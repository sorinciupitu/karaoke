from ..config import settings
from .device import pick_device, pick_whisper_compute_type
from .lyrics import Word

# A Romanian initial prompt nudges Whisper towards diacritics and the right
# spelling instead of anglicising everything it hears.
_ROMANIAN_PROMPT = (
    "Transcriere în limba română, cu diacritice: ă, â, î, ș, ț. "
    "Versurile cântecului, pe rânduri."
)


def effective_model(model: str, device: str) -> str:
    """large-v3 (and large) hangs / is impractically slow on CPU — downgrade."""
    if device == "cpu" and model in ("large-v3", "large"):
        return settings.WHISPER_CPU_MODEL
    return model


def transcribe(
    vocals_path: str,
    language: str,
    model: str,
    models_dir: str,
    initial_prompt: str | None = None,
    progress_cb=None,
) -> list[Word]:
    from faster_whisper import WhisperModel

    device = pick_device()
    compute_type = pick_whisper_compute_type(device)
    model = effective_model(model, device)
    if initial_prompt is None and (language or "").lower().startswith("ro"):
        initial_prompt = _ROMANIAN_PROMPT
    m = WhisperModel(model, device=device, compute_type=compute_type, download_root=models_dir)
    segments, _info = m.transcribe(
        vocals_path,
        language=language,
        word_timestamps=True,
        initial_prompt=initial_prompt,
        condition_on_previous_text=False,
        # Drop silence so Whisper cannot invent lyrics over instrumental gaps
        # (the classic "mulțumesc pentru vizionare" hallucination).
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        hallucination_silence_threshold=2.0,
        no_speech_threshold=0.6,
        beam_size=5,
        temperature=[0.0, 0.2, 0.4],
    )

    words: list[Word] = []
    for seg in segments:
        for w in seg.words or []:
            text = w.word.strip()
            if text:
                words.append(Word(start=w.start, end=w.end, text=text))
        if progress_cb is not None:
            progress_cb(seg.end)
    return words
