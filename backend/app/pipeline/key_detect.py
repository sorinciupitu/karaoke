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


def _decode_mono(audio_path: str, sr: int = 22050):
    """Decode any audio file to mono float samples at `sr`, returning
    (samples, sample_rate). Raises on ffmpeg failure."""
    import numpy as np

    fd, wav_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", audio_path, "-ac", "1", "-ar", str(sr), wav_path],
            check=True,
            capture_output=True,
        )
        with wave.open(wav_path, "rb") as w:
            file_sr = w.getframerate()
            raw = w.readframes(w.getnframes())
    finally:
        if os.path.exists(wav_path):
            os.unlink(wav_path)

    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0, file_sr


def detect_bpm(audio_path: str) -> float | None:
    """Estimate the tempo (BPM) from the onset envelope of an audio file."""
    import numpy as np

    try:
        data, sr = _decode_mono(audio_path)
        if len(data) < sr:  # shorter than 1s
            return None

        # Analyse at most the first 90 seconds — enough for a stable estimate.
        data = data[: sr * 90]
        frame, hop = 1024, 512
        window = np.hanning(frame)
        envelope: list[float] = []
        prev = None
        for start in range(0, len(data) - frame, hop):
            spec = np.abs(np.fft.rfft(data[start : start + frame] * window))
            if prev is not None:
                envelope.append(float(np.sum(np.maximum(spec - prev, 0.0))))
            prev = spec

        env = np.asarray(envelope, dtype=np.float64)
        if env.size < 16 or float(env.std()) == 0.0:
            return None

        env -= env.mean()
        ac = np.correlate(env, env, mode="full")[env.size - 1 :]
        fps = sr / hop
        min_lag = max(1, int(round(fps * 60 / 200)))  # 200 BPM
        max_lag = min(ac.size - 1, int(round(fps * 60 / 50)))  # 50 BPM
        if max_lag <= min_lag:
            return None

        lag = min_lag + int(np.argmax(ac[min_lag:max_lag]))
        if lag <= 0:
            return None

        bpm = 60.0 * fps / lag
        while bpm < 70:
            bpm *= 2
        while bpm > 180:
            bpm /= 2
        return round(float(bpm), 1)
    except Exception:
        return None


def detect_key(audio_path: str) -> str | None:
    """Detect the musical key of an audio file, returned in Romanian notation
    (e.g. 'Do Major', 'Si bemol Minor')."""
    import numpy as np

    try:
        data, sr = _decode_mono(audio_path)
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
