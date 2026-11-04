import os
from dataclasses import dataclass

from ..config import settings
from .device import pick_device


@dataclass
class SeparateResult:
    instrumental_path: str
    vocals_path: str


def separate(original_path: str, out_dir: str, models_dir: str) -> SeparateResult:
    import torch
    import torchaudio
    from demucs.apply import apply_model
    from demucs.pretrained import get_model

    model = get_model(settings.DEMUCS_MODEL)
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

    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(original_path))[0]
    inst_path = os.path.join(out_dir, f"{base}_instrumental.wav")
    voc_path = os.path.join(out_dir, f"{base}_vocals.wav")

    torchaudio.save(inst_path, instrumental.cpu(), model.samplerate)
    torchaudio.save(voc_path, vocals.cpu(), model.samplerate)

    return SeparateResult(instrumental_path=inst_path, vocals_path=voc_path)
