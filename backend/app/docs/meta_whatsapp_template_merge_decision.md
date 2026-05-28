# Meta WhatsApp Template — Merge Decision Document

**Purpose:** single audit + decision document comparing the **real
templates currently referenced as deployed on Meta** against the **new
48-template Nuru catalogue**, to decide what to keep, create, translate,
merge, replace, or retire — before any backend wiring or Meta
submission is done.

**Status:** AUDIT ONLY. Nothing deployed. No Meta template added,
edited, or deleted. No backend dispatcher changes.

> **Rule — no Meta placeholder reuse.** A positional placeholder
> (`{{N}}`) must appear at most once per template body. Currency and
> amount are never two slots; they are merged into one combined money
> string (e.g. `TZS 10,000`) computed by
> `utils.message_templates.format_money(currency, amount)` and passed
> to the edge function under `*_text` parameter keys. Any prior row in
> this document that still describes `{{N}} = currency` + `{{N+1}} =
> amount` is superseded by the single combined `*_text` slot.


---

## How "current Meta template" content was obtained

A read-only Meta Graph fetch was attempted using the credentials
present in the project environment (`WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID`). The token authenticates and the phone
number metadata is reachable, but the **WhatsApp Business Account ID
(WABA)** required to enumerate `/{waba_id}/message_templates` is not
exposed via any field reachable from the available scopes
(`business_management`, `whatsapp_business_management`,
`whatsapp_business_messaging`) on the phone number, the system user, or
the parent app. `me/businesses` returns empty.

> **Fallback used:** template bodies were assembled from the
> authoritative local sources, not Meta. Each row below is tagged with
> its source. To upgrade this document with the live Meta payload, set
> a `WHATSAPP_BUSINESS_ACCOUNT_ID` env var and re-run the audit; the
> Graph call is `GET /{WABA_ID}/message_templates?fields=name,language,category,status,components&limit=200`.

Local sources used:

- `supabase/functions/whatsapp-send/index.ts` — dispatcher with every
  template name actively sent today and the exact components built per
  send.
- `backend/app/utils/whatsapp.py` — caller helpers, action names.
- `backend/app/utils/whatsapp_cards.py` — rich-media (invitation +
  ticket) callers.
- `backend/app/docs/whatsapp_reminder_templates.md` — verbatim bodies
  of the reminder-automation templates.
- `backend/app/docs/whatsapp_templates_catalogue.md` — the new 48
  catalogue (source of truth for the new bodies — referenced rather
  than duplicated here to avoid drift; section 4 of this doc indexes
  every one of the 48 with its target name and trigger).
- `backend/app/docs/whatsapp_templates_audit_for_merge.md` — previous
  merge audit.

Source legend used in the tables below:

- **`code`** — body text inferred from the parameters sent in
  `whatsapp-send/index.ts` and verified against the call site.
- **`docs`** — body copied verbatim from local documentation.
- **`ref-only`** — template name is sent in code but the body text
  itself is not stored locally; Meta is the only source of truth.
- **`Meta`** — body fetched live from Meta (none in this run).

---

## 1. Current Existing Meta Templates

Every template that the dispatcher currently sends, plus the
documented reminder templates and the `hello_world` probe. Auth-only
rows are excluded from translation/merge decisions per scope.

> "Lang exists" columns are based on the names referenced in code. A
> single-language template (e.g. `event_invitation_v2` with no `_sw` /
> `_en` suffix) is assumed to be English-only on Meta unless
> otherwise documented.

### 1.1 Notification templates (subject to translation / merge)

