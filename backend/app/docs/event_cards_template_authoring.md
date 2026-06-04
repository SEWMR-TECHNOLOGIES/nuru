# Event Cards — Template Authoring Guide

This document is the **single source of truth** for adding new SVG card
templates (thank-you, wedding-invitation, future categories) to the Nuru
platform. Future templates that follow this contract render correctly on
both the frontend (browser SVG + QR overlay) and the backend (cairosvg
PNG → WhatsApp delivery) **without writing a single line of frontend or
backend code**.

If a new template requires code edits to render, the template is wrong —
fix the SVG or `metadata.json`, not the renderer.

---

## 1. Big picture — how a card flows end-to-end

```
       ┌──────────────────────────────────────────────────────────────────┐
       │  backend/app/static/cards/<category>/                             │
       │     card_1.svg     ← author-controlled template                   │
       │     metadata.json  ← field whitelist + render hints               │
       │     *.ttf/.otf     ← bundled fonts                                │
       └──────────────────────────────────────────────────────────────────┘
                 │ (scanned on demand)
                 ▼
       card_templates row (DB) — stable UUID + cached metadata_json
                 │
   ┌─────────────┴──────────────────────────────────────────────┐
   │ FRONTEND (EventCardsTab + SvgCardRenderer)                  │
   │   GET /cards/categories                                     │
   │   GET /cards/categories/<cat>/templates                     │
   │   GET /cards/templates/<slug>      → metadata + raw SVG     │
   │   GET /cards/templates/<slug>/asset/<svg> → SVG w/ fonts    │
   │   PUT /events/<id>/cards           → save custom_text_values│
   │                                                             │
   │   Preview: SvgCardRenderer injects edits + overlays QR      │
   └─────────────────────────────────────────────────────────────┘
                 │
                 ▼
       event_cards.custom_text_values (per-event edits)
                 │
   ┌─────────────┴──────────────────────────────────────────────┐
   │ BACKEND DELIVERY                                            │
   │   POST /events/<id>/cards/<cat>/send                        │
   │     1. _render_event_card_svg(event, category, guest_name)  │
   │        - reads master SVG                                   │
   │        - applies allowed text edits                         │
   │        - substitutes contributor_placeholder_id with guest  │
   │        - injects @font-face data URIs                       │
   │     2. _render_png_bytes → cairosvg                         │
   │     3. caches PNG + sends via WhatsApp / fallback SMS link  │
   └─────────────────────────────────────────────────────────────┘
```

The same `metadata.json` drives the editor UI, the live preview, and the
server-side render. There is **no per-template branch** anywhere in the
codebase.

---

## 2. Folder layout for a new template

Drop everything in one directory under `backend/app/static/cards/`:

```
backend/app/static/cards/<category-slug>/
├── card_1.svg          ← required
├── metadata.json       ← required
├── thumbnail.png       ← optional (recommended, 1080×… preview)
└── <Font Name>.ttf     ← any fonts referenced by the SVG
└── <Font Name>.otf
```

Rules:

- `<category-slug>` is lowercase, `kebab-case`, regex `^[A-Za-z0-9_-]+$`.
  Examples: `thank-you-for-pledging`, `wedding-invitation`, `birthday-rsvp`.
- File names must match `^[A-Za-z0-9 _.-]+$` (spaces OK, no other punctuation).
- Multiple templates per category: add `card_2.svg`, `card_3.svg`, … plus
  optional per-SVG metadata at `<svg-stem>.json` (e.g. `card_2.json`).
  Otherwise the shared `metadata.json` is used for every SVG in the folder.
- Commit everything to Git. The directory is the production source of truth
  (see `event_cards_storage_and_deployment.md`).

---

## 3. SVG authoring contract

Every text node the editor or delivery pipeline must touch needs **two**
things on its opening tag:

1. A unique `id="..."` matching the id listed in `metadata.json`.
2. `data-editable="true"` — without this attribute, `_apply_text_edits`
   will refuse to touch the node (defense-in-depth against accidental
   edits to artwork text).

Example:

```xml
<!-- Editable headline -->
<text id="editable_couple_name_1_text"
      data-editable="true"
      class="st5"
      transform="matrix(1 0 0 1 200 300)">John</text>

<!-- Guest placeholder (filled at delivery, NEVER at edit time) -->
<text id="editable_guest_name_text"
      data-editable="true"
      class="st9"
      transform="matrix(1 0 0 1 297 660)"
      text-anchor="middle">Guest Name</text>

<!-- Locked artwork — no data-editable attribute -->
<path id="locked_card_artwork_background" d="…" fill="#c8a828"/>
```

### Required SVG attributes

- A `viewBox` (the renderer uses it for QR scaling and preview aspect ratio).
- Whatever `<style>` / `class` declarations the SVG needs. The backend
  appends `@font-face` blocks immediately before `</svg>` automatically —
  do **not** hand-author `@font-face` for bundled fonts (they'd break
  cross-environment loading).

### Naming convention for ids

Use a verbose, purpose-named convention so future templates stay readable:

