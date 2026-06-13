"""WhatsApp-safe media preparation.

Meta's Cloud API frequently fails to download large or PNG-with-alpha
images that we render for event cards (Meta error 131053 — "Media
download error"). To make WhatsApp template headers reliable we keep the
original PNG (for display + download) and additionally publish a
flattened, EXIF-stripped JPEG variant that lives next to it in storage
and is what we hand to Meta.

Public helpers:
    prepare_whatsapp_jpeg_bytes(png_bytes) -> (jpg_bytes, width, height)
    ensure_whatsapp_media_for_png_url(png_url) -> dict
        {"url", "content_type", "size", "width", "height", "reused"}

Naming convention: for a PNG uploaded at
    .../<dir>/<uuid>.png
the WhatsApp-safe sibling is published at
    .../<dir>/<uuid>.wa.jpg
so callers can derive the URL deterministically.
"""
from __future__ import annotations

import io
import os
from typing import Optional, Tuple
from urllib.parse import urlparse

import requests

try:
    from PIL import Image
except Exception:  # noqa: BLE001 — surface the import error only at call time
    Image = None  # type: ignore

from core.config import UPLOAD_SERVICE_URL


# Meta is happy with images <= 5 MB; we target ~1 MB to leave plenty of
# headroom for re-encoding by Meta's CDN.
MAX_WIDTH = 1280
MAX_BYTES = 1_000_000
JPEG_QUALITY = 85
JPEG_QUALITY_MIN = 65


def prepare_whatsapp_jpeg_bytes(png_bytes: bytes) -> Tuple[bytes, int, int]:
    """Convert raw image bytes into a WhatsApp-safe JPEG.

    - Flattens alpha onto white background (Meta rejects PNG transparency).
    - Down-scales to ``MAX_WIDTH`` while preserving aspect ratio.
    - Strips EXIF / ICC / metadata.
    - Iteratively lowers quality if the result exceeds ``MAX_BYTES``.

    Returns ``(jpg_bytes, width, height)``.
    """
    if Image is None:
        raise RuntimeError("Pillow is not installed; cannot prepare WhatsApp media")
    if not png_bytes:
        raise ValueError("png_bytes is empty")

    img = Image.open(io.BytesIO(png_bytes))
    img.load()

    # Flatten transparency onto white.
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        bg = Image.new("RGB", img.size, (255, 255, 255))
        rgba = img.convert("RGBA")
        bg.paste(rgba, mask=rgba.split()[-1])
        img = bg
    else:
        img = img.convert("RGB")

    # Down-scale if needed.
    if img.width > MAX_WIDTH:
        new_h = int(round(img.height * (MAX_WIDTH / float(img.width))))
        img = img.resize((MAX_WIDTH, new_h), Image.LANCZOS)

    width, height = img.size

    # Encode, stepping quality down until we fit MAX_BYTES.
    quality = JPEG_QUALITY
    out = io.BytesIO()
    while True:
        out.seek(0)
        out.truncate(0)
        img.save(
            out,
            format="JPEG",
            quality=quality,
            optimize=True,
            progressive=True,
            subsampling="4:2:0",
        )
        size = out.tell()
        if size <= MAX_BYTES or quality <= JPEG_QUALITY_MIN:
            break
        quality -= 5
    return out.getvalue(), width, height


def _derive_wa_jpg_url(png_url: str) -> Optional[str]:
    if not png_url:
        return None
    base, _, query = png_url.partition("?")
    low = base.lower()
    if low.endswith(".png"):
        wa = base[:-4] + ".wa.jpg"
    elif low.endswith(".jpeg"):
        wa = base[:-5] + ".wa.jpg"
    elif low.endswith(".jpg"):
        wa = base[:-4] + ".wa.jpg"
    else:
        return None
    return wa + (("?" + query) if query else "")



