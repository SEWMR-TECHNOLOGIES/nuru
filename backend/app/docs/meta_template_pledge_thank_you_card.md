# Meta Template Submission — Pledge Thank-You Card

Two new templates power the pledge thank-you card delivery in
`backend/app/utils/whatsapp.py` → `wa_pledge_thank_you_card()` and the
edge function builder `pledge_thank_you_card` in
`supabase/functions/whatsapp-send/index.ts`.

Both templates use an **IMAGE header** + 2 body params, no buttons.

---

## 1. `nuru_pledge_thank_you_card_sw`

* **Category**: `UTILITY`
* **Language**: `sw` (Swahili)
* **Header**: `IMAGE` (sample PNG = any rendered card from
  `/api/v1/cards/public/{sent_id}.png`, 1080 px wide, < 5 MB)
* **Body**:

```
KADI YA SHUKRANI

Habari {{1}}, asante sana kwa ahadi yako ya mchango kwa ajili ya {{2}}.

Plan Smarter. Celebrate Better.
```

* **Footer**: none (tagline is part of the body, matching other Nuru templates)
* **Buttons**: none
* **Sample values**: `{{1}} = Asha Mwakyusa`, `{{2}} = Harusi ya Asha & Juma`

---

## 2. `nuru_pledge_thank_you_card_en`

* **Category**: `UTILITY`
* **Language**: `en` (English)
* **Header**: `IMAGE` (same sample)
* **Body**:

```
THANK YOU CARD

Hello {{1}}, thank you so much for your pledge towards {{2}}.

Plan Smarter. Celebrate Better.
```

* **Footer**: none (tagline is part of the body, matching other Nuru templates)
* **Buttons**: none
* **Sample values**: `{{1}} = Asha Mwakyusa`, `{{2}} = Asha & Juma's Wedding`


---

## Builder reference (already deployed)

```ts
// supabase/functions/whatsapp-send/index.ts
pledge_thank_you_card: (lang, p) => ({
  name: `nuru_pledge_thank_you_card_${lang}`,
  lang,
  components: [
    { type: "header", parameters: [
        { type: "image", image: { link: toWaImageLink(p.image_url || "") } }
    ]},
    ...bodyParams([
      p.contributor_name || "Friend",
      p.event_name || "the event",
    ]),
  ],
}),
```

## Submission checklist

1. Meta Business Manager → WhatsApp Manager → Message Templates → **Create**.
2. Category: **Utility** (not Marketing — this is a transactional ack).
3. Upload the sample header image (any real card from
   `https://api.nuru.tz/api/v1/cards/public/<existing-sent-id>.png`).
4. Paste body text exactly as above (Meta is sensitive to extra
   whitespace and emoji).
5. Submit both `_sw` and `_en` variants.
6. After Meta approves, run a smoke send from
   `POST /api/v1/events/{id}/cards/thank-you-for-pledging/send`.