| # | Template name | Lang | Category | Source | Header | Footer | Buttons | Placeholders | Used in (code) | Auth-only | SW exists | EN exists | Recommended action |
|---|---------------|------|----------|--------|--------|--------|---------|--------------|----------------|-----------|-----------|-----------|---------------------|
| 1 | `event_invitation_v2` | en | UTILITY | code | none | none | 2 × quick_reply (`rsvp_confirm_<code>`, `rsvp_decline_<code>`) | `{{1}}` guest_name · `{{2}}` event_name · `{{3}}` event_date · `{{4}}` organizer_name | `whatsapp-send/index.ts` case `invite`; `whatsapp.py::wa_guest_invited` | no | no | yes | **Replace** with catalogue #1/#2 (`nuru_guest_invitation_sw/_en`). Quick-reply RSVP buttons drop in favor of `rsvp_url` body link. Retire later. |
| 2 | `event_update` | en | UTILITY | code | none | none | none | `{{1}}` guest_name · `{{2}}` event_name · `{{3}}` changes | `whatsapp-send/index.ts` case `event_update`; `whatsapp.py::wa_event_updated` | no | no | yes | **Keep but create missing SW version.** Not in the 48 catalogue. Needs `nuru_event_update_sw` + `_en` pair drafted and approved before retiring the legacy single-language template. |
| 3 | `event_reminder` | en | UTILITY | code | none | none | none | `{{1}}` guest_name · `{{2}}` event_name · `{{3}}` event_date · `{{4}}` event_time · `{{5}}` location | `whatsapp-send/index.ts` case `reminder`; `whatsapp.py::wa_event_reminder` | no | no | yes | **Needs manual decision.** Reminder automation already covered by `nuru_guest_remind_sw/_en`. If `wa_event_reminder` is still triggered manually outside the automation, create `_sw/_en` pair; otherwise mark for retirement once call sites are removed. |
| 4 | `expense_recorded` | en | UTILITY | code | none | none | none | `{{1}}` recipient_name · `{{2}}` recorder_name · `{{3}}` amount · `{{4}}` category · `{{5}}` event_name | `whatsapp-send/index.ts` case `expense_recorded`; `whatsapp.py::wa_expense_recorded` | no | no | yes | **Replace** with catalogue #41/#42 (`nuru_expense_recorded_sw/_en`). Retire later. |
| 5 | `contribution_recorded` | en | UTILITY | code | none | none | none | `{{1}}` contributor_name · `{{2}}` recorder_name · `{{3}}` amount · `{{4}}` event_name · `{{5}}` target · `{{6}}` total_paid · `{{7}}` balance | `whatsapp-send/index.ts` case `contribution_recorded`; `whatsapp.py::wa_contribution_recorded` | no | no | yes | **Replace** with catalogue split #9/#10 (with-balance) **and** #11/#12 (pledge-complete). Branch added in backend; retire after dispatcher cut-over. |
| 6 | `contribution_target` | en | UTILITY | code | none | none | none | `{{1}}` contributor_name · `{{2}}` event_name · `{{3}}` target · `{{4}}` total_paid · `{{5}}` balance | `whatsapp-send/index.ts` case `contribution_target`; `whatsapp.py::wa_contribution_target_set` | no | no | yes | **Replace** with catalogue #13/#14 (set), #14a/#14b (updated), and #17/#18 (guest invite). Retire later. |
| 7 | `thank_you_contribution` | en | UTILITY | code | none | none | none | `{{1}}` contributor_name · `{{2}}` event_name · `{{3}}` custom_message | `whatsapp-send/index.ts` case `thank_you_contribution`; `whatsapp.py::wa_thank_you` | no | no | yes | **Replace** with catalogue #15/#16 (`nuru_contribution_thank_you_sw/_en`). Retire later. |
| 8 | `booking_notification` | en | UTILITY | code | none | none | none | `{{1}}` provider_name · `{{2}}` client_name · `{{3}}` event_name | `whatsapp-send/index.ts` case `booking_notification`; `whatsapp.py::wa_booking_notification` | no | no | yes | **Replace** with catalogue #43/#44 (`nuru_service_booking_notification_sw/_en`). Retire later. |
| 9 | `booking_accepted` | en | UTILITY | code | none | none | none | `{{1}}` client_name · `{{2}}` vendor_name · `{{3}}` service_name · `{{4}}` event_name | `whatsapp-send/index.ts` case `booking_accepted`; `whatsapp.py::wa_booking_accepted` | no | no | yes | **Replace** with catalogue #45/#46 (`nuru_booking_accepted_sw/_en`). Retire later. |
| 10 | `meeting_invitation` | en_US | UTILITY | code | none | none | 1 × URL (dynamic, `https://nuru.tz/meet/{{1}}`) | body `{{1}}` event_name · `{{2}}` meeting_title · `{{3}}` scheduled_time · `{{4}}` meeting_link; button `{{1}}` meet_path | `whatsapp-send/index.ts` case `meeting_invitation`; `whatsapp.py::wa_meeting_invitation` | no | no | yes (`en_US`) | **Replace** with catalogue #7/#8. **Manual decision needed**: catalogue body is text-only; confirm whether to add the URL "Join Meeting" button to the new pair before submitting. |
| 11 | `vendor_payment_otp` | en | UTILITY | code | none | none | none | `{{1}}` vendor_name · `{{2}}` organiser_name · `{{3}}` amount · `{{4}}` service_title · `{{5}}` event_name · `{{6}}` otp | `whatsapp-send/index.ts` case `vendor_payment_otp` | no | no | yes | **Replace** with catalogue #31/#32 (`nuru_vendor_otp_claim_sw/_en`) plus #33/#34 (`nuru_vendor_otp_resend_sw/_en`). Backend must distinguish first send vs resend. Retire later. |
| 12 | `vendor_payment_confirmed` | en | UTILITY | code | none | none | none | `{{1}}` vendor_name · `{{2}}` amount · `{{3}}` organiser_name · `{{4}}` event_name · `{{5}}` remaining_msg | `whatsapp-send/index.ts` case `vendor_payment_confirmed` | no | no | yes | **Replace** with catalogue #35/#36 (`nuru_vendor_confirmation_receipt_sw/_en`) plus #37/#38 (full payment). Backend must branch partial vs full. Retire later. |

### 1.2 Rich-media / image-header templates

