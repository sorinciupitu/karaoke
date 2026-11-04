import time

from ..db import SessionLocal
from ..models import Track
from ..pipeline.runner import run_lyrics, run_track


def next_processing_track(session_factory=None) -> Track | None:
    """A track that still needs download/separate/encode."""
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


def next_lyrics_track(session_factory=None) -> Track | None:
    """A ready track whose lyrics still need to be transcribed/synced."""
    factory = session_factory or SessionLocal
    db = factory()
    try:
        return (
            db.query(Track)
            .filter(
                Track.status == "ready",
                Track.lyrics_status.in_(["pending", "syncing"]),
            )
            .order_by(Track.id)
            .first()
        )
    finally:
        db.close()


def _loop_processing(poll_interval: float) -> None:
    while True:
        try:
            track = next_processing_track()
            if track is not None:
                run_track(track.id)
                continue
            time.sleep(poll_interval)
        except Exception:
            time.sleep(poll_interval)


def _loop_lyrics(poll_interval: float) -> None:
    while True:
        try:
            track = next_lyrics_track()
            if track is not None:
                run_lyrics(track.id)
                continue
            time.sleep(poll_interval)
        except Exception:
            time.sleep(poll_interval)


def start_worker(poll_interval: float = 5.0) -> None:
    """Run track processing in the main thread and lyrics transcription in a
    background thread, so a slow transcription never blocks new downloads."""
    import threading

    threading.Thread(
        target=_loop_lyrics, args=(poll_interval,), daemon=True
    ).start()
    _loop_processing(poll_interval)


if __name__ == "__main__":
    start_worker()
