"""Event card editor + pledge thank-you card delivery.

All endpoints are mounted under the default ``/api/v1`` prefix.

Card templates live on disk under ``backend/app/static/cards/<category>/``.
Each category folder contains one or more SVG files plus optional fonts
and a ``metadata.json`` describing editable fields. The scanner registers
every template into the ``card_templates`` DB table on demand so saved
``event_cards`` rows can reference a stable UUID.

SVG editing is restricted to the editable_fields whitelist in metadata.json
AND the SVG element must carry ``data-editable="true"``. The contributor
placeholder is never written by the editor; it is only substituted at
delivery time.
"""
from __future__ import annotations

import json
import os
import base64
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse, Response
from sqlalchemy import and_
from sqlalchemy.orm import Session, joinedload

from core.database import get_db
from models import (
    CardTemplate,
    Event,
    EventCard,
    EventContributor,
    SentEventCard,
    User,
    UserSetting,
)
from utils.auth import get_current_user
from utils.card_storage import get_card_storage
from utils.helpers import standard_response

router = APIRouter(tags=["Event Cards"])

# ──────────────────────────────────────────────
# Storage backend (filesystem today; swap via NURU_CARDS_STORAGE)
# ──────────────────────────────────────────────

_storage = get_card_storage()
_SAFE_NAME = re.compile(r"^[A-Za-z0-9 _.-]+$")
_SAFE_SLUG = re.compile(r"^[A-Za-z0-9_-]+$")


def _font_media_type_and_format(abs_path: str | Path, filename: str) -> tuple[str, str]:
    suffix = Path(filename).suffix.lower()
    media_type = {
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".otf": "font/otf",
        ".woff": "font/woff",
        ".woff2": "font/woff2",
    }.get(suffix)
    css_format = {
        ".otf": "opentype",
        ".woff": "woff",
        ".woff2": "woff2",
    }.get(suffix)
    if suffix == ".ttf":
        try:
            header = Path(abs_path).read_bytes()[:4]
        except Exception:
            header = b""
        if header == b"ttcf":
            return "font/collection", "collection"
        return "font/ttf", "truetype"
    return media_type or "application/octet-stream", css_format or "truetype"


def _validate_category(category: str) -> str:
    if not category or not _SAFE_SLUG.match(category):
        raise HTTPException(status_code=400, detail="Invalid category")
    if category not in _storage.list_categories():
        raise HTTPException(status_code=404, detail="Category not found")
    return category


def _read_metadata(category: str) -> Dict[str, Any]:
    rel = f"{category}/metadata.json"
    if not _storage.exists(rel):
        return {}
    try:
        return json.loads(_storage.read_text(rel))
    except Exception:
        return {}


def _list_categories() -> List[Dict[str, Any]]:
    out = []
    for cat in _storage.list_categories():
        meta = _read_metadata(cat)
        svgs = [f for f in _storage.list_category_files(cat) if f.lower().endswith(".svg")]
        if not svgs:
            continue
        out.append({
            "category": cat,
            "label": meta.get("category_label") or cat.replace("-", " ").title(),
            "templates_count": len(svgs),
        })
    return out


def _list_templates_in(category: str) -> List[Dict[str, Any]]:
    _validate_category(category)
    meta = _read_metadata(category)
    files = _storage.list_category_files(category)
    svgs = sorted([f for f in files if f.lower().endswith(".svg")])
    out = []
    for svg_name in svgs:
        # Per-template metadata can either live in metadata.json (single
        # template) or `<svg-stem>.json` (multi-template categories).
        per_rel = f"{category}/{Path(svg_name).stem}.json"
        m = meta if not _storage.exists(per_rel) else json.loads(_storage.read_text(per_rel))
        slug = m.get("slug") or f"{category}-{Path(svg_name).stem}"
        out.append({
            "category": category,
            "slug": slug,
            "name": m.get("name") or Path(svg_name).stem.replace("_", " ").title(),
            "svg_file": svg_name,
            "thumbnail_file": m.get("thumbnail_file"),
            "editable_fields": m.get("editable_fields", []),
            "contributor_placeholder_id": m.get("contributor_placeholder_id"),
            "locked_ids": m.get("locked_ids", []),
            "fonts": m.get("fonts", []),
            "qr_placement": m.get("qr_placement"),
            "view_box": m.get("view_box"),
            "preserve_text_positions": bool(m.get("preserve_text_positions")),
            "replace_defaults_in_preview": bool(m.get("replace_defaults_in_preview")),
            "recipient_noun": m.get("recipient_noun"),
            "recipient_source": (m.get("recipient_source") or "contributors"),
            "recipient_filter": m.get("recipient_filter") or [],
        })
    return out