def _split_url_for_upload(png_url: str) -> Tuple[str, str]:
    """Return ``(target_path, wa_filename)`` from a sewmr-style storage URL."""
    parsed = urlparse(png_url)
    parts = parsed.path.split("/")
    if len(parts) < 2:
        raise ValueError(f"Cannot derive target path from URL: {png_url}")
    filename = parts[-1]
    # Storage convention: the upload handler expects a target_path *under*
    # the bucket root. The URL path on data.sewmrtechnologies.com is
    # `/storage/<bucket>/<target_path...>/<filename>` — strip the leading
    # `/storage/<bucket>/` segments so we re-upload to the same folder.
    path_parts = [p for p in parts[1:-1] if p]
    if path_parts and path_parts[0] == "storage":
        path_parts = path_parts[1:]
    if path_parts and path_parts[0] in ("nuru",):
        # keep "nuru/..." prefix — UPLOAD_SERVICE_URL expects it.
        target_path = "/".join(path_parts) + "/"
    else:
        target_path = "/".join(path_parts) + "/"
    # Strip any known extension to derive the WA filename base.
    fl = filename.lower()
    if fl.endswith(".jpeg"):
        base = filename[:-5]
    elif fl.endswith(".png") or fl.endswith(".jpg"):
        base = filename[:-4]
    else:
        base = filename
    return target_path, f"{base}.wa.jpg"



def _head_ok(url: str, timeout: float = 6.0) -> bool:
    try:
        r = requests.head(url, timeout=timeout, allow_redirects=True)
        return r.status_code == 200
    except Exception:
        return False


def ensure_whatsapp_media_for_png_url(png_url: str) -> dict:
    """Make sure a `.wa.jpg` sibling exists for ``png_url``.

    Returns a dict describing the WhatsApp-safe media. The shape is:
        {
            "url":          str,   # final WhatsApp-safe URL
            "content_type": "image/jpeg" | "image/png" (fallback),
            "size":         int | None,
            "width":        int | None,
            "height":       int | None,
            "reused":       bool,  # True if sibling already existed
            "original_url": str,
            "error":        str | None,
        }

    On any failure the function falls back to the original PNG URL so
    sending never crashes — the dispatcher just logs the failure.
    """
    out = {
        "url": png_url,
        "content_type": "image/png",
        "size": None,
        "width": None,
        "height": None,
        "reused": False,
        "original_url": png_url,
        "error": None,
    }
    if not png_url:
        out["error"] = "empty url"
        return out

    src_low = png_url.partition("?")[0].lower()
    is_png = src_low.endswith(".png")
    is_jpg = src_low.endswith(".jpg") or src_low.endswith(".jpeg")
    if not (is_png or is_jpg):
        out["error"] = "url is not png/jpg"
        return out
    if is_jpg:
        out["content_type"] = "image/jpeg"
        # If the source JPG is already comfortably within Meta's limit,
        # there is nothing to do — return the original URL.
        try:
            h = requests.head(png_url, timeout=6, allow_redirects=True)
            cl = h.headers.get("content-length")
            if h.status_code == 200 and cl and cl.isdigit() and int(cl) <= MAX_BYTES:
                out["size"] = int(cl)
                return out
        except Exception:
            pass

    wa_url = _derive_wa_jpg_url(png_url)
    if not wa_url:
        out["error"] = "cannot derive wa.jpg url"
        return out


    # Fast path — already generated.
    if _head_ok(wa_url):
        out.update({"url": wa_url, "content_type": "image/jpeg", "reused": True})
        try:
            r = requests.head(wa_url, timeout=6, allow_redirects=True)
            cl = r.headers.get("content-length")
            if cl and cl.isdigit():
                out["size"] = int(cl)
        except Exception:
            pass
        return out

    # Slow path — download, convert, upload.
    try:
        r = requests.get(png_url, timeout=20)
        r.raise_for_status()
        png_bytes = r.content
        jpg_bytes, width, height = prepare_whatsapp_jpeg_bytes(png_bytes)
        target_path, wa_filename = _split_url_for_upload(png_url)
        files = {"file": (wa_filename, jpg_bytes, "image/jpeg")}
        data = {"target_path": target_path}
        up = requests.post(UPLOAD_SERVICE_URL, files=files, data=data, timeout=30)
        result = {}
        try:
            result = up.json()
        except Exception:
            result = {}
        if not up.ok or not result.get("success"):
            out["error"] = f"upload failed: status={up.status_code} body={up.text[:200]}"
            return out
        new_url = (result.get("data") or {}).get("url") or wa_url
        out.update({
            "url": new_url,
            "content_type": "image/jpeg",
            "size": len(jpg_bytes),
            "width": width,
            "height": height,
            "reused": False,
        })
        return out
    except Exception as e:  # noqa: BLE001
        out["error"] = f"prepare failed: {e}"
        return out


def prepare_whatsapp_card_media(original_png_url: str) -> str:
    """Convenience wrapper — returns the WhatsApp-safe URL or the original
    PNG URL on failure (so callers can always pass *something* to Meta)."""
    return ensure_whatsapp_media_for_png_url(original_png_url).get("url") or original_png_url
