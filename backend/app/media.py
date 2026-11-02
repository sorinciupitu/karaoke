import os
import re

from fastapi import HTTPException
from fastapi.responses import Response

_RANGE_RE = re.compile(r"bytes=(\d*)-(\d*)")


def _media_type(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    if ext in (".m4a", ".mp4", ".aac"):
        return "audio/mp4"
    if ext == ".wav":
        return "audio/wav"
    if ext in (".mp3",):
        return "audio/mpeg"
    return "application/octet-stream"


def _parse_range(range_header: str | None, size: int):
    """Return 'invalid', 'unsatisfiable', None (full), or (start, end) inclusive."""
    if not range_header:
        return None
    m = _RANGE_RE.match(range_header.strip())
    if not m:
        return "invalid"
    start_s, end_s = m.group(1), m.group(2)
    if start_s == "" and end_s == "":
        return "invalid"

    if start_s == "":
        # suffix range: bytes=-N  (last N bytes)
        n = int(end_s)
        if n <= 0:
            return "unsatisfiable"
        start = max(0, size - n)
        return (start, size - 1)

    start = int(start_s)
    if end_s == "":
        end = size - 1
    else:
        end = int(end_s)

    if start >= size:
        return "unsatisfiable"
    end = min(end, size - 1)
    if start > end:
        return "unsatisfiable"
    return (start, end)


def build_media_response(path: str, range_header: str | None) -> Response:
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="fișier lipsă")

    size = os.path.getsize(path)
    media_type = _media_type(path)
    parsed = _parse_range(range_header, size)

    if parsed == "invalid":
        parsed = None  # ignore malformed Range, serve full

    if parsed == "unsatisfiable":
        return Response(
            status_code=416,
            content=b"",
            headers={"Content-Range": f"bytes */{size}"},
        )

    common = {"Accept-Ranges": "bytes"}

    if parsed is None:
        with open(path, "rb") as f:
            data = f.read()
        return Response(
            content=data,
            media_type=media_type,
            headers={**common, "Content-Length": str(size)},
        )

    start, end = parsed
    length = end - start + 1
    with open(path, "rb") as f:
        f.seek(start)
        data = f.read(length)

    return Response(
        status_code=206,
        content=data,
        media_type=media_type,
        headers={
            **common,
            "Content-Range": f"bytes {start}-{end}/{size}",
            "Content-Length": str(length),
        },
    )
