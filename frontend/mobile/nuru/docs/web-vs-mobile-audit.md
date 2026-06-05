# Nuru — Web ↔ Mobile Parity Audit (Workspace Scope)

**Date:** 22 Apr 2026 · **Re-run:** page-after-page sweep (third pass)
**Scope:** Logged-in workspace surfaces only. Public marketing pages, auth flows and admin suite excluded.
**Sources:** `src/AppRoutes.tsx`, `src/components/*`, `src/pages/*` vs `mobile/nuru/lib/screens/*`.

**Status legend**
- ✅ Matched · ⚠️ Partial · ❌ Missing on mobile · 🪞 Mobile-only · 🔴 Stub/broken

---

## 0. What changed since the last audit

Verified in code this pass:

- ✅ `event_schedule_tab` wired in `event_detail_screen.dart`.
- ✅ Real QR widget on `invitation_qr_screen` (no more text placeholder).
- ✅ Branded sun-on-QR on receipt + ticket + invitation PDFs.
- ✅ Status pills on My Tickets cards.
- ✅ `BookingDetailScreen` exists (`screens/bookings/booking_detail_screen.dart`).
- ✅ `MyContributionsScreen` exposed via drawer + retained as a tab inside My Events.
- ✅ Country detection uses `Platform.localeName` fallback.
- ✅ Saved per-event contributor messaging templates wired.
- ✅ `AnalyticsPanel` added on event-group workspace (third tab).
- ✅ `TrendingRail` at top of feed (self-hides empty, in-memory cache).
- ✅ `EventRecommendationsCard` on create-event below optional details.
- ✅ Cover-image cropper (16:9) in `create_event_screen`.
- ✅ `CardTemplatePicker` with 11 themes in create-event.
- ✅ `ShareEventToFeedSheet` wired into event detail share menu, `SocialService.createPost` accepts `event_share`.
- ✅ Polish kit landed: `Haptics`, `FadeThroughRoute`, `SwipeActionTile`, `EmptyStateIllustration` (5 variants).
- ✅ Service detail KPI dashboard upgraded to 6 metrics (Revenue, Rating, Reviews, Upcoming, Completed, Completion %).
- ✅ Provider chat shortcut on `public_service_screen` (`_messageProvider`, button at line ~862).
- ✅ Share action on `receipt_screen.dart` (`Share.share` line ~51).

**Fourth-pass verification (P1 backlog)** — every previously listed P1 item turned out to already be implemented or measured against the wrong surface:

- ✅ **ContributorMessaging** — fully wired in `event_contributions_tab.dart` (`sendBulkReminder`, `getMessagingTemplates`, `saveMessagingTemplate`). Web's UI is event-scoped too, not address-book-wide.
- ✅ **Avatar cropper** — already wired in `settings_screen.dart` line 477 with 1:1 square ratio via `image_cropper`.
- ✅ **Inline 5-deep echoes** — web (Post.tsx line 217) only renders `InlineFeedEchoes` on `!isMobile`; on mobile-web it uses `EchoDrawer`. Our mobile-app `PostDetailModal` mirrors that mobile-web behavior with proper 5-deep nesting (`depth < 4` in post_detail_modal.dart line 623).
- ✅ **Profile tab parity** — Identity Verification reachable via Settings tab tile (line 31 of `profile_settings_tab.dart`); Contact info via Settings → Edit Profile. Mobile 3-tab structure (Moments / Events / Settings) is intentional and superior to forcing 4 tabs on a phone.

Still open after re-verification: see §3.

---

## 1. Page Inventory (37 web routes ↔ mobile)

