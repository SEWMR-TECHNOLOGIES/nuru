# Stable Card URLs (`card_url_mappings`)

## Why
Re-sending a card to the same recipient used to mint a brand-new
storage file and brand-new URL each time. Old WhatsApp/SMS links broke,
storage filled with duplicates, and there was no canonical "David's
thank-you card for this contribution" URL.

This module fixes that. **One recipient + one card purpose + one event
+ one related entity = one stable public URL forever.**

## Uniqueness key

```text
card_context_key = sha256(
  recipient_type | recipient_id | card_purpose | event_id |
  related_entity_type | related_entity_id
)
```

`template_slug` is **not** part of the key — switching the design must
not break links the recipient already has. The slug is stored as
metadata for analytics/debug only.

## Public URL

```
https://{host}/card/{token}        ← frontend route, never changes
└─ resolves to ─►
   GET /api/v1/cards/public/by-token/{token}.png  ← serves current bytes
```

The token is minted once on first generation (`secrets.token_urlsafe(12)`)
and stored in `card_url_mappings.token`. It is the *only* identifier
external systems should see.

## Stable storage path

```
cards/{card_purpose}/{event_id or 'global'}/{recipient_type}/{recipient_id}/{token}.{ext}
```

Re-renders upload to the same path with Supabase Storage
`upsert: true` → the file is replaced atomically, no orphans.

## Using the service

Every sender (current and future) must call:

```python
from services.card_url_service import generate_or_replace_card

result = generate_or_replace_card(
    db,
    recipient_type="contributor",      # 'contributor' | 'guest' | 'user' | 'committee' | 'vendor' | 'invitee'
    recipient_id=str(contributor_id),
    card_purpose="thank_you",          # 'thank_you' | 'invitation' | 'rsvp' | 'contribution_receipt' | ...
    template_slug=tpl.slug,            # metadata only
    event_id=str(event.id),
    related_entity_type="contribution",
    related_entity_id=str(contribution.id),
    render_fn=lambda: (png_bytes, "image/png", "png"),
    uploader=lambda path, data, mime: upload_card_png(path, data),
)

image_url = result["public_url"]  # ALWAYS the same for this recipient/context
```

If the caller already has a publicly hosted render (e.g. frontend
uploaded the PNG), pass `pre_uploaded_url=...` instead of `render_fn`
and `uploader`. The stable public URL is still returned and sent.

## What to send over WhatsApp/SMS/email

Always send `result["public_url"]`. Never send `storage_url` directly,
because it can change behind the scenes. The public URL resolves to
the latest version automatically.

## Cleanup safety

The service never deletes anything under `static/cards/` (templates,
fonts, logos, QR assets). Replacement is achieved by *overwriting* the
stable storage path, not by deleting and re-creating. Template assets
are untouched.

## Backward compatibility

The legacy `/api/v1/cards/public/{sent_event_card_id}.png` endpoint
continues to serve old messages. New sends use the token URL.

## Logging

Each call prints a structured line tagged `[card_url]`:

```
[card_url] reused token=ABC purpose=thank_you recipient_type=contributor
  recipient_id=… event_id=… related=contribution:… path=cards/…/ABC.png template=thank-you-01
```

Actions are `created`, `reused`, or `replaced`. No PII (names, phones)
is logged here.

## Adding a new card purpose

1. Pick a stable `card_purpose` string (e.g. `vendor_confirmation`).
2. Pick a stable `related_entity_type` (e.g. `booking`).
3. Call `generate_or_replace_card(...)` from the sender.
4. Use `result["public_url"]` in every channel message.

No schema or route changes are needed — the mapping table and resolver
route handle any purpose generically.
