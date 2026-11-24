"""Synced-lyrics providers.

Order matters for quality: official word/line-synced lyrics (LyricsPlus:
Apple Music, QQ Music, Spotify, Deezer, Musixmatch) beat community LRC files
(LRCLIB), and both beat AI transcription.

`fetch_synced_lyrics` asks every enabled provider and keeps the best match,
judged mainly by how well the lyrics' end time lines up with the track length
(a remix/radio edit of the same song has very different timings).
"""

import difflib
import re
import unicodedata
from dataclasses import dataclass

from ..config import settings
from .lyrics import Line, parse_lrc
from .songmeta import candidates

_BROWSER_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

# How far the lyrics' end may sit from the track length before we assume the
# hit is a different edit (radio edit / live / remix with other words).
_DURATION_TOLERANCE = 25.0
_DURATION_TOLERANCE_RATIO = 0.15


@dataclass
class LyricsHit:
    lines: list[Line]
    source: str


# --- text similarity --------------------------------------------------------


def _norm(text: str) -> str:
    text = unicodedata.normalize("NFKD", (text or "").lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _ratio(a: str, b: str) -> float:
    a, b = _norm(a), _norm(b)
    if not a or not b:
        return 0.0
    if a == b:
        return 1.0
    return difflib.SequenceMatcher(None, a, b).ratio()


def _best_ratio(value: str, wanted: str) -> float:
    """Compare against each artist in a multi-artist credit."""
    parts = re.split(r"[,&/]|\bfeat\.?\b|\bft\.?\b", value or "")
    return max([_ratio(value, wanted)] + [_ratio(p, wanted) for p in parts])


# --- LyricsPlus -------------------------------------------------------------


def parse_lyricsplus(payload: dict) -> list[Line]:
    """Convert a LyricsPlus `/v2/lyrics/get` payload into line-level lyrics.

    Times in that payload are milliseconds; `syllabus` (word timings) is
    ignored here because playback highlights whole lines.
    """
    entries = payload.get("lyrics") or []
    lines: list[Line] = []
    for entry in entries:
        text = (entry.get("text") or "").replace("♪", "").strip()
        if not text:
            continue
        try:
            start = float(entry.get("time") or 0.0) / 1000.0
        except (TypeError, ValueError):
            continue
        try:
            duration = float(entry.get("duration") or 0.0) / 1000.0
        except (TypeError, ValueError):
            duration = 0.0
        end = start + duration if duration > 0 else start + 3.0
        lines.append(Line(text=text, start=start, end=max(end, start + 0.2)))

    lines.sort(key=lambda l: l.start)
    # Never let a line overlap the next one (long notes stall the highlight).
    for i in range(len(lines) - 1):
        lines[i].end = min(lines[i].end, lines[i + 1].start)
    return [l for l in lines if l.end > l.start]


def _lyricsplus_urls() -> list[str]:
    raw = settings.LYRICSPLUS_URLS or ""
    return [u.strip().rstrip("/") for u in raw.split(",") if u.strip()]


def _lyricsplus_sources() -> list[str]:
    raw = settings.LYRICSPLUS_SOURCES or ""
    return [s.strip() for s in raw.split(",") if s.strip()]


def _get_json(url: str, params: dict, timeout: float, client=None):
    if client is not None:
        r = client.get(url, params=params, timeout=timeout)
        if r.status_code != 200:
            return None
        try:
            return r.json()
        except Exception:
            return None

    import httpx

    try:
        r = httpx.get(
            url,
            params=params,
            timeout=timeout,
            headers={"User-Agent": _BROWSER_UA, "Accept": "application/json"},
        )
    except Exception:
        return None
    if r.status_code != 200:
        return None
    try:
        return r.json()
    except Exception:
        return None


def fetch_lyricsplus(
    title: str,
    artist: str,
    duration: float = 0.0,
    *,
    urls: list[str] | None = None,
    sources: list[str] | None = None,
    timeout: float | None = None,
    max_requests: int = 5,
    client=None,
) -> list[Line] | None:
    """Ask one of the public LyricsPlus mirrors for synced lyrics."""
    if not title and not artist:
        return None

    urls = urls if urls is not None else _lyricsplus_urls()
    if not urls:
        return None
    sources = sources if sources is not None else _lyricsplus_sources()
    timeout = settings.LYRICSPLUS_TIMEOUT if timeout is None else timeout

    combined = ",".join(sources)
    param_sets: list[dict] = []
    if combined:
        param_sets.append({"source": combined})
    # The mirrors occasionally fail to race several providers at once, but
    # answer fine for a single source — retry those before giving up.
    param_sets.extend({"source": s} for s in sources)
    param_sets.append({})

    budget = max_requests
    for query_title, query_artist in candidates(title, artist)[:2]:
        for base in urls:
            for extra in param_sets:
                if budget <= 0:
                    return None
                budget -= 1
                params = {"title": query_title, "artist": query_artist}
                if duration:
                    params["duration"] = round(float(duration), 3)
                params.update(extra)
                payload = _get_json(f"{base}/v2/lyrics/get", params, timeout, client)
                if not payload:
                    continue
                lines = parse_lyricsplus(payload)
                if lines:
                    return lines
    return None


# --- LRCLIB ----------------------------------------------------------------


def score_lrclib_hit(hit: dict, title: str, artist: str, duration: float) -> float:
    """How likely is this LRCLIB search hit the song we are playing? (0..1)"""
    track_name = hit.get("trackName") or ""
    title_score = max(
        _ratio(track_name, title), _ratio(track_name, f"{artist} {title}")
    )
    artist_score = _best_ratio(hit.get("artistName") or "", artist)

    hit_duration = hit.get("duration")
    if duration and hit_duration:
        diff = abs(float(hit_duration) - float(duration))
        duration_score = max(0.0, 1.0 - diff / 15.0)
    else:
        duration_score = 0.5

    return 0.55 * title_score + 0.25 * artist_score + 0.20 * duration_score


def fetch_lrclib(
    title: str,
    artist: str,
    duration: float = 0.0,
    *,
    timeout: float = 10.0,
    client=None,
) -> list[Line] | None:
    """Search LRCLIB (fuzzy) and return the best synced match."""
    if not title and not artist:
        return None

    best: tuple[float, list[Line]] | None = None
    for query_title, query_artist in candidates(title, artist)[:3]:
        payload = _get_json(
            "https://lrclib.net/api/search",
            {"q": f"{query_artist} {query_title}".strip()},
            timeout,
            client,
        )
        hits = payload if isinstance(payload, list) else []
        for hit in hits:
            synced = hit.get("syncedLyrics")
            if not synced:
                continue
            score = score_lrclib_hit(hit, query_title, query_artist, duration)
            lines = parse_lrc(synced)
            if len(lines) < 3:
                continue
            if best is None or score > best[0]:
                best = (score, lines)

        if best is not None and best[0] >= 0.82:
            break  # good enough, skip the remaining candidate spellings

    if best is None or best[0] < 0.5:
        return None
    return best[1]


# --- orchestration ---------------------------------------------------------


def _plausible(lines: list[Line], duration: float) -> bool:
    if not lines:
        return False
    if len(lines) < 3:
        return False
    if duration and duration > 25:
        tolerance = max(_DURATION_TOLERANCE, duration * _DURATION_TOLERANCE_RATIO)
        return abs(lines[-1].end - duration) <= tolerance
    return True


def fetch_synced_lyrics(
    title: str, artist: str, duration: float = 0.0
) -> LyricsHit | None:
    """Try every configured provider, keep the best-fitting result."""
    order = [
        p.strip().lower()
        for p in (settings.LYRICS_PROVIDERS or "").split(",")
        if p.strip()
    ]
    if not order:
        order = ["lyricsplus", "lrclib"]

    found: list[tuple[float, int, LyricsHit]] = []
    for rank, name in enumerate(order):
        try:
            if name == "lyricsplus":
                lines = fetch_lyricsplus(title, artist, duration)
            elif name == "lrclib":
                lines = fetch_lrclib(title, artist, duration)
            else:
                continue
        except Exception:
            continue
        if not lines or not _plausible(lines, duration):
            continue
        # Prefer the provider whose last line lands closest to the track end.
        drift = abs(lines[-1].end - duration) if duration else 0.0
        found.append((drift, rank, LyricsHit(lines=lines, source=name)))

    if not found:
        return None
    found.sort(key=lambda x: (x[0], x[1]))
    return found[0][2]
