import os
from dataclasses import dataclass

from ..config import settings
from .device import pick_device


@dataclass
class SeparateResult:
    instrumental_path: str
    vocals_path: str


_DEMUCS_MODELS = {"htdemucs", "htdemucs_ft"}
_ROFORMER_MODELS = {"roformer"}
_ENSEMBLE_MODELS = {"ensemble"}

_ROFORMER_FILENAME = "model_bs_roformer_ep_317_sdr_12.9755.ckpt"


def separate(
    original_path: str, out_dir: str, models_dir: str, model_name: str | None = None
) -> SeparateResult:
    """Separate vocals/instrumental using the requested model (or the default)."""
    model = model_name or settings.DEMUCS_MODEL

    # RoFormer (and Ensemble, which includes it) is a GPU model: on CPU — and
    # especially on ARM64 — it hangs or takes an impractical amount of time.
    # Fail fast with a clear message instead of blocking the worker for hours.
    if model in (_ROFORMER_MODELS | _ENSEMBLE_MODELS) and pick_device() == "cpu":
        raise RuntimeError(
            "RoFormer / Ensemble necesită un GPU NVIDIA; pe CPU nu funcționează "
            "(se blochează sau durează extrem de mult). Alege alt model (ex. htdemucs)."
        )

    base = os.path.splitext(os.path.basename(original_path))[0]

    if model in _DEMUCS_MODELS:
        inst = os.path.join(out_dir, f"{base}_instrumental.wav")
        voc = os.path.join(out_dir, f"{base}_vocals.wav")
        _run_demucs(original_path, model, inst, voc)
        return SeparateResult(instrumental_path=inst, vocals_path=voc)

    if model in _ROFORMER_MODELS:
        inst, voc = _run_roformer(original_path, out_dir, models_dir)
        final_inst = os.path.join(out_dir, f"{base}_instrumental.wav")
        final_voc = os.path.join(out_dir, f"{base}_vocals.wav")
        _move(inst, final_inst)
        _move(voc, final_voc)
        return SeparateResult(instrumental_path=final_inst, vocals_path=final_voc)

    if model in _ENSEMBLE_MODELS:
        return _run_ensemble(original_path, out_dir, models_dir, base)

    raise ValueError(f"model de separare necunoscut: {model}")


def _run_demucs(original_path: str, model_name: str, inst_out: str, voc_out: str) -> None:
    import torch
    import torchaudio
    from demucs.apply import apply_model
    from demucs.pretrained import get_model

    model = get_model(model_name)
    device = pick_device()
    wav, sr = torchaudio.load(original_path)
    if sr != model.samplerate:
        wav = torchaudio.transforms.Resample(
            orig_freq=sr, new_freq=model.samplerate
        )(wav)
    ref = wav.mean(0)
    mean = ref.mean().item()
    std = ref.std().item()
    wav = (wav - mean) / std

    sources = apply_model(model, wav[None], device=device, progress=True)[0]
    sources = sources * std + mean

    stem_names = model.sources  # e.g. ['drums', 'bass', 'other', 'vocals']
    voc_idx = stem_names.index("vocals")
    vocals = sources[voc_idx]
    instrumental = sources[[i for i in range(len(stem_names)) if i != voc_idx]].sum(0)

    torchaudio.save(inst_out, instrumental.cpu(), model.samplerate)
    torchaudio.save(voc_out, vocals.cpu(), model.samplerate)


def _run_roformer(original_path: str, out_dir: str, models_dir: str) -> tuple[str, str]:
    from audio_separator.separator import Separator

    separator = Separator(
        output_dir=out_dir,
        model_file_dir=models_dir,
        output_format="WAV",
        sample_rate=44100,
    )
    separator.load_model(model_filename=_ROFORMER_FILENAME)
    output_files = separator.separate(original_path)

    inst = _pick_stem(output_files, "instrumental")
    voc = _pick_stem(output_files, "vocals")
    if not inst or not voc:
        raise RuntimeError(f"RoFormer nu a produs ambele fișiere: {output_files}")

    # audio-separator returns paths relative to output_dir — make them absolute.
    inst = _abs_path(out_dir, inst)
    voc = _abs_path(out_dir, voc)

    # Normalize each stem to a standard 16-bit PCM stereo WAV so downstream
    # readers (torchaudio/soundfile) can always open it.
    inst = _reencode_wav(inst)
    voc = _reencode_wav(voc)
    return inst, voc


