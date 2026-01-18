import sqlite3
import os
from datetime import datetime
from typing import Optional
from contextlib import contextmanager
from .models import HistoryItem

DATABASE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "heartmula.db")


def get_database_path() -> str:
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    return DATABASE_PATH


@contextmanager
def get_connection():
    conn = sqlite3.connect(get_database_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_database():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS generations (
                id TEXT PRIMARY KEY,
                title TEXT,
                lyrics TEXT NOT NULL,
                tags TEXT NOT NULL,
                audio_path TEXT NOT NULL,
                thumbnail_path TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                duration_ms INTEGER DEFAULT 0,
                temperature REAL DEFAULT 1.0,
                topk INTEGER DEFAULT 50,
                cfg_scale REAL DEFAULT 1.5
            )
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_created_at ON generations(created_at DESC)
        """)
        conn.commit()

        # Migration: add thumbnail_path column if it doesn't exist
        try:
            conn.execute("ALTER TABLE generations ADD COLUMN thumbnail_path TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists


def add_generation(
    id: str,
    title: Optional[str],
    lyrics: str,
    tags: str,
    audio_path: str,
    duration_ms: int,
    temperature: float,
    topk: int,
    cfg_scale: float,
    thumbnail_path: Optional[str] = None,
) -> HistoryItem:
    created_at = datetime.now()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO generations (id, title, lyrics, tags, audio_path, thumbnail_path, created_at, duration_ms, temperature, topk, cfg_scale)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (id, title, lyrics, tags, audio_path, thumbnail_path, created_at, duration_ms, temperature, topk, cfg_scale),
        )
        conn.commit()

    return HistoryItem(
        id=id,
        title=title,
        lyrics=lyrics,
        tags=tags,
        audio_path=audio_path,
        thumbnail_path=thumbnail_path,
        created_at=created_at,
        duration_ms=duration_ms,
        temperature=temperature,
        topk=topk,
        cfg_scale=cfg_scale,
    )


def update_thumbnail(id: str, thumbnail_path: str) -> bool:
    with get_connection() as conn:
        cursor = conn.execute(
            "UPDATE generations SET thumbnail_path = ? WHERE id = ?",
            (thumbnail_path, id),
        )
        conn.commit()
        return cursor.rowcount > 0


def get_generations(page: int = 1, page_size: int = 20, search: Optional[str] = None) -> tuple[list[HistoryItem], int]:
    offset = (page - 1) * page_size

    with get_connection() as conn:
        if search:
            search_pattern = f"%{search}%"
            count_row = conn.execute(
                "SELECT COUNT(*) FROM generations WHERE title LIKE ? OR lyrics LIKE ? OR tags LIKE ?",
                (search_pattern, search_pattern, search_pattern),
            ).fetchone()
            rows = conn.execute(
                """
                SELECT * FROM generations
                WHERE title LIKE ? OR lyrics LIKE ? OR tags LIKE ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                """,
                (search_pattern, search_pattern, search_pattern, page_size, offset),
            ).fetchall()
        else:
            count_row = conn.execute("SELECT COUNT(*) FROM generations").fetchone()
            rows = conn.execute(
                "SELECT * FROM generations ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (page_size, offset),
            ).fetchall()

        total = count_row[0]
        items = [
            HistoryItem(
                id=row["id"],
                title=row["title"],
                lyrics=row["lyrics"],
                tags=row["tags"],
                audio_path=row["audio_path"],
                thumbnail_path=row["thumbnail_path"],
                created_at=datetime.fromisoformat(row["created_at"]) if isinstance(row["created_at"], str) else row["created_at"],
                duration_ms=row["duration_ms"],
                temperature=row["temperature"],
                topk=row["topk"],
                cfg_scale=row["cfg_scale"],
            )
            for row in rows
        ]

        return items, total


def get_generation_by_id(id: str) -> Optional[HistoryItem]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM generations WHERE id = ?", (id,)).fetchone()
        if row:
            return HistoryItem(
                id=row["id"],
                title=row["title"],
                lyrics=row["lyrics"],
                tags=row["tags"],
                audio_path=row["audio_path"],
                thumbnail_path=row["thumbnail_path"],
                created_at=datetime.fromisoformat(row["created_at"]) if isinstance(row["created_at"], str) else row["created_at"],
                duration_ms=row["duration_ms"],
                temperature=row["temperature"],
                topk=row["topk"],
                cfg_scale=row["cfg_scale"],
            )
        return None


def delete_generation(id: str) -> bool:
    with get_connection() as conn:
        row = conn.execute("SELECT audio_path, thumbnail_path FROM generations WHERE id = ?", (id,)).fetchone()
        if row:
            audio_path = row["audio_path"]
            thumbnail_path = row["thumbnail_path"]
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
            if thumbnail_path and os.path.exists(thumbnail_path):
                os.remove(thumbnail_path)
            conn.execute("DELETE FROM generations WHERE id = ?", (id,))
            conn.commit()
            return True
        return False
