from ..config import settings
from ..db import SessionLocal
from ..models import Track
from .download import download
from .encode import encode_to_m4a
from .lyrics import group_words
from .separate import separate
from .transcribe import fetch_lrclib, transcribe


def _lines_to_json(lines) -> list[dict]:
    return [{"text": l.text, "start": l.start, "end": l.end} for l in lines]


def run_track(track_id: int, session_factory=None) -> None:
    factory = session_factory or SessionLocal
    db = factory()
    try:
        track = db.get(Track, track_id)
        if track is None or track.status in ("ready", "failed"):
            return

        # 1. download
        if not track.original_path:
            track.status = "downloading"
            db.commit()
            try:
                res = download(track.youtube_url, settings.MEDIA_DIR)
            except Exception as e:
                track.status = "failed"
                track.error = f"descărcare: {e}"
                db.commit()
                return
            track.original_path = res.original_path
            track.title = res.title
            track.artist = res.artist
            track.duration = res.duration
            track.youtube_id = res.youtube_id
            db.commit()

        # 2. separate
        if not track.instrumental_path or not track.vocals_path:
            track.status = "separating"
            db.commit()
            try:
                res = separate(
                    track.original_path, settings.MEDIA_DIR, settings.MODELS_DIR
                )
            except Exception as e:
                track.status = "failed"
                track.error = f"separare: {e}"
                db.commit()
                return
            track.instrumental_path = res.instrumental_path
            track.vocals_path = res.vocals_path
            db.commit()

        # 3. lyrics (independent: failure does not fail the track)
        if track.lyrics_status == "pending":
            track.lyrics_status = "syncing"
            db.commit()
            try:
                lines = fetch_lrclib(track.title, track.artist, track.duration or 0.0)
                if lines:
                    track.lyrics = _lines_to_json(lines)
                    track.lyrics_source = "lrclib"
                else:
                    words = transcribe(
                        track.vocals_path,
                        track.language,
                        settings.WHISPER_MODEL,
                        settings.MODELS_DIR,
                    )
                    track.lyrics = _lines_to_json(group_words(words))
                    track.lyrics_source = "whisper"
                track.lyrics_status = "ready"
                db.commit()
            except Exception as e:
                track.lyrics_status = "failed"
                track.error = f"versuri: {e}"
                db.commit()

        # 4. encode (retryable: leaves status="encoding" on failure)
        if track.status != "ready":
            track.status = "encoding"
            db.commit()
            try:
                track.instrumental_path = encode_to_m4a(
                    track.instrumental_path, track.instrumental_path + ".m4a"
                )
                track.original_path = encode_to_m4a(
                    track.original_path, track.original_path + ".m4a"
                )
                track.vocals_path = encode_to_m4a(
                    track.vocals_path, track.vocals_path + ".m4a"
                )
            except Exception as e:
                track.error = f"encodare: {e}"
                db.commit()
                return
            track.status = "ready"
            db.commit()
    finally:
        db.close()
