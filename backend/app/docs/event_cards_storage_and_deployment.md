# Event Cards — Storage & Deployment

## Where assets live today

All card assets live on the API server's local filesystem under:

```
backend/app/static/cards/
├── thank-you-for-pledging/
│   ├── card_1.svg            ← template SVG (committed to Git)
│   ├── metadata.json         ← editable / locked field whitelist (Git)
│   ├── Anthony Hunter.ttf    ← bundled fonts (Git)
│   ├── Anthony Hunter.otf
│   ├── Anthony Hunter Italic.ttf
│   └── Anthony Hunter Italic.otf
└── <future-category>/        ← new categories drop in here
```

Rendered per-contributor PNGs are cached at:

```
$NURU_CARDS_CACHE_DIR  (default: /tmp/nuru_cards_cache/<sent_card_id>.png)
```

The cache is regenerable — losing it only forces the next public GET of
`/api/v1/cards/public/{id}.png` to re-render. No data is destroyed.

## Storage abstraction

All disk access goes through `backend/app/utils/card_storage.py`:

```python
from utils.card_storage import get_card_storage
storage = get_card_storage()           # singleton
storage.list_categories()
storage.read_text("thank-you-for-pledging/card_1.svg")
storage.read_bytes(rel)
storage.absolute_path(rel)             # may return None on remote backends
storage.open_font_dir(category)        # returns a local dir for cairosvg
storage.cache_get(key) / cache_put(key, data)
```

The route handlers in `backend/app/api/routes/event_cards.py` never touch
`Path` or filesystem APIs directly. To migrate to **S3 / R2 / Supabase
Storage / MinIO** later, implement a new `CardStorage` subclass and
register it in `get_card_storage()` keyed on `NURU_CARDS_STORAGE`:

| Env var | Default | Purpose |
|---|---|---|
| `NURU_CARDS_STORAGE` | `local` | Backend selector (`local` today) |
| `NURU_CARDS_ROOT` | `backend/app/static/cards` | Override on-disk template root |
| `NURU_CARDS_CACHE_DIR` | `/tmp/nuru_cards_cache` | Rendered-PNG cache location |

The remote backend would also need to materialise font files into a
local temp directory inside `open_font_dir()` so `cairosvg` can find
them via fontconfig.

## ⚠️ Deployment — DO NOT LOSE ASSETS

`backend/app/static/cards/` is a **source-controlled directory**.
Templates, metadata, and bundled fonts are committed to Git and therefore
re-deployed on every release. As long as you only ship templates that
ship with the repo, no extra action is needed.

If you ever add **operator-uploaded templates at runtime** (a future
phase — there is no upload UI yet), they will NOT survive a deploy that
replaces `backend/app/static/`. Options for production:

1. **Recommended now**: keep every template in Git. Author SVG/JSON in
   the repo, PR-review, deploy. Zero infra risk.
2. **Mid term**: mount a persistent VPS volume (e.g. `/var/lib/nuru/cards`)
   and point `NURU_CARDS_ROOT` at it. Deploy scripts must NOT delete
   that path. Back it up nightly along with Postgres.
3. **Long term**: implement an object-storage backend (S3 / R2 / Supabase
   Storage / MinIO) per the abstraction above. Then templates and rendered
   cards live outside the API server entirely; deploys become stateless.

The rendered PNG cache (`NURU_CARDS_CACHE_DIR`) is **safe to wipe** on
every deploy — it's pure cache, not data.

## VPS quick reference (current setup)

* App root: `/var/www/nuru/backend/app/static/cards/` (deployed from Git)
* Cache: `/tmp/nuru_cards_cache/` (auto-recreated, ignored by deploys)
* System deps for PNG rendering: `libcairo2 libpango-1.0-0 libpangoft2-1.0-0 libgdk-pixbuf-2.0-0 libffi-dev`
* Python deps: `cairosvg` in `backend/app/requirements.txt`

If the renderer is unavailable, WhatsApp sends will fail with a 503 and
the catalogue automatically falls back to SMS with a link.

## Backup checklist

| Asset | Where | Backup? |
|---|---|---|
| Template SVG / metadata / fonts | Git | ✅ via Git |
| `card_templates` rows | Postgres | ✅ via pg backup |
| `event_cards` rows (organiser edits) | Postgres | ✅ via pg backup |
| `sent_event_cards` rows | Postgres | ✅ via pg backup |
| Rendered PNG cache | `/tmp/nuru_cards_cache/` | ❌ disposable |
