# WhatsApp Template Specs — Reminder Automations

Submit these to Meta Business Manager. Names match the
`whatsapp_template_name` column on `event_reminder_templates`.

Variables are positional in WhatsApp (`{{1}}`, `{{2}}`, …). Templates
1–2 (fundraise) accept an organiser-edited body in `{{2}}`. Templates
3–6 are fully system-composed — the organiser cannot edit them, only
the event variables are filled in.

All bodies preserve real newlines. Each template is padded with literal
text so Meta's variable-density check passes.

For pledge templates, the payment link is delivered as a tappable
**URL button** (dynamic suffix) — never as inline body text. The
backend issues a fresh share token per recipient via
`services.share_links.issue_share_token`, resolves the URL with
`build_share_url`, and passes the dynamic portion as the button
parameter so each recipient gets a unique, clickable button.

Date/time variables (`{{3}}` on pledge/guest templates) always include
both the date and the time in the organiser's timezone (default
`Africa/Nairobi`). English formats as `14 June 2026 at 18:30`; Swahili
as `14 Juni 2026 saa 18:30`.

---

## 1. fundraise_attend (English) — `nuru_fundraise_notice_en`

Category: UTILITY · Language: en

**Body**
```
Hello {{1}}

We would like to inform you that:

{{2}}

For questions, please contact the organiser directly.
```

Variables: `{{1}}` recipient_name · `{{2}}` organiser_body

---

## 2. fundraise_attend (Swahili) — `nuru_fundraise_notice_sw`

Category: UTILITY · Language: sw

**Body**
```
Habari {{1}}

Tunapenda kukufahamisha kuwa:

{{2}}

Kwa maswali, wasiliana na mwandaaji moja kwa moja.
```

Variables: `{{1}}` jina · `{{2}}` ujumbe_wa_mwandaaji

---

## 3. pledge_remind (English) — `nuru_pledge_remind_en`

Category: UTILITY · Language: en

**Body**
```
Hello {{1}},

This is a friendly reminder about your pending pledge for the event "{{2}}", which is scheduled to take place on {{3}}.

Your total pledge is {{4}} and the outstanding balance still awaited is {{5}}.

Please tap the button below to securely complete your contribution at any time before the event date.

Thank you for your generosity and continued support.

Nuru
```

Body variables: `{{1}}` recipient_name · `{{2}}` event_name · `{{3}}` event_datetime · `{{4}}` pledge_amount · `{{5}}` balance

**Buttons**

| Type | Text             | URL type | URL                              | Sample suffix          |
|------|------------------|----------|----------------------------------|------------------------|
| URL  | Complete payment | Dynamic  | `https://nuru.tz/c/{{1}}`      | `abc123def456xyz`      |

The button's `{{1}}` is the dynamic suffix produced by
`build_share_url(currency_code, plain_token).removeprefix("https://nuru.tz/c/")` (the share token only)
per recipient.

---

## 4. pledge_remind (Swahili) — `nuru_pledge_remind_sw`

**Body**
```
Habari {{1}},

Hii ni kumbusho la upole kuhusu ahadi yako iliyobaki kwa tukio la "{{2}}", ambalo limepangwa kufanyika tarehe {{3}}.

Ahadi yako jumla ni {{4}} na kiasi kilichobaki ni {{5}}.

Tafadhali bonyeza kitufe hapa chini kukamilisha mchango wako kwa usalama kabla ya siku ya tukio.

Asante kwa ukarimu wako na mchango wako endelevu.

Nuru
```

Body variables: `{{1}}` jina · `{{2}}` jina_la_tukio · `{{3}}` tarehe_na_muda · `{{4}}` ahadi · `{{5}}` kiasi_kilichobaki

**Buttons**

| Type | Text             | URL type | URL                              | Sample suffix      |
|------|------------------|----------|----------------------------------|--------------------|
| URL  | Lipa sasa        | Dynamic  | `https://nuru.tz/c/{{1}}`      | `abc123def456xyz`  |

---

## 5. guest_remind (English) — `nuru_guest_remind_en`

**Body**
```
Hello {{1}},

This is a friendly reminder that you have been invited to the event "{{2}}", which will take place on {{3}} at {{4}}.

We truly value your presence and kindly ask you to plan ahead so you do not miss this special occasion. Please arrive on time and feel free to share this reminder with anyone accompanying you.

We look forward to welcoming you on the day.

Nuru
```

Variables: `{{1}}` guest_name · `{{2}}` event_name · `{{3}}` event_datetime · `{{4}}` event_venue

---

## 6. guest_remind (Swahili) — `nuru_guest_remind_sw`

**Body**
```
Habari {{1}},

Hii ni kumbusho la upole kwamba umealikwa kwenye tukio la "{{2}}", ambalo litafanyika tarehe {{3}} mahali {{4}}.

Uwepo wako ni wa thamani kubwa kwetu na tunakuomba upange ratiba yako mapema ili usikose tukio hili maalum. Tafadhali wahi kufika na unaweza kushiriki ukumbusho huu na yeyote atakayefuatana nawe.

Tunatazamia kukukaribisha siku hiyo.

Nuru
```

Variables: `{{1}}` jina · `{{2}}` jina_la_tukio · `{{3}}` tarehe_na_muda · `{{4}}` mahali