| # | Template name | Lang | Category | Source | Header | Footer | Buttons | Placeholders | Used in (code) | SW exists | EN exists | Recommended action |
|---|---------------|------|----------|--------|--------|--------|---------|--------------|----------------|-----------|-----------|---------------------|
| 13 | `event_invitation_text` | en | UTILITY | code | none | n/a | 2 × URL (dynamic, `https://nuru.tz/i/{{1}}`, `https://nuru.tz/rsvp/{{1}}`) | body `{{1}}` guest_name · `{{2}}` event_name · `{{3}}` organizer_name · `{{4}}` event_date · `{{5}}` event_time · `{{6}}` venue · `{{7}}` rsvp_code | `whatsapp-send/index.ts` case `send_invitation_text`; `whatsapp_cards.py::wa_send_invitation_text` | no | yes | **Keep separate as rich/media template.** Not collapsed into catalogue #1/#2 because of the two URL buttons (invite link + RSVP link). Create `event_invitation_text_sw` for parity. |
| 14 | `event_invitation_card` | en | UTILITY | code | image (template-bound) | n/a | none | `{{1}}` guest_name · `{{2}}` event_name · `{{3}}` event_date · `{{4}}` organizer_name · `{{5}}` rsvp_code | `whatsapp-send/index.ts` case `send_invitation_card`; `whatsapp_cards.py::wa_send_invitation_card` | no | yes | **Keep separate.** Image-header card invitation. Create `event_invitation_card_sw`. |
| 15 | `event_ticket_delivery` | en | UTILITY | code | image (template-bound) | n/a | none | `{{1}}` guest_name · `{{2}}` event_name · `{{3}}` event_date · `{{4}}` ticket_class · `{{5}}` ticket_code | `whatsapp-send/index.ts` case `send_ticket`; `whatsapp_cards.py::wa_send_ticket` | no | yes | **Keep separate.** Image-header ticket. Create `event_ticket_delivery_sw`. |

### 1.3 Reminder automation templates (already SW + EN paired)

Bodies are documented verbatim in `whatsapp_reminder_templates.md`.

| # | Template name | Lang | Source | Buttons | Action |
|---|---------------|------|--------|---------|--------|
| 16 | `nuru_fundraise_notice_en` | en | docs | none | Keep unchanged. |
| 17 | `nuru_fundraise_notice_sw` | sw | docs | none | Keep unchanged. |
| 18 | `nuru_pledge_remind_en` | en | docs | 1 × URL (dynamic, `https://nuru.tz/c/{{1}}`) | Keep unchanged. |
| 19 | `nuru_pledge_remind_sw` | sw | docs | 1 × URL (dynamic) | Keep unchanged. |
| 20 | `nuru_guest_remind_en` | en | docs | none | Keep unchanged. |
| 21 | `nuru_guest_remind_sw` | sw | docs | none | Keep unchanged. |

### 1.4 Auth / probe templates (excluded from translation decisions)

| # | Template name | Lang | Source | Buttons | Purpose | Action |
|---|---------------|------|--------|---------|---------|--------|
| A1 | `otp_verification` | en | code | 1 × URL copy-code | Login / phone-verify / password-reset OTP — authentication category. | **Exclude (auth).** Keep unchanged. |
| A2 | `hello_world` | en_US | code | none | Meta sample / WhatsApp-presence health probe used by `check_whatsapp` action. | **Exclude (probe).** Keep unchanged. |

---

## 2. New 48 Core Catalogue Templates (Index)

The 48 final-submission bodies, placeholders, headings, sign-off, and
backend references are maintained in **`whatsapp_templates_catalogue.md`**
(single source of truth — duplicated here would drift). Below is the
catalogue index with each template's status, category, replacement
target, and submission decision so this document remains a complete
decision view without forcing a second hop for every body.

All 48 are **UTILITY**, all start with their heading line, all end
with `Plan Smarter. Celebrate Better.`, none have media headers, none
have footers. Body and placeholder mapping for any row below: see the
matching section number in `whatsapp_templates_catalogue.md`.

