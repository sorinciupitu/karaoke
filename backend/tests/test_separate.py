import os

import pytest

from app.pipeline.separate import SeparateResult, combine_max_spec, separate


@pytest.fixture()
def wav_pair(tmp_path):
    pytest.importorskip("torch")
    pytest.importorskip("torchaudio")
    import torch
    import torchaudio

    sr = 44100
    t = torch.arange(0, sr) / sr
    a = torch.stack([torch.sin(2 * torch.pi * 440 * t), torch.sin(2 * torch.pi * 880 * t)])
    b = torch.stack([torch.sin(2 * torch.pi * 330 * t), torch.sin(2 * torch.pi * 660 * t)])
    pa = tmp_path / "a.wav"
    pb = tmp_path / "b.wav"
    torchaudio.save(str(pa), a, sr)
    torchaudio.save(str(pb), b, sr)
    return str(pa), str(pb), sr


def test_combine_max_spec_produces_stereo_wav(wav_pair, tmp_path):
    import torchaudio

    pa, pb, sr = wav_pair
    out = tmp_path / "out.wav"
    combine_max_spec(pa, pb, str(out))

    assert out.exists()
    wav, out_sr = torchaudio.load(str(out))
    assert out_sr == sr
    assert wav.shape[0] == 2


def test_combine_max_spec_trims_to_shortest(wav_pair, tmp_path):
    import torchaudio

    pa, pb, sr = wav_pair
    b, _ = torchaudio.load(pb)
    pb_short = tmp_path / "b_short.wav"
    torchaudio.save(str(pb_short), b[..., :22050], sr)

    out = tmp_path / "out2.wav"
    combine_max_spec(pa, str(pb_short), str(out))

    wav, _ = torchaudio.load(str(out))
    assert wav.shape[-1] == 22050


def test_separate_dispatch_demucs(monkeypatch, tmp_path):
    calls = {}

    def fake_demucs(original, model, inst_out, voc_out):
        calls["model"] = model
        open(inst_out, "w").close()
        open(voc_out, "w").close()

    monkeypatch.setattr("app.pipeline.separate._run_demucs", fake_demucs)

    res = separate("orig.wav", str(tmp_path), str(tmp_path), model_name="htdemucs")
    assert calls["model"] == "htdemucs"
    assert res.instrumental_path.endswith("_instrumental.wav")
    assert res.vocals_path.endswith("_vocals.wav")


def test_separate_dispatch_roformer(monkeypatch, tmp_path):
    monkeypatch.setattr("app.pipeline.separate.pick_device", lambda: "cuda")

    def fake_roformer(original, out_dir, models_dir):
        i = os.path.join(out_dir, "tmp_i.wav")
        v = os.path.join(out_dir, "tmp_v.wav")
        open(i, "w").close()
        open(v, "w").close()
        return i, v

    monkeypatch.setattr("app.pipeline.separate._run_roformer", fake_roformer)

    res = separate("orig.wav", str(tmp_path), str(tmp_path), model_name="roformer")
    assert res.instrumental_path.endswith("_instrumental.wav")
    assert res.vocals_path.endswith("_vocals.wav")


def test_separate_dispatch_ensemble(monkeypatch, tmp_path):
    monkeypatch.setattr("app.pipeline.separate.pick_device", lambda: "cuda")

    def fake_ensemble(original, out_dir, models_dir, base):
        return SeparateResult("inst.wav", "voc.wav")

    monkeypatch.setattr("app.pipeline.separate._run_ensemble", fake_ensemble)

    res = separate("orig.wav", str(tmp_path), str(tmp_path), model_name="ensemble")
    assert res.instrumental_path == "inst.wav"


def test_separate_unknown_model_raises(tmp_path):
    with pytest.raises(ValueError):
        separate("orig.wav", str(tmp_path), str(tmp_path), model_name="nope")


def test_roformer_blocked_on_cpu(monkeypatch, tmp_path):
    monkeypatch.setattr("app.pipeline.separate.pick_device", lambda: "cpu")
    with pytest.raises(RuntimeError, match="GPU"):
        separate("orig.wav", str(tmp_path), str(tmp_path), model_name="roformer")


def test_ensemble_blocked_on_cpu(monkeypatch, tmp_path):
    monkeypatch.setattr("app.pipeline.separate.pick_device", lambda: "cpu")
    with pytest.raises(RuntimeError, match="GPU"):
        separate("orig.wav", str(tmp_path), str(tmp_path), model_name="ensemble")


def test_ensure_wav_source_uses_existing_source(tmp_path):
    from app.pipeline.download import ensure_wav_source

    src = tmp_path / "a.wav"
    src.write_bytes(b"RIFF-placeholder")
    assert ensure_wav_source(str(src), "orig.m4a") == str(src)


def test_ensure_wav_source_falls_back_to_wav_original(tmp_path):
    from app.pipeline.download import ensure_wav_source

    orig = tmp_path / "orig.wav"
    orig.write_bytes(b"RIFF-placeholder")
    assert ensure_wav_source(None, str(orig)) == str(orig)


def test_ensure_wav_source_returns_none_when_both_missing(tmp_path):
    from app.pipeline.download import ensure_wav_source

    assert ensure_wav_source("/nope/a.wav", "/nope/b.m4a") is None
