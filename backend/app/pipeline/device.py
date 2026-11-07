from ..config import settings


def cuda_state() -> str:
    """Describe GPU availability: 'available' | 'full' | 'none'.

    'full' means a GPU exists but has less than CUDA_MIN_FREE_GB free (another
    process holds the VRAM). 'none' means no usable GPU.
    """
    if settings.DEVICE == "cuda":
        return "available"  # user forced it
    if settings.DEVICE == "cpu":
        return "none"
    try:
        import torch

        if torch.cuda.is_available():
            free, total = torch.cuda.mem_get_info()
            if free / (1024 ** 3) >= settings.CUDA_MIN_FREE_GB:
                return "available"
            import logging

            logging.getLogger(__name__).warning(
                "GPU are doar %.2f GB liberi (din %.2f GB) — necesar >= %.1f GB.",
                free / (1024 ** 3),
                total / (1024 ** 3),
                settings.CUDA_MIN_FREE_GB,
            )
            return "full"
        return "none"
    except Exception:
        return "none"


def pick_device() -> str:
    """Return the torch/whisper device to use: 'cuda' or 'cpu'.

    In "auto" mode, CUDA is used only if the GPU has at least
    CUDA_MIN_FREE_GB free; otherwise we fall back to CPU (instead of failing
    with "CUDA out of memory" when another process holds the VRAM).
    """
    return "cuda" if cuda_state() == "available" else "cpu"


def pick_whisper_compute_type(device: str) -> str:
    """Pick a safe compute type for faster-whisper.

    'int8_float16' on GPU keeps large-v3 within a 12 GB card; 'int8' on CPU
    is the fastest quantized type. Both are overridable via WHISPER_COMPUTE_TYPE.
    """
    if settings.WHISPER_COMPUTE_TYPE != "auto":
        return settings.WHISPER_COMPUTE_TYPE
    return "int8_float16" if device == "cuda" else "int8"
