# WhatsApp Templates — Merge & Cleanup Audit

> Purpose: decide what to **merge, replace, keep, or newly submit** on Meta
> before wiring the new SMS-aligned catalogue into the backend dispatcher.
> Auth-only templates are out of scope.
>
> Sources inspected:
> - `supabase/functions/whatsapp-send/index.ts` (live dispatcher, all `case` branches)
> - `backend/app/utils/whatsapp.py` (`wa_*` helpers)
> - `backend/app/utils/whatsapp_cards.py` (rich-media cards: invitation card, invitation text, ticket)
> - `backend/app/utils/notify_channels.py` (free-form WhatsApp→SMS fallback)
> - `backend/app/utils/sms.py` (catalogue-backed SMS senders that share params with WA)
> - `backend/app/docs/whatsapp_templates_catalogue.md` (final **48** catalogue templates — updated 2026-05-23 to split contribution target into set vs updated and extend guest receipt + vendor booking paid bodies)
> - `backend/app/docs/whatsapp_reminder_templates.md` (6 reminder-automation templates)
>
> **No deployment, no Meta API call, no template removal, no wording change
> performed by this audit.**
>
> ### Rule — no Meta placeholder reuse (added 2026-05-26)
>
> Meta does not allow the same positional placeholder (`{{N}}`) to appear
> more than once in a template body. Every money value is therefore
> shipped as a **single combined string** (e.g. `TZS 10,000`) built by
> `utils.message_templates.format_money(currency, amount)` and passed to
> the edge function under a `*_text` key (`amount_text`, `balance_text`,
> `target_text`, `total_paid_text`, `pledge_amount_text`,
> `increase_text`, `total_target_text`, `service_amount_text`). All
> catalogue bodies have been rewritten to use one slot per money value;
> earlier rows in this audit that describe `currency + amount` as two
> placeholders are superseded.

