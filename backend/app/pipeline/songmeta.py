"""Clean up YouTube-style metadata so lyrics providers can match the song.

YouTube titles arrive full of noise ("(Videoclip Oficial)", "[Official Video]",
"feat. X", " - Topic" channels). Lyrics databases want "title" + "artist", so we
strip the noise and try a few plausible splits of "Artist - Title" strings.
"""

import re

_BRACKET_RE = re.compile(r"[\(\[]([^\)\]]*)[\)\]]")

# Words that only describe the video, never the song itself.
_NOISE_WORDS = {
    "official",
    "oficial",
    "officiel",
    "video",
    "videoclip",
    "videoclipul",
    "music",
    "muzica",
    "muzical",
    "audio",
    "lyric",
    "lyrics",
    "versuri",
    "teaser",
    "promo",
    "hd",
    "hq",
    "4k",
    "8k",
    "mv",
    "m/v",
    "visualizer",
    "visualiser",
    "remaster",
    "remastered",
    "explicit",
    "clean",
    "premiere",
    "premiera",
    "officialvideo",
    "officialaudio",
}

_FEAT_RE = re.compile(r"\s*[\(\[]?\s*\b(?:feat\.?|ft\.?|featuring|cu)\b[^\)\]]*[\)\]]?\s*$", re.I)
_SEPARATOR_RE = re.compile(r"\s+[-–—|]\s+|\s*[|]\s*")
_CHANNEL_SUFFIX_RE = re.compile(
    r"\s*[-\u2013]\s*topic\s*$|\s*vevo\s*$|\s*official\s*$", re.I
)
_WS_RE = re.compile(r"\s+")


def _clean_spaces(text: str) -> str:
    return _WS_RE.sub(" ", (text or "").replace("\u00a0", " ")).strip(" \t-–—|:,")


def _is_noise_segment(segment: str) -> bool:
    words = re.findall(r"[a-zA-Z]+", segment.lower())
    if not words:
        return True
    return all(w in _NOISE_WORDS for w in words)


def clean_title(title: str) -> str:
    """Remove bracketed video noise, feature credits and stray separators."""
    text = _clean_spaces(title)
    if not text:
        return ""

    def drop(m: re.Match) -> str:
        return "" if _is_noise_segment(m.group(1)) else m.group(0)

    text = _BRACKET_RE.sub(drop, text)
    text = _FEAT_RE.sub("", text)
    text = _clean_spaces(text)
    # "Song | Official Video" -> drop the noise segments, keep the song title.
    # "Artist - Song" is kept as-is: `split_artist_title` handles that later.
    parts = [p for p in _SEPARATOR_RE.split(text) if p.strip()]
    while len(parts) > 1 and _is_noise_segment(parts[-1]):
        parts.pop()
    while len(parts) > 1 and _is_noise_segment(parts[0]):
        parts.pop(0)
    text = _clean_spaces(" - ".join(parts)) if parts else text
    # Drop a trailing "(Remix)"-free dangling "Official Video" without brackets
    words = text.split()
    while len(words) > 1 and words[-1].lower() in _NOISE_WORDS:
        words.pop()
    return _clean_spaces(" ".join(words))


def clean_artist(artist: str) -> str:
    """Strip " - Topic", "VEVO" and other YouTube channel decorations."""
    text = _clean_spaces(artist)
    if not text:
        return ""
    text = _CHANNEL_SUFFIX_RE.sub("", text)
    text = _FEAT_RE.sub("", text)
    for prefix in ("Official ", "Oficial "):
        if text.startswith(prefix):
            text = text[len(prefix) :]
    return _clean_spaces(text)


def split_artist_title(title: str) -> tuple[str, str] | None:
    """Split "Artist - Song" into (song, artist). Returns None if ambiguous."""
    text = _clean_spaces(title)
    if not text:
        return None
    pieces = [p for p in _SEPARATOR_RE.split(text) if p.strip()]
    if len(pieces) != 2:
        return None
    left, right = pieces
    song, artist = right, left
    # Also drop noise in both halves ("Visele Official Video - Irina Rimes")
    song = clean_title(song)
    artist = clean_artist(artist)
    if not song or not artist:
        return None
    return song, artist


def candidates(title: str, artist: str) -> list[tuple[str, str]]:
    """Plausible (title, artist) pairs to query a lyrics database with."""
    raw_title = _clean_spaces(title)
    clean_t = clean_title(title)
    clean_a = clean_artist(artist)

    out: list[tuple[str, str]] = []

    def add(t: str, a: str) -> None:
        t, a = _clean_spaces(t), _clean_spaces(a)
        if t and (t, a) not in out:
            out.append((t, a))

    split = split_artist_title(clean_t or raw_title)
    if split and split[1].lower() == clean_a.lower():
        # "Irina Rimes - Visele" from a channel named "Irina Rimes": the split
        # is the right query, so try it first.
        add(split[0], split[1])

    add(clean_t or raw_title, clean_a)
    add(raw_title, clean_a)

    if split:
        song, split_artist = split
        add(song, split_artist)
        add(song, clean_a or split_artist)

    return out