def _get_or_register_template(db: Session, category: str, slug: str) -> CardTemplate:
    found = next((t for t in _list_templates_in(category) if t["slug"] == slug), None)
    if not found:
        raise HTTPException(status_code=404, detail="Template not found")
    row = db.query(CardTemplate).filter(CardTemplate.slug == slug).first()
    if row:
        # keep metadata fresh on each access — cheap and avoids stale fields
        row.metadata_json = found
        row.svg_path = f"{category}/{found['svg_file']}"
        row.name = found["name"]
        row.category = category
        db.commit()
        return row
    row = CardTemplate(
        category=category,
        slug=slug,
        name=found["name"],
        svg_path=f"{category}/{found['svg_file']}",
        thumbnail_path=(f"{category}/{found['thumbnail_file']}" if found.get("thumbnail_file") else None),
        metadata_json=found,
        is_active=True,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


# ──────────────────────────────────────────────
# SVG safety + editing
# ──────────────────────────────────────────────

_SCRIPT_RE = re.compile(r"<script[\s\S]*?</script>", re.IGNORECASE)
_ON_ATTR_RE = re.compile(r"\son[a-z]+\s*=\s*\"[^\"]*\"", re.IGNORECASE)


def _sanitize_svg(svg: str) -> str:
    svg = re.sub(r"<\?xml[\s\S]*?\?>", "", svg, flags=re.IGNORECASE)
    svg = re.sub(r"<!DOCTYPE[\s\S]*?\]>", "", svg, flags=re.IGNORECASE)
    svg = re.sub(r"<!DOCTYPE[^>]*>", "", svg, flags=re.IGNORECASE)
    svg = _SCRIPT_RE.sub("", svg)
    svg = _ON_ATTR_RE.sub("", svg)
    return svg.strip()


def _center_text_element(svg: str, element_id: str, center_x: float = 561.0) -> str:
    """Keep dynamic single-line text visually centred in the card artwork."""
    id_part = re.escape(element_id)

    def patch_open(match: re.Match) -> str:
        open_tag = match.group(1)
        open_tag = re.sub(
            r'transform="matrix\(1\s+0\s+0\s+1\s+[-0-9.]+\s+([-0-9.]+)\)"',
            lambda m: f'transform="matrix(1 0 0 1 {center_x:g} {m.group(1)})"',
            open_tag,
            count=1,
        )
        if 'text-anchor=' in open_tag:
            open_tag = re.sub(r'text-anchor="[^"]*"', 'text-anchor="middle"', open_tag, count=1)
        else:
            open_tag = open_tag[:-1] + ' text-anchor="middle">'
        return open_tag

    return re.sub(r'(<(?:text|tspan)\b[^>]*\bid\s*=\s*"' + id_part + r'"[^>]*>)', patch_open, svg, count=1, flags=re.IGNORECASE)


def _inject_template_font_faces(svg: str, tpl: CardTemplate, mode: str = "file") -> str:
    meta = tpl.metadata_json or {}
    fonts = meta.get("fonts") or []
    if not fonts:
        return svg
    blocks: List[str] = []
    for filename in fonts:
        if not isinstance(filename, str) or not _SAFE_NAME.match(filename):
            continue
        rel = f"{tpl.category}/{filename}"
        abs_path = _storage.absolute_path(rel)
        if not abs_path:
            continue
        mime, fmt = _font_media_type_and_format(abs_path, filename)
        bare = re.sub(r"\.(ttf|otf|woff2?|eot)$", "", filename, flags=re.IGNORECASE)
        spaced = re.sub(r"\s*Italic\s*$", "", bare, flags=re.IGNORECASE).strip()
        squashed = re.sub(r"\s+", "", spaced)
        is_italic = "italic" in filename.lower()
        if mode == "data":
            data = base64.b64encode(Path(abs_path).read_bytes()).decode("ascii")
            url = f"data:{mime};base64,{data}"
        else:
            url = Path(abs_path).resolve().as_uri()
        for family in dict.fromkeys([spaced, squashed]):
            if family:
                blocks.append(
                    f"@font-face{{font-family:'{family}';src:url('{url}') format('{fmt}');font-weight:400;font-style:{'italic' if is_italic else 'normal'};}}"
                )
    if not blocks:
        return svg
    return re.sub(r"</svg>\s*$", f"<style>{''.join(blocks)}</style></svg>", svg, flags=re.IGNORECASE)


def _apply_text_edits(svg: str, edits: Dict[str, str], allowed_ids: List[str]) -> str:
    """Replace text content of <text id="…"> / <tspan id="…"> nodes when the
    id is in ``allowed_ids`` AND the element carries data-editable="true".
    Only inner text is replaced. Element structure is preserved.
    """
    if not edits:
        return svg
    for eid, value in edits.items():
        if eid not in allowed_ids:
            continue
        safe_val = (str(value or "")
                    .replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;"))
        # Match either <tspan ...>...</tspan> or <text ...>...</text> where
        # the open tag carries id="<eid>" AND data-editable="true".
        pattern = re.compile(
            r'(<(text|tspan)\b[^>]*\bid\s*=\s*"' + re.escape(eid) +
            r'"[^>]*\bdata-editable\s*=\s*"true"[^>]*>)([\s\S]*?)(</\2>)',
            re.IGNORECASE,
        )
        svg = pattern.sub(lambda m: f"{m.group(1)}{safe_val}{m.group(4)}", svg)
    return svg


def _render_qr_data_uri(payload: str, size_px: int = 512) -> Optional[str]:
    """Render `payload` as a high-error-correction QR PNG and return a
    ``data:image/png;base64,…`` URI suitable for inlining in an SVG.
    Returns ``None`` if the `qrcode` package isn't available."""
    if not payload:
        return None
    try:
        import qrcode  # type: ignore
        from io import BytesIO
        qr = qrcode.QRCode(
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=1,
        )
        qr.add_data(payload)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        # Upscale/downscale to the requested pixel size for crispness.
        try:
            img = img.resize((size_px, size_px))
        except Exception:
            pass
        buf = BytesIO()
        img.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/png;base64,{b64}"
    except Exception as exc:
        print(f"[event_cards] qr render failed: {exc!r}")
        return None


def _inject_qr_image(svg: str, qr_placement: Optional[Dict[str, Any]], payload: str) -> str:
    """Append an ``<image>`` element rendering the QR at the metadata
    ``qr_placement`` rectangle, immediately before ``</svg>``. Existing
    placeholder QR artwork in the template is left alone — the inlined
    image simply overlays it at the same coordinates."""
    if not qr_placement or not payload:
        return svg
    try:
        x = float(qr_placement.get("x", 0))
        y = float(qr_placement.get("y", 0))
        w = float(qr_placement.get("width", 0))
        h = float(qr_placement.get("height", 0))
    except Exception:
        return svg
    if w <= 0 or h <= 0:
        return svg
    data_uri = _render_qr_data_uri(payload, size_px=max(256, int(round(max(w, h) * 6))))
    if not data_uri:
        return svg
    img_tag = (
        f'<image x="{x}" y="{y}" width="{w}" height="{h}" '
        f'preserveAspectRatio="xMidYMid meet" '
        f'href="{data_uri}" xlink:href="{data_uri}" />'
    )
    # Inject before the LAST </svg> close tag.
    idx = svg.rfind("</svg>")
    if idx == -1:
        return svg
    return svg[:idx] + img_tag + svg[idx:]


def _render_event_card_svg(
    db: Session,
    event: Event,
    category: str,
    contributor_name: Optional[str] = None,
    qr_payload: Optional[str] = None,
) -> tuple[str, EventCard, CardTemplate]:
    ec = (
        db.query(EventCard)
        .filter(EventCard.event_id == event.id, EventCard.category == category, EventCard.is_active.is_(True))
        .first()
    )
    if not ec:
        raise HTTPException(status_code=404, detail="No card configured for this event yet.")
    tpl = db.query(CardTemplate).filter(CardTemplate.id == ec.card_template_id).first()
    if not tpl:
        raise HTTPException(status_code=404, detail="Card template missing.")
    if not _storage.exists(tpl.svg_path):
        raise HTTPException(status_code=500, detail="Card asset missing.")
    raw = _sanitize_svg(_storage.read_text(tpl.svg_path))
    meta = tpl.metadata_json or {}
    allowed = [f["id"] for f in meta.get("editable_fields", []) if f.get("id")]
    svg = _apply_text_edits(raw, ec.custom_text_values or {}, allowed)
    preserve_text_positions = bool(meta.get("preserve_text_positions"))
    # Legacy cards need runtime centering; optimized SVG templates keep their
    # author-provided coordinates exactly to avoid shifting the artwork text.
    if not preserve_text_positions:
        for fid in allowed:
            svg = _center_text_element(svg, fid)
    if contributor_name:
        placeholder = meta.get("contributor_placeholder_id") or "contributor_name_text"
        pattern = re.compile(
            r'(<(text|tspan)\b[^>]*\bid\s*=\s*"' + re.escape(placeholder) + r'"[^>]*>)([\s\S]*?)(</\2>)',
            re.IGNORECASE,
        )
        safe_name = (contributor_name.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))
        prefix_raw = ((ec.custom_text_values or {}).get("__guest_name_prefix") or "").strip()
        if prefix_raw:
            safe_prefix = prefix_raw.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
            safe_name = f"{safe_prefix} {safe_name}"
        svg = pattern.sub(lambda m: f"{m.group(1)}{safe_name}{m.group(4)}", svg)
        if not preserve_text_positions:
            svg = _center_text_element(svg, placeholder)
    if qr_payload:
        svg = _inject_qr_image(svg, meta.get("qr_placement"), qr_payload)
    svg = _inject_template_font_faces(svg, tpl, mode="data")
    return svg, ec, tpl



def _render_png_bytes(svg: str, tpl: CardTemplate, width: int = 1080) -> Optional[bytes]:
    """Best-effort SVG → PNG using cairosvg with the template's font dir.
    Returns None if cairosvg isn't installed or rendering fails — callers
    should fall back to SMS-only delivery.
    """
    try:
        import cairosvg  # type: ignore
    except Exception:
        return None
    font_dir = _storage.open_font_dir(tpl.category)
    prev_fc = os.environ.get("FONTCONFIG_PATH")
    prev_xdg = os.environ.get("XDG_DATA_HOME")
    os.environ["XDG_DATA_HOME"] = str(font_dir)
    try:
        return cairosvg.svg2png(bytestring=svg.encode("utf-8"), output_width=width)
    except Exception as exc:
        print(f"[event_cards] cairosvg render failed: {exc!r}")
        return None
    finally:
        if prev_fc is not None:
            os.environ["FONTCONFIG_PATH"] = prev_fc
        if prev_xdg is not None:
            os.environ["XDG_DATA_HOME"] = prev_xdg
        else:
            os.environ.pop("XDG_DATA_HOME", None)


def _public_api_base(host: str) -> str:
    """Public API host used for Meta-fetchable card URLs."""
    configured = os.getenv("API_BASE_URL", "").rstrip("/")
    if configured:
        configured = configured.replace("https://api.nuru.tz", "https://nuruapi.nuru.tz")
        configured = configured.replace("http://api.nuru.tz", "https://nuruapi.nuru.tz")
        return configured
    clean_host = (host or "nuru.tz").strip().removeprefix("www.")
    if clean_host.startswith("nuru."):
        return f"https://nuruapi.{clean_host}"
    return f"https://nuruapi.nuru.tz"


# ──────────────────────────────────────────────
# Permissions
# ──────────────────────────────────────────────

def _assert_event_manager(db: Session, event_id: str, user: User) -> Event:
    try:
        eid = uuid.UUID(str(event_id))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event id")
    event = db.query(Event).filter(Event.id == eid).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if str(event.organizer_id) != str(user.id) and str(getattr(event, "event_owner_user_id", "")) != str(user.id):
        # accept committee permission with can_manage_contributions
        try:
            from models import EventCommitteeMember
            cm = db.query(EventCommitteeMember).filter(
                and_(EventCommitteeMember.event_id == event.id, EventCommitteeMember.member_user_id == user.id)
            ).first()
            if not cm:
                raise HTTPException(status_code=403, detail="Only the event organiser can manage cards.")
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=403, detail="Only the event organiser can manage cards.")
    return event