```
editable_<purpose>_text          → editable text field
editable_<purpose>_<n>_text      → repeated fields (couple_name_1, couple_name_2)
locked_<purpose>_<thing>         → locked artwork / branding
```

The id is what the editor UI shows (`label` from metadata), what the
preview substitutes, and what the backend delivery substitutes. Pick
once, never rename.

### QR code placement

Frontend overlays a real QR canvas on top of the SVG. Two ways to tell
it where:

1. **Preferred:** add `qr_placement` to `metadata.json` (see §4).
2. **Legacy fallback:** place an invisible marker rect inside the SVG:
   `<rect x="…" y="…" width="…" height="…" opacity="0.001"/>`. Avoid for
   new templates.

Backend SVGs do **not** need to render a QR — delivery PNGs are sent
together with the QR-linked URL in the WhatsApp/SMS body.

### Text safety

- Inner text inside editable nodes can be a single line; multiline support
  is via the editor textarea (`multiline: true` in metadata).
- Don't use `<tspan>` for editable content unless you also give the
  `<tspan>` the same `id` + `data-editable="true"`. The replacement regex
  matches either `<text>` or `<tspan>`, but only the outermost matching
  element gets its inner content replaced.
- Avoid inline event handlers (`onclick`, etc.) and `<script>` — the
  sanitizer strips them, but it's better to never author them.
- Author smart quotes (`'`, `'`, `"`, `"`) directly; the sanitizer
  leaves them alone.

---

## 4. `metadata.json` reference

Every key is optional unless marked **required**. Unknown keys are
ignored, so additive extensions are safe.

```jsonc
{
  // ── identity ────────────────────────────────────────────────
  "name":          "Wedding Invitation 01",            // required, shown in UI
  "slug":          "wedding-invitation-card-1",        // required, globally unique
  "category":      "wedding-invitation",               // required, matches folder
  "category_label":"Wedding Invitation",               // optional, UI label
  "description":   "Elegant wedding invitation card.", // optional

  // ── assets ──────────────────────────────────────────────────
  "svg_file":       "card_1.svg",                      // required
  "thumbnail_file": "thumbnail.png",                   // optional
  "fonts": [                                           // every font file in folder
    "Anthony Hunter.ttf",
    "Anthony Hunter Italic.otf"
  ],

  // ── rendering hints ─────────────────────────────────────────
  "view_box":   { "width": 595.3, "height": 841.9 },
  "qr_placement": { "x": 360, "y": 686, "width": 119, "height": 119 },

  // Keep author-supplied text positions exactly. Set true for all new
  // templates — false is a legacy mode that re-centers text at runtime.
  "preserve_text_positions": true,

  // When true, the preview replaces baked-in SVG default text with the
  // `default` value of each editable field before showing the editor.
  // Useful when the SVG ships with placeholder words you don't want users
  // to see in the live preview.
  "replace_defaults_in_preview": true,

  // ── delivery substitution ───────────────────────────────────
  // The single id whose inner text is replaced with the guest's name at
  // delivery time. NEVER include this id in editable_fields.
  "contributor_placeholder_id": "editable_guest_name_text",

  // Optional per-id font / weight overrides applied only by the
  // frontend preview. Backend cairosvg renders from the SVG's own
  // <style>. Use this to bold a single line, swap a script font for a
  // serif on intro lines, etc.
  "font_overrides": {
    "editable_guest_name_text": { "weight": "bold", "family": "MongolianBaiti" },
    "editable_intro_line_1_text": {
      "family": "Georgia, 'Times New Roman', serif",
      "note":   "Intro lines use a system serif for readability."
    }
  },

  // ── safety / whitelist ──────────────────────────────────────
  // Any id listed here is rejected by the editor (server-side) even if
  // the SVG accidentally has data-editable="true" on it. Use for brand
  // artwork ids and ALWAYS include contributor_placeholder_id.
  "locked_ids": [
    "locked_card_artwork_background",
    "editable_brand_tagline_text",
    "editable_guest_name_text"
  ],

  // The ONLY ids the editor can write. id MUST exist in the SVG with
  // data-editable="true" on its open tag. `default` is used by the
  // preview when the event has no saved value yet.
  "editable_fields": [
    { "id": "editable_couple_name_1_text", "label": "Partner 1 name", "max_length": 40, "multiline": false, "default": "John" },
    { "id": "editable_intro_line_1_text",  "label": "Intro line 1",   "max_length": 120, "multiline": false, "default": "Welcome to The" },
    { "id": "editable_event_date_text",    "label": "Event date",     "max_length": 40,  "multiline": false, "default": "12 June 2026" }
  ]
}
```

### Whitelist semantics (server-enforced)

`PUT /events/<id>/cards` will:

- Reject any key not in `editable_fields[].id`.
- Reject any value longer than the field's `max_length` (default 1000).
- Reject any id listed in `locked_ids` or equal to
  `contributor_placeholder_id`.
- Reject edits to SVG nodes that lack `data-editable="true"`.

A template is only correct if **all three** of (SVG id, editable_fields
id, data-editable attribute) line up.

---

## 5. Fonts

### Bundling

