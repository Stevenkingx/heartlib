import os
import sys
import uuid
import threading
import asyncio
from datetime import datetime
from typing import Optional, Callable
from collections import deque
from dataclasses import dataclass, field

import torch
from tqdm import tqdm

from .models import GenerationStatus, QueueItem, ProgressUpdate
from . import database

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

        self._progress_callbacks: list[Callable[[ProgressUpdate], None]] = []
        self._async_callbacks: list[Callable[[ProgressUpdate], asyncio.Future]] = []

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

    def add_progress_callback(self, callback: Callable[[ProgressUpdate], None]):
        self._progress_callbacks.append(callback)

    def add_async_callback(self, callback: Callable[[ProgressUpdate], asyncio.Future]):
        self._async_callbacks.append(callback)

    def remove_callback(self, callback):
        if callback in self._progress_callbacks:
            self._progress_callbacks.remove(callback)
        if callback in self._async_callbacks:
            self._async_callbacks.remove(callback)

    def _notify_progress(self, update: ProgressUpdate):
        for callback in self._progress_callbacks:
            try:
                callback(update)
            except Exception:
                pass

        for callback in self._async_callbacks:
            try:
                asyncio.run_coroutine_threadsafe(
                    callback(update),
                    asyncio.get_event_loop()
                )
            except Exception:
                pass

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

        original_tqdm = tqdm.__init__
        queue_ref = self
        entry_ref = entry

        def patched_tqdm_init(self_tqdm, *args, **kwargs):
            original_tqdm(self_tqdm, *args, **kwargs)
            original_update = self_tqdm.update

            def patched_update(n=1):
                result = original_update(n)
                entry_ref.progress = self_tqdm.n

                if entry_ref.id in queue_ref.cancelled_ids:
                    raise InterruptedError("Generation cancelled")

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
                message="Generation complete!",
            ))

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
            tqdm.__init__ = original_tqdm


_queue_instance: Optional[GenerationQueue] = None


def get_queue(model_path: Optional[str] = None, version: str = "3B", use_fp16: bool = False) -> GenerationQueue:
    global _queue_instance
    if _queue_instance is None:
        if model_path is None:
            model_path = os.environ.get("HEARTMULA_MODEL_PATH", "./ckpt")
        _queue_instance = GenerationQueue(model_path, version, use_fp16)
        database.init_database()
    return _queue_instance
