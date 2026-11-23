import os
import shutil

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import SEPARATION_MODELS, settings
from ..db import get_db
from ..models import PlaylistTrack, Track, User
from ..pipeline.download import ensure_wav_source, save_upload
from ..schemas import (
    LyricsUpdate,
    ReprocessIn,
    TrackCreate,
    TrackOut,
    TracksCreate,
    TrackUpdate,
)

router = APIRouter(prefix="/api/tracks", tags=["tracks"])

_ALLOWED_UPLOAD_EXT = {
    ".mp3", ".m4a", ".wav", ".flac", ".ogg", ".aac", ".webm", ".opus",
}


def _own_track(db: Session, track_id: int, user: User) -> Track:
    track = db.get(Track, track_id)
    if track is None or track.user_id != user.id:
        raise HTTPException(status_code=404, detail="piesa inexistentă")
    return track


@router.post("", response_model=TrackOut, status_code=201)
def create_track(
    body: TrackCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = Track(
        user_id=user.id,
        youtube_url=body.youtube_url,
        status="queued",
        language=settings.WHISPER_LANGUAGE,
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    return track


@router.post("/batch", response_model=list[TrackOut], status_code=201)
def create_tracks(
    body: TracksCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    urls = [u.strip() for u in body.youtube_urls if u and u.strip()]
    tracks = [
        Track(
            user_id=user.id,
            youtube_url=u,
            status="queued",
            language=settings.WHISPER_LANGUAGE,
        )
        for u in urls
    ]
    db.add_all(tracks)
    db.commit()
    for t in tracks:
        db.refresh(t)
    return tracks


@router.post("/upload", response_model=TrackOut, status_code=201)
def upload_track(
    file: UploadFile = File(...),
    title: str = Form(""),
    artist: str = Form(""),
    remove_vocals: bool = Form(False),
    lyrics: bool = Form(True),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in _ALLOWED_UPLOAD_EXT:
        raise HTTPException(
            status_code=400,
            detail="format audio neacceptat (mp3, m4a, wav, flac, ogg, aac)",
        )

    wav_path, duration = save_upload(file, settings.MEDIA_DIR)
    title = title.strip() or os.path.splitext(file.filename or "")[0] or "Piesă încărcată"

    track = Track(
        user_id=user.id,
        title=title,
        artist=artist.strip(),
        youtube_url="",
        youtube_id="",
        source="upload",
        needs_separation=remove_vocals,
        status="queued",
        language=settings.WHISPER_LANGUAGE,
        original_path=wav_path,
        source_path=wav_path,
        instrumental_path=None if remove_vocals else wav_path,
        vocals_path=None,
        duration=duration,
        lyrics_status="pending" if lyrics else "ready",
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    return track


@router.get("", response_model=list[TrackOut])
def list_tracks(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return (
        db.query(Track)
        .filter(Track.user_id == user.id)
        .order_by(Track.id.desc())
        .all()
    )


@router.get("/{track_id}", response_model=TrackOut)
def get_track(
    track_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return _own_track(db, track_id, user)


@router.patch("/{track_id}", response_model=TrackOut)
def update_track(
    track_id: int,
    body: TrackUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = _own_track(db, track_id, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(track, field, value)
    db.commit()
    db.refresh(track)
    return track


@router.delete("/{track_id}", status_code=204)
def delete_track(
    track_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = _own_track(db, track_id, user)
    paths = [
        track.instrumental_path,
        track.original_path,
        track.vocals_path,
        track.recording_path,
    ]
    db.query(PlaylistTrack).filter(PlaylistTrack.track_id == track.id).delete(
        synchronize_session=False
    )
    db.delete(track)
    db.commit()
    for path in paths:
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass


@router.post("/{track_id}/cancel", response_model=TrackOut)
def cancel_track(
    track_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = _own_track(db, track_id, user)
    if track.status not in ("ready", "failed"):
        track.status = "failed"
        track.error = "anulat de utilizator"
        db.commit()
        db.refresh(track)
    return track


@router.post("/{track_id}/retry", response_model=TrackOut)
def retry_track(
    track_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = _own_track(db, track_id, user)
    if track.status == "failed":
        track.status = "queued"
        track.error = None
        track.error_count = 0
        db.commit()
        db.refresh(track)
    return track


@router.post("/{track_id}/reprocess", response_model=TrackOut)
def reprocess_track(
    track_id: int,
    body: ReprocessIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = _own_track(db, track_id, user)
    if not track.needs_separation:
        raise HTTPException(
            status_code=400, detail="piesa nu necesită separare (nu are voce de scos)"
        )
    if body.model not in SEPARATION_MODELS:
        raise HTTPException(status_code=400, detail="model necunoscut")

    src = ensure_wav_source(track.source_path, track.original_path)
    if not src:
        raise HTTPException(status_code=400, detail="sursa audio lipsește")

    track.source_path = src
    track.demucs_model = body.model
    track.instrumental_path = None
    track.vocals_path = None
    track.status = "queued"
    track.error = None
    db.commit()
    db.refresh(track)
    return track


_RECORDING_EXT = {
    "audio/webm": ".webm",
    "video/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/wav": ".wav",
}


@router.post("/{track_id}/recording", response_model=TrackOut)
def save_recording(
    track_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Store the user's own vocal take recorded over the instrumental."""
    track = _own_track(db, track_id, user)
    content_type = (file.content_type or "").split(";")[0].strip().lower()
    ext = _RECORDING_EXT.get(content_type, ".webm")

    os.makedirs(settings.MEDIA_DIR, exist_ok=True)
    dest = os.path.join(settings.MEDIA_DIR, f"track_{track.id}_recording{ext}")
    old = track.recording_path
    with open(dest, "wb") as out:
        shutil.copyfileobj(file.file, out)

    track.recording_path = dest
    db.commit()
    db.refresh(track)

    if old and os.path.abspath(old) != os.path.abspath(dest) and os.path.exists(old):
        try:
            os.remove(old)
        except OSError:
            pass
    return track


@router.delete("/{track_id}/recording", response_model=TrackOut)
def delete_recording(
    track_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = _own_track(db, track_id, user)
    path = track.recording_path
    track.recording_path = None
    db.commit()
    db.refresh(track)
    if path and os.path.exists(path):
        try:
            os.remove(path)
        except OSError:
            pass
    return track


@router.put("/{track_id}/lyrics", response_model=TrackOut)
def update_lyrics(
    track_id: int,
    body: LyricsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = _own_track(db, track_id, user)
    track.lyrics = [l.model_dump() for l in body.lines]
    db.commit()
    db.refresh(track)
    return track


@router.post("/{track_id}/lyrics/resync", response_model=TrackOut)
def resync_lyrics(
    track_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = _own_track(db, track_id, user)
    track.lyrics_mode = "resync"
    track.lyrics_status = "pending"
    track.error = None
    db.commit()
    db.refresh(track)
    return track


@router.post("/{track_id}/lyrics/refetch", response_model=TrackOut)
def refetch_lyrics(
    track_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = _own_track(db, track_id, user)
    track.lyrics_mode = "auto"
    track.lyrics_status = "pending"
    track.error = None
    db.commit()
    db.refresh(track)
    return track


@router.post("/{track_id}/lyrics/retry", response_model=TrackOut)
def retry_lyrics(
    track_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = _own_track(db, track_id, user)
    track.lyrics_mode = "transcribe"
    track.lyrics_status = "pending"
    track.error = None
    db.commit()
    db.refresh(track)
    return track