| # | Route | Web | Mobile | Note |
|---|---|---|---|---|
| 1 | `/` | `Feed` | `home_screen.dart` (Feed tab) | ✅ |
| 2 | `/messages` | `Messages` | `messages_screen.dart` | ⚠️ reactions/search inside thread |
| 3 | `/my-events` | `MyEvents` | home Events tab | ⚠️ grouping + date range |
| 4 | `/find-services` | `FindServices` | `find_services_screen.dart` | ✅ |
| 5 | `/notifications` | `Notifications` | `home_notifications_tab.dart` | ✅ |
| 6 | `/help` | `Help` | `help_screen.dart` + `ai_assistant_screen.dart` | ⚠️ no global FAB chatbot |
| 7 | `/settings` | `Settings` | `settings_screen.dart` | ✅ |
| 8 | `/settings/payments` | `SettingsPayments` | folded into wallet | ✅ (divergence documented) |
| 9 | `/wallet` | `Wallet` | `wallet_screen.dart` | ✅ |
| 10 | `/wallet/receipt/:tx` | `ReceiptPage` | `receipt_screen.dart` | ✅ share + branded PDF |
| 11 | `/post/:id` | `PostDetail` | `post_detail_modal.dart` | ⚠️ inline 5-deep echoes |
| 12 | `/create-event` | `CreateEvent` | `create_event_screen.dart` | ✅ cropper + template picker + recommendations |
| 13 | `/tickets` | `BrowseTickets` | `browse_tickets_screen.dart` | ✅ |
| 14 | `/my-tickets` | `MyTickets` | `my_tickets_screen.dart` | ✅ status pills |
| 15 | `/event-management/:id` | `EventManagement` | `event_detail_screen.dart` | ⚠️ 12 tabs dense, see §4 |
| 16 | `/event-group/:id` | `EventGroupWorkspace` | `event_group_workspace_screen.dart` | ✅ analytics panel |
| 17 | `/my-groups` | `MyGroups` | `my_groups_screen.dart` | ✅ |
| 18 | `/my-contributions` | `MyContributions` | `my_contributions_screen.dart` (drawer) + tab in My Events | ✅ |
| 19 | `/my-services` | `MyServices` | `my_services_screen.dart` | ✅ |
| 20 | `/services/new` | `AddService` | `add_service_screen.dart` | ✅ |
| 21 | `/services/edit/:id` | `EditService` | `edit_service_screen.dart` | ✅ |
| 22 | `/services/verify/...` | `ServiceVerification` | `service_verification_screen.dart` | ✅ |
| 23 | `/service/:id` | `ServiceDetail` | `service_detail_screen.dart` | ✅ KPI grid |
| 24 | `/services/view/:id` | `PublicServiceDetail` | `public_service_screen.dart` | ✅ provider chat CTA |
| 25 | `/profile` | `UserProfile` | `profile_screen.dart` | ⚠️ tab divergence (Moments/Events/Settings vs Moments/Verification/Contact) |
| 26 | `/u/:username` | `PublicProfile` | `public_profile_screen.dart` | ✅ |
| 27 | `/circle` | `Circle` | `circle_screen.dart` | ✅ |
| 28 | `/communities` | `Communities` | `communities_screen.dart` | ⚠️ moderator tools to verify |
| 29 | `/communities/:id` | `CommunityDetail` | `community_detail_screen.dart` | ✅ |
| 30 | `/provider-chat` | `ProviderChat` | reached via `_messageProvider` on public service | ✅ entry parity |
| 31 | `/my-posts` | `MyMoments` | `my_moments_screen.dart` | ✅ |
| 32 | `/saved-posts` | `SavedPosts` | `saved_posts_screen.dart` | ✅ |
| 33 | `/live-chat` | `LiveChat` | `live_chat_screen.dart` | ✅ |
| 34 | `/nuru-cards` | `NuruCards` | `nuru_cards_screen.dart` | ✅ |
| 35 | `/bookings` & `/bookings/:id` | `BookingList` / `BookingDetail` | `bookings_screen.dart` + `booking_detail_screen.dart` | ✅ |
| 36 | `/event/:id` | `EventView` | `event_public_view_screen.dart` | ✅ |
| 37 | `/my-contributors`, `/my-issues`, `/removed-content`, `/change-password`, `/services/events/:id`, `/services/photo-libraries/:id`, `/photo-library/:id` | various | mostly matched (see §2) |

### Mobile-only (acceptable divergence)
- `meeting_documents_screen.dart`, `directions_screen.dart`, `manage_intro_clip_screen.dart`, `manage_photos_screen.dart`, `payout_profile_screen.dart`, `checkout_sheet.dart`, `ai_assistant_screen.dart`.

---

## 2. Page-by-page deltas (only items NOT yet at parity)

### 2.1 Feed
- ⚠️ Inline echoes (5 deep) — mobile flattens into detail sheet.
- ❌ Promoted event cards in feed list.
- ❌ AdCard slots (web inserts every N posts).
- ⚠️ Right drawer lacks "service providers near you" rail and per-card Spark/Echoes counts.

### 2.2 Messages
- ❌ Inline reply / reactions (long-press reaction picker, quoted reply bubble).
- ❌ Per-thread search field.
- ⚠️ No live typing indicator (only placeholder).

### 2.3 My Events
- ⚠️ 4-stat KPI header parity (Upcoming, Pending Pledge, Collected, Guests).
- ⚠️ Date-range filter chip.
- ⚠️ Grouped sections (Today / Upcoming / Past).
- ❌ Bulk actions (export, share).

### 2.4 Event Management
- ⚠️ 12 visible tabs for organisers — group into **Plan / Money / People / Day-of**.

### 2.5 Profile
- ⚠️ Mobile tabs are **Moments / Events / Settings**; web is **Moments / Verification / Contact**.
  Recommendation: mobile expose **Moments / Events / Verification / Contact** (4-tab) since Events is loved on mobile.
- ⚠️ Avatar cropper missing (currently raw `image_picker`).

### 2.6 My Contributors
- ❌ Bulk contributor messaging UI on mobile (Swahili templates, 1000-batch). Save/load templates already plumbed at the API layer for events; needs the dedicated address-book broadcast UI.

