# Web Routing & Wiring Audit

**Date:** 22 Apr 2026 · **Scope:** Verify every nav entry point on the web reaches the correct page; payment + event-group flows intact.

## 1. Route table (`src/AppRoutes.tsx`)

All 114 imports resolve. No dead imports, no missing component files. Routes verified as **defined**:

| Surface | Path | Component | Status |
|---|---|---|---|
| Feed (logged-in root) | `/` | `<Feed/>` inside `<Layout/>` | ✅ |
| Messages | `/messages` | `Messages` | ✅ |
| My Events | `/my-events` | `MyEvents` | ✅ |
| Find Services | `/find-services` | `FindServices` | ✅ |
| Notifications | `/notifications` | `Notifications` | ✅ |
| Help | `/help` | `Help` | ✅ |
| Settings | `/settings` | `Settings` | ✅ |
| Settings → Payments | `/settings/payments` | `SettingsPayments` | ✅ |
| Wallet | `/wallet` | `Wallet` | ✅ |
| Receipt | `/wallet/receipt/:transaction_code` | `ReceiptPage` | ✅ |
| Shared receipt | `/shared/receipt/:transaction_code` | `SharedReceiptPage` | ✅ |
| Public contribute | `/c/:token` | `PublicContribute` | ✅ |
| Public contribution receipt | `/c/:token/r/:txCode` | `PublicContributionReceipt` | ✅ |
| Bookings list | `/bookings` | `BookingList` | ✅ |
| Booking detail | `/bookings/:id` | `BookingDetail` | ✅ |
| My Profile | `/profile` | `UserProfile` | ✅ |
| Public profile | `/u/:username` | `PublicProfile` | ✅ |
| My Groups | `/my-groups` | `MyGroups` | ✅ |
| Event Group workspace | `/event-group/:groupId` | `EventGroupWorkspace` | ✅ |
| Guest Group join | `/g/:token` | `GuestGroupJoin` | ✅ |
| Event Management | `/event-management/:id` | `EventManagement` | ✅ |
| Public event view | `/event/:id` | `EventView` | ✅ |
| My Tickets | `/my-tickets` | `MyTickets` | ✅ |
| Browse Tickets | `/tickets` | `BrowseTickets` | ✅ |
| Ticket verification | `/ticket/:code` | `TicketVerification` | ✅ |
| Nuru Cards | `/nuru-cards` | `NuruCards` | ✅ |
| My Contributions | `/my-contributions` | `MyContributions` | ✅ |
| My Contributors | `/my-contributors` | `MyContributors` | ✅ |
| Communities + detail | `/communities`, `/communities/:id` | `Communities`, `CommunityDetail` | ✅ |
| Circle | `/circle` | `Circle` | ✅ |
| Provider Chat | `/provider-chat` | `ProviderChat` | ✅ |

## 2. Nav entry points → routing matrix

### 2.1 Messages
- **Sidebar** (pinned, line 177): `NavLink to="/messages"` ✅
- **Header** (top bar, line 114): `NavLink to="/messages"` ✅
- **Provider chat CTAs**: navigate via `/messages?service_id=…` (event-scoped) — wired correctly.

### 2.2 My Events
- **Sidebar** (pinned, line 175): `NavLink to="/my-events"` ✅
- **CardTemplatesPage** post-save → `navigate("/my-events")` ✅
- **EventManagement** "Back" buttons → `navigate("/my-events")` ✅

### 2.3 Find Services
- **Sidebar** Discover section: `NavLink to="/find-services"` ✅
- **Empty states** in Bookings, MyServices link here ✅

### 2.4 My Profile
- **Sidebar** profile pill (line 469): `NavLink to="/profile"` ✅
- **Header avatar** menu: routes to `/profile` ✅
- **PublicProfile** owner self-view auto-redirects to `/profile` ✅

### 2.5 Payments (every entry point)
- `Wallet.tsx` lines 144, 183, 346 → `navigate("/settings/payments")` ✅
- `MigrationBanner.tsx` line 79 → `/settings/payments` ✅
- `MigrationGate.tsx` lines 67, 86 → `/settings/payments` ✅
- `MigrationWelcomeModal.tsx` line 41 → `/settings/payments` ✅
- `CheckoutModal.tsx` line 232 → `/wallet/receipt/${code}` ✅
- `printPaymentReceipt.ts` line 17 → `/wallet/receipt/${code}` ✅
- `Wallet.tsx` line 512 (transaction click) → `/wallet/receipt/${transaction_code}` ✅

### 2.6 Bookings
- `BookingList.tsx` lines 237, 405 → `navigate(/bookings/${id})` ✅
- `MyServices.tsx` line 473 → `/bookings?service=${id}` ✅
- Sidebar Money section: `path: '/bookings'` ✅

### 2.7 Event Groups
- `EventManagement.tsx` line 86 (group CTA) → `/event-group/${groupId}` ✅
- `EventGroupCta.tsx` line 55 → `/event-group/${group.id}` ✅
- `MyGroups.tsx` line 159 → `/event-group/${g.id}` ✅
- `GuestGroupJoin.tsx` line 59 → `/event-group/${res.data.group_id}` (replace) ✅
- Sidebar Network section: `path: '/my-groups'` ✅
- All four panels mounted: `ChatPanel`, `ScoreboardPanel`, `AnalyticsPanel`, `MembersDrawer` ✅

## 3. Payment API wiring (`src/lib/api/`)

All payment-related modules present and exported via `src/lib/api.ts`:
`paymentsApi`, `walletApi`, `paymentProfilesApi`, `withdrawalsApi`, `adminPaymentsApi`, `bookingsApi`, plus types in `payments-types.ts` and helpers in `adminPaymentsOps.ts`, `adminWithdrawals.ts`, `receivedPayments.ts`.

## 4. Runtime check

- ✅ Dev server compiles cleanly.
- ✅ No console errors at boot (`code--read_console_logs`).
- ✅ No runtime errors (`code--read_runtime_errors`).
- ✅ All 114 route component imports resolve.
- ✅ All 23 critical paths exercised in static check (exact or `:param`).

## 5. Findings

**Zero broken routes. Zero dead nav links. Zero missing components.**

Routing for Messages, My Events, Find Services, My Profile, every payment surface, and every event-group surface is consistent across Sidebar, Header, in-page CTAs, and modal flows.
