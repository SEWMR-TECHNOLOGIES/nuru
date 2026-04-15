# Changelog - Fixes & Features (2026-02-10)

## 1. Nuru Card Order Error (Internal Server Error)
**Problem:** `card_number` column was `String(12)` but generated format `NURU-2026-XXXXXX` is 16 characters.
**Fix:** Updated `card_number` column from `String(12)` to `String(20)` in both model files.
**Files changed:**
- `backend/nuru_cards.py` line 18
- `backend/models/nuru_cards.py` line 18
**ALTER statement needed on DB:**
```sql
ALTER TABLE nuru_cards ALTER COLUMN card_number TYPE VARCHAR(20);
```

## 2. OTP Input Consistency
**Problem:** VerifyEmail and VerifyPhone pages used plain text `<Input>` while Register used box-based `<InputOTP>`.
**Fix:** Replaced text inputs with `InputOTP` component with 6 slots (w-12 h-14, rounded-xl border-2) on both pages.
**Files changed:**
- `src/pages/VerifyEmail.tsx` (full rewrite)
- `src/pages/VerifyPhone.tsx` (full rewrite)

## 3. Autocomplete Prevention
**Problem:** Forms allowed browser autocomplete across the system.
**Fix:** Added `autoComplete="off"` as default prop on the shared `Input` component.
**Files changed:**
- `src/components/ui/input.tsx`

## 4. Dark Mode
**Problem:** No dark mode implementation with localStorage persistence.
**Fix:** 
- Added theme initialization in `src/main.tsx` reading from `localStorage('nuru-ui-theme')`
- Updated Settings toggle to apply `document.documentElement.classList.toggle('dark')` and persist to localStorage
- Dark mode CSS variables already existed in `index.css`
**Files changed:**
- `src/main.tsx`
- `src/components/Settings.tsx`

## 5. Default Currency (TZS not KES)
**Problem:** Settings page showed 'KES' as default currency.
**Fix:** Changed default fallback from 'KES' to 'TZS'.
**Files changed:**
- `src/components/Settings.tsx` line 353

## 6. Moment Images Cut Off
**Problem:** Images with more height appeared cut off due to `object-cover` with fixed heights.
**Fix:** Changed from `h-48 md:h-64 object-cover` to `max-h-[500px] object-contain bg-muted/30` for auto-height.
**Files changed:**
- `src/components/Moment.tsx` (feed post images)
- `src/components/PostDetail.tsx` (post detail images)
- `src/components/MomentDetail.tsx` (moment detail images)

## 7. MomentDetail Hardcoded Data
**Problem:** MomentDetail used localStorage/hardcoded Sarah Johnson data instead of real API data.
**Fix:** Complete rewrite to fetch from `socialApi.getPost(id)` and `socialApi.getComments(id)`.
**Files changed:**
- `src/components/MomentDetail.tsx` (full rewrite)

## 8. PostDetail Echoes Styling
**Problem:** Showed "Echoes (1)" format instead of modern styling.
**Fix:** Changed to `{count} {count === 1 ? 'Echo' : 'Echoes'}` format.
**Files changed:**
- `src/components/PostDetail.tsx` line 402

## 9. Chat UI Back Icon Alignment
**Problem:** Back icon and avatar were too far right in chat header.
**Fix:** Reduced padding and gaps in chat header, made back button `flex-shrink-0`.
**Files changed:**
- `src/components/Messages.tsx` lines 379-399

## 10. Password Reset
**Problem:** Forgot password used `setTimeout` mock instead of calling the actual API.
**Fix:** Now calls `api.auth.forgotPassword(email)` with proper error handling.
**Files changed:**
- `src/pages/Login.tsx` lines 80-94

## 11. Homepage CTA Cards Redesign
**Problem:** CTA action cards used emoji icons and basic glassmorphism styling.
**Fix:** Removed emoji icons, added gradient backgrounds, larger rounded-3xl corners, shine hover effect, and better typography hierarchy.
**Files changed:**
- `src/pages/Index.tsx` lines 386-422

## 12. Service Detail Packages
**Problem:** Packages were initialized as empty array and never populated from service data.
**Fix:** Now loads packages from `service.packages` and reviews from `service.reviews` when available.
**Files changed:**
- `src/components/ServiceDetail.tsx`

---

## Pending Items (Require Backend Changes)
The following items require backend endpoint changes or new endpoints that cannot be implemented purely on the frontend:

- **Edit event existing images**: Backend needs to return `gallery_images` in the event GET response
- **Service providers on edit**: EventRecommendations needs the event type ID passed correctly on edit
- **Settings update failures**: Backend `/settings/*` endpoints may need debugging
- **Notifications population**: Backend notification creation triggers needed for invitations, posts, etc.
- **Circle members not showing**: Backend `/circles/{id}/members` endpoint needs to return member data
- **Community member access**: Backend needs community feed/posts endpoints
- **Service assignment on events**: CORS error on `/user-events/{id}/services` needs backend CORS fix
- **Moment sharing visibility**: Backend needs `visibility` field on posts model
- **Committee/contributor SMS notifications**: Backend notification_service needs SMS triggers
- **Guest SMS on add**: Backend needs SMS trigger on guest addition
- **Chat with own service**: Frontend blocks self-chat - needs policy change
- **Number auto-formatting**: Requires per-component input handler changes
- **Event service booking calendar**: Needs `/user-services/{id}/bookings` endpoint for booked dates

## 13. Payment Method Enum Update
**Problem:** Payment method enum lacked `cash` option; `M-Pesa` naming was biased toward a specific provider.
**Fix:**
- Added `cash` to `payment_method` enum (listed first)
- Renamed all "M-Pesa" references to "Mobile Money" across frontend
- Removed emoji icons from payment method dropdowns system-wide
- Updated `PaymentMethodEnum` in both `backend/enums.py` and `backend/models/enums.py`
- Updated frontend types, components (`EventContributions`, `NuruCards`), and data hooks
**Files changed:**
- `database.sql` line 6
- `backend/enums.py` lines 18-22
- `backend/models/enums.py` lines 18-22
- `src/components/events/EventContributions.tsx` lines 37-44, 427
- `src/components/NuruCards.tsx` lines 43, 529-531
- `src/data/useNuruCards.ts` line 90
- `src/lib/api/types.ts` line 292
**ALTER statement needed on DB:**
```sql
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'cash' BEFORE 'mobile';
```

## 14. Guest Type Enum – Contributors as Event Guests
**Problem:** `event_invitations` and `event_attendees` tables had hard FK constraints on `users.id`, preventing non-registered address book contacts from being added as event guests.
**Fix:**
- Added `guest_type_enum` (`user`, `contributor`) to database and ORM
- Removed FK constraints on `invited_user_id` (invitations) and `attendee_id` (attendees) — now plain UUID columns
- Added `guest_type`, `contributor_id`, `guest_name` columns to `event_invitations`
- Added `guest_type`, `contributor_id`, `guest_name`, `guest_phone`, `guest_email` columns to `event_attendees`
- Updated all backend helpers (`_resolve_guest_name`, `_attendee_dict`) to resolve name/contact from either `User` (first_name + last_name) or `UserContributor` (full_name) based on `guest_type`
- Updated public RSVP endpoints to use type-aware name resolution
- Updated bulk import to tag guests as `guest_type='user'`
- Frontend `EventGuestList` now supports tabbed "Add Guest" with both user search and address book contributor selection
**Files changed:**
- `database.sql` (enum + table DDL)
- `backend/app/models/enums.py` (added `GuestTypeEnum`)
- `backend/app/models/invitations.py` (updated `EventInvitation`, `EventAttendee`)
- `backend/app/models/models.py` (synced `EventInvitation`, `EventAttendee`, added `GuestTypeEnum` import)
- `backend/app/api/routes/user_events.py` (guest helpers, add/bulk endpoints)
- `backend/app/api/routes/events.py` (public RSVP resolution)
- `src/lib/api/types.ts` (added `guest_type`, `contributor_id`)
- `src/components/events/EventGuestList.tsx` (contributor tab UI)
- `nuru-api-doc.md` (updated §4.3 Add Guest)
**ALTER statements needed on DB:**
```sql
-- 1. Create the guest_type enum
CREATE TYPE guest_type_enum AS ENUM ('user', 'contributor');

-- 2. Update event_invitations
ALTER TABLE event_invitations
  ADD COLUMN IF NOT EXISTS guest_type guest_type_enum DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS contributor_id uuid REFERENCES user_contributors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_name text;

-- 3. Drop FK constraint on invited_user_id
ALTER TABLE event_invitations DROP CONSTRAINT IF EXISTS event_invitations_invited_user_id_fkey;

-- 4. Update event_attendees
ALTER TABLE event_attendees
  ADD COLUMN IF NOT EXISTS guest_type guest_type_enum DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS contributor_id uuid REFERENCES user_contributors(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS guest_email text;

-- 5. Drop FK constraint on attendee_id
ALTER TABLE event_attendees DROP CONSTRAINT IF EXISTS event_attendees_attendee_id_fkey;

-- 6. Add indexes
CREATE INDEX IF NOT EXISTS idx_event_invitations_contributor ON event_invitations(contributor_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_contributor ON event_attendees(contributor_id);
```