# ──────────────────────────────────────────────
# Catalogue endpoints (must be defined BEFORE dynamic event paths)
# ──────────────────────────────────────────────

@router.get("/cards/categories")
def list_categories(_user: User = Depends(get_current_user)):
    return standard_response(True, "OK", {"categories": _list_categories()})


@router.get("/cards/categories/{category}/templates")
def list_templates(category: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    tpls = _list_templates_in(category)
    # Register each so frontend can reference DB ids
    for t in tpls:
        _get_or_register_template(db, category, t["slug"])
    out = []
    for t in tpls:
        row = db.query(CardTemplate).filter(CardTemplate.slug == t["slug"]).first()
        out.append({
            "id": str(row.id) if row else None,
            **t,
            "svg_url": f"/api/v1/cards/templates/{t['slug']}/asset/{t['svg_file']}",
            "thumbnail_url": (f"/api/v1/cards/templates/{t['slug']}/asset/{t['thumbnail_file']}"
                              if t.get("thumbnail_file") else None),
        })
    return standard_response(True, "OK", {"category": category, "templates": out})


@router.get("/cards/templates/{slug}")
def get_template(slug: str, db: Session = Depends(get_db), _user: User = Depends(get_current_user)):
    row = db.query(CardTemplate).filter(CardTemplate.slug == slug).first()
    if not row:
        # search disk for this slug
        for cat in _list_categories():
            for t in _list_templates_in(cat["category"]):
                if t["slug"] == slug:
                    row = _get_or_register_template(db, cat["category"], slug)
                    break
            if row:
                break
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    svg = _sanitize_svg(_storage.read_text(row.svg_path))
    return standard_response(True, "OK", {
        "id": str(row.id),
        "slug": row.slug,
        "category": row.category,
        "name": row.name,
        "metadata": row.metadata_json or {},
        "svg": svg,
    })


@router.get("/cards/templates/{slug}/asset/{filename}")
def get_template_asset(slug: str, filename: str, db: Session = Depends(get_db)):
    if not _SAFE_NAME.match(filename):
        raise HTTPException(status_code=400, detail="Invalid filename")
    row = db.query(CardTemplate).filter(CardTemplate.slug == slug).first()
    if not row:
        raise HTTPException(status_code=404, detail="Template not found")
    rel = f"{row.category}/{filename}"
    if not _storage.exists(rel):
        raise HTTPException(status_code=404, detail="Asset not found")
    suffix = Path(filename).suffix.lower()
    abs_path = _storage.absolute_path(rel)
    mt, _ = _font_media_type_and_format(abs_path or rel, filename)
    if suffix == ".svg":
        svg = _inject_template_font_faces(_sanitize_svg(_storage.read_text(rel)), row, mode="data")
        return Response(content=svg, media_type=mt)
    if abs_path:
        return FileResponse(abs_path, media_type=mt)
    return Response(content=_storage.read_bytes(rel), media_type=mt)


# ──────────────────────────────────────────────
# Event-scoped endpoints
# ──────────────────────────────────────────────

@router.get("/events/{event_id}/cards")
def list_event_cards(event_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    event = _assert_event_manager(db, event_id, current_user)
    rows = db.query(EventCard).filter(EventCard.event_id == event.id, EventCard.is_active.is_(True)).all()
    data = []
    for ec in rows:
        tpl = db.query(CardTemplate).filter(CardTemplate.id == ec.card_template_id).first()
        data.append({
            "id": str(ec.id),
            "category": ec.category,
            "card_template_id": str(ec.card_template_id),
            "card_template_slug": tpl.slug if tpl else None,
            "card_template_name": tpl.name if tpl else None,
            "custom_text_values": ec.custom_text_values or {},
            "updated_at": ec.updated_at.isoformat() if ec.updated_at else None,
        })
    return standard_response(True, "OK", {"event_cards": data})


@router.put("/events/{event_id}/cards")
def upsert_event_card(
    event_id: str,
    body: dict = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = _assert_event_manager(db, event_id, current_user)
    slug = (body.get("card_template_slug") or "").strip()
    category = (body.get("category") or "").strip()
    tpl_id_raw = body.get("card_template_id")
    if not category:
        raise HTTPException(status_code=400, detail="category is required")
    tpl: Optional[CardTemplate] = None
    if tpl_id_raw:
        try:
            tpl = db.query(CardTemplate).filter(CardTemplate.id == uuid.UUID(str(tpl_id_raw))).first()
        except Exception:
            tpl = None
    if not tpl and slug:
        tpl = _get_or_register_template(db, category, slug)
    if not tpl:
        raise HTTPException(status_code=400, detail="card_template_id or card_template_slug is required")
    if tpl.category != category:
        raise HTTPException(status_code=400, detail="Category does not match template")

    meta = tpl.metadata_json or {}
    allowed_ids = {f["id"] for f in meta.get("editable_fields", []) if f.get("id")}
    max_len_by_id = {f["id"]: int(f.get("max_length") or 1000) for f in meta.get("editable_fields", [])}
    locked = set(meta.get("locked_ids", [])) | {meta.get("contributor_placeholder_id") or "contributor_name_text"}

    raw_values = body.get("custom_text_values") or {}
    if not isinstance(raw_values, dict):
        raise HTTPException(status_code=400, detail="custom_text_values must be an object")
    clean: Dict[str, str] = {}
    for k, v in raw_values.items():
        if k in locked:
            continue
        if k not in allowed_ids:
            continue
        s = str(v or "")
        ml = max_len_by_id.get(k, 1000)
        if len(s) > ml:
            s = s[:ml]
        clean[k] = s

    existing = (
        db.query(EventCard)
        .filter(EventCard.event_id == event.id, EventCard.category == category, EventCard.is_active.is_(True))
        .first()
    )
    if existing:
        existing.card_template_id = tpl.id
        existing.custom_text_values = clean
        existing.updated_by_user_id = current_user.id
        existing.updated_at = datetime.utcnow()
        ec = existing
    else:
        ec = EventCard(
            event_id=event.id,
            card_template_id=tpl.id,
            category=category,
            custom_text_values=clean,
            created_by_user_id=current_user.id,
            updated_by_user_id=current_user.id,
            is_active=True,
        )
        db.add(ec)
    db.commit()
    db.refresh(ec)
    return standard_response(True, "Card saved.", {
        "id": str(ec.id),
        "category": ec.category,
        "card_template_id": str(ec.card_template_id),
        "card_template_slug": tpl.slug,
        "custom_text_values": ec.custom_text_values or {},
    })


@router.get("/events/{event_id}/cards/{category}/preview.svg")
def preview_event_card_svg(
    event_id: str,
    category: str,
    contributor_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = _assert_event_manager(db, event_id, current_user)
    name = None
    if contributor_id:
        try:
            ec = db.query(EventContributor).options(joinedload(EventContributor.contributor)).filter(
                EventContributor.id == uuid.UUID(contributor_id), EventContributor.event_id == event.id
            ).first()
            if ec and ec.contributor:
                name = ec.contributor.name
        except Exception:
            pass
    svg, _ec, _tpl = _render_event_card_svg(db, event, category, contributor_name=name)
    return Response(content=svg, media_type="image/svg+xml")


@router.get("/events/{event_id}/cards/{category}/preview.png")
def preview_event_card_png(
    event_id: str,
    category: str,
    contributor_id: Optional[str] = Query(default=None),
    width: int = Query(default=1080, ge=320, le=2160),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = _assert_event_manager(db, event_id, current_user)
    name = None
    if contributor_id:
        try:
            ec = db.query(EventContributor).options(joinedload(EventContributor.contributor)).filter(
                EventContributor.id == uuid.UUID(contributor_id), EventContributor.event_id == event.id
            ).first()
            if ec and ec.contributor:
                name = ec.contributor.name
        except Exception:
            pass
    svg, _ec, tpl = _render_event_card_svg(db, event, category, contributor_name=name)
    png = _render_png_bytes(svg, tpl, width=width)
    if not png:
        raise HTTPException(status_code=503, detail="PNG renderer unavailable on this server.")
    return Response(content=png, media_type="image/png")


@router.post("/events/{event_id}/cards/{category}/send")
def send_pledge_thank_you_cards(
    event_id: str,
    category: str,
    body: dict = Body(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = _assert_event_manager(db, event_id, current_user)
    dispatch_event_id = event.id
    dispatch_sender_user_id = current_user.id

    raw_guest_ids = body.get("guest_ids")
    raw_contrib_ids = body.get("contributor_ids")
    is_guest_dispatch = bool(raw_guest_ids)

    if is_guest_dispatch:
        if not isinstance(raw_guest_ids, list) or not raw_guest_ids:
            raise HTTPException(status_code=400, detail="guest_ids is required")
        try:
            ids = [uuid.UUID(str(x)) for x in raw_guest_ids]
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid guest id in list")
    else:
        if not isinstance(raw_contrib_ids, list) or not raw_contrib_ids:
            raise HTTPException(status_code=400, detail="contributor_ids is required")
        try:
            ids = [uuid.UUID(str(x)) for x in raw_contrib_ids]
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid contributor id in list")

    # Frontend can render the final PNG in the browser (matches preview
    # exactly, avoids 12 MB Illustrator SVG rasterisation on the VPS) and
    # upload one URL per contributor. Invitation cards (guest_ids) always
    # use server-side rendering so the per-recipient QR is embedded fresh.
    raw_pre = body.get("pre_rendered_images") or {}
    pre_rendered: Dict[str, str] = {}
    if not is_guest_dispatch and isinstance(raw_pre, dict):
        for k, v in raw_pre.items():
            if isinstance(v, str) and v.strip():
                pre_rendered[str(k)] = v.strip()

    active_card = (
        db.query(EventCard)
        .filter(and_(EventCard.event_id == dispatch_event_id, EventCard.category == category, EventCard.is_active.is_(True)))
        .first()
    )
    if not active_card:
        raise HTTPException(status_code=404, detail="No card configured for this event yet.")
    dispatch_event_card_id = active_card.id

    sent_card_ids: List[str] = []
    sid_to_pre_rendered: Dict[str, str] = {}

    if is_guest_dispatch:
        # Resolve event attendees + their invitation codes for QR payloads.
        from models import EventAttendee, EventInvitation, UserContributor
        attendees = (
            db.query(EventAttendee)
            .filter(and_(EventAttendee.event_id == dispatch_event_id, EventAttendee.id.in_(ids)))
            .all()
        )
        if not attendees:
            raise HTTPException(status_code=404, detail="No selected guests found on this event.")
        for att in attendees:
            # Display name — reuse the canonical resolver from user_events.
            try:
                from api.routes.user_events import _resolve_guest_name as _grn
                display_name = _grn(db, att) or att.guest_name or "Guest"
            except Exception:
                display_name = att.guest_name or "Guest"
            # Phone — attendee → linked user → linked contributor → guest_phone.
            phone = None
            if att.attendee_id:
                u = db.query(User).filter(User.id == att.attendee_id).first()
                phone = (getattr(u, "phone", None) if u else None)
            if not phone and att.contributor_id:
                c = db.query(UserContributor).filter(UserContributor.id == att.contributor_id).first()
                phone = c.phone if c else None
            if not phone:
                phone = att.guest_phone
            # QR payload — invitation_code if present, else attendee id.
            qr_payload = None
            if att.invitation_id:
                inv = db.query(EventInvitation).filter(EventInvitation.id == att.invitation_id).first()
                qr_payload = inv.invitation_code if inv and inv.invitation_code else None
            if not qr_payload:
                qr_payload = str(att.id)
            sent = SentEventCard(
                event_id=dispatch_event_id,
                guest_attendee_id=att.id,
                event_card_id=dispatch_event_card_id,
                recipient_name=display_name,
                recipient_phone=phone,
                recipient_qr_payload=qr_payload,
                delivery_status="pending",
                delivery_channel="whatsapp",
                sent_by_user_id=dispatch_sender_user_id,
            )
            db.add(sent)
            db.commit()
            db.refresh(sent)
            sent_card_ids.append(str(sent.id))
    else:
        contributors = (
            db.query(EventContributor)
            .options(joinedload(EventContributor.contributor))
            .filter(and_(EventContributor.event_id == dispatch_event_id, EventContributor.id.in_(ids), EventContributor.pledge_amount > 0))
            .all()
        )
        if not contributors:
            raise HTTPException(status_code=404, detail="No selected contributors with a pending pledge were found on this event.")

        for ec in contributors:
            if not ec.contributor:
                continue
            sent = SentEventCard(
                event_id=dispatch_event_id,
                contributor_id=ec.id,
                event_card_id=dispatch_event_card_id,
                recipient_name=ec.contributor.name or "Friend",
                recipient_phone=ec.contributor.phone,
                delivery_status="pending",
                delivery_channel="whatsapp",
                sent_by_user_id=dispatch_sender_user_id,
            )
            db.add(sent)
            db.commit()
            db.refresh(sent)
            sent_card_ids.append(str(sent.id))
            pre_url = pre_rendered.get(str(ec.id))
            if pre_url:
                sid_to_pre_rendered[str(sent.id)] = pre_url



    def _dispatch(dispatch_event_id: str, dispatch_category: str, dispatch_sent_card_ids: List[str], dispatch_sender_user_id: str, pre_rendered_map: Dict[str, str]):
        from core.database import SessionLocal
        from services.share_links import host_for_currency, can_send_sms_for_currency
        from utils.whatsapp import wa_pledge_thank_you_card
        from utils.sms import sms_pledge_thank_you_card

        s = SessionLocal()
        try:
            ev = s.query(Event).filter(Event.id == uuid.UUID(dispatch_event_id)).first()
            if not ev:
                for sid in dispatch_sent_card_ids:
                    row = s.query(SentEventCard).filter(SentEventCard.id == uuid.UUID(str(sid))).first()
                    if row:
                        row.delivery_status = "failed"
                        row.error_message = "Event not found during card dispatch."
                s.commit()
                return
            saved_card = (
                s.query(EventCard)
                .filter(and_(EventCard.event_id == ev.id, EventCard.category == dispatch_category, EventCard.is_active.is_(True)))
                .first()
            )
            tpl = s.query(CardTemplate).filter(CardTemplate.id == saved_card.card_template_id).first() if saved_card else None
            currency = None
            try:
                from models import Currency
                if getattr(ev, "currency_id", None):
                    cur = s.query(Currency).filter(Currency.id == ev.currency_id).first()
                    currency = cur.code if cur else None
            except Exception:
                pass
            sms_ok = can_send_sms_for_currency(currency)
            host = host_for_currency(currency)
            # Resolve language preference
            lang = "sw"
            try:
                settings = s.query(UserSetting).filter(UserSetting.user_id == uuid.UUID(dispatch_sender_user_id)).first()
                lang = (getattr(settings, "notification_language", None) or "sw").lower()[:2]
            except Exception:
                pass

            for sid in dispatch_sent_card_ids:
                row = s.query(SentEventCard).filter(SentEventCard.id == uuid.UUID(str(sid))).first()
                if not row:
                    continue
                if not saved_card or not tpl:
                    row.delivery_status = "failed"
                    row.error_message = "Card configuration missing during dispatch."
                    s.commit()
                    continue
                # Stable per-recipient card URL: always reuse the same
                # public token for (contributor, thank_you, event), so
                # re-sends overwrite the file behind a fixed URL instead
                # of minting new ones. See docs/card_url_mappings.md.
                from services.card_url_service import (
                    generate_or_replace_card,
                    _default_public_host,
                )
                from utils.whatsapp_cards import upload_card_png, upload_card_svg, upload_card_svg_url

                api_base = _public_api_base(host)
                fallback_image_url = f"{api_base}/api/v1/cards/public/{row.id}.png"
                landing_url = f"https://{host}/cards/{row.id}"

                # Per-recipient context: guest invitations carry a QR payload
                # and use a guest-scoped stable token; thank-you cards keep
                # the legacy contributor-scoped token.
                is_guest_row = bool(row.guest_attendee_id)
                qr_payload = row.recipient_qr_payload if is_guest_row else None
                if is_guest_row:
                    rec_type = "guest"
                    rec_id = str(row.guest_attendee_id)
                    purpose = "invitation"
                    rel_type = "attendee"
                    rel_id = str(row.guest_attendee_id)
                else:
                    rec_type = "contributor"
                    rec_id = str(row.contributor_id) if row.contributor_id else str(row.id)
                    purpose = "thank_you"
                    rel_type = "contribution"
                    rel_id = str(row.contributor_id) if row.contributor_id else None

                pre_url = None if is_guest_row else pre_rendered_map.get(str(row.id))
                stable_result: Dict[str, Any] = {}
                try:
                    if pre_url:
                        # Frontend already produced + uploaded a PNG; record
                        # it on the mapping so the public token URL serves
                        # the latest render, but keep the token-based URL
                        # as the canonical link we share with the recipient.
                        stable_result = generate_or_replace_card(
                            s,
                            recipient_type=rec_type,
                            recipient_id=rec_id,
                            card_purpose=purpose,
                            template_slug=tpl.slug if tpl else None,
                            event_id=str(ev.id),
                            related_entity_type=rel_type,
                            related_entity_id=rel_id,
                            pre_uploaded_url=pre_url,
                            public_host=f"https://{host}",
                        )
                        print(f"[event_card_dispatch] stable token={stable_result.get('token')} reusing pre-rendered upload sid={row.id}")
                    else:
                        svg, _ec, _tpl = _render_event_card_svg(
                            s, ev, dispatch_category,
                            contributor_name=row.recipient_name,
                            qr_payload=qr_payload,
                        )
                        png_bytes = _render_png_bytes(svg, tpl, width=1080)

                        def _uploader(stable_path: str, data: bytes, mime: str) -> Optional[str]:
                            if mime.startswith("image/png"):
                                return upload_card_png(stable_path, data)
                            return upload_card_svg(stable_path, data.decode("utf-8", errors="ignore"))

                        if png_bytes:
                            cache_key = f"{row.id}.png"
                            _storage.cache_put(cache_key, png_bytes)
                            stable_result = generate_or_replace_card(
                                s,
                                recipient_type=rec_type,
                                recipient_id=rec_id,
                                card_purpose=purpose,
                                template_slug=tpl.slug if tpl else None,
                                event_id=str(ev.id),
                                related_entity_type=rel_type,
                                related_entity_id=rel_id,
                                render_fn=lambda: (png_bytes, "image/png", "png"),
                                uploader=_uploader,
                                public_host=f"https://{host}",
                            )
                        else:
                            # PNG renderer unavailable; fall back to SVG via render-card edge function
                            svg_payload = svg.encode("utf-8")
                            stable_result = generate_or_replace_card(
                                s,
                                recipient_type=rec_type,
                                recipient_id=rec_id,
                                card_purpose=purpose,
                                template_slug=tpl.slug if tpl else None,
                                event_id=str(ev.id),
                                related_entity_type=rel_type,
                                related_entity_id=rel_id,
                                render_fn=lambda: (svg_payload, "image/svg+xml", "svg"),
                                uploader=_uploader,
                                public_host=f"https://{host}",
                            )

                except Exception as exc:
                    print(f"[pledge_card_dispatch] stable URL generation failed: {exc!r}")
                    stable_result = {}

                # Prefer the stable token URL for messaging. Fall back to
                # the legacy per-sent-id URL only if mapping creation failed
                # (so we never block a delivery on the new feature).
                image_url = stable_result.get("public_url") or fallback_image_url
                if stable_result.get("storage_url") and not stable_result.get("public_url"):
                    image_url = stable_result["storage_url"]


                row.rendered_card_url = image_url
                s.commit()

                channels = []
                phone = row.recipient_phone
                ok_wa = False
                wa_message_id = None
                wa_error = None
                wa_not_on_whatsapp = False
                if phone:
                    try:
                        from utils.whatsapp import _send_whatsapp_sync
                        if is_guest_row:
                            # Approved Meta templates: nuru_invitation_card_message_sw / _en
                            # Body placeholders required: {{1}} guest_name,
                            # {{2}} organizer_name, {{3}} event_name, {{4}} organizer_phone.
                            organizer_name = (
                                getattr(ev, "recognizable_event_owner_name", None)
                                or ""
                            ).strip()
                            organizer_phone = ""
                            try:
                                owner_uid = getattr(ev, "event_owner_user_id", None) or getattr(ev, "organizer_id", None)
                                if owner_uid:
                                    owner_user = s.query(User).filter(User.id == owner_uid).first()
                                    if owner_user:
                                        if not organizer_name:
                                            organizer_name = (
                                                getattr(owner_user, "full_name", None)
                                                or getattr(owner_user, "name", None)
                                                or ""
                                            ).strip()
                                        organizer_phone = (getattr(owner_user, "phone", None) or "").strip()
                            except Exception:
                                pass
                            wa_action = "invitation_card_message"
                            wa_params = {
                                "guest_name": row.recipient_name or "Guest",
                                "organizer_name": organizer_name or "the organizer",
                                "event_name": ev.name or "the event",
                                "organizer_phone": organizer_phone or "—",
                                "image_url": image_url or "",
                                "lang": "en" if lang == "en" else "sw",
                            }
                        else:
                            wa_action = "pledge_thank_you_card"
                            wa_params = {
                                "contributor_name": row.recipient_name or "Friend",
                                "event_name": ev.name or "the event",
                                "image_url": image_url or "",
                                "lang": "en" if lang == "en" else "sw",
                            }
                        wa_result = _send_whatsapp_sync(wa_action, phone, wa_params) or {}
                        ok_wa = bool(wa_result.get("ok"))
                        wa_message_id = wa_result.get("message_id")
                        wa_not_on_whatsapp = bool(wa_result.get("not_on_whatsapp"))
                        wa_error = None if ok_wa else (wa_result.get("error") or "send failed")
                        if ok_wa:
                            channels.append("whatsapp")
                    except Exception as exc:
                        wa_error = f"exception: {exc}"
                ok_sms = False
                sms_error = None
                if phone and sms_ok:
                    try:
                        ok_sms = bool(sms_pledge_thank_you_card(
                            phone=phone,
                            contributor_name=row.recipient_name,
                            event_name=ev.name or "the event",
                            card_link=(stable_result.get("public_url") or landing_url),
                            lang=lang,
                        ))
                        if ok_sms:
                            channels.append("sms")
                        else:
                            sms_error = "sms send returned false"
                    except Exception as exc:
                        sms_error = f"exception: {exc}"

                if wa_message_id:
                    row.whatsapp_message_id = wa_message_id
                error_parts = []
                if wa_error:
                    error_parts.append(f"wa: {wa_error}")
                if wa_not_on_whatsapp:
                    error_parts.append("wa: not_on_whatsapp")
                if sms_error:
                    error_parts.append(f"sms: {sms_error}")
                row.error_message = " | ".join(error_parts) if error_parts else None
                row.delivery_channel = "+".join(channels) or "none"
                row.delivery_status = "sent" if (ok_wa or ok_sms) else "failed"
                row.sent_at = datetime.utcnow()
                s.commit()

                # Structured per-recipient delivery report for troubleshooting.
                phone_mask = (phone[:5] + "***" + phone[-3:]) if phone and len(phone) > 8 else (phone or "")
                print(
                    f"[pledge_card_dispatch_report] sid={row.id} event_id={ev.id} "
                    f"contributor_id={row.contributor_id} name={row.recipient_name!r} "
                    f"phone={phone_mask} status={row.delivery_status} channel={row.delivery_channel} "
                    f"wa_ok={ok_wa} wa_message_id={wa_message_id} wa_not_on_whatsapp={wa_not_on_whatsapp} "
                    f"wa_error={wa_error!r} sms_ok={ok_sms} sms_error={sms_error!r} image_url={image_url}"
                )
        except Exception as exc:
            try:
                for sid in dispatch_sent_card_ids:
                    row = s.query(SentEventCard).filter(SentEventCard.id == uuid.UUID(str(sid))).first()
                    if row and row.delivery_status == "pending":
                        row.delivery_status = "failed"
                        row.error_message = f"dispatch: {exc}"
                        row.sent_at = datetime.utcnow()
                s.commit()
            except Exception as update_exc:
                s.rollback()
                print(f"[event_cards] failed to mark dispatch errors: {update_exc!r}")
            print(f"[event_cards] background dispatch failed: {exc!r}")
        finally:
            s.close()

    if background_tasks is not None:
        background_tasks.add_task(
            _dispatch,
            str(dispatch_event_id),
            category,
            sent_card_ids,
            str(dispatch_sender_user_id),
            sid_to_pre_rendered,
        )
    else:
        _dispatch(str(dispatch_event_id), category, sent_card_ids, str(dispatch_sender_user_id), sid_to_pre_rendered)

    return standard_response(True, f"Queued {len(sent_card_ids)} thank-you cards.", {
        "queued": len(sent_card_ids),
        "sent_ids": [str(x) for x in sent_card_ids],
    })


# ──────────────────────────────────────────────
# Public (no-auth) endpoints
# ──────────────────────────────────────────────

@router.get("/cards/public/{sent_id}.png")
def public_card_png(sent_id: str, db: Session = Depends(get_db)):
    try:
        sid = uuid.UUID(sent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    cache_key = f"{sid}.png"
    cached = _storage.cache_get(cache_key)
    if cached:
        return Response(content=cached, media_type="image/png")
    row = db.query(SentEventCard).filter(SentEventCard.id == sid).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    ec = db.query(EventCard).filter(EventCard.id == row.event_card_id).first() if row.event_card_id else None
    tpl = None
    if not ec:
        # Active card for this event category
        ec = db.query(EventCard).filter(
            EventCard.event_id == row.event_id, EventCard.is_active.is_(True)
        ).first()
    if ec:
        tpl = db.query(CardTemplate).filter(CardTemplate.id == ec.card_template_id).first()
    if not ec or not tpl:
        raise HTTPException(status_code=404, detail="Card configuration missing")
    event = db.query(Event).filter(Event.id == row.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    svg, _ec, _tpl = _render_event_card_svg(db, event, ec.category, contributor_name=row.recipient_name, qr_payload=row.recipient_qr_payload)
    png = _render_png_bytes(svg, tpl, width=1080)
    if not png:
        raise HTTPException(status_code=503, detail="PNG renderer unavailable")
    _storage.cache_put(cache_key, png)
    return Response(content=png, media_type="image/png")


@router.get("/cards/public/{sent_id}.svg")
def public_card_svg(sent_id: str, db: Session = Depends(get_db)):
    try:
        sid = uuid.UUID(sent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    row = db.query(SentEventCard).filter(SentEventCard.id == sid).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    ec = db.query(EventCard).filter(EventCard.id == row.event_card_id).first() if row.event_card_id else None
    if not ec:
        ec = db.query(EventCard).filter(
            EventCard.event_id == row.event_id, EventCard.is_active.is_(True)
        ).first()
    if not ec:
        raise HTTPException(status_code=404, detail="Card configuration missing")
    event = db.query(Event).filter(Event.id == row.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    svg, _ec, _tpl = _render_event_card_svg(db, event, ec.category, contributor_name=row.recipient_name, qr_payload=row.recipient_qr_payload)
    return Response(content=svg, media_type="image/svg+xml")


@router.get("/cards/public/{sent_id}", response_class=HTMLResponse)
def public_card_landing(sent_id: str, db: Session = Depends(get_db)):
    try:
        sid = uuid.UUID(sent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")
    row = db.query(SentEventCard).filter(SentEventCard.id == sid).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    img_url = f"/api/v1/cards/public/{sent_id}.png"
    deep_link = f"nuru://cards/{sent_id}"
    html = f"""<!doctype html>
<html lang=\"en\"><head><meta charset=\"utf-8\" />
<title>Thank you, {row.recipient_name}</title>
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
<meta property=\"og:image\" content=\"{img_url}\" />
<style>
 body{{margin:0;background:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,Inter,Arial,sans-serif;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:24px}}
 img{{max-width:min(560px,92vw);width:100%;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)}}
 a.btn{{display:inline-block;padding:14px 22px;border-radius:999px;background:#C98B28;color:#18251C;font-weight:600;text-decoration:none}}
 p{{opacity:.7;margin:0}}
</style></head>
<body>
 <img src=\"{img_url}\" alt=\"Thank you card for {row.recipient_name}\" />
 <a class=\"btn\" href=\"{deep_link}\">Open in Nuru app</a>
 <p>Plan Smarter. Celebrate Better.</p>
</body></html>"""
    return HTMLResponse(content=html)


# ──────────────────────────────────────────────
# Stable token-based public resolver
# (see backend/app/docs/card_url_mappings.md)
# ──────────────────────────────────────────────

from fastapi.responses import RedirectResponse  # noqa: E402
from models.card_url_mapping import CardUrlMapping  # noqa: E402

_TOKEN_RE = re.compile(r"^[A-Za-z0-9_\-]{8,64}$")


def _resolve_token(db: Session, token: str) -> CardUrlMapping:
    if not token or not _TOKEN_RE.match(token):
        raise HTTPException(status_code=400, detail="Invalid token")
    row = db.query(CardUrlMapping).filter(CardUrlMapping.token == token).first()
    if not row:
        raise HTTPException(status_code=404, detail="Card not found")
    return row


@router.get("/cards/public/by-token/{token}.png")
def public_card_by_token_png(token: str, db: Session = Depends(get_db)):
    row = _resolve_token(db, token)
    if row.storage_url:
        return RedirectResponse(row.storage_url, status_code=302)
    # Fall back to the per-sent-id render path if we have nothing cached yet.
    cache_key = f"token-{row.token}.png"
    cached = _storage.cache_get(cache_key)
    if cached:
        return Response(content=cached, media_type="image/png")
    raise HTTPException(status_code=404, detail="Card has not been rendered yet")


@router.get("/cards/public/by-token/{token}.svg")
def public_card_by_token_svg(token: str, db: Session = Depends(get_db)):
    row = _resolve_token(db, token)
    if row.storage_url:
        return RedirectResponse(row.storage_url, status_code=302)
    raise HTTPException(status_code=404, detail="Card has not been rendered yet")


@router.get("/cards/public/by-token/{token}", response_class=HTMLResponse)
def public_card_by_token_landing(token: str, db: Session = Depends(get_db)):
    row = _resolve_token(db, token)
    img_url = row.storage_url or f"/api/v1/cards/public/by-token/{token}.png"
    deep_link = f"nuru://card/{token}"
    html = f"""<!doctype html>
<html lang=\"en\"><head><meta charset=\"utf-8\" />
<title>Your Nuru card</title>
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
<meta property=\"og:image\" content=\"{img_url}\" />
<style>
 body{{margin:0;background:#1a1a1a;font-family:-apple-system,BlinkMacSystemFont,Inter,Arial,sans-serif;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;gap:24px}}
 img{{max-width:min(560px,92vw);width:100%;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.5)}}
 a.btn{{display:inline-block;padding:14px 22px;border-radius:999px;background:#C98B28;color:#18251C;font-weight:600;text-decoration:none}}
 p{{opacity:.7;margin:0}}
</style></head>
<body>
 <img src=\"{img_url}\" alt=\"Your Nuru card\" />
 <a class=\"btn\" href=\"{deep_link}\">Open in Nuru app</a>
 <p>Plan Smarter. Celebrate Better.</p>
</body></html>"""
    return HTMLResponse(content=html)
