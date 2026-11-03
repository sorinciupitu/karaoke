import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import settings
from ..db import get_db
from ..models import PlaylistTrack, Track, User
from ..pipeline.download import save_upload
from ..schemas import LyricsUpdate, TrackCreate, TrackOut, TrackUpdate

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
    paths = [track.instrumental_path, track.original_path, track.vocals_path]
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
