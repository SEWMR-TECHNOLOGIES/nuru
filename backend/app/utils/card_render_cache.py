"""In-memory caches for the card render hot path.

The dispatch loop in ``api/routes/event_cards.py`` previously re-read the
template SVG and every embedded font file from disk for every recipient,
then base64-encoded each font into a data URI on every iteration. For a
batch of 200 invitations that is ~200 * (file IO + base64 of ~1-2 MB of
font data) of wasted work.

These caches are keyed by ``(absolute_path, mtime_ns)`` so an operator
who hot-swaps a template file (mtime changes) gets a fresh read on the
next request without restarting the API.

Nothing here changes the rendered output — the cached values are byte-
identical to what the legacy code computed on every call.
"""
from __future__ import annotations

import base64
import threading
from pathlib import Path
from typing import Optional, Tuple

_lock = threading.Lock()

# {(abs_path, mtime_ns): bytes}
_BYTES_CACHE: dict[Tuple[str, int], bytes] = {}
# {(abs_path, mtime_ns): str (utf-8)}
_TEXT_CACHE: dict[Tuple[str, int], str] = {}
# {(abs_path, mtime_ns): "data:<mime>;base64,<b64>"}
_DATA_URI_CACHE: dict[Tuple[str, int], str] = {}
# {(template_id, mode, font_paths_tuple): "<style>...</style>"}
_FONT_FACE_BLOCK_CACHE: dict[Tuple[str, str, tuple], str] = {}

_MAX_ENTRIES = 256


def _key(path: str | Path) -> Optional[Tuple[str, int]]:
    try:
        p = Path(path)
        st = p.stat()
        return (str(p.resolve()), st.st_mtime_ns)
    except Exception:
        return None


def _trim(d: dict) -> None:
    if len(d) > _MAX_ENTRIES:
        # drop ~25% of oldest entries
        for k in list(d.keys())[: len(d) - int(_MAX_ENTRIES * 0.75)]:
            d.pop(k, None)


def read_bytes_cached(path: str | Path) -> bytes:
    key = _key(path)
    if key is None:
        return Path(path).read_bytes()
    with _lock:
        hit = _BYTES_CACHE.get(key)
        if hit is not None:
            return hit
    data = Path(path).read_bytes()
    with _lock:
        _BYTES_CACHE[key] = data
        _trim(_BYTES_CACHE)
    return data


def read_text_cached(path: str | Path) -> str:
    key = _key(path)
    if key is None:
        return Path(path).read_text(encoding="utf-8")
    with _lock:
        hit = _TEXT_CACHE.get(key)
        if hit is not None:
            return hit
    text = Path(path).read_text(encoding="utf-8")
    with _lock:
        _TEXT_CACHE[key] = text
        _trim(_TEXT_CACHE)
    return text


def font_data_uri(path: str | Path, mime: str) -> str:
    """Return ``data:<mime>;base64,<b64>`` for the font file, cached."""
    key = _key(path)
    if key is None:
        data = Path(path).read_bytes()
        return f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"
    with _lock:
        hit = _DATA_URI_CACHE.get(key)
        if hit is not None:
            return hit
    data = Path(path).read_bytes()
    uri = f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}"
    with _lock:
        _DATA_URI_CACHE[key] = uri
        _trim(_DATA_URI_CACHE)
    return uri


def get_font_face_block(template_id: str, mode: str, font_paths: tuple) -> Optional[str]:
    return _FONT_FACE_BLOCK_CACHE.get((template_id, mode, font_paths))


def set_font_face_block(template_id: str, mode: str, font_paths: tuple, block: str) -> None:
    with _lock:
        _FONT_FACE_BLOCK_CACHE[(template_id, mode, font_paths)] = block
        _trim(_FONT_FACE_BLOCK_CACHE)


def invalidate_template(template_id: str) -> None:
    """Drop any cached <style> blocks for a template (called when fonts edited)."""
    with _lock:
        for k in list(_FONT_FACE_BLOCK_CACHE.keys()):
            if k[0] == template_id:
                _FONT_FACE_BLOCK_CACHE.pop(k, None)
