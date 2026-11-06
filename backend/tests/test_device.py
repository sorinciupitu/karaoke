import builtins
import sys
import types

from app.pipeline.device import pick_device, pick_whisper_compute_type


def _fake_torch(available: bool, free_bytes=10 * 1024**3, total_bytes=12 * 1024**3):
    mod = types.ModuleType("torch")
    mod.cuda = types.SimpleNamespace(
        is_available=lambda: available,
        mem_get_info=lambda: (free_bytes, total_bytes),
    )
    return mod


def test_pick_device_defaults_to_cpu_without_cuda(monkeypatch):
    monkeypatch.setattr("app.config.settings.DEVICE", "auto")
    monkeypatch.setitem(sys.modules, "torch", _fake_torch(False))
    assert pick_device() == "cpu"


def test_pick_device_uses_cuda_when_available(monkeypatch):
    monkeypatch.setattr("app.config.settings.DEVICE", "auto")
    monkeypatch.setitem(sys.modules, "torch", _fake_torch(True))
    assert pick_device() == "cuda"


def test_pick_device_falls_back_to_cpu_when_gpu_full(monkeypatch):
    monkeypatch.setattr("app.config.settings.DEVICE", "auto")
    monkeypatch.setitem(sys.modules, "torch", _fake_torch(True, free_bytes=1 * 1024**3))
    assert pick_device() == "cpu"


def test_pick_device_falls_back_to_cpu_when_torch_missing(monkeypatch):
    monkeypatch.setattr("app.config.settings.DEVICE", "auto")
    monkeypatch.delitem(sys.modules, "torch", raising=False)
    real_import = builtins.__import__

    def fake_import(name, *args, **kwargs):
        if name == "torch":
            raise ImportError("no torch")
        return real_import(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    assert pick_device() == "cpu"


def test_pick_device_honours_explicit_cpu(monkeypatch):
    monkeypatch.setattr("app.config.settings.DEVICE", "cpu")
    assert pick_device() == "cpu"


def test_pick_device_honours_explicit_cuda(monkeypatch):
    monkeypatch.setattr("app.config.settings.DEVICE", "cuda")
    assert pick_device() == "cuda"


def test_compute_type_gpu_defaults_to_int8_float16(monkeypatch):
    monkeypatch.setattr("app.config.settings.WHISPER_COMPUTE_TYPE", "auto")
    assert pick_whisper_compute_type("cuda") == "int8_float16"


def test_compute_type_cpu_defaults_to_int8(monkeypatch):
    monkeypatch.setattr("app.config.settings.WHISPER_COMPUTE_TYPE", "auto")
    assert pick_whisper_compute_type("cpu") == "int8"


def test_compute_type_honours_override(monkeypatch):
    monkeypatch.setattr("app.config.settings.WHISPER_COMPUTE_TYPE", "float16")
    assert pick_whisper_compute_type("cpu") == "float16"


def test_effective_model_downgrades_large_v3_on_cpu(monkeypatch):
    from app.pipeline.transcribe import effective_model

    monkeypatch.setattr("app.config.settings.WHISPER_CPU_MODEL", "medium")
    assert effective_model("large-v3", "cpu") == "medium"
    assert effective_model("large", "cpu") == "medium"
    assert effective_model("large-v3", "cuda") == "large-v3"
    assert effective_model("medium", "cpu") == "medium"
    assert effective_model("small", "cpu") == "small"
