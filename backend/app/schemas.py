from datetime import datetime

from pydantic import BaseModel, ConfigDict


class LoginIn(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    is_admin: bool


class TrackCreate(BaseModel):
    youtube_url: str


class TrackUpdate(BaseModel):
    title: str | None = None
    artist: str | None = None
    language: str | None = None


class LineIn(BaseModel):
    text: str
    start: float
    end: float


class LyricsUpdate(BaseModel):
    lines: list[LineIn]


class TrackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    artist: str
    youtube_url: str
    youtube_id: str
    status: str
    lyrics_status: str
    error: str | None
    duration: float | None
    lyrics: list
    lyrics_source: str | None
    musical_key: str | None
    demucs_model: str | None
    needs_separation: bool
    language: str
    created_at: datetime


class PlaylistCreate(BaseModel):
    name: str


class PlaylistUpdate(BaseModel):
    name: str


class PlaylistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    created_at: datetime


class PlaylistDetail(BaseModel):
    id: int
    user_id: int
    name: str
    created_at: datetime
    tracks: list[TrackOut]


class PlaylistTrackAdd(BaseModel):
    track_id: int


class OrderUpdate(BaseModel):
    track_ids: list[int]


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    crossfade_enabled: bool
    crossfade_seconds: float
    whisper_model: str
    demucs_model: str


class SettingsUpdate(BaseModel):
    crossfade_enabled: bool | None = None
    crossfade_seconds: float | None = None
    whisper_model: str | None = None
    demucs_model: str | None = None


class ReprocessIn(BaseModel):
    model: str


class UserCreate(BaseModel):
    username: str
    password: str