| Cat # | Template name | Lang | Replaces current Meta template | Submit now? | Manual decision? |
|-------|---------------|------|--------------------------------|-------------|------------------|
| 1 | `nuru_guest_invitation_sw` | sw | `event_invitation_v2` | yes | Confirm: drop quick-reply RSVP buttons (catalogue body uses `rsvp_url` link only). |
| 2 | `nuru_guest_invitation_en` | en | `event_invitation_v2` | yes | same as #1 |
| 3 | `nuru_committee_invite_sw` | sw | — (new) | yes | no |
| 4 | `nuru_committee_invite_en` | en | — (new) | yes | no |
| 5 | `nuru_welcome_registered_by_sw` | sw | — (new) | yes | no |
| 6 | `nuru_welcome_registered_by_en` | en | — (new) | yes | no |
| 7 | `nuru_meeting_invitation_sw` | sw | `meeting_invitation` | yes | **Yes — URL button decision.** Catalogue body is text-only; confirm whether to attach the "Join Meeting" dynamic URL button (`https://nuru.tz/meet/{{1}}`) before submitting. |
| 8 | `nuru_meeting_invitation_en` | en | `meeting_invitation` | yes | same as #7 |
| 9 | `nuru_contribution_recorded_with_balance_sw` | sw | `contribution_recorded` (branch: balance > 0) | yes | no |
| 10 | `nuru_contribution_recorded_with_balance_en` | en | same | yes | no |
| 11 | `nuru_contribution_recorded_pledge_complete_sw` | sw | `contribution_recorded` (branch: balance = 0) | yes | no |
| 12 | `nuru_contribution_recorded_pledge_complete_en` | en | same | yes | no |
| 13 | `nuru_contribution_target_set_sw` | sw | `contribution_target` (initial pledge) | yes | no |
| 14 | `nuru_contribution_target_set_en` | en | same | yes | no |
| 14a | `nuru_contribution_target_updated_sw` | sw | `contribution_target` (pledge increased) | yes | **Yes — reduction policy.** Decide whether pledge reductions reuse `_set` template (current behaviour) or get their own template. |
| 14b | `nuru_contribution_target_updated_en` | en | same | yes | same as #14a |
| 15 | `nuru_contribution_thank_you_sw` | sw | `thank_you_contribution` | yes | no |
| 16 | `nuru_contribution_thank_you_en` | en | same | yes | no |
| 17 | `nuru_guest_contribution_invite_sw` | sw | `contribution_target` (anonymous / guest path) | yes | no |
| 18 | `nuru_guest_contribution_invite_en` | en | same | yes | no |
| 19 | `nuru_guest_contribution_receipt_sw` | sw | — (new; sends from `public_contributions.py`) | yes | no |
| 20 | `nuru_guest_contribution_receipt_en` | en | same | yes | no |
| 21 | `nuru_payment_received_generic_sw` | sw | — (new) | yes | no |
| 22 | `nuru_payment_received_generic_en` | en | — (new) | yes | no |
| 23 | `nuru_payment_confirmation_payer_sw` | sw | — (new) | yes | no |
| 24 | `nuru_payment_confirmation_payer_en` | en | — (new) | yes | no |
| 25 | `nuru_organiser_contribution_received_sw` | sw | — (new) | yes | no |
| 26 | `nuru_organiser_contribution_received_en` | en | — (new) | yes | no |
| 27 | `nuru_vendor_booking_paid_sw` | sw | — (new) | yes | no |
| 28 | `nuru_vendor_booking_paid_en` | en | — (new) | yes | no |
| 29 | `nuru_admin_payment_alert_sw` | sw | — (new) | yes | no |
| 30 | `nuru_admin_payment_alert_en` | en | — (new) | yes | no |
| 31 | `nuru_vendor_otp_claim_sw` | sw | `vendor_payment_otp` (first send) | yes | no |
| 32 | `nuru_vendor_otp_claim_en` | en | same | yes | no |
| 33 | `nuru_vendor_otp_resend_sw` | sw | `vendor_payment_otp` (resend) | yes | no |
| 34 | `nuru_vendor_otp_resend_en` | en | same | yes | no |
| 35 | `nuru_vendor_confirmation_receipt_sw` | sw | `vendor_payment_confirmed` (partial) | yes | no |
| 36 | `nuru_vendor_confirmation_receipt_en` | en | same | yes | no |
| 37 | `nuru_vendor_confirmation_receipt_full_sw` | sw | `vendor_payment_confirmed` (full) | yes | no |
| 38 | `nuru_vendor_confirmation_receipt_full_en` | en | same | yes | no |
| 39 | `nuru_organiser_committee_vendor_confirmed_sw` | sw | — (new) | yes | no |
| 40 | `nuru_organiser_committee_vendor_confirmed_en` | en | — (new) | yes | no |
| 41 | `nuru_expense_recorded_sw` | sw | `expense_recorded` | yes | no |
| 42 | `nuru_expense_recorded_en` | en | same | yes | no |
| 43 | `nuru_service_booking_notification_sw` | sw | `booking_notification` | yes | no |
| 44 | `nuru_service_booking_notification_en` | en | same | yes | no |
| 45 | `nuru_booking_accepted_sw` | sw | `booking_accepted` | yes | no |
| 46 | `nuru_booking_accepted_en` | en | same | yes | no |

**Total: 48 templates** (24 message keys × 2 languages).

For full body text and placeholder mapping per row, open
`whatsapp_templates_catalogue.md` and jump to the matching `## N.` section.

---

## 3. Existing Non-Catalogue Templates That Need SW and EN Pairing

These live outside the 48 catalogue (not in the uploaded SMS document)
but are actively used and currently exist as **English-only single
templates** on Meta. They must be paired before the legacy single
template can be retired. All proposed wording below is **DRAFT — needs
user approval** before Meta submission.

### 3.1 `event_update` → `nuru_event_update_sw` / `_en`

- **Existing template:** `event_update` · lang `en`
- **Existing body (from code):** sends `{{1}}` guest_name, `{{2}}` event_name, `{{3}}` changes
- **Why unique:** event-detail-change broadcast; no row in the SMS
  catalogue. Used by `wa_event_updated`.
- **Suggested SW name:** `nuru_event_update_sw`
- **Suggested EN name:** `nuru_event_update_en`
- **Suggested SW body — DRAFT NEEDS USER APPROVAL:**
  ```
  TUKIO LIMEBADILISHWA

  Habari {{1}}, kuna mabadiliko kwenye {{2}}: {{3}}. Fungua Nuru kuona taarifa kamili.

  Plan Smarter. Celebrate Better.
  ```
- **Suggested EN body — DRAFT NEEDS USER APPROVAL:**
  ```
  EVENT UPDATED

  Hello {{1}}, there are changes to {{2}}: {{3}}. Open Nuru to see the full details.

  Plan Smarter. Celebrate Better.
  ```
