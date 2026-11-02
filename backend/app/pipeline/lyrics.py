import re
from dataclasses import dataclass


@dataclass
class Line:
    text: str
    start: float
    end: float


@dataclass
class Word:
    start: float
    end: float
    text: str


_TIMESTAMP_RE = re.compile(r"\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]")


def _parse_timestamp(m: re.Match) -> float:
    minutes = int(m.group(1))
    seconds = int(m.group(2))
    frac = m.group(3)
    if not frac:
        return minutes * 60 + seconds
    return minutes * 60 + seconds + int(frac) / (10 ** len(frac))


def parse_lrc(lrc: str) -> list[Line]:
    entries: list[tuple[float, str]] = []
    for raw in lrc.splitlines():
        line = raw.strip()
        if not line:
            continue
        timestamps = list(_TIMESTAMP_RE.finditer(line))
        if not timestamps:
            continue  # metadata tag ([ar:...], [ti:...]) or empty — skip
        text = _TIMESTAMP_RE.sub("", line).strip()
        if not text:
            continue  # instrumental line with a timestamp but no lyric
        for m in timestamps:
            entries.append((_parse_timestamp(m), text))

    entries.sort(key=lambda x: x[0])
    lines: list[Line] = []
    for i, (start, text) in enumerate(entries):
        end = entries[i + 1][0] if i + 1 < len(entries) else start + 3.0
        lines.append(Line(text=text, start=start, end=end))
    return lines


def group_words(
    words: list[Word], *, max_gap: float = 1.0, max_chars: int = 60
) -> list[Line]:
    if not words:
        return []

    lines: list[Line] = []
    current: list[Word] = [words[0]]

    def close(group: list[Word]) -> Line:
        return Line(
            text=" ".join(w.text for w in group),
            start=group[0].start,
            end=group[-1].end,
        )

    for w in words[1:]:
        prev = current[-1]
        current_text = " ".join(x.text for x in current)
        if w.start - prev.end > max_gap or len(current_text) + 1 + len(w.text) > max_chars:
            lines.append(close(current))
            current = [w]
        else:
            current.append(w)

    lines.append(close(current))
    return lines
