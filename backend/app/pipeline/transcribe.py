from .device import pick_device, pick_whisper_compute_type
from .lyrics import Line, Word, parse_lrc


def fetch_lrclib(title: str, artist: str, duration: float) -> list[Line] | None:
    import httpx

    try:
        params = {"track_name": title, "artist_name": artist}
        if duration:
            params["duration"] = int(round(duration))
        r = httpx.get("https://lrclib.net/api/get", params=params, timeout=10.0)
        if r.status_code == 200:
            data = r.json()
            synced = data.get("syncedLyrics")
            if synced:
                lines = parse_lrc(synced)
                if lines:
                    return lines
        return None
    except Exception:
        return None


def transcribe(
    vocals_path: str,
    language: str,
    model: str,
    models_dir: str,
    initial_prompt: str | None = None,
) -> list[Word]:
    from faster_whisper import WhisperModel

    device = pick_device()
    compute_type = pick_whisper_compute_type(device)
    m = WhisperModel(model, device=device, compute_type=compute_type, download_root=models_dir)
    segments, _info = m.transcribe(
        vocals_path,
        language=language,
        word_timestamps=True,
        initial_prompt=initial_prompt,
    )

    words: list[Word] = []
    for seg in segments:
        for w in seg.words or []:
            words.append(Word(start=w.start, end=w.end, text=w.word.strip()))
    return words
