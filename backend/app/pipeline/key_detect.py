import os
import subprocess
import tempfile
import wave

NOTE_NAMES_RO = [
    "Do", "Re bemol", "Re", "Mi bemol", "Mi", "Fa",
    "Sol bemol", "Sol", "La bemol", "La", "Si bemol", "Si",
]

# Krumhansl–Schmuckler key profiles (major & minor), pitch classes relative to tonic.
KS_MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
KS_MINOR = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]


def detect_key(audio_path: str) -> str | None:
    """Detect the musical key of an audio file, returned in Romanian notation
    (e.g. 'Do Major', 'Si bemol Minor')."""
    import numpy as np

    try:
        fd, wav_path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        subprocess.run(
            ["ffmpeg", "-y", "-i", audio_path, "-ac", "1", "-ar", "22050", wav_path],
            check=True,
            capture_output=True,
        )
        with wave.open(wav_path, "rb") as w:
            sr = w.getframerate()
            n = w.getnframes()
            raw = w.readframes(n)
        os.unlink(wav_path)

        data = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
        if len(data) < sr:  # shorter than 1s
            return None

        frame, hop = 4096, 2048
        window = np.hanning(frame)
        chroma = np.zeros(12, dtype=np.float64)
        n_frames = 0
        for start in range(0, len(data) - frame, hop):
            seg = data[start : start + frame] * window
            spec = np.abs(np.fft.rfft(seg))
            freqs = np.fft.rfftfreq(frame, 1.0 / sr)
            with np.errstate(divide="ignore", invalid="ignore"):
                midi = 69 + 12 * np.log2(freqs / 440.0)
            rounded = np.round(midi).astype(np.int64)
            valid = np.isfinite(midi) & (freqs > 80)
            for pc in range(12):
                chroma[pc] += spec[valid & ((rounded % 12) == pc)].sum()
            n_frames += 1

        if n_frames == 0 or chroma.sum() <= 0:
            return None
        chroma /= chroma.sum()

        best: tuple[float, int, str] | None = None
        for mode, profile in (("Major", KS_MAJOR), ("Minor", KS_MINOR)):
            prof = np.array(profile, dtype=np.float64)
            for tonic in range(12):
                corr = float(np.dot(chroma, np.roll(prof, tonic)))
                if best is None or corr > best[0]:
                    best = (corr, tonic, mode)

        _, tonic, mode = best
        return f"{NOTE_NAMES_RO[tonic]} {mode}"
    except Exception:
        return None
