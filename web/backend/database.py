import sqlite3
import os
import uuid
from datetime import datetime
from typing import Optional
from contextlib import contextmanager
from .models import HistoryItem, User

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
        # Create users table
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Create generations table
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
                cfg_scale REAL DEFAULT 1.5,
                user_id TEXT REFERENCES users(id)
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

        # Migration: add user_id column if it doesn't exist
        try:
            conn.execute("ALTER TABLE generations ADD COLUMN user_id TEXT REFERENCES users(id)")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists

        # Create index on user_id (after migration)
        try:
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_generations ON generations(user_id, created_at DESC)
            """)
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Index already exists or column doesn't exist


# User functions
def create_user(username: str, email: str, password_hash: str) -> User:
    """Create a new user."""
    user_id = str(uuid.uuid4())
    created_at = datetime.now()

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO users (id, username, email, password_hash, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, username, email.lower(), password_hash, created_at),
        )
        conn.commit()

    return User(
        id=user_id,
        username=username,
        email=email.lower(),
        created_at=created_at,
    )


def get_user_by_email(email: str) -> Optional[tuple[User, str]]:
    """Get a user by email. Returns (User, password_hash) or None."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, email, password_hash, created_at FROM users WHERE email = ?",
            (email.lower(),),
        ).fetchone()

        if row:
            user = User(
                id=row["id"],
                username=row["username"],
                email=row["email"],
                created_at=datetime.fromisoformat(row["created_at"]) if isinstance(row["created_at"], str) else row["created_at"],
            )
            return user, row["password_hash"]
        return None


def get_user_by_id(user_id: str) -> Optional[User]:
    """Get a user by ID."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, email, created_at FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()

        if row:
            return User(
                id=row["id"],
                username=row["username"],
                email=row["email"],
                created_at=datetime.fromisoformat(row["created_at"]) if isinstance(row["created_at"], str) else row["created_at"],
            )
        return None


def get_user_by_username(username: str) -> Optional[User]:
    """Get a user by username."""
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, email, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()

        if row:
            return User(
                id=row["id"],
                username=row["username"],
                email=row["email"],
                created_at=datetime.fromisoformat(row["created_at"]) if isinstance(row["created_at"], str) else row["created_at"],
            )
        return None


def user_exists(email: str = None, username: str = None) -> bool:
    """Check if a user exists with the given email or username."""
    with get_connection() as conn:
        if email:
            row = conn.execute("SELECT 1 FROM users WHERE email = ?", (email.lower(),)).fetchone()
            if row:
                return True
        if username:
            row = conn.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone()
            if row:
                return True
        return False


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
    user_id: Optional[str] = None,
) -> HistoryItem:
    created_at = datetime.now()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO generations (id, title, lyrics, tags, audio_path, thumbnail_path, created_at, duration_ms, temperature, topk, cfg_scale, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (id, title, lyrics, tags, audio_path, thumbnail_path, created_at, duration_ms, temperature, topk, cfg_scale, user_id),
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
        user_id=user_id,
    )


def update_thumbnail(id: str, thumbnail_path: str) -> bool:
    with get_connection() as conn:
        cursor = conn.execute(
            "UPDATE generations SET thumbnail_path = ? WHERE id = ?",
            (thumbnail_path, id),
        )
        conn.commit()
        return cursor.rowcount > 0


def get_generations(page: int = 1, page_size: int = 20, search: Optional[str] = None, user_id: Optional[str] = None) -> tuple[list[HistoryItem], int]:
    offset = (page - 1) * page_size

    with get_connection() as conn:
        # Build query based on filters
        base_where = "WHERE user_id = ?" if user_id else ""
        params = [user_id] if user_id else []

        if search:
            search_pattern = f"%{search}%"
            search_clause = "(title LIKE ? OR lyrics LIKE ? OR tags LIKE ?)"
            if base_where:
                where_clause = f"{base_where} AND {search_clause}"
            else:
                where_clause = f"WHERE {search_clause}"
            params.extend([search_pattern, search_pattern, search_pattern])

            count_row = conn.execute(
                f"SELECT COUNT(*) FROM generations {where_clause}",
                params,
            ).fetchone()
            rows = conn.execute(
                f"""
                SELECT * FROM generations
                {where_clause}
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                """,
                params + [page_size, offset],
            ).fetchall()
        else:
            count_row = conn.execute(
                f"SELECT COUNT(*) FROM generations {base_where}",
                params,
            ).fetchone()
            rows = conn.execute(
                f"SELECT * FROM generations {base_where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                params + [page_size, offset],
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
                user_id=row["user_id"] if "user_id" in row.keys() else None,
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
                user_id=row["user_id"] if "user_id" in row.keys() else None,
            )
        return None


def delete_generation(id: str, user_id: Optional[str] = None) -> bool:
    """Delete a generation. If user_id is provided, only delete if owned by that user."""
    with get_connection() as conn:
        if user_id:
            row = conn.execute(
                "SELECT audio_path, thumbnail_path FROM generations WHERE id = ? AND user_id = ?",
                (id, user_id),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT audio_path, thumbnail_path FROM generations WHERE id = ?",
                (id,),
            ).fetchone()

        if row:
            audio_path = row["audio_path"]
            thumbnail_path = row["thumbnail_path"]
            if audio_path and os.path.exists(audio_path):
                os.remove(audio_path)
            if thumbnail_path and os.path.exists(thumbnail_path):
                os.remove(thumbnail_path)

            if user_id:
                conn.execute("DELETE FROM generations WHERE id = ? AND user_id = ?", (id, user_id))
            else:
                conn.execute("DELETE FROM generations WHERE id = ?", (id,))
            conn.commit()
            return True
        return False
