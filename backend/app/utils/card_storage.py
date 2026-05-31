"""Storage backend abstraction for the event card editor.

All filesystem access for card templates, fonts, and rendered PNG cache
goes through a single ``CardStorage`` interface so we can later swap the
local backend for S3 / R2 / Supabase Storage / MinIO without touching the
routes, renderer, or delivery code.

Today only ``LocalCardStorage`` is wired in; it reads templates from
``backend/app/static/cards/<category>/`` and caches rendered PNGs under
``$NURU_CARDS_CACHE_DIR`` (default ``/tmp/nuru_cards_cache``).

To add an object-storage backend later:
  1. Implement the abstract methods below (``read_template_bytes``,
     ``read_asset``, ``cache_get`` / ``cache_put``, ``list_categories``,
     ``list_category_files``, ``open_font_dir``).
  2. Select it via the ``NURU_CARDS_STORAGE`` env var (``local`` |
     ``s3`` | ``r2`` | ``supabase`` | ``minio``) in ``get_card_storage()``.
  3. No callers in ``api/routes/event_cards.py`` should need to change.
"""
from __future__ import annotations

import os
import re
import tempfile
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Iterable, Optional

_SAFE_SLUG = re.compile(r"^[A-Za-z0-9_-]+$")


class CardStorage(ABC):
    """Abstract storage backend for card templates + rendered card cache."""

    # ── Template catalogue ────────────────────────────────────────────
    @abstractmethod
    def list_categories(self) -> list[str]: ...

    @abstractmethod
    def list_category_files(self, category: str) -> list[str]:
        """Return file names (basenames) in a category directory."""

    @abstractmethod
    def read_text(self, relpath: str) -> str:
        """Read a UTF-8 text file by ``category/file`` relative path."""

    @abstractmethod
    def read_bytes(self, relpath: str) -> bytes: ...

    @abstractmethod
    def exists(self, relpath: str) -> bool: ...

    @abstractmethod
    def absolute_path(self, relpath: str) -> Optional[str]:
        """Best-effort absolute path for FileResponse-style serving.

        Object-storage backends should return ``None`` and the caller
        should fall back to streaming ``read_bytes`` through ``Response``.
        """

    @abstractmethod
    def open_font_dir(self, category: str) -> str:
        """Return a local directory containing the category's font files.

        For object-storage backends this should materialise fonts to a
        per-process temp dir (cached) so ``cairosvg`` / fontconfig can
        find them. For the local backend this is the on-disk path.
        """

    # ── Rendered PNG cache ────────────────────────────────────────────
    @abstractmethod
    def cache_get(self, key: str) -> Optional[bytes]: ...

    @abstractmethod
    def cache_put(self, key: str, data: bytes) -> Optional[str]:
        """Persist a cached render; return a public URL if the backend
        exposes one (e.g. S3 + CloudFront), else ``None``."""


# ──────────────────────────────────────────────────────────────────────
# Local filesystem implementation
# ──────────────────────────────────────────────────────────────────────


class LocalCardStorage(CardStorage):
    def __init__(self, root: Path, cache_dir: Path) -> None:
        self.root = root.resolve()
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    # path helpers
    def _safe(self, relpath: str) -> Path:
        p = (self.root / relpath).resolve()
        if not str(p).startswith(str(self.root)):
            raise ValueError("Path escapes storage root")
        return p

    # catalogue
    def list_categories(self) -> list[str]:
        if not self.root.exists():
            return []
        return sorted([c.name for c in self.root.iterdir() if c.is_dir()])

    def list_category_files(self, category: str) -> list[str]:
        if not _SAFE_SLUG.match(category):
            raise ValueError("Invalid category slug")
        d = self._safe(category)
        if not d.is_dir():
            return []
        return sorted([f.name for f in d.iterdir() if f.is_file()])

    def read_text(self, relpath: str) -> str:
        return self._safe(relpath).read_text(encoding="utf-8")

    def read_bytes(self, relpath: str) -> bytes:
        return self._safe(relpath).read_bytes()

    def exists(self, relpath: str) -> bool:
        try:
            return self._safe(relpath).exists()
        except ValueError:
            return False

    def absolute_path(self, relpath: str) -> Optional[str]:
        p = self._safe(relpath)
        return str(p) if p.exists() else None

    def open_font_dir(self, category: str) -> str:
        return str(self._safe(category))

    # cache
    def cache_get(self, key: str) -> Optional[bytes]:
        p = self.cache_dir / key
        if p.exists():
            try:
                return p.read_bytes()
            except Exception:
                return None
        return None

    def cache_put(self, key: str, data: bytes) -> Optional[str]:
        try:
            (self.cache_dir / key).write_bytes(data)
        except Exception:
            pass
        return None


# ──────────────────────────────────────────────────────────────────────
# Factory
# ──────────────────────────────────────────────────────────────────────

_DEFAULT_ROOT = Path(__file__).resolve().parents[1] / "static" / "cards"
_DEFAULT_CACHE = Path(os.getenv("NURU_CARDS_CACHE_DIR", "/tmp/nuru_cards_cache"))

_singleton: Optional[CardStorage] = None


def get_card_storage() -> CardStorage:
    """Return the configured card storage backend (singleton).

    Selection driven by ``NURU_CARDS_STORAGE`` env var. Today only
    ``local`` is implemented; the dispatch block is the only place a
    future backend needs to be added.
    """
    global _singleton
    if _singleton is not None:
        return _singleton

    backend = (os.getenv("NURU_CARDS_STORAGE") or "local").lower()
    root = Path(os.getenv("NURU_CARDS_ROOT") or str(_DEFAULT_ROOT))

    if backend == "local":
        _singleton = LocalCardStorage(root=root, cache_dir=_DEFAULT_CACHE)
    else:
        # Until a remote backend is implemented, fail loud and fall back
        # to local so production never silently loses template access.
        print(f"[card_storage] backend '{backend}' not implemented; using local")
        _singleton = LocalCardStorage(root=root, cache_dir=_DEFAULT_CACHE)
    return _singleton
