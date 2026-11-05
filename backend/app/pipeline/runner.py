from ..config import settings
from ..db import SessionLocal
from ..models import Track, UserSettings
from .download import download
from .encode import encode_to_m4a
from .key_detect import detect_key
from .lyrics import group_words
from .ollama import correct_lines
from .separate import separate
from .transcribe import fetch_lrclib, transcribe


def _lines_to_json(lines) -> list[dict]:
    return [{"text": l.text, "start": l.start, "end": l.end} for l in lines]


def _separation_model(track: Track, db) -> str:
    """Per-track override, else the user's setting, else the global default."""
    if track.demucs_model:
        return track.demucs_model
    us = db.get(UserSettings, track.user_id)
    if us and us.demucs_model:
        return us.demucs_model
    return settings.DEMUCS_MODEL


def _apply_lyrics(track: Track, db, mode: str) -> None:
    try:
        if mode == "transcribe":
            if not track.vocals_path:
                track.lyrics = track.lyrics or []
            else:
                words = transcribe(
                    track.vocals_path,
                    track.language,
                    settings.WHISPER_MODEL,
                    settings.MODELS_DIR,
                )
                lines = correct_lines(group_words(words))
                track.lyrics = _lines_to_json(lines)
                track.lyrics_source = "whisper"
        elif mode == "resync":
            if not track.vocals_path:
                track.lyrics = track.lyrics or []
            else:
                prompt = "\n".join(l["text"] for l in (track.lyrics or [])).strip()
                words = transcribe(
                    track.vocals_path,
                    track.language,
                    settings.WHISPER_MODEL,
                    settings.MODELS_DIR,
                    initial_prompt=prompt or None,
                )
                new_lines = group_words(words)
                edited = track.lyrics or []
                if len(new_lines) == len(edited):
                    # preserve the user's edited text, only re-time it
                    track.lyrics = [
                        {"text": old["text"], "start": nl.start, "end": nl.end}
                        for old, nl in zip(edited, new_lines)
                    ]
                else:
                    track.lyrics = _lines_to_json(new_lines)
                track.lyrics_source = track.lyrics_source or "whisper"
        else:  # "auto": LRCLIB first, whisper fallback
            lines = fetch_lrclib(track.title, track.artist, track.duration or 0.0)
            if lines:
                track.lyrics = _lines_to_json(lines)
                track.lyrics_source = "lrclib"
            elif track.vocals_path:
                words = transcribe(
                    track.vocals_path,
                    track.language,
                    settings.WHISPER_MODEL,
                    settings.MODELS_DIR,
                )
                lines = correct_lines(group_words(words))
                track.lyrics = _lines_to_json(lines)
                track.lyrics_source = "whisper"
            else:
                track.lyrics = []
                track.lyrics_source = None
        track.lyrics_status = "ready"
    except Exception as e:
        track.lyrics_status = "failed"
        track.error = f"versuri: {e}"
    db.commit()


def run_lyrics(track_id: int, mode: str | None = None, session_factory=None) -> None:
    factory = session_factory or SessionLocal
    db = factory()
    try:
        track = db.get(Track, track_id)
        if track is None:
            return
        mode = mode or track.lyrics_mode or "auto"
        track.lyrics_status = "syncing"
        track.lyrics_mode = None
        db.commit()
        _apply_lyrics(track, db, mode)
    finally:
        db.close()


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
            track.source_path = res.original_path
            track.title = res.title
            track.artist = res.artist
            track.duration = res.duration
            track.youtube_id = res.youtube_id
            db.commit()

        # 2. separate (skipped for already-instrumental uploads)
        if track.needs_separation and not (
            track.instrumental_path and track.vocals_path
        ):
            track.status = "separating"
            db.commit()
            src = track.source_path or track.original_path
            model = _separation_model(track, db)
            try:
                res = separate(
                    src, settings.MEDIA_DIR, settings.MODELS_DIR, model_name=model
                )
            except Exception as e:
                track.status = "failed"
                track.error = f"separare: {e}"
                db.commit()
                return
            track.instrumental_path = res.instrumental_path
            track.vocals_path = res.vocals_path
            track.demucs_model = model
            db.commit()

        # 2.5 detect the musical key from the instrumental
        if track.musical_key is None and track.instrumental_path:
            try:
                track.musical_key = detect_key(track.instrumental_path)
                db.commit()
            except Exception:
                pass

        # 3. encode (atomic; bounded retries before marking failed).
        #    Lyrics are handled separately (see run_lyrics) so the track becomes
        #    playable immediately, while transcription continues in the background.
        if track.status != "ready":
            track.status = "encoding"
            db.commit()
            try:
                inst = encode_to_m4a(
                    track.instrumental_path, track.instrumental_path + ".m4a"
                )
                if track.original_path and track.original_path != track.instrumental_path:
                    orig = encode_to_m4a(
                        track.original_path, track.original_path + ".m4a"
                    )
                else:
                    orig = inst
                voc = (
                    encode_to_m4a(track.vocals_path, track.vocals_path + ".m4a")
                    if track.vocals_path
                    else None
                )
            except Exception as e:
                track.error_count = (track.error_count or 0) + 1
                track.error = f"encodare: {e}"
                if track.error_count >= 3:
                    track.status = "failed"
                db.commit()
                return
            track.instrumental_path = inst
            track.original_path = orig
            track.vocals_path = voc
            track.error_count = 0
            track.status = "ready"
            db.commit()
    finally:
        db.close()
