# Nuru Platform — Detailed Status Document

> Source of truth for what is **DONE**, **PARTIAL**, and **MISSING**.
> Last updated after deep audit. Do not start Phase 1 work until this doc is referenced.

## Decisions locked in
- **Escrow** = logical ledger only (admin manually settles MPesa/card payouts).
- **Cancellation tier** = auto-assigned per category from `public/docs/cancellation-policy.md`.
- **OTP check-in** = mandatory for every booking before escrow can release.

---

## 1. Legal / Policy Layer

| Item | Status | Notes |
|---|---|---|
| Vendor Agreement (text + acceptance) | ✅ DONE | `vendor-agreement.md`, `VendorAgreement.tsx`, `agreements.py` model + API + Flutter `agreements_service.dart`. Versioned via `agreement_versions` and per-user `user_agreement_acceptances`. |
| Organiser Agreement | ✅ DONE | `organiser-agreement.md`, `OrganiserAgreement.tsx`, same acceptance pipeline. |
| Cancellation Policy 3 tiers | ⚠ PARTIAL | Text complete in `cancellation-policy.md`; **no enforcement code** anywhere — refunds are not auto-calculated. |
| Payment System Guide (escrow / OTP / auto-release) | ⚠ PARTIAL | Document only; **zero supporting code**. |
| Terms / Privacy / Community guidelines | ✅ DONE | Pages render and are linked from auth flows. |

---

## 2. Bookings & Booking Lifecycle

**Done**
- `ServiceBookingRequest` model: `proposed_price`, `quoted_price`, `deposit_required`, `deposit_paid (bool)`, `status (text)`, `responded_at`.
- Endpoints: create, list mine, list received, respond (accept/reject), cancel, complete, calendar, block/unblock dates.
- Web `BookingList.tsx` + mobile equivalents.

**Missing**
- **State machine**: status is free `text`. No enforced transitions `pending → accepted → funds_secured → in_progress → delivered → released/refunded/disputed`.
- **`funds_secured` concept**: `deposit_paid` flips, but no link to a held escrow row; "Funds Secured" notification (payment guide §3) not sent.
- **Two-way price lock**: vendor sets `quoted_price`, but organiser cannot formally "Accept Quote → Lock". Either side can keep editing.
- **Auto-expire unpaid bookings**: not implemented.

---

## 3. Escrow & Money Movement

**Done**: Nothing. Searches for `escrow`, `wallet`, `payout`, `released_at` returned zero matches.

**Missing (Phase 1, logical-only)**
- `escrow_holds`: `booking_id`, `event_service_id`, `amount_total`, `amount_deposit`, `amount_balance`, `currency`, `status (held/partially_released/released/refunded)`, `auto_release_at`.
- `escrow_transactions` ledger: append-only — HOLD, RELEASE_TO_VENDOR, REFUND_TO_ORGANISER, COMMISSION_TO_NURU, FEE.
- Booking → escrow link + state transitions.
- Admin dashboard to mark a hold as "settled to vendor".

**Today's pain**: vendors have no proof Nuru is holding funds; organisers can't see "funds secured"; refunds are ad-hoc.

---

## 4. Cancellation Tier Enforcement

**Done**: policy text + 3 tiers (Flexible / Moderate / Strict) + 48-hour universal rule.

**Missing**
- `cancellation_tier` on `service_types` (or `user_services`) — auto-seed mapping: catering→Strict, decor→Strict, hotel→Strict, photographer→Moderate, MC/planner→Flexible, etc.
- Refund calculator endpoint: `(booking_id, cancelling_party, cancel_at)` → `(refund_amount, vendor_retention, nuru_fee, reason_code)`.
- Hook into cancel endpoint; record results as escrow transactions.
- UI: show tier on each listing + show exact refund **before** confirm.

---

## 5. Service-Delivery OTP Check-In (mandatory)

**Done**: Nothing.

**Missing**
- `service_delivery_otps`: `booking_id`, `event_service_id`, `code (6-digit)`, `generated_by_vendor_at`, `entered_at`, `expires_at`, `attempts`, `status`.
- Vendor "Arrived" → backend issues code → push/SMS to organiser.
- Organiser shares code → vendor enters → backend verifies → set `event_services.delivery_confirmed_at`.
- Block escrow `release` until `delivery_confirmed_at IS NOT NULL`. Admin override path.
- Web + Flutter UI both sides.

---

## 6. Auto-Release Timer

**Done**: Celery + beat scheduler wired (`core/celery_app.py`) with two existing periodic jobs.

**Missing**
- New beat task `auto_release_escrow_after_event` (hourly): for every hold where event date + 48h ≤ now, no open dispute, and `delivery_confirmed_at` set → release + notify both sides.

---

## 7. Disputes

**Done**: Nothing structured.

