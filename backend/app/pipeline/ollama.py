from ..config import settings
from .lyrics import Line

_PROMPT = (
    "Corectează ortografia și diacriticele textului de mai jos. "
    "Nu adăuga cuvinte noi, nu șterge cuvinte, nu schimba ordinea. "
    "Păstrează exact același număr de rânduri și aceeași ordine. "
    "Răspunde DOAR cu rândurile corectate, fiecare pe linia lui, "
    "fără numerotare și fără alt text."
)


def correct_lines(lines: list[Line]) -> list[Line]:
    """Optionally run the transcribed lines through a local LLM (Ollama).

    Correction is line-by-line and preserves each line's timing. If Ollama is
    disabled, unreachable, or returns a different number of lines, the original
    lines are returned unchanged (fail-safe).
    """
    if not settings.OLLAMA_ENABLED or not lines:
        return lines

    import httpx

    text = "\n".join(line.text for line in lines)
    try:
        r = httpx.post(
            f"{settings.OLLAMA_URL.rstrip('/')}/api/generate",
            json={
                "model": settings.OLLAMA_MODEL,
                "prompt": f"{_PROMPT}\n\n{text}",
                "stream": False,
                "options": {"temperature": 0},
            },
            timeout=180.0,
        )
        r.raise_for_status()
        response = (r.json().get("response") or "").strip()
    except Exception:
        return lines

    corrected = [ln.strip() for ln in response.splitlines() if ln.strip()]
    if len(corrected) != len(lines):
        return lines

    return [
        Line(text=new_text, start=old.start, end=old.end)
        for new_text, old in zip(corrected, lines)
    ]
