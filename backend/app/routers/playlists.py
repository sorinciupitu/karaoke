from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..models import Playlist, PlaylistTrack, Track, User
from ..schemas import (
    OrderUpdate,
    PlaylistCreate,
    PlaylistDetail,
    PlaylistOut,
    PlaylistTrackAdd,
    PlaylistUpdate,
    TrackOut,
)

router = APIRouter(prefix="/api/playlists", tags=["playlists"])


def _own_playlist(db: Session, playlist_id: int, user: User) -> Playlist:
    p = db.get(Playlist, playlist_id)
    if p is None or p.user_id != user.id:
        raise HTTPException(status_code=404, detail="playlist inexistent")
    return p


def _playlist_detail(db: Session, p: Playlist) -> dict:
    rows = (
        db.query(PlaylistTrack, Track)
        .join(Track, PlaylistTrack.track_id == Track.id)
        .filter(PlaylistTrack.playlist_id == p.id)
        .order_by(PlaylistTrack.position)
        .all()
    )
    return {
        "id": p.id,
        "user_id": p.user_id,
        "name": p.name,
        "created_at": p.created_at,
        "tracks": [TrackOut.model_validate(t) for _, t in rows],
    }


@router.post("", response_model=PlaylistOut, status_code=201)
def create_playlist(
    body: PlaylistCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = Playlist(user_id=user.id, name=body.name)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("", response_model=list[PlaylistOut])
def list_playlists(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    return (
        db.query(Playlist)
        .filter(Playlist.user_id == user.id)
        .order_by(Playlist.id)
        .all()
    )


@router.get("/{playlist_id}", response_model=PlaylistDetail)
def get_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = _own_playlist(db, playlist_id, user)
    return _playlist_detail(db, p)


@router.patch("/{playlist_id}", response_model=PlaylistOut)
def update_playlist(
    playlist_id: int,
    body: PlaylistUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = _own_playlist(db, playlist_id, user)
    p.name = body.name
    db.commit()
    db.refresh(p)
    return p


@router.delete("/{playlist_id}", status_code=204)
def delete_playlist(
    playlist_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = _own_playlist(db, playlist_id, user)
    db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == p.id).delete(
        synchronize_session=False
    )
    db.delete(p)
    db.commit()


@router.post("/{playlist_id}/tracks", response_model=PlaylistDetail)
def add_track(
    playlist_id: int,
    body: PlaylistTrackAdd,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = _own_playlist(db, playlist_id, user)
    track = db.get(Track, body.track_id)
    if track is None or track.user_id != user.id:
        raise HTTPException(status_code=404, detail="piesa inexistentă")

    existing = (
        db.query(PlaylistTrack)
        .filter(PlaylistTrack.playlist_id == p.id, PlaylistTrack.track_id == track.id)
        .first()
    )
    if existing is None:
        max_pos = (
            db.query(PlaylistTrack.position)
            .filter(PlaylistTrack.playlist_id == p.id)
            .order_by(PlaylistTrack.position.desc())
            .first()
        )
        next_pos = (max_pos[0] if max_pos else 0.0) + 1.0
        db.add(PlaylistTrack(playlist_id=p.id, track_id=track.id, position=next_pos))
        db.commit()

    return _playlist_detail(db, p)


@router.delete("/{playlist_id}/tracks/{track_id}", response_model=PlaylistDetail)
def remove_track(
    playlist_id: int,
    track_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = _own_playlist(db, playlist_id, user)
    db.query(PlaylistTrack).filter(
        PlaylistTrack.playlist_id == p.id, PlaylistTrack.track_id == track_id
    ).delete(synchronize_session=False)
    db.commit()
    return _playlist_detail(db, p)


@router.put("/{playlist_id}/tracks/order", response_model=PlaylistDetail)
def reorder_tracks(
    playlist_id: int,
    body: OrderUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    p = _own_playlist(db, playlist_id, user)
    ids = body.track_ids

    if not ids:
        raise HTTPException(status_code=422, detail="lista goală")
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=422, detail="id-uri duplicate")

    pts = db.query(PlaylistTrack).filter(PlaylistTrack.playlist_id == p.id).all()
    existing = {pt.track_id: pt for pt in pts}
    if set(ids) != set(existing):
        raise HTTPException(status_code=422, detail="lista nu corespunde piesele playlistului")

    for idx, tid in enumerate(ids):
        existing[tid].position = float(idx)
    db.commit()

    return _playlist_detail(db, p)