**Missing**
- `disputes`: `booking_id`, `opened_by`, `reason_code`, `description`, `status (open/under_review/resolved_release/resolved_refund/resolved_split)`, `resolved_by_admin_id`, `resolution_notes`.
- `dispute_evidence`: file + chat snapshot + OTP log refs.
- Open-dispute endpoint that **freezes** auto-release.
- Admin resolution UI: release / refund / partial split → matching escrow transactions.

---

## 8. Vendor Wallet & Payouts

**Done**: Nothing.

**Missing**
- `vendor_wallets`: `user_id`, `available_balance`, `pending_balance`, `lifetime_earned`, `currency`.
- `wallet_transactions`: mirrors of escrow releases minus commission.
- `vendor_payout_methods` (separate from organiser payment methods) — used **by Nuru to pay the vendor**.
- `withdrawal_requests` + admin approval queue.
- Commission deduction (5–10% per payment guide §16) on every release.
- UI: vendor wallet (web + mobile), payout methods, withdrawal request, history.

---

## 9. Per-Event Vendor Workspace (+ mirrored organiser workspace)

**Done**: Loose `event_services` rows; generic 1:1 chat in `messages`.

**Missing**: dedicated route per `(event_id, vendor_user_id)` grouping booking summary, scoped chat, two-way price lock, "Arrived"+OTP, files, payment status, deliver/dispute buttons. Mirrored organiser-side view per vendor. Web `/workspace/event/:id/vendor/:vid` + Flutter screens.

---

## 10. "Events Done" Semantics

**Done**: derived today from `event_services` rows where the **event** completed (wrong).

**Missing**: refactor all surfaces (vendor profile stats, portfolio counts, ranking, "completed events" tab) to use `event_services.delivery_confirmed_at IS NOT NULL AND delivery_accepted_at IS NOT NULL`.

---

## 11. Co-Hosting

**Done**: Nothing. Single `organizer_id` per event.

**Missing**: `event_co_hosts` (`event_id`, `user_id`, `role`, `accepted_at`), permission helpers, invite/accept flow.

---

## 12. Inventory-Based Ticketing

**Done**: `EventTicketClass.quantity` (flat int) + approval gate + owner-pending visibility.

**Missing**: `ticket_inventory_items` for SKU-level stock (rooms, tables, time slots), allocation logic, organiser inventory UI, buyer SKU picker.

---

## 13. Performance / UX

| Item | Status |
|---|---|
| Essential-first / lazy-tab loading (event, service, profile — web + Flutter) | ✅ DONE |
| Hover prefetch on lists | ✅ DONE |
| IntersectionObserver viewport prefetch + Network Information API skip | ✅ DONE |
| Rate-limit modal with live Retry-After countdown (web + Flutter) | ✅ DONE |
| Feed including standalone Moments | ⚠ Needs verification |
| Redis caching expansion, image optimization, skeletons end-to-end | ⚠ Incremental |

---

## 14. Other Gaps from Source Conversation

- Contributor-pays-organiser flow (wedding contributions) — payment guide §2C, no model/route.
- Ticket-buyer settlement to **organiser wallet** — organiser wallet object missing.
- Vendor security deposit (optional, payment guide §9) — not modeled.
- Rating penalties tied to no-shows / late cancels — rating system exists but not wired to outcomes.
- Fraud holding period before withdrawals — depends on wallet (Phase 2).

---

## Recommended Build Order

```text
Phase 1 — Money trust spine
  1.1  escrow_holds + escrow_transactions (logical) + booking state machine
  1.2  cancellation_tier auto-seed from policy doc + refund calculator + cancel hook
  1.3  service_delivery_otps + Arrived/Enter-code flow (mandatory, web + mobile)
  1.4  Celery beat: auto_release_escrow_after_event (48h, requires OTP confirmed, no dispute)
  1.5  disputes + evidence + admin resolution UI (freezes auto-release)
  1.6  Admin "mark settled" action for manual MPesa/card payout per hold

Phase 2 — Vendor ownership
  2.1  vendor_wallets + wallet_transactions + commission deduction on release
  2.2  vendor_payout_methods (separate model) + add/manage UI (web + mobile)
  2.3  withdrawal_requests + admin approval queue
  2.4  per-event vendor workspace (web route + Flutter screen)
  2.5  mirrored organiser-side workspace per assigned vendor
  2.6  refactor "completed events" everywhere to use delivery_confirmed_at
  2.7  two-way price lock (organiser confirms quote → locked)

Phase 3 — Co-hosting, inventory, contributor flows
  3.1  event_co_hosts + permission helpers + invite/accept
  3.2  ticket_inventory_items (SKU stock)
  3.3  contributor-pays-organiser flow + organiser wallet object
  3.4  vendor security deposit (optional)
  3.5  rating penalties wired to dispute/cancel outcomes
```

When the user says **"start Phase 1"**, begin at 1.1 (migrations + models + endpoints + UI).
