import time

from ..db import SessionLocal
from ..models import Track
from ..pipeline.runner import run_track


def next_pending_track(session_factory=None) -> Track | None:
    factory = session_factory or SessionLocal
    db = factory()
    try:
        return (
            db.query(Track)
            .filter(Track.status.notin_(["ready", "failed"]))
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
                run_track(track.id)
                continue
            time.sleep(poll_interval)
        except Exception:
            time.sleep(poll_interval)


if __name__ == "__main__":
    start_worker()
