import io
import json
import os
import uuid
import zipfile

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..config import settings
from ..db import get_db
from ..models import Track, User

router = APIRouter(prefix="/api/backup", tags=["backup"])

_STREAMS = ("instrumental", "original", "vocals")


def _manifest(track: Track) -> dict:
    files = {}
    for kind in _STREAMS:
        path = getattr(track, f"{kind}_path")
        if path and os.path.exists(path):
            files[kind] = os.path.basename(path)
    return {
        "title": track.title,
        "artist": track.artist,
        "duration": track.duration,
        "status": track.status,
        "lyrics_status": track.lyrics_status,
        "lyrics": track.lyrics,
        "lyrics_source": track.lyrics_source,
        "musical_key": track.musical_key,
        "language": track.language,
        "source": track.source,
        "needs_separation": track.needs_separation,
        "files": files,
    }


@router.get("")
def export_backup(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Download a ZIP of the user's processed tracks, audio files and lyrics."""
    tracks = (
        db.query(Track)
        .filter(Track.user_id == user.id, Track.status == "ready")
        .order_by(Track.id)
        .all()
    )

    buf = io.BytesIO()
    manifest_tracks = []
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for track in tracks:
            m = _manifest(track)
            for kind in _STREAMS:
                name = m["files"].get(kind)
                if not name:
                    continue
                zf.write(getattr(track, f"{kind}_path"), arcname=f"media/{name}")
            manifest_tracks.append(m)
        zf.writestr(
            "manifest.json",
            json.dumps(
                {"version": 1, "tracks": manifest_tracks}, ensure_ascii=False
            ),
        )

    buf.seek(0)
    return Response(
        content=buf.read(),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="karaoke-backup.zip"'
        },
    )


@router.post("/import")
def import_backup(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Restore tracks from a previously downloaded backup ZIP."""
    data = file.file.read()
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="fișier backup invalid")

    try:
        manifest = json.loads(zf.read("manifest.json"))
    except (KeyError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="manifest lipsă din backup")

    os.makedirs(settings.MEDIA_DIR, exist_ok=True)
    count = 0
    for mt in manifest.get("tracks", []):
        files = mt.get("files") or {}
        paths: dict[str, str | None] = {}
        for kind in _STREAMS:
            name = files.get(kind)
            if not name:
                continue
            try:
                raw = zf.read(f"media/{name}")
            except KeyError:
                continue
            ext = os.path.splitext(name)[1] or ".m4a"
            new_name = f"restored_{uuid.uuid4().hex}{ext}"
            with open(os.path.join(settings.MEDIA_DIR, new_name), "wb") as f:
                f.write(raw)
            paths[kind] = os.path.join(settings.MEDIA_DIR, new_name)

        track = Track(
            user_id=user.id,
            title=mt.get("title", ""),
            artist=mt.get("artist", ""),
            youtube_url="",
            youtube_id="",
            status="ready",
            lyrics_status=mt.get("lyrics_status", "ready"),
            duration=mt.get("duration"),
            lyrics=mt.get("lyrics") or [],
            lyrics_source=mt.get("lyrics_source"),
            musical_key=mt.get("musical_key"),
            language=mt.get("language", "ro"),
            source=mt.get("source", "upload"),
            needs_separation=bool(mt.get("needs_separation", False)),
            instrumental_path=paths.get("instrumental"),
            original_path=paths.get("original"),
            vocals_path=paths.get("vocals"),
        )
        db.add(track)
        count += 1
    db.commit()
    return {"imported": count}
