from ..config import settings


def pick_device() -> str:
    """Return the torch/whisper device to use: 'cuda' or 'cpu'."""
    if settings.DEVICE == "cuda":
        return "cuda"
    if settings.DEVICE == "cpu":
        return "cpu"
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
    except Exception:
        pass
    return "cpu"


def pick_whisper_compute_type(device: str) -> str:
    """Pick a safe compute type for faster-whisper.

    'int8_float16' on GPU keeps large-v3 within a 12 GB card; 'int8' on CPU
    is the fastest quantized type. Both are overridable via WHISPER_COMPUTE_TYPE.
    """
    if settings.WHISPER_COMPUTE_TYPE != "auto":
        return settings.WHISPER_COMPUTE_TYPE
    return "int8_float16" if device == "cuda" else "int8"
