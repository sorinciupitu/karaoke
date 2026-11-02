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
    language: str
    created_at: datetime
