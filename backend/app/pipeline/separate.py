import os
from dataclasses import dataclass


@dataclass
class SeparateResult:
    instrumental_path: str
    vocals_path: str


def separate(original_path: str, out_dir: str, models_dir: str) -> SeparateResult:
    import torch
    import torchaudio
    from demucs.apply import apply_model
    from demucs.pretrained import get_model

    model = get_model("htdemucs")
    wav, sr = torchaudio.load(original_path)
    wav = torchaudio.functional.resample(wav, sr, model.samplerate)
    ref = wav.mean(0)
    wav = (wav - ref.mean()) / ref.std()

    sources = apply_model(model, wav[None], device="cpu", progress=True)[0]
    sources = sources * ref.std() + ref.mean()

    stem_names = model.sources  # e.g. ['drums', 'bass', 'other', 'vocals']
    voc_idx = stem_names.index("vocals")
    vocals = sources[voc_idx]
    instrumental = sources[[i for i in range(len(stem_names)) if i != voc_idx]].sum(0)

    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(original_path))[0]
    inst_path = os.path.join(out_dir, f"{base}_instrumental.wav")
    voc_path = os.path.join(out_dir, f"{base}_vocals.wav")

    torchaudio.save(inst_path, instrumental, model.samplerate)
    torchaudio.save(voc_path, vocals, model.samplerate)

    return SeparateResult(instrumental_path=inst_path, vocals_path=voc_path)