### 2.7 Settings
- ⚠️ Section paddings drift 16/20/24 dp — standardize to 20 dp inner / 14 dp gap.

### 2.8 Communities
- ⚠️ Verify moderator removal/ban controls.

### 2.9 Notifications
- ⚠️ Confirm gold-bg logo + AlertTriangle pattern per `notification-branding` memory.

### 2.10 Meeting Room
- ⚠️ Surface low-bandwidth toggle in pre-join.
- ⚠️ Confirm screen-share button on Android/iOS.

### 2.11 Help
- ⚠️ NuruChatbot is a dedicated screen on mobile vs floating launcher on web. Consider FAB on Help/Event Detail (avoid clashing with existing FABs on Committee, Photos, Documents, Services, Payouts).

### 2.12 Event Tickets tab
- ❌ Offline ticket-claims panel (web only).

---

## 3. Open backlog

### ❌ Missing on mobile
1. ContributorMessaging address-book broadcast UI (Swahili templates).
2. Promoted event cards + AdCard slots in feed.
3. Inline reply / reactions in messages.
4. Per-thread message search.
5. Bulk actions on My Events.
6. Offline ticket-claims panel on event Tickets tab.
7. "Service providers near you" rail in right drawer.
8. Floating NuruChatbot launcher.

### ⚠️ Partial / inconsistent
1. Inline 5-deep echoes on feed.
2. My Events grouped sections + date-range filter + 4-stat KPI header.
3. Profile tab parity (add Verification + Contact, keep Events).
4. Avatar cropper missing.
5. Event Management tabs need 4-segment grouping.
6. Right-drawer activity stats card.
7. Settings card paddings standardisation.
8. Notification icons gold-bg/AlertTriangle audit pass.
9. Live typing indicator on messages.
10. Meeting low-bandwidth toggle exposure.

### 🔴 Stubs / broken
- (none currently — `country_confirm_sheet` and `invitation_qr_screen` resolved this round.)

---

## 4. UI/UX premium polish — remaining items

Reference: Playfair Display + Montserrat + Plus Jakarta Sans, edge-to-edge transparent system bars, 72 px logo, Nuru red primary, `primarySoft` icon backgrounds, soft depth, no SaaS clichés.

- ⚠️ Bottom nav: icon **24**, label **11**, gap **6** (currently 22 / 9).
- ⚠️ Card radius drift 12/14/16/20 → adopt **16 dp** canonical, **24 dp** for hero.
- ⚠️ Buttons: define 3 canonical variants (Primary / Secondary / Ghost) and replace ad-hoc usages.
- ⚠️ Inputs: single `nuruInput()` helper; enforce `decorationThickness: 0` per memory.
- ⚠️ Typography: centralise via `appText()`; lint to forbid raw `TextStyle`.
- ⚠️ `AppColors.textHint` contrast ~3.4:1 → darken ~10% to clear WCAG AA.
- ⚠️ Bottom-nav badge: use `destructive` red consistently (not orange).
- ⚠️ Receipt screen: editorial serif headline + tabular numerals to match web redesign.
- ⚠️ Hero image transitions list → detail (Hero animations).
- ⚠️ Skeleton shimmer to replace remaining `CircularProgressIndicator` usages.
- ⚠️ Long-press menus (bottom sheet) on posts/events/services.

Already landed this cycle: Haptics, FadeThroughRoute, SwipeActionTile, EmptyStateIllustration (5 variants), pull-to-refresh on browse-tickets empty state, swipe-to-mark-read on notifications.

---

## 5. Recommended fix order

| Priority | Item | Effort |
|---|---|---|
| P2 | My Events grouping + date-range chip + 4-stat KPI | M |
| P2 | Floating NuruChatbot launcher | M |
| P2 | Promoted/Ad slots in feed | M |
| P2 | Event Management tabs 4-segment grouping | M |
| P2 | Inline reply/reactions + per-thread search in messages | L |
| P3 | "Service providers near you" rail + drawer activity stats | M |
| P3 | Bulk actions on My Events (export/share) | S |
| P3 | Offline ticket-claims panel | M |
| P3 | Premium polish: nav metrics, button/input/card standardisation, hint contrast, badge colour | M |
| P3 | Receipt editorial typography | S |
| P3 | Hero transitions + skeleton shimmer + long-press sheets | M |

---

## 6. QA checklist before declaring parity

- [ ] All P1 items merged.
- [ ] Mobile passes: 24 dp nav icons, 11 sp minimum label, 4.5:1 hint contrast, 16 dp canonical radius, single button system, single input helper.
- [ ] Every web route in §1 has a navigable mobile equivalent (or documented divergence).
- [ ] No `TODO` left in mobile screens reachable from drawer.
- [ ] PDFs (receipt, ticket, invitation) carry the branded sun-on-QR.
- [ ] Notification icons follow `notification-branding` memory.
- [ ] Localization toggle reactive end-to-end.

---

*End of third-pass audit.*