def _abs_path(out_dir: str, path: str) -> str:
    return path if os.path.isabs(path) else os.path.join(out_dir, path)


def _reencode_wav(src: str) -> str:
    import subprocess

    dst = src + ".pcm.wav"
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", src, "-ar", "44100", "-ac", "2", "-c:a", "pcm_s16le", dst],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"re-encodare ffmpeg eșuată: {e.stderr or e}") from e
    return dst


def _run_ensemble(original_path: str, out_dir: str, models_dir: str, base: str) -> SeparateResult:
    # 1. Demucs fine-tuned -> temporary instrumental/vocals.
    demucs_inst = os.path.join(out_dir, f"{base}_ens_demucs_inst.wav")
    demucs_voc = os.path.join(out_dir, f"{base}_ens_demucs_voc.wav")
    _run_demucs(original_path, "htdemucs_ft", demucs_inst, demucs_voc)

    # 2. RoFormer -> temporary instrumental/vocals.
    roformer_inst, roformer_voc = _run_roformer(original_path, out_dir, models_dir)

    # 3. Combine the two instrumentals with the "Max Spec" algorithm.
    final_inst = os.path.join(out_dir, f"{base}_instrumental.wav")
    combine_max_spec(demucs_inst, roformer_inst, final_inst)

    # Use RoFormer vocals (high quality) for the vocals stem.
    final_voc = os.path.join(out_dir, f"{base}_vocals.wav")
    _move(roformer_voc, final_voc)

    for tmp in (demucs_inst, demucs_voc, roformer_inst):
        if os.path.exists(tmp):
            os.remove(tmp)
    return SeparateResult(instrumental_path=final_inst, vocals_path=final_voc)


def _pick_stem(output_files, keyword: str) -> str | None:
    for f in output_files or []:
        if keyword.lower() in os.path.basename(f).lower():
            return f
    return None


def _move(src: str, dst: str) -> None:
    if src == dst:
        return
    if os.path.exists(dst):
        os.remove(dst)
    os.replace(src, dst)


def combine_max_spec(path_a: str, path_b: str, out_path: str) -> str:
    """Combine two instrumental stems with the UVR5 "Max Spec" algorithm.

    For every time-frequency bin, keep the bin with the larger magnitude
    (and its phase). This avoids phase-cancellation artifacts and gives a
    cleaner instrumental than a plain average.
    """
    import torch
    import torchaudio

    a, sr_a = torchaudio.load(path_a)
    b, sr_b = torchaudio.load(path_b)
    if sr_a != sr_b:
        b = torchaudio.transforms.Resample(sr_b, sr_a)(b)
    n = min(a.shape[-1], b.shape[-1])
    a = a[..., :n]
    b = b[..., :n]

    n_fft = 2048
    hop = 1024
    win = torch.hann_window(n_fft)
    spec_a = torch.stft(a, n_fft=n_fft, hop_length=hop, window=win, return_complex=True)
    spec_b = torch.stft(b, n_fft=n_fft, hop_length=hop, window=win, return_complex=True)

    mag_a = spec_a.abs()
    mag_b = spec_b.abs()
    use_a = (mag_a >= mag_b).to(spec_a.real.dtype)
    combined = spec_a * use_a + spec_b * (1.0 - use_a)

    out = torch.istft(combined, n_fft=n_fft, hop_length=hop, window=win, length=n)
    torchaudio.save(out_path, out, sr_a)
    return out_path