- **Placeholders:** `{{1}}` guest_name · `{{2}}` event_name · `{{3}}` changes
- **Header/buttons/media:** none.
- **Used in:** `whatsapp.py::wa_event_updated`,
  `whatsapp-send/index.ts` case `event_update`.
- **Approval needed before submission:** yes.

### 3.2 `event_reminder` → `nuru_event_reminder_sw` / `_en`

- **Existing template:** `event_reminder` · lang `en`
- **Existing body (from code):** `{{1}}` guest_name, `{{2}}` event_name,
  `{{3}}` event_date, `{{4}}` event_time, `{{5}}` location
- **Why unique (or whether to retire):** reminder automation already
  covered by `nuru_guest_remind_sw/_en`. Only submit a SW/EN pair if
  product confirms the manual reminder path (`wa_event_reminder`) is
  still active outside automation.
- **Suggested SW body — DRAFT NEEDS USER APPROVAL:**
  ```
  KUMBUSHO LA TUKIO

  Habari {{1}}, kumbusho kwamba {{2}} ni tarehe {{3}} saa {{4}}, mahali {{5}}. Tunatazamia kukuona.

  Plan Smarter. Celebrate Better.
  ```
- **Suggested EN body — DRAFT NEEDS USER APPROVAL:**
  ```
  EVENT REMINDER

  Hello {{1}}, a reminder that {{2}} is on {{3}} at {{4}}, venue {{5}}. We look forward to seeing you.

  Plan Smarter. Celebrate Better.
  ```
- **Approval needed before submission:** yes — **first** confirm
  whether manual `wa_event_reminder` calls still happen. If not, mark
  for retirement instead.

### 3.3 `event_invitation_text` → `event_invitation_text_sw` / `_en`

- **Existing template:** `event_invitation_text` · lang `en`
- **Existing body (from code):** 7 placeholders + 2 URL buttons
  (`https://nuru.tz/i/{{1}}`, `https://nuru.tz/rsvp/{{1}}`).
- **Why unique:** Two distinct URL buttons (open invite + RSVP) plus a
  richer body than catalogue #1/#2. Must not be merged into the
  catalogue invitation.
- **Suggested SW body — DRAFT NEEDS USER APPROVAL:** wording must
  mirror current English body in Swahili; defer to product for the
  exact translation since both URL buttons remain.
- **Buttons to preserve:** 2 × URL (dynamic suffix per button =
  `rsvp_code`).
- **Used in:** `whatsapp_cards.py::wa_send_invitation_text`.
- **Approval needed:** yes (full SW body draft).

### 3.4 `event_invitation_card` → `event_invitation_card_sw` / `_en`

- **Existing template:** `event_invitation_card` · lang `en`
- **Header:** image (template-bound, proxied through wsrv.nl).
- **Existing body placeholders:** `{{1}}`–`{{5}}` as above.
- **Why unique:** image-header card invitation; cannot be merged into
  text-only catalogue #1/#2.
- **Suggested SW body — DRAFT NEEDS USER APPROVAL.**
- **Used in:** `whatsapp_cards.py::wa_send_invitation_card`.
- **Approval needed:** yes (SW body).

### 3.5 `event_ticket_delivery` → `event_ticket_delivery_sw` / `_en`

- **Existing template:** `event_ticket_delivery` · lang `en`
- **Header:** image (ticket render).
- **Placeholders:** `{{1}}`–`{{5}}` as above.
- **Why unique:** image-header ticket delivery; not in the SMS
  catalogue.
- **Suggested SW body — DRAFT NEEDS USER APPROVAL.**
- **Used in:** `whatsapp_cards.py::wa_send_ticket`.
- **Approval needed:** yes (SW body).

---

## 4. Duplicate, Similar, and Merge Candidates

