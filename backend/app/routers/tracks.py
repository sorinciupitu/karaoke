from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import settings
from ..db import get_db
from ..models import Track, User
from ..pipeline.runner import schedule_lyrics_job
from ..schemas import LyricsUpdate, TrackCreate, TrackOut, TrackUpdate

router = APIRouter(prefix="/api/tracks", tags=["tracks"])


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
    db.delete(track)
    db.commit()


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
    track.status = "queued"
    track.error = None
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
    track.lyrics_status = "pending"
    db.commit()
    schedule_lyrics_job(track.id, "resync")
    db.refresh(track)
    return track


@router.post("/{track_id}/lyrics/refetch", response_model=TrackOut)
def refetch_lyrics(
    track_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = _own_track(db, track_id, user)
    track.lyrics_status = "pending"
    db.commit()
    schedule_lyrics_job(track.id, "auto")
    db.refresh(track)
    return track


@router.post("/{track_id}/lyrics/retry", response_model=TrackOut)
def retry_lyrics(
    track_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    track = _own_track(db, track_id, user)
    track.lyrics_status = "pending"
    db.commit()
    schedule_lyrics_job(track.id, "transcribe")
    db.refresh(track)
    return track
