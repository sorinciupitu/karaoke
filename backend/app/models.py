from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Track(Base):
    __tablename__ = "tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(512), default="")
    artist: Mapped[str] = mapped_column(String(512), default="")
    youtube_url: Mapped[str] = mapped_column(String(1024))
    youtube_id: Mapped[str] = mapped_column(String(64), default="", index=True)
    status: Mapped[str] = mapped_column(String(32), default="queued")
    lyrics_status: Mapped[str] = mapped_column(String(32), default="pending")
    error: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)
    instrumental_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    original_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    vocals_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    source_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    demucs_model: Mapped[str | None] = mapped_column(String(32), nullable=True)
    lyrics: Mapped[list] = mapped_column(JSON, default=list)
    lyrics_source: Mapped[str | None] = mapped_column(String(32), nullable=True)
    lyrics_mode: Mapped[str | None] = mapped_column(String(32), nullable=True)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    musical_key: Mapped[str | None] = mapped_column(String(32), nullable=True)
    language: Mapped[str] = mapped_column(String(16), default="ro")
    source: Mapped[str] = mapped_column(String(16), default="youtube")
    needs_separation: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Playlist(Base):
    __tablename__ = "playlists"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class PlaylistTrack(Base):
    __tablename__ = "playlist_tracks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    playlist_id: Mapped[int] = mapped_column(ForeignKey("playlists.id"), index=True)
    track_id: Mapped[int] = mapped_column(ForeignKey("tracks.id"), index=True)
    position: Mapped[float] = mapped_column(Float, default=0.0)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class UserSettings(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    crossfade_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    crossfade_seconds: Mapped[float] = mapped_column(Float, default=5.0)
    whisper_model: Mapped[str] = mapped_column(String(32), default="medium")
    demucs_model: Mapped[str] = mapped_column(String(32), default="htdemucs")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
