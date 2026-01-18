import os
import asyncio
import sqlite3
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect, Query, BackgroundTasks, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    GenerationRequest,
    GenerationResponse,
    GenerationStatus,
    QueueStatus,
    HistoryResponse,
    HistoryItem,
    ProgressUpdate,
    SystemStatus,
    AILyricsRequest,
    AILyricsResponse,
    AIThumbnailRequest,
    AIThumbnailResponse,
    UserCreate,
    UserLogin,
    User,
    Token,
    AuthResponse,
)
from .queue import get_queue, GenerationQueue
from . import database
from . import openai_service
from .auth import (
    get_current_user,
    get_current_user_optional,
    create_access_token,
    get_password_hash,
    verify_password,
)


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()
queue: Optional[GenerationQueue] = None
progress_task: Optional[asyncio.Task] = None


async def progress_broadcaster():
    """Background task to broadcast progress updates from the queue"""
    global queue
    while True:
        try:
            if queue and manager.active_connections:
                updates = queue.get_pending_updates()
                for update in updates:
                    await manager.broadcast(update.model_dump())
            await asyncio.sleep(0.1)  # Check every 100ms
        except Exception as e:
            print(f"Progress broadcaster error: {e}")
            await asyncio.sleep(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global queue, progress_task
    model_path = os.environ.get("HEARTMULA_MODEL_PATH", "./ckpt")
    version = os.environ.get("HEARTMULA_VERSION", "3B")
    use_fp16 = os.environ.get("HEARTMULA_FP16", "false").lower() == "true"

    queue = get_queue(model_path, version, use_fp16)
    database.init_database()

    # Start progress broadcaster
    progress_task = asyncio.create_task(progress_broadcaster())

    yield

    # Cleanup
    if progress_task:
        progress_task.cancel()
        try:
            await progress_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="HeartMuLa Web API",
    description="Web API for HeartMuLa music generation",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Auth endpoints
@app.post("/api/auth/register", response_model=AuthResponse)
async def register(user_data: UserCreate):
    """Register a new user."""
    # Check if user already exists
    if database.user_exists(email=user_data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    if database.user_exists(username=user_data.username):
        raise HTTPException(status_code=400, detail="Username already taken")

    # Create user
    try:
        password_hash = get_password_hash(user_data.password)
        user = database.create_user(
            username=user_data.username,
            email=user_data.email,
            password_hash=password_hash,
        )
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="User already exists")

    # Generate token
    access_token = create_access_token(data={"sub": user.id})
    return AuthResponse(
        user=user,
        token=Token(access_token=access_token),
    )


@app.post("/api/auth/login", response_model=AuthResponse)
async def login(credentials: UserLogin):
    """Login and get an access token."""
    result = database.get_user_by_email(credentials.email)
    if not result:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user, password_hash = result
    if not verify_password(credentials.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(data={"sub": user.id})
    return AuthResponse(
        user=user,
        token=Token(access_token=access_token),
    )


@app.get("/api/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get the current authenticated user."""
    return current_user


@app.get("/api/status", response_model=SystemStatus)
async def get_status():
    return SystemStatus(
        gpu_available=queue.gpu_available,
        gpu_name=queue.gpu_name,
        model_loaded=queue.model_loaded,
        queue_length=len(queue.queue) + (1 if queue.current_entry else 0),
        openai_configured=openai_service.is_openai_configured(),
    )


@app.post("/api/generate", response_model=GenerationResponse)
async def generate(
    request: GenerationRequest,
    current_user: User = Depends(get_current_user),
):
    if not queue.gpu_available:
        raise HTTPException(status_code=503, detail="No GPU available for generation")

    entry_id = queue.add_to_queue(
        lyrics=request.lyrics,
        tags=request.tags,
        title=request.title,
        max_audio_length_ms=request.max_audio_length_ms,
        temperature=request.temperature,
        topk=request.topk,
        cfg_scale=request.cfg_scale,
        user_id=current_user.id,
    )

    return GenerationResponse(
        id=entry_id,
        status=GenerationStatus.PENDING,
        message="Generation added to queue",
    )


@app.get("/api/queue", response_model=QueueStatus)
async def get_queue_status(
    current_user: User = Depends(get_current_user),
):
    # Filter queue items by user_id
    all_items = queue.get_queue_status()
    user_items = [item for item in all_items if queue.get_entry_user_id(item.id) == current_user.id]
    active_id = queue.get_active_id()
    # Only show active_id if it belongs to current user
    if active_id and queue.get_entry_user_id(active_id) != current_user.id:
        active_id = None
    return QueueStatus(
        items=user_items,
        active_id=active_id,
    )


@app.delete("/api/queue/{entry_id}")
async def cancel_generation(
    entry_id: str,
    current_user: User = Depends(get_current_user),
):
    # Check if entry belongs to current user
    if queue.get_entry_user_id(entry_id) != current_user.id:
        raise HTTPException(status_code=403, detail="You can only cancel your own generations")
    if queue.cancel(entry_id):
        return {"message": "Generation cancelled"}
    raise HTTPException(status_code=404, detail="Entry not found in queue")


@app.get("/api/history", response_model=HistoryResponse)
async def get_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    items, total = database.get_generations(page, page_size, search, user_id=current_user.id)
    return HistoryResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@app.get("/api/history/{entry_id}", response_model=HistoryItem)
async def get_history_item(
    entry_id: str,
    current_user: User = Depends(get_current_user),
):
    item = database.get_generation_by_id(entry_id)
    if not item:
        raise HTTPException(status_code=404, detail="Generation not found")
    # Check ownership
    if item.user_id and item.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return item


@app.delete("/api/history/{entry_id}")
async def delete_history_item(
    entry_id: str,
    current_user: User = Depends(get_current_user),
):
    if database.delete_generation(entry_id, user_id=current_user.id):
        return {"message": "Generation deleted"}
    raise HTTPException(status_code=404, detail="Generation not found or access denied")


@app.get("/api/audio/{entry_id}")
async def get_audio(entry_id: str):
    item = database.get_generation_by_id(entry_id)
    if not item:
        raise HTTPException(status_code=404, detail="Generation not found")

    if not os.path.exists(item.audio_path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(
        item.audio_path,
        media_type="audio/wav",
        filename=f"{item.title or entry_id}.wav",
    )


@app.get("/api/thumbnail/{entry_id}")
async def get_thumbnail(entry_id: str):
    item = database.get_generation_by_id(entry_id)
    if not item:
        raise HTTPException(status_code=404, detail="Generation not found")

    if not item.thumbnail_path or not os.path.exists(item.thumbnail_path):
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    return FileResponse(
        item.thumbnail_path,
        media_type="image/png",
        filename=f"{item.title or entry_id}.png",
    )


@app.post("/api/ai/lyrics", response_model=AILyricsResponse)
async def generate_ai_lyrics(request: AILyricsRequest):
    """Generate lyrics, title, and tags using OpenAI."""
    if not openai_service.is_openai_configured():
        raise HTTPException(status_code=503, detail="OpenAI API not configured. Set OPENAI_API_KEY environment variable.")

    try:
        result = await openai_service.generate_lyrics(request.prompt, request.language)
        return AILyricsResponse(
            title=result.title,
            tags=result.tags,
            lyrics=result.lyrics,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/ai/thumbnail", response_model=AIThumbnailResponse)
async def generate_ai_thumbnail(request: AIThumbnailRequest):
    """Generate a thumbnail image using DALL-E."""
    if not openai_service.is_openai_configured():
        raise HTTPException(status_code=503, detail="OpenAI API not configured. Set OPENAI_API_KEY environment variable.")

    try:
        result = await openai_service.generate_thumbnail(
            title=request.title,
            tags=request.tags,
            lyrics_preview=request.lyrics_preview,
            style=request.style,
        )
        return AIThumbnailResponse(
            image_base64=result.image_base64,
            prompt_used=result.prompt_used,
        )
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/progress")
async def websocket_progress(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if data == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                # Send ping to keep connection alive
                try:
                    await websocket.send_text("ping")
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