- Drop the font files (`.ttf`, `.otf`, `.woff`, `.woff2`) into the
  category folder.
- List every file in `metadata.json` → `fonts[]`.
- Font filename → CSS family is derived as **two** registrations to be
  forgiving:
  - the bare filename minus extension and trailing "Italic"
    (e.g. `"Anthony Hunter"`)
  - the same name with whitespace removed (e.g. `"AnthonyHunter"`)
- Italic variants (filename contains "italic", case-insensitive) are
  registered with `font-style: italic`; all others are `normal`. The
  current pipeline assumes weight 400 — use a different filename for
  bold cuts and reference that family inside the SVG.

So `<text style="font-family:'Anthony Hunter'">` and
`<text style="font-family:AnthonyHunter">` both resolve.

### Injection at runtime

The backend appends `@font-face` rules to the served SVG automatically:

| Endpoint                                            | URL form     |
|-----------------------------------------------------|--------------|
| `GET /cards/templates/<slug>/asset/<svg>`           | `data:` URI  |
| Preview/delivery rendering (`_render_event_card_svg`) | `data:` URI |
| Internal cairosvg PNG rendering                     | local `file://` via `open_font_dir()` + fontconfig |

Do **not** hand-author your own `@font-face` blocks for bundled fonts —
they will conflict with the injected ones.

### `font_overrides` (preview-only)

Use for surgical typographic decisions that override the SVG's own
`<style>` block in the browser only (cairosvg respects the SVG style).
Document every override with a short `"note"` so future authors know
why it exists. The wedding-invitation template intentionally uses
Georgia for intro lines because Anthony Hunter is too decorative for
short factual phrases.

---

## 6. Frontend behaviour you can rely on

`src/components/events/EventCardsTab.tsx` and
`src/components/invitation-cards/SvgCardRenderer.tsx`:

- Render the live preview from `template.svg` + `custom_text_values`.
- Show one form input per `editable_fields[]` entry, respecting
  `label`, `max_length`, `multiline`, and `default`.
- Show the optional **"Dear" (or any prefix) text area** that writes
  to the reserved synthetic key `__guest_name_prefix`. This key is
  carried through `custom_text_values` and applied by the backend at
  delivery time as `"<prefix> <guest name>"` substituted into
  `contributor_placeholder_id`. New templates get this for free — do
  not invent another field for it.
- Overlay a real `<QRCodeCanvas>` on top of the SVG using
  `qr_placement` (preferred) or the `opacity="0.001"` marker rect.
- The "Guest names are added automatically when the card is sent."
  helper text is shown for the wedding-invitation category; other
  categories see the "Contributor names…" copy. If you add a new
  category with guest-style language, update that conditional in
  `EventCardsTab.tsx`.

---

## 7. Backend behaviour you can rely on

`backend/app/api/routes/event_cards.py`:

- Scans `backend/app/static/cards/` on every catalogue request and
  upserts a `card_templates` row per template, keyed by `slug`. No
  manual DB seeding needed.
- Sanitises the SVG (`<?xml?>`, `<!DOCTYPE>`, `<script>`, `on*=`
  attributes are stripped on every read).
- Applies the editor whitelist (`_apply_text_edits`) — only ids
  listed in `editable_fields` and carrying `data-editable="true"`
  are mutated.
- Substitutes `contributor_placeholder_id` exactly once per
  delivery, with the optional `__guest_name_prefix` prepended.
- Re-injects `@font-face` rules as data URIs before handing the
  SVG to cairosvg.
- Caches the rendered PNG at `$NURU_CARDS_CACHE_DIR` keyed by
  `sent_event_card.id`.

If cairosvg is missing or fails, delivery degrades to SMS-with-link
automatically. Do not rely on the cache surviving deploys.

---

## 8. Checklist before shipping a new template

Run through this list. If any item is "no", fix the template — not
the code.

- [ ] Folder is `backend/app/static/cards/<kebab-slug>/` and committed
      to Git.
- [ ] `metadata.json` is valid JSON and includes `name`, `slug`,
      `category`, `svg_file`.
- [ ] `slug` is globally unique across all card templates.
- [ ] `svg_file` exists and opens in a browser at the declared
      `view_box`.
- [ ] Every id in `editable_fields[]` exists in the SVG with
      `data-editable="true"` on its open tag.
- [ ] `contributor_placeholder_id` exists in the SVG, is listed in
      `locked_ids`, and is **not** in `editable_fields[]`.
- [ ] All fonts referenced inside the SVG `<style>` are present as
      files in the folder and listed in `fonts[]`. Filenames match
      `^[A-Za-z0-9 _.-]+$`.
- [ ] `qr_placement` is set (or a single legacy `opacity="0.001"` rect
      exists) for templates that should carry a QR.
- [ ] `preserve_text_positions: true` for all new templates.
- [ ] `font_overrides` documents any preview-only typography decision
      with a `"note"`.
- [ ] Locally verified: editor preview, "Dear …" prefix, send-to-self
      WhatsApp delivery render correctly.

If you tick every box, the template ships without a code review of the
renderer pipeline — the renderer is data-driven by design.
