import os
import sys
import uuid
import threading
import queue as thread_queue
import base64
import asyncio
from datetime import datetime
from typing import Optional
from collections import deque
from dataclasses import dataclass, field

import torch
from tqdm import tqdm

from .models import GenerationStatus, QueueItem, ProgressUpdate
from . import database
from . import openai_service

# Add src to path for heartlib imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "src"))
from heartlib import HeartMuLaGenPipeline


@dataclass
class QueueEntry:
    id: str
    title: Optional[str]
    lyrics: str
    tags: str
    max_audio_length_ms: int
    temperature: float
    topk: int
    cfg_scale: float
    status: GenerationStatus = GenerationStatus.PENDING
    progress: int = 0
    total_frames: int = 0
    created_at: datetime = field(default_factory=datetime.now)
    error_message: str = ""


class GenerationQueue:
    def __init__(self, model_path: str, version: str = "3B", use_fp16: bool = False):
        self.model_path = model_path
        self.version = version
        self.use_fp16 = use_fp16

        self.queue: deque[QueueEntry] = deque()
        self.current_entry: Optional[QueueEntry] = None
        self.cancelled_ids: set[str] = set()

        self.pipeline: Optional[HeartMuLaGenPipeline] = None
        self.model_loaded = False
        self.gpu_available = torch.cuda.is_available()
        self.gpu_name = torch.cuda.get_device_name(0) if self.gpu_available else None

        self._lock = threading.Lock()
        self._processing_thread: Optional[threading.Thread] = None
        self._running = False

        # Thread-safe queue for progress updates
        self._progress_queue: thread_queue.Queue[ProgressUpdate] = thread_queue.Queue()

        self.output_dir = os.path.join(os.path.dirname(__file__), "..", "data", "audio")
        os.makedirs(self.output_dir, exist_ok=True)

    def load_model(self):
        if self.model_loaded:
            return

        if not self.gpu_available:
            raise RuntimeError("No GPU available for model loading")

        dtype = torch.float16 if self.use_fp16 else torch.bfloat16

        self.pipeline = HeartMuLaGenPipeline.from_pretrained(
            self.model_path,
            device=torch.device("cuda"),
            dtype=dtype,
            version=self.version,
        )
        self.model_loaded = True

    def add_to_queue(
        self,
        lyrics: str,
        tags: str,
        title: Optional[str] = None,
        max_audio_length_ms: int = 120000,
        temperature: float = 1.0,
        topk: int = 50,
        cfg_scale: float = 1.5,
    ) -> str:
        entry_id = str(uuid.uuid4())
        entry = QueueEntry(
            id=entry_id,
            title=title or f"Generation {entry_id[:8]}",
            lyrics=lyrics,
            tags=tags,
            max_audio_length_ms=max_audio_length_ms,
            temperature=temperature,
            topk=topk,
            cfg_scale=cfg_scale,
            total_frames=max_audio_length_ms // 80,
        )

        with self._lock:
            self.queue.append(entry)

        self._ensure_processing()
        return entry_id

    def cancel(self, entry_id: str) -> bool:
        with self._lock:
            self.cancelled_ids.add(entry_id)
            for entry in self.queue:
                if entry.id == entry_id:
                    entry.status = GenerationStatus.CANCELLED
                    return True
            if self.current_entry and self.current_entry.id == entry_id:
                return True
        return False

    def get_queue_status(self) -> list[QueueItem]:
        items = []
        with self._lock:
            if self.current_entry:
                items.append(QueueItem(
                    id=self.current_entry.id,
                    title=self.current_entry.title,
                    status=self.current_entry.status,
                    progress=self.current_entry.progress,
                    total_frames=self.current_entry.total_frames,
                    created_at=self.current_entry.created_at,
                    lyrics=self.current_entry.lyrics,
                    tags=self.current_entry.tags,
                ))
            for entry in self.queue:
                items.append(QueueItem(
                    id=entry.id,
                    title=entry.title,
                    status=entry.status,
                    progress=entry.progress,
                    total_frames=entry.total_frames,
                    created_at=entry.created_at,
                    lyrics=entry.lyrics,
                    tags=entry.tags,
                ))
        return items

    def get_active_id(self) -> Optional[str]:
        with self._lock:
            return self.current_entry.id if self.current_entry else None

    def get_pending_updates(self) -> list[ProgressUpdate]:
        """Get all pending progress updates (non-blocking)"""
        updates = []
        while True:
            try:
                update = self._progress_queue.get_nowait()
                updates.append(update)
            except thread_queue.Empty:
                break
        return updates

    def _notify_progress(self, update: ProgressUpdate):
        """Thread-safe progress notification"""
        self._progress_queue.put(update)

    def _ensure_processing(self):
        with self._lock:
            if self._running:
                return
            self._running = True

        self._processing_thread = threading.Thread(target=self._process_loop, daemon=True)
        self._processing_thread.start()

    def _process_loop(self):
        while True:
            entry = None
            with self._lock:
                if len(self.queue) == 0:
                    self._running = False
                    return
                entry = self.queue.popleft()

                if entry.id in self.cancelled_ids:
                    self.cancelled_ids.discard(entry.id)
                    continue

                self.current_entry = entry
                entry.status = GenerationStatus.PROCESSING

            self._notify_progress(ProgressUpdate(
                id=entry.id,
                status=GenerationStatus.PROCESSING,
                progress=0,
                total_frames=entry.total_frames,
                message="Starting generation...",
            ))

            try:
                self._process_entry(entry)
            except Exception as e:
                import traceback
                traceback.print_exc()
                entry.status = GenerationStatus.FAILED
                entry.error_message = str(e)
                self._notify_progress(ProgressUpdate(
                    id=entry.id,
                    status=GenerationStatus.FAILED,
                    progress=entry.progress,
                    total_frames=entry.total_frames,
                    message=f"Error: {str(e)}",
                ))
            finally:
                with self._lock:
                    self.current_entry = None

    def _process_entry(self, entry: QueueEntry):
        if not self.model_loaded:
            self.load_model()

        output_path = os.path.join(self.output_dir, f"{entry.id}.wav")

        # Store references for the patched tqdm
        queue_ref = self
        entry_ref = entry
        last_update = [0]  # Use list to allow modification in nested function

        # Patch tqdm to capture progress
        original_tqdm_init = tqdm.__init__

        def patched_tqdm_init(self_tqdm, *args, **kwargs):
            original_tqdm_init(self_tqdm, *args, **kwargs)
            original_update = self_tqdm.update

            def patched_update(n=1):
                result = original_update(n)
                entry_ref.progress = self_tqdm.n

                if entry_ref.id in queue_ref.cancelled_ids:
                    raise InterruptedError("Generation cancelled")

                # Send update every 10 frames to avoid flooding
                if self_tqdm.n - last_update[0] >= 10 or self_tqdm.n == 1:
                    last_update[0] = self_tqdm.n
                    queue_ref._notify_progress(ProgressUpdate(
                        id=entry_ref.id,
                        status=GenerationStatus.PROCESSING,
                        progress=self_tqdm.n,
                        total_frames=entry_ref.total_frames,
                        message=f"Generating frame {self_tqdm.n}/{entry_ref.total_frames}",
                    ))
                return result

            self_tqdm.update = patched_update

        tqdm.__init__ = patched_tqdm_init

        try:
            with torch.no_grad():
                self.pipeline(
                    {
                        "lyrics": entry.lyrics,
                        "tags": entry.tags,
                    },
                    max_audio_length_ms=entry.max_audio_length_ms,
                    save_path=output_path,
                    topk=entry.topk,
                    temperature=entry.temperature,
                    cfg_scale=entry.cfg_scale,
                )

            entry.status = GenerationStatus.COMPLETED

            import soundfile as sf
            info = sf.info(output_path)
            duration_ms = int(info.duration * 1000)

            database.add_generation(
                id=entry.id,
                title=entry.title,
                lyrics=entry.lyrics,
                tags=entry.tags,
                audio_path=output_path,
                duration_ms=duration_ms,
                temperature=entry.temperature,
                topk=entry.topk,
                cfg_scale=entry.cfg_scale,
            )

            self._notify_progress(ProgressUpdate(
                id=entry.id,
                status=GenerationStatus.COMPLETED,
                progress=entry.progress,
                total_frames=entry.total_frames,
                message="Generation complete! Generating thumbnail...",
            ))

            # Generate thumbnail if OpenAI is configured
            self._generate_thumbnail(entry)

        except InterruptedError:
            entry.status = GenerationStatus.CANCELLED
            self._notify_progress(ProgressUpdate(
                id=entry.id,
                status=GenerationStatus.CANCELLED,
                progress=entry.progress,
                total_frames=entry.total_frames,
                message="Generation cancelled",
            ))
            if os.path.exists(output_path):
                os.remove(output_path)
        finally:
            tqdm.__init__ = original_tqdm_init

    def _generate_thumbnail(self, entry: QueueEntry):
        """Generate thumbnail for a completed song using OpenAI DALL-E"""
        if not openai_service.is_openai_configured():
            print("OpenAI not configured, skipping thumbnail generation")
            return

        try:
            # Run async function in a new event loop since we're in a thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                result = loop.run_until_complete(
                    openai_service.generate_thumbnail(
                        title=entry.title or f"Generation {entry.id[:8]}",
                        tags=entry.tags,
                        lyrics_preview=entry.lyrics[:200] if entry.lyrics else "",
                    )
                )

                # Save the thumbnail as a PNG file
                thumbnail_dir = os.path.join(os.path.dirname(__file__), "..", "data", "thumbnails")
                os.makedirs(thumbnail_dir, exist_ok=True)
                thumbnail_path = os.path.join(thumbnail_dir, f"{entry.id}.png")

                image_data = base64.b64decode(result.image_base64)
                with open(thumbnail_path, "wb") as f:
                    f.write(image_data)

                # Update the database with thumbnail path
                database.update_thumbnail(entry.id, thumbnail_path)
                print(f"Thumbnail generated for {entry.id}")

            finally:
                loop.close()

        except Exception as e:
            print(f"Failed to generate thumbnail: {e}")
            import traceback
            traceback.print_exc()


_queue_instance: Optional[GenerationQueue] = None


def get_queue(model_path: Optional[str] = None, version: str = "3B", use_fp16: bool = False) -> GenerationQueue:
    global _queue_instance
    if _queue_instance is None:
        if model_path is None:
            model_path = os.environ.get("HEARTMULA_MODEL_PATH", "./ckpt")
        _queue_instance = GenerationQueue(model_path, version, use_fp16)
        database.init_database()
    return _queue_instance
