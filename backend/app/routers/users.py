from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..auth import hash_password, require_admin
from ..db import get_db
from ..models import Playlist, PlaylistTrack, Track, User, UserSettings
from ..schemas import UserCreate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db), _admin: User = Depends(require_admin)
):
    return db.query(User).order_by(User.id).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="nume deja folosit")
    u = User(username=body.username, password_hash=hash_password(body.password))
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="nu te poți șterge pe tine însuți")
    u = db.get(User, user_id)
    if u is None:
        raise HTTPException(status_code=404, detail="utilizator inexistent")

    playlist_ids = [p.id for p in db.query(Playlist).filter(Playlist.user_id == user_id)]
    if playlist_ids:
        db.query(PlaylistTrack).filter(
            PlaylistTrack.playlist_id.in_(playlist_ids)
        ).delete(synchronize_session=False)
    db.query(Playlist).filter(Playlist.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Track).filter(Track.user_id == user_id).delete(synchronize_session=False)
    db.query(UserSettings).filter(UserSettings.user_id == user_id).delete(
        synchronize_session=False
    )
    db.delete(u)
    db.commit()
