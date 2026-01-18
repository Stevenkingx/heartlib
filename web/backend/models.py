from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
from datetime import datetime


class GenerationStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class GenerationRequest(BaseModel):
    lyrics: str = Field(..., description="Song lyrics")
    tags: str = Field(..., description="Music tags (genre, mood, instruments)")
    title: Optional[str] = Field(None, description="Optional title for the generation")
    max_audio_length_ms: int = Field(120000, ge=10000, le=240000, description="Max audio length in milliseconds")
    temperature: float = Field(1.0, ge=0.1, le=2.0, description="Sampling temperature")
    topk: int = Field(50, ge=1, le=500, description="Top-k sampling parameter")
    cfg_scale: float = Field(1.5, ge=1.0, le=5.0, description="Classifier-free guidance scale")


class GenerationResponse(BaseModel):
    id: str
    status: GenerationStatus
    message: str


class QueueItem(BaseModel):
    id: str
    title: Optional[str]
    status: GenerationStatus
    progress: int = 0
    total_frames: int = 0
    created_at: datetime
    lyrics: str
    tags: str


class QueueStatus(BaseModel):
    items: list[QueueItem]
    active_id: Optional[str] = None


class HistoryItem(BaseModel):
    id: str
    title: Optional[str]
    lyrics: str
    tags: str
    audio_path: str
    created_at: datetime
    duration_ms: int
    temperature: float
    topk: int
    cfg_scale: float


class HistoryResponse(BaseModel):
    items: list[HistoryItem]
    total: int
    page: int
    page_size: int


class ProgressUpdate(BaseModel):
    id: str
    status: GenerationStatus
    progress: int
    total_frames: int
    message: str = ""


class SystemStatus(BaseModel):
    gpu_available: bool
    gpu_name: Optional[str]
    model_loaded: bool
    queue_length: int
