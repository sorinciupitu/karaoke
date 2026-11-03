import os
import subprocess
from dataclasses import dataclass


@dataclass
class DownloadResult:
    original_path: str
    title: str
    artist: str
    duration: float
    youtube_id: str


def download(url: str, media_dir: str) -> DownloadResult:
    import yt_dlp

    os.makedirs(media_dir, exist_ok=True)
    outtmpl = os.path.join(media_dir, "%(id)s.%(ext)s")
    opts = {
        "format": "bestaudio/best",
        "outtmpl": outtmpl,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        if "entries" in info:
            info = info["entries"][0]
        raw_path = ydl.prepare_filename(info)

    # Demucs/torchaudio needs PCM WAV; yt-dlp may return webm/opus or m4a,
    # which torchaudio cannot decode. Convert with ffmpeg (already installed).
    wav_path = os.path.join(media_dir, f"{info['id']}.wav")
    subprocess.run(
        ["ffmpeg", "-y", "-i", raw_path, "-ar", "44100", "-ac", "2", wav_path],
        check=True,
        capture_output=True,
    )
    if raw_path != wav_path and os.path.exists(raw_path):
        os.remove(raw_path)

    return DownloadResult(
        original_path=wav_path,
        title=info.get("title") or "",
        artist=info.get("artist") or info.get("uploader") or "",
        duration=float(info.get("duration") or 0),
        youtube_id=info.get("id") or "",
    )


def save_upload(file, media_dir: str) -> tuple[str, float]:
    """Save an uploaded audio file and convert it to a 44.1 kHz stereo WAV
    (demucs/torchaudio needs PCM). Returns (wav_path, duration_seconds)."""
    import shutil
    import wave
    from uuid import uuid4

    os.makedirs(media_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1].lower() or ".bin"
    raw_path = os.path.join(media_dir, f"upload_{uuid4().hex}{ext}")
    with open(raw_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    wav_path = os.path.join(media_dir, f"upload_{uuid4().hex}.wav")
    subprocess.run(
        ["ffmpeg", "-y", "-i", raw_path, "-ar", "44100", "-ac", "2", wav_path],
        check=True,
        capture_output=True,
    )
    if raw_path != wav_path and os.path.exists(raw_path):
        os.remove(raw_path)

    with wave.open(wav_path, "rb") as w:
        duration = w.getnframes() / float(w.getframerate() or 1)
    return wav_path, duration
