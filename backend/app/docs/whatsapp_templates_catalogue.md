# WhatsApp Templates — Final Submission List for Meta Business Manager

Source of truth: `backend/app/utils/message_templates.py` (which mirrors
`nuru_sms_messages_updated.docx`). Every body below is the **full final
text** to paste into Meta — no "mirror from catalogue" placeholders.

## Conventions

> **Money placeholders — no variable reuse.** Meta forbids the same
> positional placeholder (`{{N}}`) from appearing more than once in a
> template body. Every money value is therefore submitted as a **single
> combined string** (for example `TZS 10,000`) populated by
> `utils.message_templates.format_money(currency, amount)` and shipped
> to the edge function under a `*_text` key (`amount_text`,
> `balance_text`, `target_text`, `total_paid_text`,
> `pledge_amount_text`, `increase_text`, `total_target_text`,
> `service_amount_text`). The legacy `{currency}` + `{amount}` pairs in
> body text and any "currency reused at `{{N}}`" notes have been
> removed — each money slot is exactly one placeholder.


- **One template per language.** Every catalogue entry produces a `_sw`
  and `_en` template. Never group them under one name.
- **Headings preserved.** Each body begins with the uppercase heading
  from the catalogue (`MWALIKO`, `INVITATION`, `MALIPO YAMEPOKELEWA`,
  `PAYMENT RECEIVED`, `GHARAMA MPYA`, `NEW EXPENSE RECORDED`, …) on its
  own line, followed by a blank line, then the body, then the sign-off
  `Plan Smarter. Celebrate Better.`
- **Category:** all 48 templates are **UTILITY**. None are MARKETING.
- **Placeholders are positional** in Meta (`{{1}}`, `{{2}}`, …). The
  mapping table for each template lists the catalogue placeholder name
  that the backend already passes in the same order.
- **Language selection in backend.** `utils/whatsapp.py` resolves the
  recipient's language via
  `message_templates.resolve_user_language(db, user_id)` (default `sw`)
  and forwards `lang` to the edge function. The edge function picks
  `<name>_sw` or `<name>_en`. If `lang` is unknown / missing, Swahili is
  used. Anonymous recipients (no `user_id`) default to Swahili.

## Status legend

- **Existing — kept, body rewritten** — the template name already exists
  in `supabase/functions/whatsapp-send/index.ts` (e.g.
  `event_invitation_v2`) as a single-language template. Submit a new
  `_sw` / `_en` pair with the catalogue body; the old single-language
  template is replaced in the dispatcher.
- **New** — no existing Meta template covers this trigger.
- **Skipped** — not in the uploaded SMS document.

> Two templates that exist on Meta today but are **NOT in the document**
> are *skipped* and kept as-is for non-catalogue flows: `event_reminder`
> (reminder automation, separate doc), `event_invitation_text` /
> media-card invitation variants (driven by
> `utils/whatsapp_cards.py`, not the SMS catalogue).
> The pre-existing `nuru_fundraise_notice_*`, `nuru_pledge_remind_*`,
> `nuru_guest_remind_*` reminder-automation templates remain unchanged
> (documented separately in `whatsapp_reminder_templates.md`).

---

## Dynamic URL buttons — summary

Per-recipient links are NEVER embedded as `{{N}}` inside the body. Meta lets
us define one **dynamic CTA URL button** per template using a fixed
`URL prefix` + a single `{{1}}` suffix placeholder. This keeps bodies clean
and lets every template pass Meta's "no untrusted free-form URLs" rule.

Only the following 6 templates ship with a dynamic URL button. Every other
template has **no buttons**. Auth/OTP and reminder-automation templates
documented elsewhere are unaffected.

| # | Template | Button label | Static URL prefix | Dynamic `{{1}}` (suffix) | Backend kwarg |
|---|----------|--------------|-------------------|---------------------------|---------------|
| 1 / 2 | `nuru_guest_invitation_{sw,en}` | Thibitisha Mwaliko / Confirm Invitation | `https://nuru.tz/rsvp/` | invitation code (e.g. `A1B2C3`) | `rsvp_code` |
| 7 / 8 | `nuru_meeting_invitation_{sw,en}` | Jiunge na Kikao / Join Meeting | `https://nuru.tz/m/` | opaque per-recipient redirect token (`mtk_…`) | `meeting_redirect_token` |
| 17 / 18 | `nuru_guest_contribution_invite_{sw,en}` | Lipa Sasa / Pay Now | `https://nuru.tz/c/` | contributor `share_token` | `share_token` |
| 19 / 20 | `nuru_guest_contribution_receipt_{sw,en}` | Ona Risiti / View Receipt | `https://nuru.tz/c/` | `<share_token>/r/<transaction_code>` | `receipt_path` |

