# Nuru

**Nuru** is an event operating system and social platform built in Tanzania for how people plan, fund, attend, manage, and remember events.

It combines event planning, digital invitations, guest management, ticketing, contributions, vendor coordination, secure payments, event groups, messaging, check-ins, media, and social engagement into one connected platform.

Nuru serves weddings, birthdays, graduations, conferences, concerts, memorials, fundraisers, community gatherings, religious ceremonies, exhibitions, corporate events, and private celebrations.

> **Nuru means light in Swahili.** The platform brings clarity, trust, and structure to moments that matter.

---

## Table of Contents

- [What Nuru Is](#what-nuru-is)
- [Why Nuru Exists](#why-nuru-exists)
- [Product Vision](#product-vision)
- [Who Uses Nuru](#who-uses-nuru)
- [Core Features](#core-features)
- [How Nuru Works](#how-nuru-works)
- [Product Modules](#product-modules)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Local Development](#local-development)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Mobile App Setup](#mobile-app-setup)
- [Background Workers](#background-workers)
- [Notifications and Messaging](#notifications-and-messaging)
- [Deployment](#deployment)
- [Nginx Configuration](#nginx-configuration)
- [Systemd Services](#systemd-services)
- [Environment Variables](#environment-variables)
- [Security Principles](#security-principles)
- [Development Standards](#development-standards)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Brand Positioning](#brand-positioning)
- [License](#license)
- [Contact](#contact)

---

## What Nuru Is

Nuru is a full-stack platform for the complete event lifecycle.

Most events are still managed through WhatsApp groups, mobile money screenshots, phone calls, paper lists, spreadsheets, scattered vendor contacts, and last-minute reminders. Nuru replaces that fragmented workflow with one organized digital workspace.

With Nuru, an organizer can create an event, invite guests, manage contributions, sell tickets, coordinate vendors, communicate with members, run check-ins, hold meetings, share updates, and preserve memories without jumping between different tools.

Nuru is both:

1. **An event management system** for organizers.
2. **A social event platform** for guests, contributors, vendors, and communities.

That combination is what makes Nuru different.

---

## Why Nuru Exists

Events are emotional, expensive, and coordination-heavy. A wedding is not just a date on a calendar. A memorial is not just a guest list. A conference is not just a ticket. Every event carries people, money, trust, service providers, expectations, timelines, and memories.

In many communities, especially across Tanzania and East Africa, event planning still depends heavily on manual coordination. That creates real problems:

- Organizers lose track of who contributed, who paid, who confirmed, and who still needs a reminder.
- Guests receive scattered information through forwarded messages and unclear updates.
- Vendors are discovered informally, with limited trust, verification, or accountability.
- Event teams coordinate through long chat threads where decisions disappear.
- Ticket validation and guest check-in often happen manually at the entrance.
- Photos, videos, and important memories are scattered after the event.

Nuru gives structure to this chaos without removing the human warmth that makes events special.

---

## Product Vision

Nuru’s vision is to become the leading social platform for events in Tanzania, East Africa, and African diaspora communities.

The goal is not only to help people create events. The goal is to build the digital layer around how people gather, celebrate, contribute, mourn, network, collaborate, and remember.

**Nuru helps people plan smarter and celebrate better.**

---

## Who Uses Nuru

### Event Organizers

People planning weddings, birthday parties, graduations, anniversaries, baby showers, memorials, fundraisers, conferences, concerts, community events, and religious ceremonies.

Organizers use Nuru to manage:

- Event details.
- Guest lists.
- Digital invitations.
- RSVP responses.
- Contributions.
- Ticket sales.
- Vendor coordination.
- Event groups.
- Meetings.
- Check-ins.
- Communication.
- Reports and analytics.

### Guests and Attendees

Guests use Nuru to receive invitations, RSVP, contribute, buy tickets, join event groups, check updates, access event information, and share moments.

### Contributors

Contributors use Nuru to pledge or send money toward an event, track their balance, receive confirmations, and stay updated.

This is useful for weddings, fundraisers, religious events, memorials, family ceremonies, and community gatherings.

### Vendors and Service Providers

Vendors use Nuru to showcase services, receive bookings, chat with organizers, build trust, and grow their business.

Vendor categories may include:

- Photographers.
- Caterers.
- DJs.
- MCs.
- Decorators.
- Florists.
- Venues.
- Event planners.
- Transport providers.
- Security providers.
- Printing and branding providers.

### Platform Administrators

Admins manage user support, vendor verification, platform safety, reported content, operational reviews, system analytics, and internal controls.

---

# Core Features

## 1. Event Creation and Management

Nuru gives organizers a central place to create, configure, and manage events.

Core capabilities include:

- Event title, description, date, time, category, and location.
- Public or private visibility.
- Event images and clean fallback placeholders.
- Organizer details.
- Event status tracking.
- Mobile-first event pages.
- Shareable links for guests and attendees.

Nuru is designed to support both simple personal events and large organized gatherings.

---

## 2. Digital Invitations

Nuru makes invitations easier to create, share, and track.

Invitation features include:

- Editable invitation cards.
- Custom event colors.
- Downloadable invitation designs.
- Mobile invitation card customization.
- Guest-facing invitation previews.
- Shareable invitation links.
- RSVP tracking.
- Guest response management.

The invitation experience should feel polished, not like a basic form with a date slapped on top.

---

## 3. RSVP and Guest Management

Organizers can track who is coming, who has not responded, and who needs follow-up.

Guest management may include:

- Guest list creation.
- RSVP status tracking.
- Guest categories or groups.
- Attendance confirmation.
- Manual guest updates.
- Exportable guest records.
- Check-in readiness.

This helps organizers avoid the classic event question: “Who exactly is coming?”

---

## 4. Contributions and Pledges

Nuru supports financial contributions for events where friends, family, community members, or guests contribute money.

Contribution features include:

- Pledge creation.
- Contribution targets.
- Amount paid.
- Balance remaining.
- Payment status.
- Contributor history.
- Contributor progress.
- Contribution summaries.
- Bulk reminders.
- Thank-you messages.
- Exportable reports.

Contribution tracking is built for transparency. Organizers can see progress clearly, and contributors can understand their own status without repeated calls.

---

## 5. Ticketing

Nuru includes a ticketing system for paid events.

Ticketing features include:

- Multiple ticket classes such as Regular, VIP, VVIP, and Early Bird.
- Ticket pricing.
- Ticket availability.
- Ticket purchase tracking.
- Payment status.
- Unique ticket codes.
- QR code validation.
- Organizer approval workflows where required.
- Ticket history for attendees.
- Ticket details screens.

This allows Nuru to support concerts, conferences, exhibitions, festivals, trainings, and other paid events.

---

## 6. QR and Contactless Check-In

Nuru helps organizers validate guests and tickets at the entrance.

Check-in features may include:

- QR code scanning.
- Ticket validation.
- Guest validation.
- Success and failure check-in states.
- Organizer-facing check-in screen.
- Real-time attendance updates.

The goal is simple: no confusion at the gate, no paper list panic, and no “please wait while we call the organizer.”

---

## 7. Vendor Marketplace

Nuru connects organizers with service providers they can trust.

Vendor marketplace features include:

- Vendor profiles.
- Service categories.
- Portfolio images and videos.
- Verification badges.
- Vendor reviews.
- Direct organizer-to-vendor chat.
- Booking workflows.
- Payment support.
- Vendor discovery from search and the AI assistant.

Trust is a major part of the Nuru vendor experience. A beautiful event can fall apart quickly when a vendor disappears. Nuru is built to reduce that risk.

---

## 8. Secure Payments

Nuru supports payment workflows for tickets, contributions, vendor bookings, and organizer services.

Payment options may include:

- Mobile money.
- Bank transfers.
- Cards.
- Manual payment recording.
- Payment reference codes.
- Receipt image uploads.
- Organizer approval or rejection.
- Payment reports.

For vendor bookings, Nuru can support escrow-style protection where funds are held until service delivery is confirmed or the release period expires.

---

## 9. Event Groups

Nuru event groups give organizers, contributors, committee members, and guests a focused workspace for event coordination.

Event group sections may include:

### Chat

A group conversation space where members discuss the event. Contribution updates can appear inside the chat so everyone sees progress naturally.

### Contributors

A clear view of contribution progress, contributor lists, balances, completed payments, and pending amounts.

### Analytics

Visual summaries showing how the contribution campaign or event coordination is progressing.

### Members

Admins can view members, copy invite links, manage roles, and remove members when needed.

This turns an event group from “just another chat” into a real coordination space.

---

## 10. Social Feed, Moments, Circles, and Communities

Nuru is also a social platform for event life.

Social features may include:

- Event posts.
- Moments.
- Reels or short videos.
- Public and private event updates.
- Circles for personal connections.
- Communities around interests, locations, or event types.
- Glow and Echo engagement actions.
- Trending moments.
- Shareable guest posts.
- Direct messaging.

This helps Nuru go beyond event planning and become a place where event memories and communities continue after the event ends.

---

## 11. Event Meetings, Calls, and Coordination

Nuru supports real-time coordination for event committees and groups.

Meeting and call features may include:

- Audio calls.
- Video calls.
- Event meetings.
- Screen sharing.
- Committee coordination.
- Meeting join flows.
- Workspace-based communication.

This is useful for planning committees, conference teams, wedding groups, vendors, and organizers who need live discussions inside the same event context.

---

## 12. AI Assistant

Nuru can include an AI assistant for general event support.

The assistant can help users:

- Create event budgets.
- Compare vendor options.
- Generate planning checklists.
- Suggest timelines.
- Explain contribution summaries.
- Display structured tables.
- Recommend vendors when asked.
- Support organizers with event decisions.

The AI assistant is not limited to support tickets. It is designed to become an intelligent planning companion inside Nuru.

---

## 13. Photo and Media Libraries

Nuru can support event media libraries for organizers, vendors, photographers, and attendees.

Media library features may include:

- Public albums.
- Private albums.
- Event creator-only access.
- Photographer-attached libraries.
- Image and video uploads.
- Shareable media links.
- Download permissions.
- Portfolio integration for vendors.

This helps preserve the event after the last song, speech, or prayer ends.

---

## 14. NFC Smart Cards

Nuru can support NFC smart cards for contactless event experiences.

Possible NFC use cases include:

- Guest check-in.
- Contact sharing.
- Digital business cards.
- Conference networking.
- Guest book signing.
- Event program access.
- Menu or schedule access.
- Venue information.

NFC adds a premium, modern layer to physical event interaction.

---

# How Nuru Works

A simplified event flow looks like this:

```text
Organizer creates event
        ↓
Organizer configures invitations, tickets, contributions, vendors, or groups
        ↓
Guests receive links, invitations, tickets, or contribution requests
        ↓
Payments, RSVPs, chats, and updates happen inside Nuru
        ↓
Organizer tracks progress through dashboards and group spaces
        ↓
Guests are checked in through QR or contactless tools
        ↓
Moments, photos, videos, and memories continue after the event
```

Nuru is designed to support both formal and informal event workflows. A corporate conference and a family wedding do not behave the same way, so the platform must be flexible without becoming messy.

---

# Product Modules

The platform can be divided into the following modules:

1. Authentication and user accounts.
2. Event creation and discovery.
3. Digital invitations.
4. RSVP and guest management.
5. Contributions and pledges.
6. Ticketing and QR validation.
7. Vendor marketplace.
8. Vendor verification and trust.
9. Payments and transaction tracking.
10. Event groups and chats.
11. Social feed and moments.
12. Circles and communities.
13. Direct messaging.
14. Event meetings and calls.
15. AI assistant.
16. Photo and video libraries.
17. Push, SMS, WhatsApp, and in-app notifications.
18. Admin dashboard and moderation.
19. Reports and analytics.

---

# Technology Stack

Nuru is built as a modern full-stack product with web, mobile, backend, worker, and infrastructure layers.

## Backend

- **Python** for backend development.
- **FastAPI** for REST APIs.
- **SQLAlchemy** for ORM and database access.
- **PostgreSQL** as the primary database.
- **Supabase PostgreSQL** where managed database hosting is used.
- **Redis** for caching, queues, and worker support.
- **Celery** for background jobs and scheduled work.
- **Uvicorn** or **Gunicorn with Uvicorn workers** for serving the API.

## Web Frontend

- **React** for the web application.
- **Vite** for development and builds.
- **TypeScript** where applicable.
- **Tailwind CSS** and component-based UI.
- **Nginx** for serving production builds.

## Mobile App

- **Flutter** for Android and iOS.
- **Dart** for mobile application logic.
- Android release builds through Gradle.
- iOS builds through Xcode and CocoaPods.

## Infrastructure

- Ubuntu VPS.
- Nginx reverse proxy.
- Certbot and Let’s Encrypt SSL.
- systemd services.
- Redis server.
- PostgreSQL database.
- GitHub repositories and remotes.

## Integrations

Depending on the active environment, Nuru may integrate with:

- Firebase Cloud Messaging for push notifications.
- SEWMR SMS for SMS delivery.
- WhatsApp Cloud API for WhatsApp messages.
- Payment gateways and mobile money providers.
- LiveKit or similar tools for meetings and calls.
- Object storage for media files.

---

# Project Structure

The Nuru repository is a monorepo containing the backend API, web frontend, mobile app, deployment workflow, database migrations, documentation, public assets, and supporting configuration files.

The live production project root is:

```text
/var/www/nuru
```

The current repository contains approximately:

```text
104 directories
463 files
```

The tree below excludes heavy or generated folders such as `venv`, `node_modules`, `__pycache__`, `.git`, `dist`, `build`, `.next`, `.cache`, and compiled Python files.

```text
nuru/
├── .env
├── .github/
│   └── workflows/
│       └── deploy.yml
├── .gitignore
├── .gunicorn/
│   └── gunicorn.ctl
├── README.md
├── backend/
├── frontend/
├── lovable.toml
└── mobile/
    └── nuru/
```

## Root Level

```text
/var/www/nuru
```

Important root files and folders:

```text
.env                         Production environment variables. Must not be committed.
.github/workflows/deploy.yml GitHub Actions deployment workflow.
.gitignore                   Git ignored files and folders.
.gunicorn/gunicorn.ctl        Gunicorn control file.
README.md                    Main project documentation.
backend/                     FastAPI backend, database models, migrations, workers, services.
frontend/                    React and Vite web frontend.
lovable.toml                 Lovable project configuration.
mobile/nuru/                 Flutter mobile application.
```

The root `.env` is used by production services through systemd:

```text
EnvironmentFile=/var/www/nuru/.env
```

Keep this file private. It can contain database URLs, Redis credentials, messaging keys, Firebase credentials, payment settings, and other secrets.

---

## Backend Structure

The backend lives in:

```text
/var/www/nuru/backend
```

Important backend files and folders:

```text
backend/
├── alembic/
├── alembic.ini
├── all db indexes.csv
├── app/
├── database_meeting_documents.sql
└── database_meeting_enhancements.sql
```

### Backend Alembic Migrations

```text
backend/alembic/
├── env.py
├── script.py.mako
└── versions/
```

The `versions` folder contains the formal Alembic migration history. These migrations cover important database changes such as:

```text
baseline
performance indexes
escrow ledger
cancellation tiers
service delivery OTPs
contributions and reminder phone fields
payments phase 1
withdrawal requests
admin payment operations
received payment views
event groups
event group performance indexes
messaging performance indexes
event contributor share links
contact messages
offline payment claims
event messaging templates
gateway confirmed contribution backfills
ticket reservations
Nuru card pricing
messaging encryption and reply snapshots
call logs and device tokens
app version settings
event sponsors
event invitation templates
event invitation content
event invitation card templates
community verification and category fields
meeting passcodes
user interests
signup intent and role expansion
settings expansion
account deletion requests
moment media deleted fields
user service types
offline vendor payments
```

Use Alembic for structured database changes:

```bash
cd /var/www/nuru/backend/app
alembic upgrade head
```

If Alembic is executed from another directory, ensure `alembic.ini` and import paths are correctly resolved.

---

## Backend App Structure

The active backend application lives in:

```text
/var/www/nuru/backend/app
```

This is the same directory used by the production backend and Celery systemd services.

```text
backend/app/
├── DEPLOYMENT_REDIS_CELERY.md
├── SCALABILITY_GUIDE.md
├── __init__.py
├── api/
├── celerybeat-schedule
├── core/
├── gunicorn.conf.py
├── main.py
├── middleware/
├── migrations/
├── models/
├── requirements.txt
├── services/
├── tasks/
├── utils/
└── vercel.json
```

### Backend Entry Point

```text
backend/app/main.py
```

Production runs:

```text
main:app
```

through Gunicorn with Uvicorn workers.

### Backend API Routes

```text
backend/app/api/routes/
```

This folder contains the backend route modules used by the FastAPI application.

### Backend Core

```text
backend/app/core/
├── base.py
├── celery_app.py
├── config.py
├── database.py
├── redis.py
└── test_connection.py
```

Important core files:

```text
core/config.py       Application settings and environment configuration.
core/database.py     Database connection and session setup.
core/redis.py        Redis connection helpers.
core/celery_app.py   Celery worker and beat configuration.
```

The active Celery app is:

```text
core.celery_app
```

### Backend Middleware

```text
backend/app/middleware/
├── query_logger.py
├── rate_limit.py
├── security.py
└── slow_request_logger.py
```

Middleware supports security, rate limiting, query logging, and slow request visibility.

### Backend SQL Migration Helpers

```text
backend/app/migrations/
├── performance_indexes.sql
├── performance_indexes_v2.sql
├── 2026_04_19_my_contributions_and_reminder_phone.sql
├── 2026_04_20_event_contributors_share_links.sql
├── 2026_04_22_event_messaging_templates.sql
├── 2026_04_23_event_contributor_secondary_phone.sql
├── 2026_04_24_normalize_secondary_phone.sql
├── 2026_05_10_community_verified_and_tagline.sql
└── 2026_05_13_moment_media_deleted.sql
```

These are SQL migration or helper scripts. Do not run them blindly in production if the same change already exists in Alembic.

### Backend Models

```text
backend/app/models/
```

The models folder contains SQLAlchemy models for the main Nuru domains, including:

```text
account_deletion.py
admin.py
admin_payment_logs.py
agreements.py
app_version.py
appeals.py
bookings.py
calls.py
card_templates.py
committees.py
communities.py
contact.py
contributions.py
enums.py
escrow.py
event_groups.py
event_invitation_card_template.py
event_messaging_templates.py
event_schedule.py
event_services.py
event_sponsors.py
events.py
expenses.py
feed_ranking.py
feeds.py
invitations.py
issues.py
meeting_documents.py
meetings.py
messaging.py
moments.py
notifications.py
nuru_cards.py
offline_payments.py
page_views.py
payments.py
photo_libraries.py
promotions.py
references.py
service_delivery_otps.py
services.py
support.py
templates.py
ticket_offline_claims.py
ticketing.py
uploads.py
users.py
whatsapp.py
withdrawal_requests.py
```

Important note for imports:

```text
Payments models live in: models/payments.py
Ticket models live in: models/ticketing.py
```

Do not use stale imports such as:

```python
from models.transactions import Transaction
from models.tickets import EventTicket
```

Use:

```python
from models.payments import Transaction, MobilePaymentAttempt
from models.ticketing import EventTicket
```

### Backend Services

```text
backend/app/services/
```

Service modules include business logic for SMS, reports, cancellation, commission, delivery OTPs, escrow, feed ranking, payment gateway, share links, transactions, and wallet operations.

Key files include:

```text
SewmrSmsClient.py
admin_reports.py
cancellation_service.py
commission_service.py
delivery_otp_service.py
escrow_service.py
feed_ranking.py
payment_gateway.py
payment_gateway_old.py
share_links.py
transaction_service.py
wallet_service.py
```

### Backend Tasks

```text
backend/app/tasks/
├── content_cleanup.py
├── maintenance.py
├── notifications.py
├── payments_verify.py
├── quality_scores.py
└── sms_dispatch.py
```

These are Celery task modules. The active Celery service loads them through:

```text
core.celery_app
```

### Backend Utilities

```text
backend/app/utils/
```

Utility modules include authentication, batch loading, Firebase push notification support, helper functions, notification services, SMS helpers, WhatsApp helpers, OTP routing, offline claims, validation, and user payload helpers.

Key files include:

```text
auth.py
batch_loaders.py
fcm.py
helpers.py
name_validation.py
notification_service.py
notification_titles.py
notify.py
notify_channels.py
offline_claims.py
otp_router.py
sms.py
sms_batch.py
user_payload.py
validation_functions.py
whatsapp.py
whatsapp_check.py
```

---

## Frontend Structure

The web frontend lives in:

```text
/var/www/nuru/frontend
```

Important frontend files and folders:

```text
frontend/
├── .env
├── CHANGELOG-2026-02-10.md
├── NURU_BRAND_AND_MARKETING_BRIEF.md
├── README.md
├── components.json
├── database.sql
├── docs/
├── index.html
├── lovable.toml
├── nuru-api-doc.md
├── package.json
├── package-lock.json
├── postcss.config.js
├── public/
├── src/
├── supabase/
├── tailwind.config.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vercel.json
└── vite.config.ts
```

The production frontend build is served from:

```text
/var/www/nuru/frontend/dist
```

This `dist` folder is generated by the build process and is intentionally excluded from the tree output.

### Frontend Public Folder

```text
frontend/public/
```

Important public assets and documents include:

```text
.well-known/apple-app-site-association
.well-known/assetlinks.json
docs/cancellation-policy.md
docs/nuru-marketing-guide.md
docs/organiser-agreement.md
docs/payment-system-guide.md
docs/privacy-policy.md
docs/terms-and-conditions.md
docs/vendor-agreement.md
event-default.png
favicon.ico
google9c89d49175b9b5d9.html
ke.xml
logo-meta-1024.png
logo.png
nuru-logo.png
placeholder.svg
sitemap.xml
tz.xml
uploads/
```

Notes:

- `.well-known/apple-app-site-association` supports iOS universal links.
- `.well-known/assetlinks.json` supports Android app links.
- `sitemap.xml`, `tz.xml`, and `ke.xml` support search indexing and multi-domain SEO work.
- `public/docs` contains user-facing legal and product policy documents.

### Frontend Source Folder

```text
frontend/src/
```

Main frontend files:

```text
App.tsx
AppRoutes.tsx
main.tsx
index.css
```

Important source folders:

```text
api/
assets/
components/
data/
features/
hooks/
integrations/
lib/
pages/
utils/
```

### Frontend Components

```text
frontend/src/components/
```

The components folder contains major Nuru web features such as:

```text
CreateEvent.tsx
EventManagement.tsx
EventRSVP.tsx
EventTicketPurchase.tsx
EventTicketing.tsx
EventView.tsx
Feed.tsx
FindServices.tsx
InvitationCard.tsx
LiveChat.tsx
Messages.tsx
MyContributors.tsx
MyEvents.tsx
MyTickets.tsx
Notifications.tsx
NuruCards.tsx
NuruChatbot.tsx
PhotoLibraryDetail.tsx
PledgeDialog.tsx
ProviderChat.tsx
ServiceVerification.tsx
Settings.tsx
SettingsPayments.tsx
Wallet.tsx
```

It also contains grouped component modules for:

```text
admin/
bookings/
contributions/
contributors/
eventGroups/
events/
features/
icons/
invitation-cards/
landing/
layout/
migration/
payments/
region/
tickets/
ui/
```

### Frontend Pages

```text
frontend/src/pages/
```

Key page-level routes include:

```text
CancellationPolicy.tsx
ChangePassword.tsx
Contact.tsx
CookiePolicy.tsx
DataDeletion.tsx
EventGroupWorkspace.tsx
FAQs.tsx
GuestGroupJoin.tsx
GuestPost.tsx
Index.tsx
Login.tsx
MeetingRoom.tsx
MyContributions.tsx
NotFound.tsx
OrganiserAgreement.tsx
PrivacyPolicy.tsx
PublicContribute.tsx
PublicContributionReceipt.tsx
RSVPConfirmation.tsx
Register.tsx
ResetPassword.tsx
SharedReceiptPage.tsx
ShortLinkRedirect.tsx
Terms.tsx
TicketVerification.tsx
VendorAgreement.tsx
VerifyEmail.tsx
VerifyPhone.tsx
```

### Frontend Hooks, Data, and Utilities

Important frontend support areas:

```text
frontend/src/data/       Data fetching hooks and domain data helpers.
frontend/src/hooks/      Reusable React hooks.
frontend/src/lib/        API clients, region helpers, validators, maps, i18n, utilities.
frontend/src/utils/      Formatting, reports, PDFs, receipts, downloads, short IDs.
```

Examples include:

```text
useEvents.ts
useBookings.ts
useContributors.ts
useMyContributions.ts
useNuruCards.ts
useSettings.ts
useSocial.ts
useCurrentUser.ts
useEventPermissions.ts
useGlobalSearch.ts
useRegionDetect.ts
api.ts
generateEventReport.ts
generatePdf.ts
printPaymentReceipt.ts
formatPrice.ts
shortId.ts
```

### Frontend Supabase Folder

```text
frontend/supabase/
```

This folder contains Supabase configuration, functions, and migrations.

```text
config.toml
functions/
migrations/
```

Supabase Edge Functions include:

```text
nuru-chat
og-meta
public-trending
send-otp
verify-otp-code
whatsapp-send
whatsapp-webhook
```

These functions support chat, Open Graph metadata, public trending content, OTP flows, WhatsApp sending, and WhatsApp webhook handling.

---

## Mobile App Structure

The Flutter mobile app lives in:

```text
/var/www/nuru/mobile/nuru
```

Important mobile files and folders:

```text
mobile/nuru/
├── .gitignore
├── .metadata
├── README.md
├── analysis_options.yaml
├── android/
├── assets/
├── docs/
├── ios/
├── lib/
├── pubspec.lock
├── pubspec.yaml
├── test/
└── web/
```

### Android

```text
mobile/nuru/android/
├── app/
├── build.gradle.kts
├── gradle/
├── gradle.properties
└── settings.gradle.kts
```

Android release builds are generated through Flutter and Gradle.

Important security note:

```text
Do not commit key.properties, signing keys, keystores, or Play Store credentials.
```

### iOS

```text
mobile/nuru/ios/
├── Flutter/
├── Runner/
├── Runner.xcodeproj/
├── Runner.xcworkspace/
└── RunnerTests/
```

iOS builds require Xcode signing configuration and CocoaPods support.

### Mobile Assets

```text
mobile/nuru/assets/
├── audio/
├── fonts/
├── icons/
├── illustrations/
└── images/
```

These contain app audio, fonts, icons, illustrations, and image assets.

### Mobile Documentation

```text
mobile/nuru/docs/
├── PUSH_NOTIFICATIONS.md
├── google-play.md
├── web-routing-audit.md
├── web-vs-mobile-audit.md
└── web-vs-mobile-comprehensive-audit.md
```

These documents are useful for push notifications, Play Store preparation, routing parity, and web-versus-mobile feature audits.

### Mobile Source

```text
mobile/nuru/lib/
├── core/
├── features/
├── main.dart
├── providers/
├── screens/
└── widgets/
```

The mobile app follows a feature-oriented Flutter structure with shared core logic, providers, screens, and reusable widgets.

---

## Files That Must Stay Out of Git

The tree shows several files and folders that are useful locally or in production but should not be committed unless there is a clear reason.

Keep private or generated:

```text
.env
frontend/.env
.gunicorn/
venv/
node_modules/
__pycache__/
*.pyc
dist/
build/
.next/
.cache/
mobile/nuru/android/key.properties
keystores
Firebase service account JSON files
private certificates
production logs
```

If any sensitive file is already tracked, remove it from Git tracking without deleting the local file:

```bash
git rm --cached path/to/file
```

Then commit the `.gitignore` update.

---

## Quick Structure Summary

| Area               | Path                                        | Purpose                                          |
| ------------------ | ------------------------------------------- | ------------------------------------------------ |
| Root               | `/var/www/nuru`                             | Main monorepo root                               |
| Backend            | `/var/www/nuru/backend/app`                 | FastAPI app, models, services, tasks, utilities  |
| Alembic            | `/var/www/nuru/backend/alembic`             | Database migration history                       |
| Frontend           | `/var/www/nuru/frontend`                    | React and Vite web app                           |
| Frontend build     | `/var/www/nuru/frontend/dist`               | Production static build served by Nginx          |
| Mobile             | `/var/www/nuru/mobile/nuru`                 | Flutter Android and iOS app                      |
| Supabase functions | `/var/www/nuru/frontend/supabase/functions` | Edge functions for OTP, WhatsApp, chat, metadata |
| Backend tasks      | `/var/www/nuru/backend/app/tasks`           | Celery background tasks                          |
| Backend services   | `/var/www/nuru/backend/app/services`        | Business logic services                          |
| Backend utilities  | `/var/www/nuru/backend/app/utils`           | Auth, FCM, SMS, WhatsApp, validation helpers     |
| Public docs        | `/var/www/nuru/frontend/public/docs`        | Legal and user-facing policy documents           |

---

# Local Development

Before running the project locally, install the required tools.

## Required Tools

### Backend

- Python 3.11 or newer.
- PostgreSQL.
- Redis.
- pip.
- virtualenv or venv.

### Frontend

- Node.js 18 or newer.
- npm, pnpm, or yarn.

### Mobile

- Flutter SDK.
- Dart SDK.
- Android Studio.
- Android SDK platform tools.
- Xcode for iOS builds.
- CocoaPods for iOS dependencies.

---

# Backend Setup

Move into the backend directory:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it.

Linux or macOS:

```bash
source venv/bin/activate
```

Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create your environment file:

```bash
cp .env.example .env
```

Update `.env` with your local database, Redis, secret keys, and service credentials.

Run migrations if Alembic is configured:

```bash
alembic upgrade head
```

Start the API server:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The backend should be available at:

```text
http://localhost:8000
```

API documentation should be available at:

```text
http://localhost:8000/docs
```

---

# Frontend Setup

From the web project root:

```bash
npm install
```

Create the environment file if needed:

```bash
cp .env.example .env
```

Example:

```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_APP_NAME=Nuru
```

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

---

# Mobile App Setup

Move into the Flutter app:

```bash
cd mobile/nuru
```

Install dependencies:

```bash
flutter pub get
```

Check connected devices:

```bash
flutter devices
```

Run the app:

```bash
flutter run
```

Run on a specific device:

```bash
flutter run -d DEVICE_ID
```

Build Android APK:

```bash
flutter build apk --release
```

Build Android App Bundle:

```bash
flutter build appbundle --release
```

Build iOS:

```bash
flutter build ios --release
```

For iOS, open the project in Xcode and configure signing before release builds.

---

# Background Workers

Nuru uses Redis and Celery for background tasks.

Background work may include:

- Sending notifications.
- Sending SMS messages.
- Processing scheduled reminders.
- Cleaning expired tokens.
- Running analytics tasks.
- Handling non-blocking payment or messaging operations.

Start Redis:

```bash
redis-server
```

Start Celery worker:

```bash
celery -A app.tasks.celery_app worker --loglevel=info
```

Start Celery beat if scheduled jobs are enabled:

```bash
celery -A app.tasks.celery_app beat --loglevel=info
```

In production, use systemd instead of running workers manually.

---

# Notifications and Messaging

Nuru supports multiple communication channels.

## Push Notifications

Push notifications are sent through Firebase Cloud Messaging.

Recommended behavior:

- Store one token per active device installation.
- Link tokens to authenticated users.
- Remove or deactivate tokens during logout.
- Never send notifications to devices where the user already signed out.
- Clean invalid tokens after FCM failures.
- Keep notification sending non-blocking.

Example configuration:

```env
FCM_SERVICE_ACCOUNT_FILE=/absolute/path/to/firebase.json
```

Or:

```env
FCM_SERVICE_ACCOUNT_JSON={...}
```

## SMS

SMS can be used for:

- OTP verification.
- Event reminders.
- Contribution reminders.
- Ticket confirmations.
- Organizer alerts.
- Guest communication.

Nuru may use SEWMR SMS for SMS delivery.

## WhatsApp

WhatsApp can be used for:

- Approved template messages.
- Meeting invitations.
- Event reminders.
- Guest updates.
- Follow-up communication inside Meta’s allowed messaging window.

Template variables must match approved WhatsApp template formats exactly.

---

# Production Deployment

This section documents the current Nuru VPS production setup. It is based on the actual server configuration and should be treated as the reference for how the live system is currently wired.

Nuru is currently deployed using:

```text
Ubuntu VPS
Nginx
Gunicorn with Uvicorn workers
Unix socket backend binding
FastAPI backend
React frontend build served by Nginx
Redis with authentication
Celery worker with Celery Beat
systemd services
Let’s Encrypt SSL
```

The live setup does **not** use Docker, PM2, or Supervisor. The production process manager is **systemd**.

---

# Production Server Identity

```text
Host: vmi3232947
Project root: /var/www/nuru
Backend app path: /var/www/nuru/backend/app
Frontend build path: /var/www/nuru/frontend/dist
Backend virtual environment: /var/www/nuru/backend/venv
Environment file: /var/www/nuru/.env
Runtime user: www-data
Runtime group: www-data
Gunicorn socket: /run/nuru/nuru.sock
Celery schedule file: /var/www/nuru/celerybeat-schedule
```

The backend and Celery services both run from:

```text
/var/www/nuru/backend/app
```

This is important. The running backend is not launched from only `/var/www/nuru/backend`; it is launched from the actual app directory.

---

# Nginx Configuration

Nginx is the public entry point for both the API and the frontend web application.

## Nginx Status

```text
Service: nginx.service
Status: active running
Enabled: yes
Ports: 80 and 443
Enabled site: /etc/nginx/sites-enabled/nuru
Source site: /etc/nginx/sites-available/nuru
```

The Nginx configuration test is clean when this succeeds:

```bash
sudo nginx -t
```

Expected result:

```text
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

## Current Nginx Site File

```text
/etc/nginx/sites-available/nuru
/etc/nginx/sites-enabled/nuru
```

## Current Nginx Site Configuration

```nginx
upstream nuru_backend {
    server unix:/run/nuru/nuru.sock;
}

server {
    listen 80;
    server_name nuruapi.nuru.tz app.nuru.tz;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name nuruapi.nuru.tz;

    ssl_certificate /etc/letsencrypt/live/nuruapi.nuru.tz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nuruapi.nuru.tz/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://nuru_backend;

        proxy_http_version 1.1;
        proxy_set_header Connection "";

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_redirect http:// https://;

        proxy_connect_timeout 10;
        proxy_read_timeout 120;
    }
}

server {
    listen 443 ssl http2;
    server_name app.nuru.tz;

    ssl_certificate /etc/letsencrypt/live/nuruapi.nuru.tz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nuruapi.nuru.tz/privkey.pem;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    root /var/www/nuru/frontend/dist;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}
```

## What This Means

The API domain is:

```text
nuruapi.nuru.tz
```

The frontend app domain is:

```text
app.nuru.tz
```

Nginx does not proxy to `127.0.0.1:8000`. It proxies to the Gunicorn Unix socket:

```text
/run/nuru/nuru.sock
```

This is a good production setup because the backend is not publicly exposed on port `8000`.

## Reload Nginx Safely

Always test before reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

# SSL Configuration and Renewal

Nuru uses a Let’s Encrypt SSL certificate for both the API and frontend domains.

## Active SSL Certificate

There is one active certificate:

```text
Certificate Name: nuruapi.nuru.tz
Key Type: ECDSA
Domains:
  nuruapi.nuru.tz
  app.nuru.tz
Expiry Date:
  2026-07-13 21:32:07 UTC
Validity left at time of check:
  60 days
Certificate:
  /etc/letsencrypt/live/nuruapi.nuru.tz/fullchain.pem
Private key:
  /etc/letsencrypt/live/nuruapi.nuru.tz/privkey.pem
```

The same certificate is valid for both:

```text
nuruapi.nuru.tz
app.nuru.tz
```

No separate certificate is needed for `app.nuru.tz` as long as the certificate continues to include both domains.

## Nginx SSL Usage

Both the API and frontend server blocks reference the same certificate path.

### API SSL Block

```nginx
server {
    listen 443 ssl http2;
    server_name nuruapi.nuru.tz;

    ssl_certificate /etc/letsencrypt/live/nuruapi.nuru.tz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nuruapi.nuru.tz/privkey.pem;
}
```

### Frontend SSL Block

```nginx
server {
    listen 443 ssl http2;
    server_name app.nuru.tz;

    ssl_certificate /etc/letsencrypt/live/nuruapi.nuru.tz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nuruapi.nuru.tz/privkey.pem;
}
```

This is valid because the certificate includes both domains.

## SSL Renewal Method

Certbot is installed through **Snap**, not through the normal apt `certbot.timer`.

Active renewal timer:

```text
snap.certbot.renew.timer
```

The normal `certbot.timer` is not found, and that is expected in this setup.

Current renewal timer status at the time of check:

```text
Timer: snap.certbot.renew.timer
Status: active waiting
Enabled: yes
Next run: Fri 2026-05-15 06:23:00 CEST
Last run: Thu 2026-05-14 12:52:03 CEST
Service triggered: snap.certbot.renew.service
```

The renewal timer file is:

```text
/etc/systemd/system/snap.certbot.renew.timer
```

This means SSL renewal is already automated through Snap Certbot and systemd.

## Certbot Renewal Config

Renewal configuration file:

```text
/etc/letsencrypt/renewal/nuruapi.nuru.tz.conf
```

Important values:

```text
authenticator = webroot
webroot_path = /var/www/certbot,
server = https://acme-v02.api.letsencrypt.org/directory
```

Certbot renews the certificate using the webroot challenge path:

```text
/var/www/certbot
```

Nginx supports this path through:

```nginx
location ^~ /.well-known/acme-challenge/ {
    root /var/www/certbot;
}
```

That means ACME challenge files can be served correctly during renewal.

## SSL Renewal Dry Run

The renewal dry run succeeded:

```text
Congratulations, all simulated renewals succeeded:
  /etc/letsencrypt/live/nuruapi.nuru.tz/fullchain.pem (success)
```

This confirms that certificate renewal is working.

## Renewal Hooks

The Certbot renewal hooks folder was empty at the time of check:

```text
/etc/letsencrypt/renewal-hooks
```

That means there is currently no custom deploy hook to reload Nginx after successful renewal.

Snap Certbot can handle renewal, but it is safer to add a deploy hook that reloads Nginx after the certificate is renewed.

## Recommended Nginx Reload Hook

Create a deploy hook:

```bash
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh > /dev/null <<'EOF'
#!/bin/sh
systemctl reload nginx
EOF
```

Make it executable:

```bash
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Test renewal again:

```bash
sudo certbot renew --dry-run
```

Confirm Nginx is healthy:

```bash
sudo nginx -t
sudo systemctl status nginx --no-pager
```

This is not urgent because renewal is already working, but it is good production cleanup.

## SSL Commands to Keep

```bash
sudo certbot certificates
sudo certbot renew --dry-run
systemctl list-timers --all | grep -i certbot
sudo systemctl status snap.certbot.renew.timer --no-pager
sudo nginx -t
sudo systemctl reload nginx
```

---

# Cron Jobs and Scheduled System Tasks

Cron is installed and running, but Nuru is not currently managed by cron.

Nuru uses:

```text
systemd for services
Celery Beat for scheduled application tasks
Snap Certbot timer for SSL renewal
```

not custom Nuru cron jobs.

## Cron Service Status

```text
Service: cron.service
Status: active running
Enabled: yes
```

There is no `crond.service`, which is normal on Ubuntu and Debian based systems.

## User Crontabs

No custom user crontabs were found:

```text
root crontab: none
current user crontab: none
www-data crontab: none
```

That means there are no Nuru jobs running from root, the current user, or `www-data` crontab.

## System Crontab

The system crontab contains only default system jobs:

```cron
17 *    * * *   root    cd / && run-parts --report /etc/cron.hourly
25 6    * * *   root    test -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.daily; }
47 6    * * 7   root    test -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.weekly; }
52 6    1 * *   root    test -x /usr/sbin/anacron || { cd / && run-parts --report /etc/cron.monthly; }
```

No Nuru job is configured there.

## `/etc/cron.d` Files

Cron files found:

```text
/etc/cron.d/.placeholder
/etc/cron.d/e2scrub_all
/etc/cron.d/staticroute
/etc/cron.d/sysstat
```

### staticroute

```cron
@reboot root ip route replace $(ip route list dev eth0 scope link | head -n1 | awk '{ print $1 }') via $(ip route list dev eth0 | awk '/default/{ print $3 }') dev eth0 &>/dev/null
```

This runs at reboot to restore network route behavior. Leave it unless it is proven to cause network issues.

### e2scrub_all

```cron
30 3 * * 0 root test -e /run/systemd/system || SERVICE_MODE=1 /usr/lib/x86_64-linux-gnu/e2fsprogs/e2scrub_all_cron
10 3 * * * root test -e /run/systemd/system || SERVICE_MODE=1 /sbin/e2scrub_all -A -r
```

This is filesystem maintenance. It skips when systemd is active.

### sysstat

```cron
5-55/10 * * * * root command -v debian-sa1 > /dev/null && debian-sa1 1 1
59 23 * * * root command -v debian-sa1 > /dev/null && debian-sa1 60 2
```

This collects system performance statistics.

## Hourly Cron Jobs

Hourly cron scripts found:

```text
/etc/cron.hourly/free
/etc/cron.hourly/fstrim
```

### fstrim

```bash
#!/bin/sh
fstrim /
```

This trims unused disk blocks. It is generally fine.

### free

```bash
#!/bin/sh
echo 1 > /proc/sys/vm/drop_caches
```

This clears Linux filesystem page cache every hour.

This is not usually recommended unless it was intentionally added for a known memory pressure issue. Linux uses free memory as cache by design. Dropping cache every hour can reduce performance because the server keeps throwing away useful cached files.

Recommended action:

```bash
sudo mv /etc/cron.hourly/free /root/cron.hourly.free.disabled
```

Then monitor memory normally:

```bash
free -h
vmstat 1 10
```

If cache cleanup is ever needed, run it manually during a real emergency instead of hourly.

## Daily Cron Jobs

Daily jobs found:

```text
apport
apt-compat
dpkg
logrotate
man-db
sysstat
```

These are normal system maintenance jobs. Nothing Nuru-specific was found.

## Weekly Cron Jobs

```text
man-db
```

This is normal system maintenance.

## Monthly Cron Jobs

Only the placeholder was found. No active monthly custom job was found.

## Cron Logs

Recent cron logs show:

```text
debian-sa1
run-parts /etc/cron.hourly
```

This matches the `sysstat` and hourly jobs. No Nuru cron execution was seen.

## Cron Commands to Keep

```bash
sudo crontab -l
crontab -l
sudo crontab -u www-data -l
sudo cat /etc/crontab
sudo ls -lah /etc/cron.d/
sudo ls -lah /etc/cron.hourly/
sudo ls -lah /etc/cron.daily/
sudo ls -lah /etc/cron.weekly/
sudo ls -lah /etc/cron.monthly/
sudo journalctl -u cron -n 80 --no-pager
```

## Final Cron Diagnosis

| Area                 | Status              | Notes                                    |
| -------------------- | ------------------- | ---------------------------------------- |
| Cron service         | Running             | Normal                                   |
| Root crontab         | Empty               | No custom root cron                      |
| Current user crontab | Empty               | No custom user cron                      |
| www-data crontab     | Empty               | No Nuru cron                             |
| `/etc/crontab`       | Default only        | No Nuru job                              |
| `/etc/cron.d`        | System jobs only    | `staticroute`, `e2scrub_all`, `sysstat`  |
| Hourly jobs          | `free`, `fstrim`    | Consider disabling `free` cache clearing |
| Daily jobs           | Default system jobs | Nothing Nuru-specific                    |
| Weekly jobs          | Default system job  | Nothing Nuru-specific                    |
| Monthly jobs         | Placeholder only    | Nothing custom                           |
| Nuru cron            | None found          | Nuru uses systemd and Celery Beat        |
| Certbot cron         | None needed         | SSL renewal uses Snap Certbot timer      |

---

# Backend Systemd Service

The backend runs through systemd using Gunicorn and Uvicorn workers.

## Service File

```text
/etc/systemd/system/nuru-backend.service
```

## Current Backend Service Configuration

```ini
[Unit]
Description=Nuru Backend
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/nuru/backend/app
Environment="PATH=/var/www/nuru/backend/venv/bin"
Environment="HOME=/var/www/nuru"
EnvironmentFile=/var/www/nuru/.env
RuntimeDirectory=nuru
RuntimeDirectoryMode=775
UMask=0007
ExecStart=/var/www/nuru/backend/venv/bin/gunicorn main:app -k uvicorn.workers.UvicornWorker --bind unix:/run/nuru/nuru.sock --workers 4 --forwarded-allow-ips="*" --timeout 120 --keep-alive 5 --max-requests 1000 --max-requests-jitter 100 --worker-tmp-dir /dev/shm
Restart=always
RestartSec=2
TimeoutStartSec=30

[Install]
WantedBy=multi-user.target
```

## Backend Runtime Summary

```text
Service: nuru-backend.service
Status: active running
Server: Gunicorn
Worker class: uvicorn.workers.UvicornWorker
Workers: 4
Socket: /run/nuru/nuru.sock
User: www-data
Group: www-data
Working directory: /var/www/nuru/backend/app
Environment file: /var/www/nuru/.env
```

## Backend Runtime Command

```bash
/var/www/nuru/backend/venv/bin/gunicorn main:app -k uvicorn.workers.UvicornWorker --bind unix:/run/nuru/nuru.sock --workers 4 --forwarded-allow-ips="*" --timeout 120 --keep-alive 5 --max-requests 1000 --max-requests-jitter 100 --worker-tmp-dir /dev/shm
```

## Backend Management Commands

```bash
sudo systemctl daemon-reload
sudo systemctl enable nuru-backend
sudo systemctl restart nuru-backend
sudo systemctl status nuru-backend -l --no-pager
sudo journalctl -u nuru-backend -n 120 -l --no-pager
```

Live backend logs:

```bash
sudo journalctl -u nuru-backend -f -l
```

---

# Celery Systemd Service

Nuru uses Celery for background jobs and Celery Beat for scheduled jobs.

## Service File

```text
/etc/systemd/system/nuru-celery.service
```

## Current Celery Service Configuration

```ini
[Unit]
Description=Nuru Celery Worker + Beat
After=network.target redis-server.service
Requires=redis-server.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/nuru/backend/app
Environment="PATH=/var/www/nuru/backend/venv/bin"
Environment="HOME=/var/www/nuru"
Environment="PYTHONPATH=/var/www/nuru/backend/app"
EnvironmentFile=/var/www/nuru/.env
ExecStart=/var/www/nuru/backend/venv/bin/celery -A core.celery_app worker --beat --loglevel=info --concurrency=2 --schedule=/var/www/nuru/celerybeat-schedule
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Celery Runtime Summary

```text
Service: nuru-celery.service
Status: active running
Worker app: core.celery_app
Working directory: /var/www/nuru/backend/app
Concurrency: 2
Beat: enabled
Schedule file: /var/www/nuru/celerybeat-schedule
```

## Celery Runtime Command

```bash
/var/www/nuru/backend/venv/bin/celery -A core.celery_app worker --beat --loglevel=info --concurrency=2 --schedule=/var/www/nuru/celerybeat-schedule
```

This means the same service runs both:

```text
Celery worker
Celery Beat scheduler
```

For larger production traffic, this can later be split into two services:

```text
nuru-celery-worker.service
nuru-celery-beat.service
```

The current setup is valid.

## Celery Project Files

```text
/var/www/nuru/backend/app/core/celery_app.py
/var/www/nuru/backend/app/celerybeat-schedule
/var/www/nuru/backend/app/tasks/payments_verify.py
/var/www/nuru/backend/app/tasks/sms_dispatch.py
/var/www/nuru/backend/app/tasks/maintenance.py
/var/www/nuru/backend/app/tasks/notifications.py
/var/www/nuru/backend/app/tasks/quality_scores.py
/var/www/nuru/backend/app/tasks/content_cleanup.py
```

Active Celery app:

```text
/var/www/nuru/backend/app/core/celery_app.py
```

## Celery Management Commands

```bash
sudo systemctl daemon-reload
sudo systemctl enable nuru-celery
sudo systemctl restart nuru-celery
sudo systemctl status nuru-celery -l --no-pager
sudo journalctl -u nuru-celery -n 150 -l --no-pager
```

Live Celery logs:

```bash
sudo journalctl -u nuru-celery -f -l
```

Inspect active workers:

```bash
cd /var/www/nuru/backend/app
/var/www/nuru/backend/venv/bin/celery -A core.celery_app inspect active
/var/www/nuru/backend/venv/bin/celery -A core.celery_app inspect registered
/var/www/nuru/backend/venv/bin/celery -A core.celery_app inspect scheduled
```

---

# Celery Task Modules

Confirmed task modules include:

```text
tasks.payments_verify
tasks.sms_dispatch
tasks.maintenance
tasks.notifications
tasks.quality_scores
tasks.content_cleanup
```

A previous import issue was found in:

```text
/var/www/nuru/backend/app/tasks/payments_verify.py
```

The stale imports were:

```python
from models.transactions import Transaction, MobilePaymentAttempt
from models.tickets import EventTicket
```

They were corrected to:

```python
from models.payments import Transaction, MobilePaymentAttempt
from models.ticketing import EventTicket
```

The real model files are:

```text
models/payments.py
models/ticketing.py
```

---

# Redis Configuration

Redis is used by Nuru for background jobs, queues, and related worker operations.

## Redis Status

```text
Service: redis-server.service
Status: active running
Enabled: yes
Bind: 127.0.0.1
Port: 6379
```

## Redis Config File

```text
/etc/redis/redis.conf
```

## Confirmed Redis Values

```text
bind 127.0.0.1
port 6379
supervised systemd
logfile /var/log/redis/redis-server.log
dir /var/lib/redis
appendonly yes
requirepass [REDACTED]
```

## Redis Environment Variable

The `.env` file contains:

```text
REDIS_URL='redis://:[REDACTED]@localhost:6379/0'
```

The actual Redis password must stay private and must not be committed to Git.

## Redis Authentication Note

Plain Redis ping may return:

```text
NOAUTH Authentication required
```

That is expected because Redis has a password enabled.

Use one of these instead:

```bash
redis-cli -a 'YOUR_REDIS_PASSWORD' ping
```

Or:

```bash
redis-cli -u "$REDIS_URL" ping
```

Expected result:

```text
PONG
```

## Redis Management Commands

```bash
sudo systemctl enable redis-server
sudo systemctl restart redis-server
sudo systemctl status redis-server -l --no-pager
sudo journalctl -u redis-server -n 100 -l --no-pager
```

Live Redis logs:

```bash
sudo journalctl -u redis-server -f -l
```

---

# Active Ports

Confirmed listening ports:

```text
127.0.0.1:6379  Redis
0.0.0.0:80      Nginx HTTP
0.0.0.0:443     Nginx HTTPS
```

The backend is not exposed publicly on port `8000`. It runs behind a Unix socket:

```text
/run/nuru/nuru.sock
```

Check ports anytime:

```bash
sudo ss -tulpn
sudo ss -tulpn | grep -E "80|443|6379|8000|nginx|redis|gunicorn|uvicorn"
```

---

# Running Processes

Expected production processes:

```text
nginx master process
nginx worker processes
redis-server 127.0.0.1:6379
gunicorn master process
gunicorn worker processes
celery main process
celery worker or beat child processes
```

Clean process check:

```bash
ps auxww | grep -Ei "nginx|redis|gunicorn|uvicorn|celery" | grep -v grep
```

Avoid broad checks like this:

```bash
ps auxww | grep -Ei "worker"
```

That command also catches Linux kernel workers such as `kworker`, which makes the output noisy.

---

# Process Managers Not Used

The production checks confirm:

```text
Supervisor not found
PM2 not found
Docker not found or not running
```

So the current Nuru deployment is managed by:

```text
systemd
```

not by Docker, PM2, or Supervisor.

---

# Enabled Services

Main enabled services:

```text
nginx
redis-server
nuru-backend
nuru-celery
```

Enable all important services after server setup or recovery:

```bash
sudo systemctl enable nginx
sudo systemctl enable redis-server
sudo systemctl enable nuru-backend
sudo systemctl enable nuru-celery
```

Restart all main services:

```bash
sudo systemctl restart redis-server
sudo systemctl restart nuru-backend
sudo systemctl restart nuru-celery
sudo nginx -t && sudo systemctl reload nginx
```

Check all main services:

```bash
sudo systemctl status nginx redis-server nuru-backend nuru-celery -l --no-pager
```

---

# Cron and Scheduled Jobs

Cron entries were not fully visible in the shared server output. Because of that, this README does not claim which cron jobs currently exist.

Use the following command to inspect cron configuration:

```bash
sudo crontab -l 2>/dev/null || true
crontab -l 2>/dev/null || true
sudo crontab -u www-data -l 2>/dev/null || true
sudo ls -lah /etc/cron.d/
sudo grep -RIn "nuru\|certbot\|celery\|redis\|backend\|deploy\|renew" /etc/cron.d /etc/crontab /etc/cron.hourly /etc/cron.daily /etc/cron.weekly /etc/cron.monthly 2>/dev/null || true
```

If a cron file is disabled and needs to be reactivated:

```bash
sudo chmod 644 /etc/cron.d/YOUR_CRON_FILE
sudo chown root:root /etc/cron.d/YOUR_CRON_FILE
sudo systemctl restart cron
sudo systemctl status cron --no-pager
```

On some systems the service name may be `crond`:

```bash
systemctl list-unit-files | grep -Ei "^cron|crond"
```

## Cron Warning

Nuru already uses Celery Beat for scheduled jobs. Do not duplicate the same scheduled task in both Cron and Celery Beat unless there is a deliberate reason.

Two schedulers running the same task is how a server starts behaving like it had too much coffee.

---

# Certbot Renewal Reactivation

Check Certbot timer:

```bash
systemctl list-timers | grep -i certbot
sudo systemctl status certbot.timer --no-pager
```

Enable and start the timer:

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

Test renewal:

```bash
sudo certbot renew --dry-run
```

Reload Nginx after renewal:

```bash
sudo systemctl reload nginx
```

If using cron instead of systemd timer, a safe Certbot cron example is:

```cron
0 */12 * * * root test -x /usr/bin/certbot && certbot -q renew --deploy-hook "systemctl reload nginx"
```

If the Certbot timer is already active, do not add duplicate cron renewal unless you know exactly why.

---

# Deployment Paths

Confirmed live paths:

```text
Project root: /var/www/nuru
Backend app: /var/www/nuru/backend/app
Backend virtualenv: /var/www/nuru/backend/venv
Frontend build: /var/www/nuru/frontend/dist
Environment file: /var/www/nuru/.env
Gunicorn socket: /run/nuru/nuru.sock
Celery schedule file: /var/www/nuru/celerybeat-schedule
```

---

# Deployment Flow

A practical production deployment flow should look like this:

```bash
cd /var/www/nuru

git pull origin master

cd backend
source venv/bin/activate
pip install -r requirements.txt

cd /var/www/nuru/backend/app
alembic upgrade head

cd /var/www/nuru
npm install
npm run build

sudo systemctl restart nuru-backend
sudo systemctl restart nuru-celery
sudo nginx -t && sudo systemctl reload nginx
```

Adjust the frontend build step if the frontend package is inside another folder.

---

# All in One Health Check

Run this after every deployment:

```bash
sudo systemctl status nginx redis-server nuru-backend nuru-celery -l --no-pager
sudo nginx -t
sudo ss -tulpn | grep -E "80|443|6379|nginx|redis|gunicorn|uvicorn|celery"
ps auxww | grep -Ei "nginx|redis|gunicorn|uvicorn|celery" | grep -v grep
sudo journalctl -u nuru-backend -n 80 -l --no-pager
sudo journalctl -u nuru-celery -n 100 -l --no-pager
cd /var/www/nuru
set -a
source .env
set +a
redis-cli -u "$REDIS_URL" ping
```

Expected Redis result:

```text
PONG
```

---

# Current Production Picture

| Component       | Current Configuration                      | Status                      |
| --------------- | ------------------------------------------ | --------------------------- |
| Nginx           | `/etc/nginx/sites-available/nuru`          | Running                     |
| SSL             | `/etc/letsencrypt/live/nuruapi.nuru.tz/`   | Configured in Nginx         |
| Backend         | `/etc/systemd/system/nuru-backend.service` | Running                     |
| Backend server  | Gunicorn with Uvicorn workers              | Running                     |
| Backend socket  | `/run/nuru/nuru.sock`                      | Used by Nginx               |
| Frontend        | `/var/www/nuru/frontend/dist`              | Served by Nginx             |
| Redis           | `/etc/redis/redis.conf`                    | Running                     |
| Redis bind      | `127.0.0.1:6379`                           | Local only                  |
| Redis auth      | Enabled                                    | Plain ping returns `NOAUTH` |
| Celery          | `/etc/systemd/system/nuru-celery.service`  | Running                     |
| Celery app      | `core.celery_app`                          | Active                      |
| Celery Beat     | Same service using `--beat`                | Active                      |
| Docker          | Not active or not found                    | Not used                    |
| PM2             | Not found                                  | Not used                    |
| Supervisor      | Not found                                  | Not used                    |
| Cron            | Not fully visible in shared output         | Needs cron inspection       |
| Certbot renewal | Not fully visible in shared output         | Needs timer check           |

The current infrastructure is clean: **systemd + Nginx + Redis + Gunicorn + Celery**. If the app fails while these services are healthy, the issue is more likely to be application code, imports, environment values, database access, or background task logic rather than the VPS structure itself.

---

# Security Principles

Nuru handles users, event data, payments, tickets, chats, media, device tokens, and vendor relationships. Security is not optional decoration. It is product infrastructure.

Follow these rules:

1. Never commit `.env` files.
2. Never commit private keys, signing files, Firebase credentials, or Android `key.properties`.
3. Use HTTPS in production.
4. Validate permissions on every protected endpoint.
5. Ensure users cannot access events, tickets, chats, payments, or media they do not own.
6. Use secure password hashing.
7. Protect JWT secrets.
8. Use HttpOnly cookies where appropriate.
9. Rate-limit OTP and login endpoints.
10. Invalidate sessions and device tokens during logout.
11. Sanitize uploads and validate file types.
12. Store payment references safely.
13. Log errors without exposing secrets or personal data.
14. Keep dependencies updated.
15. Review admin actions carefully.

---

# Development Standards

When working on Nuru, follow these standards.

## Product Logic

- Do not break existing flows while redesigning UI.
- Preserve business logic unless the task clearly requires logic changes.
- Keep web and mobile behavior aligned.
- Treat payments, tickets, check-ins, and permissions as sensitive flows.

## UI and UX

- Use clean, modern, mobile-first layouts.
- Avoid generic dashboard design.
- Keep Nuru’s visual identity warm, premium, and clear.
- Use consistent navigation and tab styles.
- Keep event-related screens emotional but practical.
- Avoid clutter, fake gradients, and unnecessary visual noise.

## Code Quality

- Write readable, maintainable code.
- Prefer clear naming over clever shortcuts.
- Keep API responses consistent.
- Handle errors gracefully.
- Avoid blocking user-facing requests with slow background work.
- Add logs where they help debugging without exposing sensitive data.

## Git Hygiene

Do not commit:

- `.env`
- `venv/`
- `__pycache__/`
- `.gunicorn/`
- build output
- signing keys
- Firebase service account files
- Android `key.properties`
- local cache files
- generated runtime files

Good commit messages:

```text
Fix FCM token cleanup after logout
Improve ticket check-in success screen
Add contribution progress summary to event groups
Optimize meeting join initialization
Redesign vendor chat header
Add manual payment approval flow
```

Bad commit messages:

```text
fix
changes
updates
final
new
latest
```

Future debugging is easier when Git history does not look like a crime scene.

---

# Troubleshooting

## Backend Does Not Start

Check:

- Virtual environment is active.
- Dependencies are installed.
- `.env` exists.
- `DATABASE_URL` is correct.
- PostgreSQL is reachable.
- Redis is running if required.
- Port `8000` is not already in use.

Useful commands:

```bash
systemctl status nuru-backend
journalctl -u nuru-backend -f
```

## Database Connection Fails

Check:

- Database hostname.
- Supabase pooler URL.
- Password and username.
- Network firewall.
- SSL requirements.
- Connection pool limits.
- DNS resolution on the server.

## Celery Tasks Are Not Running

Check:

- Redis service status.
- Celery app import path.
- Worker service logs.
- Environment variables loaded by systemd.
- Queue names and task routing.

Useful commands:

```bash
systemctl status redis-server
systemctl status nuru-celery
journalctl -u nuru-celery -f
```

## Frontend Build Fails

Check:

- Node version.
- Conflicting peer dependencies.
- Lockfile state.
- Missing environment variables.
- Build output path.

Useful commands:

```bash
npm install
npm run build
```

## Flutter App Does Not Detect Android Device

Check:

- USB debugging is enabled.
- Device authorization prompt was accepted.
- ADB sees the device.
- Wireless debugging pairing is correct.
- Flutter doctor output.

Useful commands:

```bash
adb devices
flutter doctor
flutter devices
```

## Push Notifications Reach Old Devices

This usually means old FCM tokens are still active.

Fix direction:

- Remove token on logout.
- Mark token inactive instead of keeping it blindly.
- Track device installation ID.
- Send notifications only to active tokens.
- Delete invalid tokens after FCM error responses.

## Mobile Meeting Restarts After Screen Sharing

Check:

- App lifecycle handling.
- Meeting session persistence.
- Background mode behavior.
- LiveKit or meeting SDK reconnection logic.
- Android foreground service requirements.
- iOS background capabilities where applicable.

The user should be able to return to an active meeting without rejoining from scratch.

---

# Roadmap

Nuru is actively evolving. Key areas include:

1. More reliable meeting, call, and screen sharing flows.
2. Faster meeting and call connection time.
3. Rich invitation card editor across web and mobile.
4. Stronger vendor verification and booking workflows.
5. Improved contribution analytics.
6. Better organizer dashboards.
7. AI-assisted planning, budgeting, and vendor discovery.
8. More polished ticketing and check-in experiences.
9. Photo and video libraries for event memories.
10. NFC-powered premium event experiences.
11. Improved offline and low-connectivity behavior.
12. Better notification token lifecycle management.
13. More payment integrations.
14. Multi-country support across East Africa.
15. Stronger admin tools for safety, trust, and operations.

---

# Brand Positioning

Nuru should feel clear, warm, trustworthy, modern, and premium.

The brand should not sound like a generic SaaS product. It should understand that events are personal. Some are joyful. Some are serious. Some involve family pressure, money pressure, public expectations, and cultural meaning.

Nuru’s tone should communicate:

- Clarity.
- Care.
- Trust.
- Confidence.
- Local understanding.
- Respect for every type of event.

Useful brand lines:

```text
Plan Smarter. Celebrate Better.
Every moment deserves care.
Plan with clarity. Organize with ease.
Tools built for the moments that matter.
Every guest deserves a warm welcome.
Trust is the foundation of every transaction.
```

---

# License

This project is proprietary unless a separate license file states otherwise.

All rights are reserved by the project owner.

---

# Contact

Project owner and development lead:

```text
David Mpinzile
SEWMR TECHNOLOGIES
Tanzania
```

Official domains may include:

```text
nuru.tz
app.nuru.tz
nuruapi.nuru.tz
```

---

# Nuru

**Plan Smarter. Celebrate Better.**