| Current Meta template | New catalogue template(s) | Similarity reason | Body difference | Placeholder difference | Buttons / media difference | Final decision |
|-----------------------|---------------------------|-------------------|-----------------|------------------------|----------------------------|----------------|
| `event_invitation_v2` | `nuru_guest_invitation_sw/_en` (#1/#2) | Same trigger (guest invite). | Catalogue adds heading `MWALIKO`/`INVITATION`, venue, `rsvp_url`; drops free-form date phrasing. | Catalogue uses 6 placeholders (adds venue + url) vs current 4. | Current has 2 quick-reply RSVP buttons; catalogue is text-only with embedded `rsvp_url`. **Manual decision** to drop quick-replies. | **Replace** + retire later. |
| `meeting_invitation` | `nuru_meeting_invitation_sw/_en` (#7/#8) | Same trigger. | Catalogue adds heading and sign-off; drops decorative emoji lines. | 4 body placeholders both sides, different order. | Current has 1 dynamic URL "Join Meeting" button; catalogue is currently specified as text-only. **Manual decision** before submission. | **Replace** + retire later (after URL button decision). |
| `contribution_recorded` | `nuru_contribution_recorded_with_balance_sw/_en` (#9/#10) **+** `nuru_contribution_recorded_pledge_complete_sw/_en` (#11/#12) | Same trigger; catalogue branches on whether balance remains. | Different wording for completed pledge vs partial. | Catalogue with-balance has fewer placeholders (no recorder field); pledge-complete is a celebratory message. | none. | **Replace + split.** Backend branch already implemented. Retire later. |
| `contribution_target` | `nuru_contribution_target_set_sw/_en` (#13/#14) **+** `nuru_contribution_target_updated_sw/_en` (#14a/#14b) **+** `nuru_guest_contribution_invite_sw/_en` (#17/#18) | Same trigger family (pledge target); catalogue distinguishes initial set, increase, and anonymous-guest invite. | Different copy per branch. | Different placeholder sets per branch. | none. | **Replace + split.** Retire later. |
| `thank_you_contribution` | `nuru_contribution_thank_you_sw/_en` (#15/#16) | Same trigger. | Heading + sign-off added. | Same 3 placeholders. | none. | **Replace** + retire later. |
| `booking_notification` | `nuru_service_booking_notification_sw/_en` (#43/#44) | Same trigger. | Heading + sign-off added. | Same 3 placeholders. | none. | **Replace** + retire later. |
| `booking_accepted` | `nuru_booking_accepted_sw/_en` (#45/#46) | Same trigger. | Heading + sign-off added. | 4 placeholders both sides (order check needed). | none. | **Replace** + retire later. |
| `expense_recorded` | `nuru_expense_recorded_sw/_en` (#41/#42) | Same trigger. | Heading + sign-off added. | Same 5 placeholders. | none. | **Replace** + retire later. |
| `vendor_payment_otp` | `nuru_vendor_otp_claim_sw/_en` (#31/#32) **+** `nuru_vendor_otp_resend_sw/_en` (#33/#34) | Same trigger; catalogue distinguishes first send vs resend. | Different wording per branch. | OTP placeholder preserved; remaining differ. | none. | **Replace + split.** Backend must distinguish first send vs resend before retiring. |
| `vendor_payment_confirmed` | `nuru_vendor_confirmation_receipt_sw/_en` (#35/#36) **+** `nuru_vendor_confirmation_receipt_full_sw/_en` (#37/#38) | Same trigger; catalogue distinguishes partial vs full. | Different copy per branch. | Different placeholder sets per branch. | none. | **Replace + split.** Backend must branch partial vs full. |
| `event_invitation_text` | catalogue #1/#2 | Adjacent trigger (text invite). | Current carries richer body + 2 URL buttons; catalogue is shorter, single link. | Current 7 placeholders vs catalogue 6. | Buttons differ (2 × URL vs none). | **Keep separate** as rich-text variant; create matching SW pair (`event_invitation_text_sw`). |
| `event_invitation_card` | catalogue #1/#2 | Adjacent trigger. | Current has image header. | n/a | Image header vs none. | **Keep separate** image-card variant; create matching SW pair. |
| `event_reminder` | reminder automation `nuru_guest_remind_sw/_en` | Same trigger family. | Different sender (manual vs automation). | Reminder automation has fewer placeholders. | none vs none. | **Manual decision**: retire if no manual call sites remain, otherwise create `nuru_event_reminder_sw/_en` pair. |

---

## 5. Templates To Keep On Meta Unchanged

| Template | Reason it remains | Risk if deleted now | When it can be revisited |
|----------|-------------------|---------------------|--------------------------|
| `otp_verification` | Authentication OTP (login, phone verify, password reset). Not in scope of catalogue. | All login / verification / password-reset flows break. | Never (auth-only). |
| `hello_world` | Meta sample template used by `check_whatsapp` to probe whether a number is on WhatsApp. | `check_whatsapp` health probe breaks. | Only if probe logic is removed from code. |
| `nuru_fundraise_notice_sw` / `_en` | Active reminder-automation templates. | Fundraise broadcast automation breaks. | Only after the automation is retired (no plan to retire). |
| `nuru_pledge_remind_sw` / `_en` | Pledge reminder automation with dynamic URL button (`https://nuru.tz/c/{{1}}`). | Pledge reminder automation breaks. | Same as above. |
| `nuru_guest_remind_sw` / `_en` | Guest reminder automation. | Guest reminders stop. | Same as above. |
| `event_invitation_text` | Still actively sent by `wa_send_invitation_text` (2 URL buttons). | Rich-text invite delivery breaks. | After `event_invitation_text_sw/_en` pair approved + deployed. |
| `event_invitation_card` | Image-card invite (`wa_send_invitation_card`). | Card invite delivery breaks. | After `event_invitation_card_sw/_en` pair approved + deployed. |
| `event_ticket_delivery` | Ticket card delivery (`wa_send_ticket`). | Ticket delivery breaks. | After `event_ticket_delivery_sw/_en` pair approved + deployed. |
| `event_update` | Active event-detail-change broadcast. | Event-change notifications break. | After `nuru_event_update_sw/_en` pair approved + deployed. |
| `event_reminder` | Legacy single-language reminder template; may still be triggered manually. | Manual reminder path breaks. | After product confirms retire-vs-replace decision. |

All current templates remain on Meta for now. Nothing to delete during
this audit pass.

---

## 6. Templates To Add On Meta

### A. Add now — core 48 catalogue templates

Submit all 48 (catalogue #1–#46 plus #14a/#14b). Bodies, placeholders,
headings, sign-off, category (UTILITY), header (none), footer (none),
buttons (none, except #7/#8 which are pending the URL-button
decision), and backend references are documented per row in
`whatsapp_templates_catalogue.md`.

### B. Add after wording approval — unique non-catalogue SW/EN pairs

| Proposed name | Lang | Category | Header | Buttons | Approval needed |
|---------------|------|----------|--------|---------|-----------------|
| `nuru_event_update_sw` | sw | UTILITY | none | none | Yes — SW body DRAFT in §3.1. |
| `nuru_event_update_en` | en | UTILITY | none | none | Yes — EN body DRAFT in §3.1 (replaces existing `event_update`). |
| `event_invitation_text_sw` | sw | UTILITY | none | 2 × URL (dynamic) | Yes — SW body DRAFT. |
| `event_invitation_text_en` | en | UTILITY | none | 2 × URL (dynamic) | Optional — current EN body may be promoted as-is or refreshed. |
| `event_invitation_card_sw` | sw | UTILITY | image | none | Yes — SW body DRAFT. |
| `event_invitation_card_en` | en | UTILITY | image | none | Optional. |
| `event_ticket_delivery_sw` | sw | UTILITY | image | none | Yes — SW body DRAFT. |
| `event_ticket_delivery_en` | en | UTILITY | image | none | Optional. |

### C. Add only if feature is still active

| Proposed name | Condition |
|---------------|-----------|
| `nuru_event_reminder_sw` / `_en` | Only if manual `wa_event_reminder` calls are still triggered outside the `nuru_guest_remind_*` automation. Otherwise retire `event_reminder` instead. |

---

## 7. Templates To Retire Later, Not Now

Remove from Meta **only after all four conditions hold**:

1. The replacement SW/EN pair has been approved by Meta.
2. The backend + edge function have been deployed and no longer
   reference the old template name.
3. WhatsApp delivery has been verified end-to-end in **both** SW and
   EN.
4. Monitoring confirms zero send failures attributable to the old
   template over a stabilisation window (≥ 48 h).

| Old template | Replacement template(s) | Reason | Safe removal condition |
|--------------|-------------------------|--------|------------------------|
| `event_invitation_v2` | `nuru_guest_invitation_sw/_en` (#1/#2) | Replaced by catalogue. | All four conditions above. |
| `meeting_invitation` | `nuru_meeting_invitation_sw/_en` (#7/#8) | Replaced. | Conditions above + URL-button decision implemented. |
| `contribution_recorded` | #9/#10 + #11/#12 | Replaced + split. | Conditions above + branch (balance vs complete) live. |
| `contribution_target` | #13/#14 + #14a/#14b + #17/#18 | Replaced + split. | Conditions above + set/updated/guest branches live. |
| `thank_you_contribution` | #15/#16 | Replaced. | Conditions above. |
| `expense_recorded` | #41/#42 | Replaced. | Conditions above. |
| `booking_notification` | #43/#44 | Replaced. | Conditions above. |
| `booking_accepted` | #45/#46 | Replaced. | Conditions above. |
| `vendor_payment_otp` | #31/#32 + #33/#34 | Replaced + split (first send vs resend). | Conditions above + resend branch live. |
| `vendor_payment_confirmed` | #35/#36 + #37/#38 | Replaced + split (partial vs full). | Conditions above + partial/full branch live. |

Optional later-retirement candidates (only if §3 pairs are approved +
deployed):

| Old template | Replacement | Condition |
|--------------|-------------|-----------|
| `event_update` | `nuru_event_update_sw/_en` | §3.1 pair approved + deployed. |
| `event_reminder` | `nuru_event_reminder_sw/_en` **or** removed | §3.2 decision made + deployed. |
| `event_invitation_text` | `event_invitation_text_sw/_en` | §3.3 pair approved + deployed. |
| `event_invitation_card` | `event_invitation_card_sw/_en` | §3.4 pair approved + deployed. |
| `event_ticket_delivery` | `event_ticket_delivery_sw/_en` | §3.5 pair approved + deployed. |

---

## 8. Final Merge Decision Table

| Current Meta template | New SW template | New EN template | Keep current? | Replace current? | Retire later? | Create missing language pair? | Manual decision? | Notes |
|-----------------------|-----------------|-----------------|---------------|------------------|---------------|-------------------------------|------------------|-------|
| `event_invitation_v2` | `nuru_guest_invitation_sw` | `nuru_guest_invitation_en` | until cut-over | yes | yes | yes (SW new) | yes — drop quick-reply buttons? | catalogue #1/#2 |
| `event_update` | `nuru_event_update_sw` (DRAFT) | `nuru_event_update_en` (DRAFT) | yes (no replacement yet) | no | optional | yes (both via §3.1) | yes — approve bodies | not in catalogue |
| `event_reminder` | `nuru_event_reminder_sw` (DRAFT, optional) | `nuru_event_reminder_en` (DRAFT, optional) | yes | no | optional | conditional | yes — confirm manual path still used | overlap with reminder automation |
| `expense_recorded` | `nuru_expense_recorded_sw` | `nuru_expense_recorded_en` | until cut-over | yes | yes | yes (SW new) | no | catalogue #41/#42 |
| `contribution_recorded` | `nuru_contribution_recorded_with_balance_sw` + `nuru_contribution_recorded_pledge_complete_sw` | matching `_en` pair | until cut-over | yes (split) | yes | yes (SW new) | no | catalogue #9–#12; backend branch implemented |
| `contribution_target` | `nuru_contribution_target_set_sw` + `nuru_contribution_target_updated_sw` + `nuru_guest_contribution_invite_sw` | matching `_en` pair | until cut-over | yes (split) | yes | yes (SW new) | yes — pledge-reduction policy (catalogue §pledge_set fallback) | catalogue #13/#14, #14a/#14b, #17/#18 |
| `thank_you_contribution` | `nuru_contribution_thank_you_sw` | `nuru_contribution_thank_you_en` | until cut-over | yes | yes | yes (SW new) | no | catalogue #15/#16 |
| `booking_notification` | `nuru_service_booking_notification_sw` | `nuru_service_booking_notification_en` | until cut-over | yes | yes | yes (SW new) | no | catalogue #43/#44 |
| `booking_accepted` | `nuru_booking_accepted_sw` | `nuru_booking_accepted_en` | until cut-over | yes | yes | yes (SW new) | no | catalogue #45/#46 |
| `meeting_invitation` | `nuru_meeting_invitation_sw` | `nuru_meeting_invitation_en` | until cut-over | yes | yes | yes (SW new) | yes — URL "Join Meeting" button on new pair? | catalogue #7/#8 |
| `vendor_payment_otp` | `nuru_vendor_otp_claim_sw` + `nuru_vendor_otp_resend_sw` | matching `_en` pair | until cut-over | yes (split) | yes | yes (SW new) | no | catalogue #31–#34 |
| `vendor_payment_confirmed` | `nuru_vendor_confirmation_receipt_sw` + `nuru_vendor_confirmation_receipt_full_sw` | matching `_en` pair | until cut-over | yes (split) | yes | yes (SW new) | no | catalogue #35–#38 |
| `event_invitation_text` | `event_invitation_text_sw` (DRAFT) | keep `event_invitation_text` or `_en` | yes | no | optional | yes (SW new) | yes — approve SW body | preserves 2 × URL buttons |
| `event_invitation_card` | `event_invitation_card_sw` (DRAFT) | keep or `_en` | yes | no | optional | yes (SW new) | yes — approve SW body | preserves image header |
| `event_ticket_delivery` | `event_ticket_delivery_sw` (DRAFT) | keep or `_en` | yes | no | optional | yes (SW new) | yes — approve SW body | preserves image header |
| `nuru_fundraise_notice_sw/_en` | n/a | n/a | yes | no | no | already paired | no | reminder automation |
| `nuru_pledge_remind_sw/_en` | n/a | n/a | yes | no | no | already paired | no | reminder automation + dynamic URL button |
| `nuru_guest_remind_sw/_en` | n/a | n/a | yes | no | no | already paired | no | reminder automation |
| `otp_verification` | n/a | n/a | yes | no | no | excluded (auth) | no | auth-only |
| `hello_world` | n/a | n/a | yes | no | no | excluded (probe) | no | Meta sample |

---

## 9. Summary (audit only, no actions taken)

- **Source of current Meta content:** local code + local docs (Meta
  API enumeration unavailable — WABA ID not exposed by current
  scopes).
- **Current Meta templates listed:** 23 (12 notification + 3 rich
  media + 6 reminder automation + 2 auth/probe).
- **Auth/probe templates excluded:** 2 (`otp_verification`, `hello_world`).
- **New core catalogue templates listed:** 48.
- **Unique non-catalogue templates needing SW + EN pairing:** 5
  message keys (`event_update`, `event_reminder` [conditional],
  `event_invitation_text`, `event_invitation_card`,
  `event_ticket_delivery`).
- **Templates to keep on Meta unchanged right now:** 10
  (auth + probe + 6 reminder-automation + 5 rich-media/legacy still
  serving traffic, see §5).
- **Templates to add now:** 48 (core catalogue) — pending the two
  manual decisions in §2 (#7/#8 URL button, #14a/#14b reduction
  policy).
- **Templates to add after approval:** up to 10 in §6.B + §6.C
  (`nuru_event_update_*`, `event_invitation_text_*`,
  `event_invitation_card_*`, `event_ticket_delivery_*`, and
  conditionally `nuru_event_reminder_*`).
- **Templates to retire later:** 10 (see §7 — only after replacement
  pair approved, deployed, and verified end-to-end).
- **Manual decisions still needed:**
  1. `nuru_meeting_invitation_*` (#7/#8) — keep dynamic URL "Join
     Meeting" button on the new pair?
  2. `nuru_guest_invitation_*` (#1/#2) — drop quick-reply RSVP buttons
     in favor of `rsvp_url` body link?
  3. `nuru_contribution_target_updated_*` (#14a/#14b) — pledge
     reductions: reuse `_set` (current behaviour) or add a dedicated
     "reduced" template?
  4. `event_reminder` — confirm whether manual `wa_event_reminder`
     calls still exist; decide retire vs replace.
  5. Product approval of all DRAFT SW/EN bodies in §3.
- **Confirmation:** no deployment performed, no Meta API submission,
  no Meta template deleted, no backend dispatcher wiring changed, no
  catalogue wording changed.