Templates whose link is the same static landing page for everyone (e.g. #5/#6
welcome → `https://nuru.tz`) keep the link inline (no dynamic substitution
needed). Meeting invitations (#7/#8) used to fall in the "arbitrary external
URL" bucket, but now mint an opaque `meeting_redirect_token` server-side; the
WhatsApp button uses the static `https://nuru.tz/m/` prefix and the backend
`/m/{token}` endpoint 302-redirects to the real meeting URL — so neither the
body nor the recipient ever sees the raw external link.


Backend wiring: `utils/sms.py::sms_guest_added`, `sms_guest_contribution_invite`,
and `sms_guest_contribution_receipt` now forward the suffix kwargs above
alongside the existing full-URL kwargs. The edge function
(`supabase/functions/whatsapp-send/index.ts`) consumes the suffix kwarg as
the value of the dynamic URL button placeholder. Older callers passing the
full URL only continue to work for SMS (no button) — only the WhatsApp
dispatcher needs the suffix.

---



## 1. nuru_guest_invitation_sw

- **Language:** sw
- **Status:** Existing — kept, body rewritten (was `event_invitation_v2`)
- **Category:** UTILITY
- **Body:**
```
MWALIKO

Habari {{1}},

{{2}} amekualika kwenye {{3}}.

Tarehe: {{4}}
Mahali: {{5}}

Tafadhali thibitisha uwepo wako kupitia kitufe hapa chini.

Plan Smarter. Celebrate Better.
```
- **Placeholders (body):** `{{1}}` guest_name · `{{2}}` organizer_name · `{{3}}` event_name · `{{4}}` event_date_and_time · `{{5}}` event_venue
- **Buttons:** 1 × **CTA URL (dynamic)** — label `Thibitisha Mwaliko` · static prefix `https://nuru.tz/rsvp/` · URL `{{1}}` = `rsvp_code` (the raw invitation code, e.g. `A1B2C3`)
- **Backend reference:** `utils/whatsapp.py::wa_guest_invited` → `api/routes/guests.py`, `api/routes/rsvp.py`. `utils/sms.py::sms_guest_added` derives `rsvp_url` from `invitation_code`; the edge function needs the raw `invitation_code` for the button URL suffix (passed via the new `rsvp_code` kwarg).

## 2. nuru_guest_invitation_en

- **Language:** en
- **Status:** Existing — kept, body rewritten (was `event_invitation_v2`)
- **Category:** UTILITY
- **Body:**
```
INVITATION

Hello {{1}},

{{2}} has invited you to {{3}}.

When: {{4}}
Where: {{5}}

Please confirm your attendance using the button below.

Plan Smarter. Celebrate Better.
```
- **Placeholders (body):** `{{1}}` guest_name · `{{2}}` organizer_name · `{{3}}` event_name · `{{4}}` event_date_and_time · `{{5}}` event_venue
- **Buttons:** 1 × **CTA URL (dynamic)** — label `Confirm Invitation` · static prefix `https://nuru.tz/rsvp/` · URL `{{1}}` = `rsvp_code`
- **Backend reference:** same as #1

## 3. nuru_committee_invite_sw

- **Language:** sw · **Status:** New · **Category:** UTILITY
- **Body:**
```
KAMATI YA TUKIO

Habari {{1}}, {{2}} amekuongeza kama {{3}} kwenye {{4}}. {{5}} Fungua Nuru kuona majukumu yako na taarifa muhimu za tukio.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` member_name · `{{2}}` organizer_name · `{{3}}` role · `{{4}}` event_name · `{{5}}` custom_message
- **Backend reference:** `utils/sms.py::sms_committee_invite` (WA fallback path) → `api/routes/committee.py`

## 4. nuru_committee_invite_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
EVENT COMMITTEE

Hello {{1}}, {{2}} has added you as {{3}} for {{4}}. {{5}} Open Nuru to see your tasks and important event updates.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #3
- **Backend reference:** same as #3

## 5. nuru_welcome_registered_by_sw

- **Language:** sw · **Status:** Updated (was password-in-body — now link-based) · **Category:** UTILITY
- **Body:**
```
KARIBU NURU

Habari {{1}},

{{2}} amekusajiri kwenye Nuru.

Akaunti yako imeundwa kikamilifu. Bonyeza kitufe hapa chini kuweka nenosiri lako kwa usalama na kuingia kwenye Nuru.

Plan Smarter. Celebrate Better.

Powered by Nuru
```
- **Placeholders:** `{{1}}` recipient first name · `{{2}}` inviter name
- **Buttons:** dynamic URL · text **Weka Nenosiri** · base `https://nuru.tz/set-password/` · button `{{1}}` = single-use setup token
- **Channel:** WhatsApp only. The mobile/SMS temp-password fallback uses a separate template (`welcome_registered_by_sms`) rendered through `sms.sms_welcome_registered_with_temp_password`.
- **Backend reference:** `api/routes/users.py` (inline registration) → `utils.account_setup.create_setup_token` + `utils.whatsapp.wa_welcome_registered_by`.

## 6. nuru_welcome_registered_by_en

- **Language:** en · **Status:** Updated (was password-in-body — now link-based) · **Category:** UTILITY
- **Body:**
```
WELCOME TO NURU

Hello {{1}},

{{2}} has added you to Nuru.

Your account is ready. Tap the button below to securely set your password and sign in to Nuru.

Plan Smarter. Celebrate Better.

Powered by Nuru
```
- **Placeholders:** same order as #5
- **Buttons:** dynamic URL · text **Set Password** · base `https://nuru.tz/set-password/` · button `{{1}}` = single-use setup token
- **Channel:** WhatsApp only.
- **Backend reference:** same as #5

## 7. nuru_meeting_invitation_sw

- **Language:** sw · **Status:** Existing — rewritten to use a dynamic URL button · **Category:** UTILITY
- **Body:**
```
MWALIKO WA KIKAO

Umealikwa kwenye kikao cha {{1}} kwa ajili ya {{2}}.

Kikao kimepangwa kufanyika {{3}}.

Bonyeza kitufe hapa chini kujiunga.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` meeting_title · `{{2}}` event_name · `{{3}}` scheduled_date_and_time
- **Buttons:** URL · label "Jiunge na Kikao" · base `https://nuru.tz/m/` · dynamic suffix `{{1}} = meeting_redirect_token` (opaque per-recipient token minted by the backend). The token resolves server-side to the real meeting URL (Nuru room, Zoom, Meet, Jitsi, …) so the raw link never appears in the message body.
- **Backend reference:** `utils/whatsapp.py::wa_meeting_invitation` → `api/routes/meetings.py::_notify_participants` → `utils/meeting_redirect.py::mint_meeting_redirect_token` → `api/routes/meeting_redirect.py`

## 8. nuru_meeting_invitation_en

- **Language:** en · **Status:** Existing — rewritten to use a dynamic URL button · **Category:** UTILITY
- **Body:**
```
MEETING INVITATION

You have been invited to {{1}} for {{2}}.

The meeting is scheduled for {{3}}.

Tap the button below to join.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #7
- **Buttons:** URL · label "Join Meeting" · base `https://nuru.tz/m/` · dynamic suffix `{{1}} = meeting_redirect_token` (see #7)
- **Backend reference:** same as #7


## 9. nuru_contribution_recorded_with_balance_sw

- **Language:** sw · **Status:** Existing — kept, body rewritten (was `contribution_recorded`) · **Category:** UTILITY
- **Body:**
```
MALIPO YAMEPOKELEWA

Habari {{1}},

Tumepokea mchango wako wa {{2}} kutoka kwa {{3}} kwa ajili ya {{4}}.

Jumla uliyolipa: {{5}}
Salio lililobaki: {{6}}

Kwa msaada, mpigie mratibu wa tukio kupitia {{7}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` contributor_name · `{{2}}` amount_text · `{{3}}` recorder_name · `{{4}}` event_name · `{{5}}` total_paid_text · `{{6}}` balance_text · `{{7}}` organizer_phone
- **Buttons:** none
- **Backend reference:** `utils/whatsapp.py::wa_contribution_recorded` → `api/routes/payments.py`, `api/routes/contributors.py`

## 10. nuru_contribution_recorded_with_balance_en

- **Language:** en · **Status:** Existing — kept, body rewritten · **Category:** UTILITY
- **Body:**
```
PAYMENT RECEIVED

Hello {{1}},

We have received your contribution of {{2}} from {{3}} for {{4}}.

Total paid: {{5}}
Remaining balance: {{6}}

For help, call the organiser on {{7}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #9
- **Buttons:** none
- **Backend reference:** same as #9

## 11. nuru_contribution_recorded_pledge_complete_sw

- **Language:** sw · **Status:** New · **Category:** UTILITY
- **Body:**
```
AHADI IMEKAMILIKA

Habari {{1}},

Tumepokea mchango wako wa {{2}} kutoka kwa {{3}} kwa ajili ya {{4}}.

Hongera kwa kukamilisha ahadi yako ya {{5}}. Asante kwa mchango wako muhimu.

Kwa msaada, mpigie mratibu wa tukio kupitia {{6}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` contributor_name · `{{2}}` amount_text · `{{3}}` recorder_name · `{{4}}` event_name · `{{5}}` target_text · `{{6}}` organizer_phone
- **Buttons:** none
- **Backend reference:** `utils/whatsapp.py::wa_contribution_recorded` (pledge-completed branch) → `api/routes/payments.py`

## 12. nuru_contribution_recorded_pledge_complete_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
PLEDGE COMPLETED

Hello {{1}},

We have received your contribution of {{2}} from {{3}} for {{4}}.

Congratulations on completing your pledge of {{5}}. Thank you for your support.

For help, call the organiser on {{6}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #11
- **Buttons:** none
- **Backend reference:** same as #11

## 13. nuru_contribution_target_set_sw

- **Language:** sw · **Status:** New (replaces the removed generic `nuru_contribution_pledge_set_*`) · **Category:** UTILITY
- **Body:**
```
AHADI YA MCHANGO

Habari {{1}}, tumepokea ahadi yako ya mchango kwa ajili ya {{2}} kiasi cha {{3}}. Asante kwa ukarimu wako. Kwa msaada, mpigie mratibu wa tukio kupitia {{4}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` contributor_name · `{{2}}` event_name · `{{3}}` target_text · `{{4}}` organizer_phone
- **Backend reference:** `utils/sms.py::sms_contribution_target_set` → `api/routes/user_contributors.py` (add-contributor flow, bulk-upload first-time + reduction fallback), `api/routes/user_events.py` (event-wide target broadcast)

## 14. nuru_contribution_target_set_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
CONTRIBUTION PLEDGE

Hello {{1}}, we have received your contribution pledge for {{2}} amounting to {{3}}. Thank you for your generosity. For help, call the event organiser on {{4}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #13
- **Backend reference:** same as #13

## 14a. nuru_contribution_target_updated_sw

- **Language:** sw · **Status:** New · **Category:** UTILITY
- **Body:**
```
AHADI YA MCHANGO

Habari {{1}}, tumepokea ongezeko la ahadi yako ya mchango kwa ajili ya {{2}} kiasi cha {{3}}. Jumla ya ahadi yako ni {{4}}. Asante kwa ukarimu wako. Kwa msaada, mpigie mratibu wa tukio kupitia {{5}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` contributor_name · `{{2}}` event_name · `{{3}}` increase_text · `{{4}}` total_target_text · `{{5}}` organizer_phone
- **Backend reference:** `utils/sms.py::sms_contribution_target_updated` → `api/routes/user_contributors.py` (update-contributor and bulk-upload increase paths)

## 14b. nuru_contribution_target_updated_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
CONTRIBUTION PLEDGE

Hello {{1}}, we have received an increase to your contribution pledge for {{2}} of {{3}}. Your total pledge is now {{4}}. Thank you for your generosity. For help, call the event organiser on {{5}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #14a
- **Backend reference:** same as #14a

> **Pledge reductions** (new_target < old_target) currently fall back to `nuru_contribution_target_set_*`. There is no dedicated reduction template; document only. Revisit if product approves a "pledge reduced" body.

## 15. nuru_contribution_thank_you_sw

- **Language:** sw · **Status:** Existing — kept, body rewritten (was `thank_you_contribution`) · **Category:** UTILITY
- **Body:**
```
ASANTE KWA MCHANGO

Habari {{1}}, asante kwa mchango wako wa {{2}} kwa ajili ya {{3}}. {{4}} Kwa msaada, mpigie mratibu wa tukio kupitia {{5}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` contributor_name · `{{2}}` amount_text (e.g. `TZS 10,000`) · `{{3}}` event_name · `{{4}}` custom_message · `{{5}}` organizer_phone
- **Backend reference:** `utils/whatsapp.py::wa_thank_you` → `api/routes/contributors.py`

## 16. nuru_contribution_thank_you_en

- **Language:** en · **Status:** Existing — kept, body rewritten · **Category:** UTILITY
- **Body:**
```
THANK YOU

Hello {{1}}, thank you for your contribution of {{2}} towards {{3}}. {{4}} For help, call the organiser on {{5}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #15
- **Backend reference:** same as #15

## 17. nuru_guest_contribution_invite_sw

- **Language:** sw · **Status:** New · **Category:** UTILITY
- **Body:**
```
MWALIKO WA KUCHANGIA

Habari {{1}},

{{2}} anakualika kuchangia {{3}}.

Kiasi cha ahadi: {{4}}

Bonyeza kitufe hapa chini kulipa kwa usalama kupitia Nuru.

Plan Smarter. Celebrate Better.
```
- **Placeholders (body):** `{{1}}` contributor_name · `{{2}}` organiser_name · `{{3}}` event_name · `{{4}}` pledge_amount_text
- **Buttons:** 1 × **CTA URL (dynamic)** — label `Lipa Sasa` · static prefix `https://nuru.tz/c/` · URL `{{1}}` = `share_token` (the contributor's public payment-link token)
- **Backend reference:** `utils/whatsapp.py::wa_contribution_target_set` (guest invite path) → `api/routes/contributors.py` (external/guest branch). The edge function needs the raw `share_token` for the dynamic URL suffix; backend already computes `payment_url` = `https://{host}/c/{share_token}` — pass `share_token` separately as the button kwarg.

## 18. nuru_guest_contribution_invite_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
CONTRIBUTION INVITATION

Hello {{1}},

{{2}} has invited you to contribute towards {{3}}.

Pledged amount: {{4}}

Tap the button below to pay securely through Nuru.

Plan Smarter. Celebrate Better.
```
- **Placeholders (body):** same order as #17 (`{{1}}` contributor_name · `{{2}}` organiser_name · `{{3}}` event_name · `{{4}}` pledge_amount_text)
- **Buttons:** 1 × **CTA URL (dynamic)** — label `Pay Now` · static prefix `https://nuru.tz/c/` · URL `{{1}}` = `share_token`
- **Backend reference:** same as #17

## 19. nuru_guest_contribution_receipt_sw

- **Language:** sw · **Status:** Updated (now includes total_paid + balance, receipt link moved to dynamic URL button) · **Category:** UTILITY
- **Body:**
```
MALIPO YAMEFANIKIWA

Habari {{1}}, asante.

Malipo yako ya {{2}} kwa ajili ya {{3}} yamefanikiwa.

Jumla uliyolipa: {{4}}
Salio lililobaki: {{5}}
Kumbukumbu ya muamala: {{6}}

Bonyeza kitufe hapa chini kuona risiti yako.

Plan Smarter. Celebrate Better.
```
- **Placeholders (body):** `{{1}}` contributor_name · `{{2}}` amount_text · `{{3}}` event_name · `{{4}}` total_paid_text · `{{5}}` balance_text · `{{6}}` transaction_code
- **Buttons:** 1 × **CTA URL (dynamic)** — label `Ona Risiti` · static prefix `https://nuru.tz/c/` · URL `{{1}}` = `receipt_path` (e.g. `<share_token>/r/<transaction_code>`)
- **Backend reference:** `utils/sms.py::sms_guest_contribution_receipt` → `api/routes/public_contributions.py` (already builds `receipt_url = https://{host}/c/{token}/r/{tx.transaction_code}`; expose the suffix `f"{token}/r/{tx.transaction_code}"` as the new `receipt_path` kwarg for the button). Also calls `resolve_user_language(db, contributor_user_id)` when the contributor is a known Nuru user; if anonymous/external, default to `sw`.

## 20. nuru_guest_contribution_receipt_en

- **Language:** en · **Status:** Updated · **Category:** UTILITY
- **Body:**
```
PAYMENT SUCCESSFUL

Hello {{1}}, thank you.

Your payment of {{2}} for {{3}} was successful.

Total paid: {{4}}
Remaining balance: {{5}}
Transaction reference: {{6}}

Tap the button below to view your receipt.

Plan Smarter. Celebrate Better.
```
- **Placeholders (body):** same order as #19
- **Buttons:** 1 × **CTA URL (dynamic)** — label `View Receipt` · static prefix `https://nuru.tz/c/` · URL `{{1}}` = `receipt_path`
- **Backend reference:** same as #19


## 21. nuru_payment_received_generic_sw

- **Language:** sw · **Status:** New · **Category:** UTILITY
- **Body:**
```
MALIPO YAMEINGIA

Umepokea {{1}} kutoka kwa {{2}} kwa ajili ya {{3}}. Kumbukumbu ya muamala: {{4}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` amount_text · `{{2}}` payer_name · `{{3}}` purpose · `{{4}}` transaction_code
- **Backend reference:** `utils/sms.py::sms_payment_received_generic` (WA fallback) → `api/routes/payments.py`, `services/wallet_service.py`

## 22. nuru_payment_received_generic_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
PAYMENT RECEIVED

You have received {{1}} from {{2}} for {{3}}. Transaction reference: {{4}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #21
- **Backend reference:** same as #21

## 23. nuru_payment_confirmation_payer_sw

- **Language:** sw · **Status:** New · **Category:** UTILITY
- **Body:**
```
MALIPO YAMEFANIKIWA

Habari {{1}}, malipo yako ya {{2}} kwa ajili ya {{3}} yamefanikiwa. Kumbukumbu ya muamala: {{4}}. Tafadhali hifadhi ujumbe huu kwa kumbukumbu zako.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` payer_name · `{{2}}` amount_text · `{{3}}` purpose · `{{4}}` transaction_code
- **Backend reference:** `utils/sms.py::sms_payment_confirmation_payer` → `api/routes/payments.py`

## 24. nuru_payment_confirmation_payer_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
PAYMENT SUCCESSFUL

Hello {{1}}, your payment of {{2}} for {{3}} was successful. Transaction reference: {{4}}. Please keep this message for your records.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #23
- **Backend reference:** same as #23

## 25. nuru_organiser_contribution_received_sw

- **Language:** sw · **Status:** New · **Category:** UTILITY
- **Body:**
```
MCHANGO UMEPOKELEWA

Habari {{1}}, umepokea mchango wa {{2}} kutoka kwa {{3}} kwa ajili ya {{4}}. Kumbukumbu ya muamala: {{5}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` organizer_name · `{{2}}` amount_text · `{{3}}` contributor_name · `{{4}}` event_name · `{{5}}` transaction_code
- **Backend reference:** `utils/sms.py::sms_organiser_contribution_received` → `api/routes/payments.py`

## 26. nuru_organiser_contribution_received_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
CONTRIBUTION RECEIVED

Hello {{1}}, you have received a contribution of {{2}} from {{3}} for {{4}}. Transaction reference: {{5}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #25
- **Backend reference:** same as #25

## 27. nuru_vendor_booking_paid_sw

- **Language:** sw · **Status:** Updated (now includes service_amount, total_paid, balance) · **Category:** UTILITY
- **Body:**
```
MALIPO YA HUDUMA

Habari {{1}},

Umepokea malipo ya {{2}} kutoka kwa {{3}} kwa ajili ya huduma yako {{4}}.

Kiasi cha huduma kilichokubaliwa: {{5}}
Jumla uliyolipwa: {{6}}
Salio lililobaki: {{7}}

Kumbukumbu ya muamala: {{8}}

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` vendor_name · `{{2}}` amount_text · `{{3}}` client_name · `{{4}}` service_title · `{{5}}` service_amount_text · `{{6}}` total_paid_text · `{{7}}` balance_text · `{{8}}` transaction_code
- **Buttons:** none
- **Backend reference:** `utils/sms.py::sms_vendor_booking_paid` → `api/routes/payments.py` (computes `service_amount` from `booking.quoted_price` with fallback to `booking.proposed_price`, `total_paid` from the sum of successful `Transaction.gross_amount` for the booking target, and `balance = max(0, service_amount - total_paid)`).

## 28. nuru_vendor_booking_paid_en

- **Language:** en · **Status:** Updated · **Category:** UTILITY
- **Body:**
```
SERVICE PAYMENT RECEIVED

Hello {{1}},

You have received {{2}} from {{3}} for your service {{4}}.

Agreed service amount: {{5}}
Received so far: {{6}}
Remaining balance: {{7}}

Transaction reference: {{8}}

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #27
- **Buttons:** none
- **Backend reference:** same as #27


## 29. nuru_admin_payment_alert_sw

- **Language:** sw · **Status:** New · **Category:** UTILITY
- **Body:**
```
[Nuru Admin]

[Nuru Admin] {{1}} zimepokelewa kupitia {{2}} kwa ajili ya {{3}} {{4}}. Mlipaji: {{5}} ({{6}}). Ref: {{7}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` amount_text · `{{2}}` method · `{{3}}` purpose · `{{4}}` target_label · `{{5}}` payer_name · `{{6}}` payer_phone · `{{7}}` transaction_code
- **Backend reference:** `utils/sms.py::sms_admin_payment_alert` → `api/routes/payments.py` (admin-notify branch)

## 30. nuru_admin_payment_alert_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
[Nuru Admin]

[Nuru Admin] {{1}} received via {{2}} for {{3}} {{4}}. Payer: {{5}} ({{6}}). Ref: {{7}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #29
- **Backend reference:** same as #29

## 31. nuru_vendor_otp_claim_sw

- **Language:** sw · **Status:** New · **Category:** AUTHENTICATION
- **Code delivery setup:** Copy code
- **Security recommendation:** enabled
- **Expiration time:** enabled (10 minutes — configured on the Meta template, NOT a backend placeholder)
- **Body:** Meta-managed authentication body. Only one placeholder is sent.
- **Placeholders:** `{{1}}` code (OTP)
- **WhatsApp payload:** action `vendor_otp_claim` → only `{ otp, lang }` is sent. Do NOT pass vendor_first_name, organiser_name, amount_text, service_title, event_name, or minutes to WhatsApp.
- **SMS (unchanged):** Detailed Swahili body in `utils/message_templates.py::vendor_otp_claim` still includes vendor name, organiser, amount, service, event, code, and expiry.
- **Backend reference:** `utils/sms.py::sms_vendor_otp_claim` (SMS); `api/routes/offline_payments.py` (WA action `vendor_otp_claim`, code-only payload)

## 32. nuru_vendor_otp_claim_en

- **Language:** en · **Status:** New · **Category:** AUTHENTICATION
- **Code delivery setup:** Copy code
- **Security recommendation:** enabled
- **Expiration time:** enabled (10 minutes — configured on the Meta template, NOT a backend placeholder)
- **Body:** Meta-managed authentication body. Only one placeholder is sent.
- **Placeholders:** `{{1}}` code (OTP)
- **WhatsApp payload:** same as #31 — `{ otp, lang: "en" }` only.
- **SMS (unchanged):** Detailed English body in `utils/message_templates.py::vendor_otp_claim`.
- **Backend reference:** same as #31

## 33. nuru_vendor_otp_resend_sw

- **Language:** sw · **Status:** New · **Category:** AUTHENTICATION
- **Code delivery setup:** Copy code
- **Security recommendation:** enabled
- **Expiration time:** enabled (10 minutes — configured on the Meta template, NOT a backend placeholder)
- **Body:** Meta-managed authentication body. Only one placeholder is sent.
- **Placeholders:** `{{1}}` code (OTP)
- **WhatsApp payload:** action `vendor_otp_resend` → only `{ otp, lang }` is sent.
- **SMS (unchanged):** Detailed Swahili body in `utils/message_templates.py::vendor_otp_resend`.
- **Backend reference:** `utils/sms.py::sms_vendor_otp_resend` (SMS); `api/routes/offline_payments.py` (WA action `vendor_otp_resend`, code-only payload)

## 34. nuru_vendor_otp_resend_en

- **Language:** en · **Status:** New · **Category:** AUTHENTICATION
- **Code delivery setup:** Copy code
- **Security recommendation:** enabled
- **Expiration time:** enabled (10 minutes — configured on the Meta template, NOT a backend placeholder)
- **Body:** Meta-managed authentication body. Only one placeholder is sent.
- **Placeholders:** `{{1}}` code (OTP)
- **WhatsApp payload:** same as #33 — `{ otp, lang: "en" }` only.
- **SMS (unchanged):** Detailed English body in `utils/message_templates.py::vendor_otp_resend`.
- **Backend reference:** same as #33

## 35. nuru_vendor_confirmation_receipt_sw

- **Language:** sw · **Status:** New · **Category:** UTILITY
- **Body:**
```
MALIPO YAMETHIBITISHWA

Habari {{1}}, umethibitisha kupokea {{2}} kutoka kwa {{3}} kwa ajili ya {{4}}. Kiasi kilichobaki ni {{5}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` vendor_first_name · `{{2}}` amount_text · `{{3}}` organiser_name · `{{4}}` event_name · `{{5}}` balance_text
- **Backend reference:** `utils/sms.py::sms_vendor_confirmation_receipt` (WA action `vendor_payment_confirmed`) → `api/routes/offline_payments.py`

## 36. nuru_vendor_confirmation_receipt_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
PAYMENT CONFIRMED

Hello {{1}}, you have confirmed receiving {{2}} from {{3}} for {{4}}. Remaining amount: {{5}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #35
- **Backend reference:** same as #35

## 37. nuru_vendor_confirmation_receipt_full_sw

- **Language:** sw · **Status:** New · **Category:** UTILITY
- **Body:**
```
MALIPO YAMEKAMILIKA

Habari {{1}}, umethibitisha kupokea {{2}} kutoka kwa {{3}} kwa ajili ya {{4}}. Sasa umelipwa kikamilifu.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` vendor_first_name · `{{2}}` amount_text · `{{3}}` organiser_name · `{{4}}` event_name
- **Backend reference:** `utils/sms.py::sms_vendor_confirmation_receipt_full` → `api/routes/offline_payments.py` (final confirmation branch)

## 38. nuru_vendor_confirmation_receipt_full_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
PAYMENT COMPLETED

Hello {{1}}, you have confirmed receiving {{2}} from {{3}} for {{4}}. You have now been paid in full.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #37
- **Backend reference:** same as #37

## 39. nuru_organiser_committee_vendor_confirmed_sw

- **Language:** sw · **Status:** New · **Category:** UTILITY
- **Body:**
```
MALIPO YAMETHIBITISHWA

Habari {{1}}, {{2}} amethibitisha kupokea {{3}} kutoka kwa {{4}} kwa ajili ya {{5}}. Kiasi kilichobaki ni {{6}}. Fungua Nuru kuona taarifa kamili.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` recipient_first_name · `{{2}}` vendor_name · `{{3}}` amount_text · `{{4}}` organiser_name · `{{5}}` event_name · `{{6}}` balance_text
- **Backend reference:** `utils/sms.py::sms_organiser_committee_vendor_confirmed` → `api/routes/offline_payments.py` (organiser + committee broadcast)

## 40. nuru_organiser_committee_vendor_confirmed_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
PAYMENT CONFIRMED

Hello {{1}}, {{2}} has confirmed receiving {{3}} from {{4}} for {{5}}. Remaining amount: {{6}}. Open Nuru for full details.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #39
- **Backend reference:** same as #39

## 41. nuru_expense_recorded_sw

- **Language:** sw · **Status:** Existing — kept, body rewritten (was `expense_recorded`) · **Category:** UTILITY
- **Body:**
```
GHARAMA MPYA

Habari {{1}}, {{2}} amerekodi matumizi mapya ya {{3}} kwenye kipengele cha {{4}} kwa ajili ya {{5}}. Fungua Nuru kuona mchanganuo kamili.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` recipient_first_name · `{{2}}` recorder_name · `{{3}}` amount_text · `{{4}}` category · `{{5}}` event_name
- **Backend reference:** `utils/whatsapp.py::wa_expense_recorded` → `api/routes/expenses.py::_send_expense_sms_wa`, `api/routes/offline_payments.py`

## 42. nuru_expense_recorded_en

- **Language:** en · **Status:** Existing — kept, body rewritten · **Category:** UTILITY
- **Body:**
```
NEW EXPENSE RECORDED

Hello {{1}}, {{2}} has recorded a new expense of {{3}} under {{4}} for {{5}}. Open Nuru to see the full breakdown.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #41
- **Backend reference:** same as #41

## 42a. nuru_owner_expense_summary_sw

- **Language:** sw · **Status:** New — owner / creator budget summary on every expense log · **Category:** UTILITY
- **Body:**
```
MUHTASARI WA MATUMIZI

Habari {{1}},

Matumizi mapya yamerekodiwa kwenye tukio la {{2}}.

Kipengele cha matumizi: {{3}}
Kiasi kilichotumika: {{4}}

Muhtasari wa bajeti:
Bajeti kuu: {{5}}
Jumla ya matumizi: {{6}}
Salio lililobaki: {{7}}

Kwa mchanganuo kamili wa matumizi na bajeti, tafadhali ingia kwenye Nuru.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` organizer_name (recognizable owner name → owner full name → creator) · `{{2}}` event_name · `{{3}}` expense_name · `{{4}}` expense_amount · `{{5}}` total_budget (total contributed, confirmed only) · `{{6}}` total_expenses (incl. the new one) · `{{7}}` remaining_balance
- **Trigger:** `POST /user-events/{event_id}/expenses` — sent to `event_owner_user_id` if set, otherwise to `organizer_id`. Always sent regardless of `notify_committee`.
- **Backend reference:** `utils/sms.py::sms_owner_expense_summary` → `api/routes/expenses.py::add_expense` (catalogue key `owner_expense_summary`)

## 42b. nuru_owner_expense_summary_en

- **Language:** en · **Status:** New · **Category:** UTILITY
- **Body:**
```
EXPENSE SUMMARY

Hello {{1}},

A new expense has been recorded for {{2}}.

Expense item: {{3}}
Amount spent: {{4}}

Budget summary:
Total contributed: {{5}}
Total expenses: {{6}}
Remaining balance: {{7}}

For the full breakdown of expenses and budget, please open Nuru.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #42a
- **Backend reference:** same as #42a


## 43. nuru_service_booking_notification_sw

- **Language:** sw · **Status:** Existing — kept, body rewritten (was `booking_notification`) · **Category:** UTILITY
- **Body:**
```
OMBI JIPYA LA HUDUMA

Habari {{1}}, {{2}} ameomba huduma yako "{{3}}" kwa ajili ya {{4}}. Fungua Nuru kukagua na kujibu ombi hili.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` provider_name · `{{2}}` client_name · `{{3}}` service_name · `{{4}}` event_name
- **Backend reference:** `utils/whatsapp.py::wa_booking_notification` → `api/routes/bookings.py`, `api/routes/user_events.py`

## 44. nuru_service_booking_notification_en

- **Language:** en · **Status:** Existing — kept, body rewritten · **Category:** UTILITY
- **Body:**
```
NEW SERVICE BOOKING

Hello {{1}}, {{2}} has booked your service "{{3}}" for {{4}}. Open Nuru to review and respond.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #43
- **Backend reference:** same as #43

## 45. nuru_booking_accepted_sw

- **Language:** sw · **Status:** Existing — kept, body rewritten (was `booking_accepted`) · **Category:** UTILITY
- **Body:**
```
OMBI LA HUDUMA LIMEKUBALIWA

Habari {{1}}, habari njema. {{2}} amekubali ombi lako la huduma "{{3}}" kwa ajili ya {{4}}. Fungua Nuru kuona hatua zinazofuata.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** `{{1}}` requester_first_name · `{{2}}` vendor_name · `{{3}}` service_name · `{{4}}` event_name
- **Backend reference:** `utils/whatsapp.py::wa_booking_accepted` → `api/routes/bookings.py` (acceptance branch)

## 46. nuru_booking_accepted_en

- **Language:** en · **Status:** Existing — kept, body rewritten · **Category:** UTILITY
- **Body:**
```
BOOKING ACCEPTED

Hello {{1}}, good news. {{2}} has accepted your booking for "{{3}}" at {{4}}. Open Nuru to see the next steps.

Plan Smarter. Celebrate Better.
```
- **Placeholders:** same order as #45
- **Backend reference:** same as #45

---

## Skipped (not in the uploaded document)

| Template | Reason kept as-is |
|----------|-------------------|
| `event_reminder` | Reminder-automation only; handled by separate doc `whatsapp_reminder_templates.md`. |
| `event_invitation_text`, `event_invitation_card`, `event_ticket_*` | Driven by `utils/whatsapp_cards.py` (rich media), not the SMS catalogue. |
| `nuru_fundraise_notice_{sw,en}`, `nuru_pledge_remind_{sw,en}`, `nuru_guest_remind_{sw,en}` | Existing reminder-automation templates with their own placeholder contract (`whatsapp_reminder_templates.md`). |
| `event_update` | No matching row in the updated SMS document. Left as-is until the document is amended. |

---

## Language selection — backend confirmation

- `utils/sms.py` and `utils/whatsapp.py` both call
  `message_templates.resolve_user_language(db, user_id)` to decide
  `lang`. The result is passed to the edge function as `params.lang`.
- The edge-function dispatcher (`supabase/functions/whatsapp-send/index.ts`)
  picks `<name>_sw` or `<name>_en` based on `params.lang`. Unknown /
  missing → `_sw`.
- Default for users with no `notification_language` row → `sw`.
- Anonymous recipients (`user_id is None`, e.g. external guest
  contributors in `public_contributions.py`) → `sw`.

### Two call sites flagged earlier

1. **`api/routes/users.py` — inline-registration welcome** (templates
   #5/#6). The new account has a `user.id` the moment it's created, so
   the call must look it up:
   `lang = resolve_user_language(db, new_user.id)` →
   `sms_welcome_registered(..., lang=lang)`. New rows default to `sw`
   because no preference is set yet, which is the intended fallback.
2. **`api/routes/public_contributions.py` — guest contribution receipt**
   (templates #19/#20). Branch on `contributor_user_id`:
   - If set → `lang = resolve_user_language(db, contributor_user_id)`.
   - Else (truly anonymous / external) → `lang = "sw"`.

These two wiring updates are the only outstanding code edits before
this is end-to-end complete; no body wording changes are required.

---

## Final core catalogue count

**48 templates** = 24 message keys × 2 languages.

The split that moved the count from 46 → 48:

- Removed the generic `nuru_contribution_pledge_set_*` pair (kept in
  `message_templates.py` only as a deprecated alias for backwards
  compatibility — **do NOT submit to Meta**).
- Added `nuru_contribution_target_set_{sw,en}` (#13/#14).
- Added `nuru_contribution_target_updated_{sw,en}` (#14a/#14b).

Net change: −2 + 4 = **+2 templates**.

---

## Templates to add on Meta now

### A. Core catalogue (48)

All 48 templates documented above (#1–#46 plus #14a/#14b). Submit each
`_sw` and `_en` as a separate template. Every template is **UTILITY**.

### B. Unique non-catalogue templates that still need SW/EN pairs

These are not in the SMS document but are in active code paths. Submit
the SW + EN pair only after product approves wording.

| Proposed name | Trigger | Notes |
|---------------|---------|-------|
| `nuru_event_update_sw` / `_en` | Event detail changes (used today as single-language `event_update` from `utils/whatsapp.py::wa_event_updated`) | Product to approve final SW + EN bodies. |
| `event_invitation_text_sw` / `_en` | Rich-text invitation variant | Keep separate from core; product to approve SW translation. |
| `event_invitation_card_sw` / `_en` | Image-header invitation card | Provide SW body; image template component already approved. |
| `event_ticket_delivery_sw` / `_en` | Ticket-delivery card | Provide SW body; image template component already approved. |
| `event_reminder_sw` / `_en` | Standalone manual reminder (only if still used outside automation) | Confirm whether still active outside `nuru_guest_remind_*` automation before submitting. |

---

## Templates to keep on Meta unchanged

| Template | Reason | Action when new pair lands |
|----------|--------|----------------------------|
| `otp_verification` | Auth OTP. Not in catalogue. | Keep. |
| `hello_world` | Meta sample / health probe. | Keep. |
| `nuru_fundraise_notice_sw` / `_en` | Reminder automation. | Keep. |
| `nuru_pledge_remind_sw` / `_en` | Reminder automation. | Keep. |
| `nuru_guest_remind_sw` / `_en` | Reminder automation. | Keep. |
| `event_invitation_text` | Rich-text invite (driven by `whatsapp_cards.py`). | Keep current template until the new `event_invitation_text_sw/_en` pair is approved and deployed. |
| `event_invitation_card` | Image-card invite. | Keep current template until the new `event_invitation_card_sw/_en` pair is approved and deployed. |
| `event_ticket_delivery` | Ticket delivery card. | Keep current template until the new `event_ticket_delivery_sw/_en` pair is approved and deployed. |
| `event_update` | Event-detail-change broadcast. | Keep current template until the new `nuru_event_update_sw/_en` pair is approved and deployed. |
| `event_reminder` | Reminder template (legacy single-language). | Keep until product confirms whether to retire or replace with a SW/EN pair. |

---

## Templates to retire later, not now

Remove from Meta **only after** all three conditions hold:

1. The replacement SW/EN pair below has been approved by Meta.
2. The backend + edge function have been deployed and no longer
   reference the old name.
3. End-to-end WhatsApp delivery in SW and EN has been verified.

| Old template | Replacement | Safe removal condition |
|--------------|-------------|------------------------|
| `event_invitation_v2` | `nuru_guest_invitation_sw/_en` (#1/#2) | After dispatcher cut-over + delivery test. |
| `meeting_invitation` | `nuru_meeting_invitation_sw/_en` (#7/#8) | After dispatcher cut-over + delivery test. Confirm URL-button decision before submitting new pair. |
| `contribution_recorded` | `nuru_contribution_recorded_with_balance_sw/_en` (#9/#10) **and** `nuru_contribution_recorded_pledge_complete_sw/_en` (#11/#12) | After backend branch (with-balance vs pledge-complete) is live and tested. |
| `contribution_target` | `nuru_contribution_target_set_sw/_en` (#13/#14) **and** `nuru_contribution_target_updated_sw/_en` (#14a/#14b) **and** `nuru_guest_contribution_invite_sw/_en` (#17/#18) | After backend branches set vs updated vs guest-invite and tests pass. |
| `thank_you_contribution` | `nuru_contribution_thank_you_sw/_en` (#15/#16) | After dispatcher cut-over + delivery test. |
| `expense_recorded` | `nuru_expense_recorded_sw/_en` (#41/#42) | After dispatcher cut-over + delivery test. |
| `booking_notification` | `nuru_service_booking_notification_sw/_en` (#43/#44) | After dispatcher cut-over + delivery test. |
| `booking_accepted` | `nuru_booking_accepted_sw/_en` (#45/#46) | After dispatcher cut-over + delivery test. |
| `vendor_payment_otp` | `nuru_vendor_otp_claim_sw/_en` (#31/#32) **and** `nuru_vendor_otp_resend_sw/_en` (#33/#34) | After backend distinguishes first send vs resend and tests pass. |
| `vendor_payment_confirmed` | `nuru_vendor_confirmation_receipt_sw/_en` (#35/#36) **and** `nuru_vendor_confirmation_receipt_full_sw/_en` (#37/#38) | After backend branches partial vs full payment and tests pass. |


---

## Test loop — 27 May 2026 (post-rewrite)

Live send loop against `255653750805` covering all 22 catalogue actions × 2
languages (44 sends). Run via `/tmp/wa_test_loop.sh` (publishable key auth).

**Result: 39 / 44 succeeded, 5 pending Meta approval.**

### Pending Meta approval (404 — template not yet live on Meta)

| # | Template | Action sent | Notes |
|---|----------|-------------|-------|
| 4 | `nuru_committee_invite_en` | `committee_invite` (en) | Submit EN variant; SW already approved. |
| 11 | `nuru_contribution_recorded_pledge_complete_sw` | `contribution_recorded_pledge_complete` (sw) | Submit SW variant; EN already approved. |
| 14a | `nuru_contribution_target_updated_sw` | `contribution_target_updated` (sw) | Submit SW variant. |
| 17 | `nuru_guest_contribution_invite_sw` | `guest_contribution_invite` (sw) | Submit SW variant. |
| 29/30 | `nuru_admin_payment_alert_{sw,en}` | `admin_payment_alert` | Submit both SW and EN. |

All five failures returned Meta error 404 ("template does not exist"). The
edge function dispatcher and backend callers are correct — the failures are
purely a Meta Business Manager submission backlog.

### Action required (Meta Business Manager)

1. Submit the 5 templates above for approval (copy bodies from sections
   #4, #11, #14a, #17, #29, #30 of this catalogue).
2. After approval, re-run `/tmp/wa_test_loop.sh` to confirm all 44 sends
   succeed.

### Removed / retained / new summary

| Category | Count | Notes |
|----------|------:|-------|
| New 46 catalogue templates | 46 | All wired in edge function + `utils/whatsapp.py`. |
| Legacy template names removed from dispatcher | 9 | `event_invitation_v2`, `meeting_invitation` (legacy single-lang), `contribution_recorded`, `contribution_target`, `thank_you_contribution`, `expense_recorded` (single-lang), `booking_notification`, `vendor_payment_otp`, `vendor_payment_confirmed`. Mapped via `ALIASES` map so any in-flight backend caller still routes to the correct new template. |
| Legacy aliases kept (transitional) | 6 | `invite`, `contribution_recorded`, `contribution_target`, `thank_you_contribution`, `booking_notification`, `vendor_payment_confirmed`. Listed under `ALIASES` in `supabase/functions/whatsapp-send/index.ts:356-364`. Remove after one full deploy cycle. |
| Retained as-is (not in catalogue) | 7 | `nuru_fundraise_notice_{sw,en}`, `nuru_pledge_remind_{sw,en}`, `nuru_guest_remind_{sw,en}`, `event_reminder`, `event_invitation_text`, `event_invitation_card`, `event_ticket_delivery` (rich-media + reminder-automation, documented separately). |

### Backend caller audit summary

| File | Calls audited | Verdict |
|------|--------------:|---------|
| `api/routes/bookings.py` | `wa_booking_accepted` | ✔ Passes `lang`; WA first, SMS fallback. |
| `api/routes/user_events.py` (×2) | `wa_booking_notification` | ✔ Added in this pass; resolves `lang`, sends WA before SMS. |
| `api/routes/user_contributors.py` | `wa_contribution_target_set`, `wa_contribution_recorded`, `wa_thank_you` | ✔ All route via helpers, which combine currency+amount via `_money()`. |
| `api/routes/payments.py` | `wa_contribution_recorded` | ✔ |
| `api/routes/offline_payments.py` | `vendor_otp_claim`, `vendor_otp_resend`, `vendor_confirmation_receipt[_full]` | ✔ Fixed in this pass: now picks `_full` variant when balance ≤ 0 and passes `amount_text`/`balance_text` instead of legacy `amount`/`remaining_msg`. |
| `api/routes/users.py` | `wa_welcome_registered_by` | ✔ Passes `setup_token` + `lang`. |
| `api/routes/meetings.py` | `wa_meeting_invitation` | ✔ Passes `meeting_redirect_token` + `lang`. |

---

## 47. nuru_pledge_thank_you_card_sw

- **Language:** sw · **Status:** New (pending Meta approval) · **Category:** UTILITY
- **Header:** IMAGE (rendered PNG of the event's thank-you card, served from `/api/v1/cards/public/{sent_id}.png`)
- **Body:**
```
KADI YA SHUKRANI

Habari {{1}}, asante sana kwa ahadi yako ya mchango kwa ajili ya {{2}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders (body):** `{{1}}` contributor_name · `{{2}}` event_name
- **Buttons:** none
- **Backend reference:** `utils/whatsapp.py::wa_pledge_thank_you_card` → `api/routes/event_cards.py` `POST /events/{id}/cards/{category}/send` (image_url is the public card render endpoint). SMS fallback: `utils/sms.py::sms_pledge_thank_you_card` sends a short message + landing URL.

## 48. nuru_pledge_thank_you_card_en

- **Language:** en · **Status:** New (pending Meta approval) · **Category:** UTILITY
- **Header:** IMAGE (same source as #47)
- **Body:**
```
THANK YOU CARD

Hello {{1}}, thank you so much for your pledge towards {{2}}.

Plan Smarter. Celebrate Better.
```
- **Placeholders (body):** `{{1}}` contributor_name · `{{2}}` event_name
- **Buttons:** none
- **Backend reference:** same as #47.


### Submission notes (#47/#48)

1. Category **UTILITY** (transactional acknowledgement, not marketing).
2. Header sample image: any existing render at
   `https://api.nuru.tz/api/v1/cards/public/<sent_id>.png` (1080 px, <5 MB).
3. Submit both `_sw` and `_en` variants simultaneously.
4. After approval, run a smoke send from
   `POST /api/v1/events/{event_id}/cards/thank-you-for-pledging/send`.
5. If renderer is offline the dispatcher already falls back to SMS-only with the public card landing link.

Full submission spec lives in `backend/app/docs/meta_template_pledge_thank_you_card.md`.
Storage & deployment notes live in `backend/app/docs/event_cards_storage_and_deployment.md`.
