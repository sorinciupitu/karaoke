from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..db import get_db
from ..media import build_media_response, get_pitched_path
from ..models import Track, User

router = APIRouter(prefix="/media", tags=["media"])

_STREAMS = {
    "instrumental": "instrumental_path",
    "original": "original_path",
    "vocals": "vocals_path",
}


@router.get("/{track_id}/{stream}")
def get_media(
    track_id: int,
    stream: str,
    request: Request,
    pitch: int = Query(0, ge=-6, le=6),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if stream not in _STREAMS:
        raise HTTPException(status_code=404, detail="flux inexistent")

    track = db.get(Track, track_id)
    if track is None or track.user_id != user.id:
        raise HTTPException(status_code=404, detail="piesa inexistentă")

    path = getattr(track, _STREAMS[stream])
    if not path:
        raise HTTPException(status_code=404, detail="fișier indisponibil")

    if stream in ("instrumental", "original") and pitch:
        path = get_pitched_path(path, pitch)

    return build_media_response(path, request.headers.get("range"))