>
> ### Updates applied 2026-05-23 (post-product-review)
>
> - **Contribution pledge split.** The generic `contribution_pledge_set`
>   message key was removed from the live catalogue (kept as a deprecated
>   alias only) and replaced with two keys:
>   - `contribution_target_set` (first-time pledge — no total_paid/balance)
>   - `contribution_target_updated` (pledge increased — uses `increase` and
>     `total_target`; reductions fall back to `contribution_target_set`)
> - **Guest contribution receipt** now includes `total_paid` and `balance`
>   in both SW and EN (templates #19/#20).
> - **Vendor booking paid** now includes `service_amount`, `total_paid`,
>   and `balance` in both SW and EN (templates #27/#28).
> - **Final core catalogue count: 48** (24 keys × 2 languages).

---

## Step 1 — Inventory: every WhatsApp message touched by the codebase

Scan of `supabase/functions/whatsapp-send/index.ts` shows **22 dispatcher
actions**. Of those, **20 send Meta-approved templates**, **1 sends
free-form text** (`text`), and **1 sends a free-form image** (`image`,
24h window only).

The free-form `text` / `image` paths are **not templates** and do not need
Meta submission — they're used by:
- `notify_channels.notify_user_wa_sms` (best-effort WA before SMS)
- `whatsapp_cards.wa_send_invitation_card/_text/_ticket` (after the
  template carries the media; chat fallbacks during 24h window)

---

## Step 2 — Existing WhatsApp Templates Currently Referenced

| # | Existing template name | Action key / helper | Language today | Body summary (from edge fn / Meta) | Placeholders | Buttons / media | Backend file | Purpose | Auth? | Excluded? | Overlaps new catalogue? | Matching new template | Recommended action |
|---|------------------------|---------------------|----------------|------------------------------------|--------------|-----------------|--------------|---------|-------|-----------|--------------------------|-----------------------|--------------------|
| 1 | `event_invitation_v2` | `invite` / `wa_guest_invited` | en (single) | "{{1}} invited by {{2}} to {{3}} on {{4}}" + quick-reply RSVP | guest_name, event_name, event_date, organizer_name | 2× quick-reply buttons (`rsvp_confirm_<code>`, `rsvp_decline_<code>`) | `utils/whatsapp.py`, edge `case "invite"` | Initial guest invitation | No | No | **Yes** | `nuru_guest_invitation_sw` / `_en` (#1/#2) | **Replace** with new `_sw`/`_en` pair. ⚠️ New catalogue body has **no quick-reply buttons** and uses an `rsvp_url` instead. Decision needed: keep quick-reply RSVP buttons on the new pair (deeper migration) or drop them. |
| 2 | `event_update` | `event_update` / `wa_event_updated` | en | "{{1}}, the event {{2}} has updates: {{3}}" | guest_name, event_name, changes | none | edge `case "event_update"` | Notify guest of event changes | No | No | **No** (catalogue skipped this) | — | **Keep**, but **create missing SW version** (`event_update_sw` or rename to `nuru_event_update_sw/_en`). Needs your decision. |
| 3 | `event_reminder` | `reminder` / `wa_event_reminder` | en | "{{1}}, reminder for {{2}} on {{3}} at {{4}} ({{5}})" | guest_name, event_name, event_date, event_time, location | none | edge `case "reminder"` | Generic event reminder (non-automation) | No | No | Partial — automation flow uses `nuru_guest_remind_*` instead | `nuru_guest_remind_sw/_en` (reminder doc) | **Keep**. Likely deprecated by automation; if still actively dispatched, create `_sw` pair. Mark for retirement once automation covers all reminder triggers. |
| 4 | `expense_recorded` | `expense_recorded` / `wa_expense_recorded` | en | "{{1}}, {{2}} recorded {{3}} under {{4}} for {{5}}" | recipient_name, recorder_name, amount, category, event_name | none | `expenses.py`, `offline_payments.py` | Notify committee of new expense | No | No | **Yes** | `nuru_expense_recorded_sw` / `_en` (#41/#42) | **Replace** with new `_sw`/`_en` pair. |
| 5 | `contribution_recorded` | `contribution_recorded` / `wa_contribution_recorded` | en | "{{1}}, {{2}} recorded contribution {{3}} for {{4}}. Target/Paid/Balance" | contributor, recorder, amount, event_name, target, total_paid, balance | none | `payments.py`, `contributors.py` | Confirm received contribution | No | No | **Yes — splits into two** | `nuru_contribution_recorded_with_balance_*` (#9/#10) **and** `nuru_contribution_recorded_pledge_complete_*` (#11/#12) | **Replace**. Backend branch by `balance==0` to pick "with_balance" vs "pledge_complete". |
| 6 | `contribution_target` | `contribution_target` / `wa_contribution_target_set` | en | "{{1}}, pledge for {{2}} is {{3}}. Paid {{4}}, balance {{5}}" | contributor, event_name, target, total_paid, balance | none | `contributors.py` | Pledge set/updated | No | No | **Yes** | `nuru_contribution_pledge_set_sw` / `_en` (#13/#14) | **Replace**. Also relates to new template #17/#18 `nuru_guest_contribution_invite_*` for **first-time guest invites** (different body — includes payment URL). Backend must branch known-contributor vs guest. |
| 7 | `thank_you_contribution` | `thank_you_contribution` / `wa_thank_you` | en | "{{1}}, thank you for contributing to {{2}}. {{3}}" | contributor_name, event_name, custom_message | none | `contributors.py` | Thank-you note | No | No | **Yes** | `nuru_contribution_thank_you_sw` / `_en` (#15/#16) | **Replace**. New body adds `{{4}} organizer_phone`. |
| 8 | `booking_notification` | `booking_notification` / `wa_booking_notification` | en | "{{1}}, {{2}} has booked your service for {{3}}" | provider_name, client_name, event_name | none | `bookings.py` | New booking to vendor | No | No | **Yes** | `nuru_service_booking_notification_sw` / `_en` (#43/#44) | **Replace**. |
| 9 | `booking_accepted` | `booking_accepted` / `wa_booking_accepted` | en | "{{1}}, {{2}} confirmed booking for {{3}} at {{4}}" | client_name, vendor_name, service_name, event_name | none | `bookings.py` | Booking acceptance to client | No | No | **Yes** | `nuru_booking_accepted_sw` / `_en` (#45/#46) | **Replace**. |
| 10 | `meeting_invitation` | `meeting_invitation` / `wa_meeting_invitation` | **en_US** | "Invited to meeting for *{{1}}*. Meeting {{2}}, when {{3}}, link {{4}}" + URL button | event_name, meeting_title, scheduled_time, meeting_link | **URL button** (dynamic suffix to `https://nuru.tz/meet/{{1}}`) | `meetings.py::_notify_participants` | Meeting invite | No | No | **Yes** | `nuru_meeting_invitation_sw` / `_en` (#7/#8) | **Replace**. ⚠️ Catalogue body is **text-only** — manual decision: keep the dynamic URL button on the new `_sw`/`_en` pair (recommended) or drop it. |
| 11 | `otp_verification` | `otp_verification` | en | OTP code + Copy-code URL button | otp_code | URL/copy-code button | edge `sendOtpTemplate` | OTP for phone/WA verification | **Yes** | **Exclude (auth)** | — | — | **Keep untouched — auth.** |
| 12 | `hello_world` | `check_whatsapp` | en_US | Default WhatsApp hello | none | none | edge `checkWhatsAppBySending` | Detect whether a number is on WhatsApp | No (probe) | Yes (utility probe, not user-facing) | No | — | **Keep untouched** — infra probe. |
| 13 | `event_invitation_text` | `send_invitation_text` / `wa_send_invitation_text` | en | 7-var invitation text with two URL buttons (`/i/{{1}}`, `/rsvp/{{1}}`) | guest_name, event_name, organizer_name, event_date, event_time, venue, rsvp_code | 2× URL buttons (dynamic suffix = rsvp_code) | `utils/whatsapp_cards.py` | Rich text invitation (no image) | No | No | Partial — overlaps `nuru_guest_invitation_*` in purpose but has buttons + more fields | `nuru_guest_invitation_*` (#1/#2) | **Keep** as the rich-buttons variant. Create missing **SW** version: `event_invitation_text_sw`. Reconsider merging with #1/#2 only after deciding the button strategy. |
| 14 | `event_invitation_card` | `send_invitation_card` / `wa_send_invitation_card` | en | Invitation with **image header** + 5 body vars | image_url (header), guest_name, event_name, event_date, organizer_name, rsvp_code | **Image header** | `utils/whatsapp_cards.py` | Rich-media invitation card | No | No | No (catalogue is text-only) | — | **Keep**. Create missing **SW** version `event_invitation_card_sw`. Unique because of image header. |
| 15 | `event_ticket_delivery` | `send_ticket` / `wa_send_ticket` | en | Ticket delivery with **image header** + 5 body vars | image_url, guest_name, event_name, event_date, ticket_class, ticket_code | **Image header** | `utils/whatsapp_cards.py` | Ticket delivery to attendee | No | No | No | — | **Keep**. Create missing **SW** version `event_ticket_delivery_sw`. Unique (image header + ticket code). |
| 16 | `vendor_payment_otp` | `vendor_payment_otp` | en | "NURU PAYMENT… use code {{6}} (10 min)" | vendor, organiser, amount, service_title, event_name, otp | none | `offline_payments.py` | Vendor OTP to confirm cash claim | No (transactional, **not login** auth) | No | **Yes** | `nuru_vendor_otp_claim_sw` / `_en` (#31/#32) | **Replace**. New body uses `{{8}} minutes` placeholder (currently hardcoded "10"). Also introduces companion `nuru_vendor_otp_resend_*` (#33/#34) for the resend path. |
| 17 | `vendor_payment_confirmed` | `vendor_payment_confirmed` | en | "NURU PAYMENT… you received {{2}} from {{3}} for {{4}}. {{5}}" | vendor, amount, organiser, event_name, remaining_msg | none | `offline_payments.py` | Vendor receipt after OTP confirm | No | No | **Yes — splits into two** | `nuru_vendor_confirmation_receipt_*` (#35/#36) **and** `nuru_vendor_confirmation_receipt_full_*` (#37/#38) | **Replace**. Branch by `balance==0` to pick "receipt" vs "receipt_full". |
| 18 | `nuru_fundraise_notice_sw` | `fundraise_attend` | sw | (see `whatsapp_reminder_templates.md` #2) | recipient_name, body | none | reminder automation | Fundraise notice (organiser-composed body) | No | No | No (not in catalogue) | — | **Keep untouched.** |
| 19 | `nuru_fundraise_notice_en` | `fundraise_attend` | en | (see #1 reminder doc) | recipient_name, body | none | reminder automation | Same, EN | No | No | No | — | **Keep untouched.** |
| 20 | `nuru_pledge_remind_sw` | `pledge_remind` | sw | Pledge reminder + URL button (dynamic suffix `/c/{{1}}`) | recipient_name, event_name, event_datetime, pledge_amount, balance | URL button | reminder automation | Pledge reminder | No | No | No | — | **Keep untouched.** Has live SW + EN pair. |
| 21 | `nuru_pledge_remind_en` | `pledge_remind` | en | EN counterpart | same | URL button | reminder automation | Pledge reminder | No | No | No | — | **Keep untouched.** |
| 22 | `nuru_guest_remind_sw` | `guest_remind` | sw | Guest reminder | recipient_name, event_name, event_datetime, event_venue | none | reminder automation | Guest day-of reminder | No | No | No | — | **Keep untouched.** |
| 23 | `nuru_guest_remind_en` | `guest_remind` | en | EN counterpart | same | none | reminder automation | Guest day-of reminder | No | No | No | — | **Keep untouched.** |

Counts:
- Existing templates referenced in code: **23** (incl. 6 reminder + 1 auth + 1 probe).
- Auth-related excluded from migration scope: **1** (`otp_verification`).
- Infra probe excluded: **1** (`hello_world`).

---

## Step 3 — Final Catalogue WhatsApp Templates

Listed in `backend/app/docs/whatsapp_templates_catalogue.md` (#1–#46). Each
already documents body, language, placeholder mapping, message key, and
backend reference. The table below condenses the merge view only.

| # | Catalogue template | Language | Replaces existing? | Existing template it merges/replaces | Recommended action |
|---|--------------------|----------|--------------------|--------------------------------------|--------------------|
| 1 | `nuru_guest_invitation_sw` | sw | Yes | `event_invitation_v2` (en only) | Submit. Decide on quick-reply buttons. |
| 2 | `nuru_guest_invitation_en` | en | Yes | `event_invitation_v2` | Submit. |
| 3 | `nuru_committee_invite_sw` | sw | No | — | Submit (new). |
| 4 | `nuru_committee_invite_en` | en | No | — | Submit (new). |
| 5 | `nuru_welcome_registered_by_sw` | sw | No | — | Submit (new). |
| 6 | `nuru_welcome_registered_by_en` | en | No | — | Submit (new). |
| 7 | `nuru_meeting_invitation_sw` | sw | Yes | `meeting_invitation` (en_US) | Submit. Decide on URL button. |
| 8 | `nuru_meeting_invitation_en` | en | Yes | `meeting_invitation` | Submit. |
| 9 | `nuru_contribution_recorded_with_balance_sw` | sw | Yes (part) | `contribution_recorded` (balance>0 branch) | Submit. |
| 10 | `nuru_contribution_recorded_with_balance_en` | en | Yes (part) | `contribution_recorded` | Submit. |
| 11 | `nuru_contribution_recorded_pledge_complete_sw` | sw | Yes (part) | `contribution_recorded` (balance==0 branch) | Submit. |
| 12 | `nuru_contribution_recorded_pledge_complete_en` | en | Yes (part) | `contribution_recorded` | Submit. |
| 13 | `nuru_contribution_pledge_set_sw` | sw | Yes | `contribution_target` | Submit. |
| 14 | `nuru_contribution_pledge_set_en` | en | Yes | `contribution_target` | Submit. |
| 15 | `nuru_contribution_thank_you_sw` | sw | Yes | `thank_you_contribution` | Submit. |
| 16 | `nuru_contribution_thank_you_en` | en | Yes | `thank_you_contribution` | Submit. |
| 17 | `nuru_guest_contribution_invite_sw` | sw | Partial | `contribution_target` (guest/external branch) | Submit (new pathway). |
| 18 | `nuru_guest_contribution_invite_en` | en | Partial | `contribution_target` | Submit. |
| 19 | `nuru_guest_contribution_receipt_sw` | sw | No | — | Submit (new). |
| 20 | `nuru_guest_contribution_receipt_en` | en | No | — | Submit (new). |
| 21 | `nuru_payment_received_generic_sw` | sw | No | — | Submit (new). |
| 22 | `nuru_payment_received_generic_en` | en | No | — | Submit (new). |
| 23 | `nuru_payment_confirmation_payer_sw` | sw | No | — | Submit (new). |
| 24 | `nuru_payment_confirmation_payer_en` | en | No | — | Submit (new). |
| 25 | `nuru_organiser_contribution_received_sw` | sw | No | — | Submit (new). |
| 26 | `nuru_organiser_contribution_received_en` | en | No | — | Submit (new). |
| 27 | `nuru_vendor_booking_paid_sw` | sw | No | — | Submit (new). |
| 28 | `nuru_vendor_booking_paid_en` | en | No | — | Submit (new). |
| 29 | `nuru_admin_payment_alert_sw` | sw | No | — | Submit (new). |
| 30 | `nuru_admin_payment_alert_en` | en | No | — | Submit (new). |
| 31 | `nuru_vendor_otp_claim_sw` | sw | Yes | `vendor_payment_otp` | Submit. |
| 32 | `nuru_vendor_otp_claim_en` | en | Yes | `vendor_payment_otp` | Submit. |
| 33 | `nuru_vendor_otp_resend_sw` | sw | No (new path) | — | Submit (new). |
| 34 | `nuru_vendor_otp_resend_en` | en | No (new path) | — | Submit (new). |
| 35 | `nuru_vendor_confirmation_receipt_sw` | sw | Yes (part) | `vendor_payment_confirmed` (balance>0) | Submit. |
| 36 | `nuru_vendor_confirmation_receipt_en` | en | Yes (part) | `vendor_payment_confirmed` | Submit. |
| 37 | `nuru_vendor_confirmation_receipt_full_sw` | sw | Yes (part) | `vendor_payment_confirmed` (balance==0) | Submit. |
| 38 | `nuru_vendor_confirmation_receipt_full_en` | en | Yes (part) | `vendor_payment_confirmed` | Submit. |
| 39 | `nuru_organiser_committee_vendor_confirmed_sw` | sw | No | — | Submit (new). |
| 40 | `nuru_organiser_committee_vendor_confirmed_en` | en | No | — | Submit (new). |
| 41 | `nuru_expense_recorded_sw` | sw | Yes | `expense_recorded` | Submit. |
| 42 | `nuru_expense_recorded_en` | en | Yes | `expense_recorded` | Submit. |
| 43 | `nuru_service_booking_notification_sw` | sw | Yes | `booking_notification` | Submit. |
| 44 | `nuru_service_booking_notification_en` | en | Yes | `booking_notification` | Submit. |
| 45 | `nuru_booking_accepted_sw` | sw | Yes | `booking_accepted` | Submit. |
| 46 | `nuru_booking_accepted_en` | en | Yes | `booking_accepted` | Submit. |

---

## Step 4 — Possible Duplicate or Similar Templates

| Existing | New catalogue | Similarity | Wording diff | Placeholder diff | Button / media diff | Recommendation |
|----------|---------------|-----------|--------------|------------------|---------------------|----------------|
| `event_invitation_v2` | `nuru_guest_invitation_sw` / `_en` (#1/#2) | Same purpose: invite guest. | Catalogue has heading `MWALIKO`/`INVITATION`, full body, sign-off. Existing body is shorter and English-only. | Existing 4 vars; catalogue 6 vars (adds `event_venue`, `rsvp_url`). | Existing has 2× quick-reply RSVP buttons; catalogue body is text-only with an `rsvp_url` inline. | **Manual decision needed**: keep quick-reply buttons on the new pair, or move RSVP to link. If keeping buttons, submit the new pair **with** button components mirroring existing v2. |
| `meeting_invitation` (en_US) | `nuru_meeting_invitation_sw` / `_en` (#7/#8) | Same purpose. | Heading + catalogue body. | Existing 4 vars; catalogue 4 vars (same fields, different order: meeting_title first). | Existing has dynamic URL button `https://nuru.tz/meet/{{1}}`; catalogue body has link inline. | **Manual decision needed**: retain URL button on new pair (recommended). |
| `contribution_recorded` | `nuru_contribution_recorded_with_balance_*` + `nuru_contribution_recorded_pledge_complete_*` | Same trigger, **two new templates** depending on balance. | Catalogue bodies have heading + organiser phone `{{8}}`. | Existing 7 vars; new "with_balance" 8 vars (adds organizer_phone); new "pledge_complete" 7 vars (drops total_paid+balance, adds organizer_phone). | None / none. | Replace existing with branched logic in `wa_contribution_recorded`. |
| `contribution_target` | `nuru_contribution_target_set_*` (#13/#14), `nuru_contribution_target_updated_*` (#14a/#14b), and `nuru_guest_contribution_invite_*` (#17/#18) | Splits by recipient and action: known contributor set/update vs guest invitation with pay button. | New target templates use combined money slots (`target_text`, `increase_text`, `total_target_text`); guest invite uses `pledge_amount_text` and a dynamic URL button. | Money values are single `*_text` placeholders; no currency placeholder is reused. | None / dynamic pay button for guest invite. | Replace existing with branched logic. |
| `thank_you_contribution` | `nuru_contribution_thank_you_*` (#15/#16) | Same purpose. | Catalogue adds organizer_phone tail. | Existing 3 vars; catalogue 4 vars. | None / none. | Replace 1-for-1. |
| `booking_notification` | `nuru_service_booking_notification_*` (#43/#44) | Same. | Heading + sign-off. | Same 3 vars. | None / none. | Replace 1-for-1. |
| `booking_accepted` | `nuru_booking_accepted_*` (#45/#46) | Same. | Heading + sign-off. | Same 4 vars. | None / none. | Replace 1-for-1. |
| `expense_recorded` | `nuru_expense_recorded_*` (#41/#42) | Same. | Heading + sign-off; amount is pre-formatted. | Existing 5 vars; catalogue 5 vars with `amount_text` replacing raw amount. | None / none. | Replace; edge builder sends a combined money string. |
| `vendor_payment_otp` | `nuru_vendor_otp_claim_*` (#31/#32) and `nuru_vendor_otp_resend_*` (#33/#34) | Same flow; new pair distinguishes initial vs resend. | New body has heading; `minutes` becomes a placeholder. | Catalogue uses `amount_text` plus `minutes`; no currency/amount split. | None / none. | Replace with branched flow (claim vs resend). |
| `vendor_payment_confirmed` | `nuru_vendor_confirmation_receipt_*` (#35/#36) and `nuru_vendor_confirmation_receipt_full_*` (#37/#38) | Splits by balance. | New body has heading; "full" body removes balance line. | Existing 5 vars (with free-form `remaining_msg`); new partial uses `amount_text` + `balance_text`, full uses `amount_text`. | None / none. | Replace with branched logic. |
| `event_reminder` | `nuru_guest_remind_sw` / `_en` (reminder doc) | Overlap on purpose (event reminder). | Different bodies; reminder doc covers automation. | Existing 5 vars; reminder doc 4 vars. | None / none. | **Manual review**: is `event_reminder` still triggered outside automation? If no, retire later. If yes, create SW version to pair the EN one. |
| `event_invitation_text` | `nuru_guest_invitation_*` (#1/#2) | Both invitations. | Existing is richer (organiser+date+time+venue, 2 URL buttons). | Existing 7 vars; catalogue 6 vars. | Existing 2 URL buttons; catalogue text-only. | **Manual review**: keep as the "rich" variant and add SW version, or merge into #1/#2 with buttons. |
| `event_invitation_card` | `nuru_guest_invitation_*` (#1/#2) | Both invitations. | Card has image header. | Existing 5 body vars + image; catalogue 6 vars text-only. | Existing **image header**; catalogue none. | **Keep** — unique due to image header. Add SW version. |
| `event_ticket_delivery` | — | Unique. | n/a | n/a | Image header + ticket code. | **Keep**. Add SW version. |

---

## Step 5 — Unique Existing Templates That Need SW and EN Versions

| # | Current name | Current lang | Current body summary | Why unique | Suggested SW name | Suggested EN name | Suggested SW body | Suggested EN body | Placeholders | Buttons / media | Where used | Approval needed? |
|---|--------------|--------------|---------------------|------------|-------------------|-------------------|-------------------|-------------------|--------------|-----------------|------------|------------------|
| A | `event_update` | en | "{{1}}, the event {{2}} has updates: {{3}}" | Not in SMS catalogue but actively dispatched in `wa_event_updated`. | `nuru_event_update_sw` | `nuru_event_update_en` | **Awaiting your approval to author** — needs catalogue-style heading (e.g. `MABADILIKO YA TUKIO`) and sign-off. Do **not** invent wording without sign-off. | Same — needs `EVENT UPDATE` heading + sign-off. | guest_name, event_name, changes | none | `wa_event_updated` → guest update flow | **Yes — please confirm wording.** |
| B | `event_reminder` | en | "{{1}}, reminder for {{2}} on {{3}} at {{4}} ({{5}})" | Generic reminder outside automation. | `nuru_event_reminder_sw` | `nuru_event_reminder_en` | Author after deciding whether to keep this distinct from automation `nuru_guest_remind_*`. | Same. | guest_name, event_name, event_date, event_time, location | none | `wa_event_reminder` | **Yes — please confirm whether to keep separate from `nuru_guest_remind_*` or retire.** |
| C | `event_invitation_text` | en | Rich text invitation with 2× URL buttons | Distinct from `nuru_guest_invitation_*` (has buttons + extra fields). | `event_invitation_text_sw` | (keep) `event_invitation_text` (or rename `_en`) | Translate existing body into SW preserving buttons. | (existing) | guest_name, event_name, organizer_name, event_date, event_time, venue, rsvp_code | 2 URL buttons `/i/{{1}}` `/rsvp/{{1}}` | `whatsapp_cards.wa_send_invitation_text` | **Yes — confirm whether to merge with #1/#2 or keep as the buttons variant.** |
| D | `event_invitation_card` | en | Invitation with image header | Unique image-header variant. | `event_invitation_card_sw` | (keep) `event_invitation_card` | Translate to SW preserving image header. | (existing) | image_url, guest_name, event_name, event_date, organizer_name, rsvp_code | Image header | `whatsapp_cards.wa_send_invitation_card` | **Yes — confirm wording.** |
| E | `event_ticket_delivery` | en | Ticket with image header + ticket code | Unique ticket delivery. | `event_ticket_delivery_sw` | (keep) `event_ticket_delivery` | Translate to SW preserving image header. | (existing) | image_url, guest_name, event_name, event_date, ticket_class, ticket_code | Image header | `whatsapp_cards.wa_send_ticket` | **Yes — confirm wording.** |

> No new wording is fabricated here. Items A–E are listed as **candidates
> that need your approval and final copy** before any submission.

---

## Step 6 — Templates To Keep Untouched

| Template | Reason | Where used | Risk if changed |
|----------|--------|------------|-----------------|
| `otp_verification` | **Auth OTP** — phone/WA login & verification. Outside this migration scope. | edge `sendOtpTemplate`, called from `send-otp`/`verify-otp-code` flows | Breaks login, signup, password reset, vendor account claims. |
| `hello_world` | Meta default template used purely to **probe whether a number is on WhatsApp** in `checkWhatsAppBySending`. | `check_whatsapp` action | Breaks "is this a WA number?" detection used during contact import. |
| `nuru_fundraise_notice_sw` / `_en` | Reminder automation with organiser-edited body. Has live SW+EN pair already. | `tasks/notifications.py` reminder flows | Breaks reminder automation. |
| `nuru_pledge_remind_sw` / `_en` | Reminder automation with **URL button (dynamic suffix)** carrying share token. Pair already complete. | reminder dispatcher | Breaks pledge reminder pay-button. |
| `nuru_guest_remind_sw` / `_en` | Reminder automation. Pair already complete. | reminder dispatcher | Breaks guest day-of reminders. |
| `event_invitation_card` (image header) | Unique image-header invitation variant; **media template**. | `whatsapp_cards` | Replacing without preserving the image header component would silently drop invitation cards. |
| `event_ticket_delivery` (image header) | Unique ticket delivery with image header + code. | `whatsapp_cards` | Same — would break tickets in WA. |
| `event_invitation_text` (2 URL buttons) | Unique rich-buttons invitation. | `whatsapp_cards` | Removing buttons drops `/i/` and `/rsvp/` deep links. |

---

## Step 7 — Templates To Retire Later

> **Do not remove now.** Only after: (a) the new `_sw`/`_en` replacements
> are **approved** on Meta, (b) the edge function + `utils/whatsapp.py`
> have been updated and **deployed**, (c) WhatsApp delivery has been
> **tested end-to-end in production for both languages**, (d) no active
> code path references the old template.

| Old template | Replaced by | Reason | Safe removal condition |
|--------------|-------------|--------|------------------------|
| `event_invitation_v2` | `nuru_guest_invitation_sw` / `_en` | Body rewritten + multi-language | All four conditions above + button decision settled. |
| `expense_recorded` | `nuru_expense_recorded_sw` / `_en` | Body rewritten + multi-language | All four conditions above. |
| `contribution_recorded` | `nuru_contribution_recorded_with_balance_*` + `_pledge_complete_*` | Split + multi-language | All four + backend branch wired. |
| `contribution_target` | `nuru_contribution_pledge_set_*` + `nuru_guest_contribution_invite_*` | Split known/guest + multi-language | All four + backend branch wired. |
| `thank_you_contribution` | `nuru_contribution_thank_you_*` | Body rewritten + multi-language | All four. |
| `booking_notification` | `nuru_service_booking_notification_*` | Body rewritten + multi-language | All four. |
| `booking_accepted` | `nuru_booking_accepted_*` | Body rewritten + multi-language | All four. |
| `meeting_invitation` | `nuru_meeting_invitation_*` | Body rewritten + multi-language | All four + URL-button decision settled. |
| `vendor_payment_otp` | `nuru_vendor_otp_claim_*` + `nuru_vendor_otp_resend_*` | Split claim/resend + multi-language | All four + resend wiring. |
| `vendor_payment_confirmed` | `nuru_vendor_confirmation_receipt_*` + `_full_*` | Split by balance + multi-language | All four. |
| `event_reminder` (conditional) | `nuru_guest_remind_*` (existing) or new `nuru_event_reminder_*` | If automation covers all triggers, retire. Otherwise create SW pair. | All four + confirmation it is no longer dispatched. |

---

## Step 8 — Merge & Cleanup Recommendation

### A. Submit as-is from catalogue
All 46 templates in `whatsapp_templates_catalogue.md` — no body edits.

### B. Replace existing single-language templates with catalogue pairs
- `event_invitation_v2` → #1/#2 (decision: buttons)
- `meeting_invitation` → #7/#8 (decision: URL button)
- `contribution_recorded` → #9–#12 (branched)
- `contribution_target` → #13/#14 + #17/#18 (branched known vs guest)
- `thank_you_contribution` → #15/#16
- `expense_recorded` → #41/#42
- `booking_notification` → #43/#44
- `booking_accepted` → #45/#46
- `vendor_payment_otp` → #31/#32 + #33/#34
- `vendor_payment_confirmed` → #35–#38 (branched)

### C. Unique existing templates that need SW/EN pairs (your call on wording)
- `event_update`
- `event_reminder` (or retire if covered by automation)
- `event_invitation_text` (rich buttons variant)
- `event_invitation_card` (image header)
- `event_ticket_delivery` (image header + ticket code)

### D. Keep untouched
- `otp_verification` (auth)
- `hello_world` (probe)
- `nuru_fundraise_notice_sw/_en`
- `nuru_pledge_remind_sw/_en`
- `nuru_guest_remind_sw/_en`
- Any rich-media `event_invitation_card`, `event_invitation_text`, `event_ticket_delivery` until SW pairs are approved.

### E. Retire later (only after replacements approved + deployed + tested)
- `event_invitation_v2`, `meeting_invitation`, `contribution_recorded`,
  `contribution_target`, `thank_you_contribution`, `expense_recorded`,
  `booking_notification`, `booking_accepted`, `vendor_payment_otp`,
  `vendor_payment_confirmed`.

### F. Templates needing your manual decision before submission
1. **Invitation quick-reply buttons** — keep on new `nuru_guest_invitation_*` or move RSVP to URL?
2. **Meeting URL button** — keep on new `nuru_meeting_invitation_*`?
3. **`event_update`** wording for SW + EN pair.
4. **`event_reminder`** — retire (covered by automation) or build SW pair?
5. **`event_invitation_text`** — merge with `nuru_guest_invitation_*` (carry buttons over) or keep as a distinct rich-buttons template?
6. **`event_invitation_card`** SW translation copy.
7. **`event_ticket_delivery`** SW translation copy.
8. **Money placeholders** — resolved: catalogue now uses combined money placeholders only (`*_text`, e.g. `TZS 10,000`). Do not split currency and amount, and do not reuse a placeholder number in a body.

---

## Summary

- **Existing WhatsApp templates found:** 23 (incl. reminder + auth + probe)
- **Auth templates excluded:** 1 (`otp_verification`)
- **Infra probe excluded:** 1 (`hello_world`)
- **Final catalogue templates listed:** 46 (23 SW + 23 EN)
- **Duplicate / similar template groups:** 13 (see Step 4)
- **Unique templates needing SW/EN pairs:** 5 (`event_update`, `event_reminder`, `event_invitation_text`, `event_invitation_card`, `event_ticket_delivery`)
- **Templates to keep untouched:** 8
- **Templates to retire later:** 10
- **Blockers / manual decisions needed:** 8 (see Step 8.F)
- **Deployment performed:** None. No Meta API call. No template removed. No wording changed. `whatsapp_templates_catalogue.md` not edited.
