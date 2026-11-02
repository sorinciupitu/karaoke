import time

from sqlalchemy import and_, or_

from ..db import SessionLocal
from ..models import Track
from ..pipeline.runner import run_lyrics, run_track


def next_pending_track(session_factory=None) -> Track | None:
    factory = session_factory or SessionLocal
    db = factory()
    try:
        return (
            db.query(Track)
            .filter(
                or_(
                    Track.status.notin_(["ready", "failed"]),
                    and_(
                        Track.status == "ready",
                        Track.lyrics_status.in_(["pending", "syncing"]),
                    ),
                )
            )
            .order_by(Track.id)
            .first()
        )
    finally:
        db.close()


def start_worker(poll_interval: float = 5.0) -> None:
    while True:
        try:
            track = next_pending_track()
            if track is not None:
                if track.status == "ready":
                    run_lyrics(track.id)
                else:
                    run_track(track.id)
                continue
            time.sleep(poll_interval)
        except Exception:
            time.sleep(poll_interval)


if __name__ == "__main__":
    start_worker()
