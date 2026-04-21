# Nuru API Routes
# This module contains all FastAPI route handlers organized by feature

from .auth import router as auth_router
from .users import router as users_router
from .references import router as references_router
from .user_events import router as user_events_router
from .events import router as events_router
from .user_services import router as user_services_router
from .services import router as services_router
from .bookings import router as bookings_router
from .messages import router as messages_router
from .notifications import router as notifications_router
from .posts import router as posts_router
from .moments import router as moments_router
from .nuru_cards import router as nuru_cards_router
from .support import router as support_router
from .settings import router as settings_router
from .uploads import router as uploads_router
from .circles import router as circles_router
from .communities import router as communities_router
from .user_contributors import router as user_contributors_router
from .profile import router as profile_router
from .rsvp import router as rsvp_router
from .templates import router as templates_router
from .expenses import router as expenses_router
from .admin import router as admin_router
from .photo_libraries import router as photo_libraries_router
from .ticketing import router as ticketing_router
from .analytics import router as analytics_router
from .whatsapp_admin import router as whatsapp_admin_router
from .issues import router as issues_router
from .agreements import router as agreements_router
from .card_templates import router as card_templates_router
from .meetings import router as meetings_router

from .meeting_documents import router as meeting_documents_router
from .meeting_og import router as meeting_og_router
from .combined import router as combined_router
from .escrow import router as escrow_router
from .delivery_otp import router as delivery_otp_router
from .wallet import router as wallet_router
from .payment_profiles import router as payment_profiles_router
from .payments import router as payments_router
from .admin_payments import router as admin_payments_router
from .withdrawals import router as withdrawals_router
from .admin_withdrawals import router as admin_withdrawals_router
from .migration import router as migration_router
from .admin_payments_ops import router as admin_payments_ops_router
from .received_payments import router as received_payments_router
from .event_groups import router as event_groups_router
from .public_contributions import router as public_contributions_router
from .contact import router as contact_router
from .admin_contact import router as admin_contact_router

# All routers to be included in main app
all_routers = [
    auth_router,          # /auth/...
    users_router,         # /users/...
    references_router,    # /references/...
    user_events_router,   # /user-events/...
    events_router,        # /events/...
    user_services_router, # /user-services/...
    services_router,      # /services/...
    bookings_router,      # /bookings/...
    messages_router,      # /messages/...
    notifications_router, # /notifications/...
    posts_router,         # /posts/...
    moments_router,       # /moments/...
    nuru_cards_router,    # /nuru-cards/...
    support_router,       # /support/...
    settings_router,      # /settings/...
    uploads_router,       # /uploads/...
    circles_router,       # /circles/...
    communities_router,   # /communities/...
    user_contributors_router,  # /user-contributors/...
    profile_router,            # /users/profile
    rsvp_router,               # /rsvp/...
    templates_router,          # /templates/... + /user-events/.../checklist
    expenses_router,           # /user-events/.../expenses
    admin_router,              # /admin/...
    photo_libraries_router,    # /photo-libraries/...
    ticketing_router,          # /ticketing/...
    analytics_router,          # /analytics/...
    whatsapp_admin_router,     # /whatsapp/... + /admin/whatsapp/...
    issues_router,             # /issues/...
    agreements_router,         # /agreements/...
    card_templates_router,     # /card-templates/... + /events/.../card-template
    meetings_router,           # /events/.../meetings
    meeting_documents_router,  # /events/.../meetings/.../agenda + minutes
    meeting_og_router,         # /meetings/room/:roomId (public OG)
    combined_router,           # /combined/... (aggregated endpoints)
    escrow_router,             # /escrow/...
    delivery_otp_router,       # /delivery-otp/...
    wallet_router,             # /wallet/...
    payment_profiles_router,   # /payment-profiles/...
    payments_router,           # /payments/...
    admin_payments_router,     # /admin/payments/...
    withdrawals_router,        # /withdrawals/...
    admin_withdrawals_router,  # /admin/withdrawals/...
    migration_router,          # /users/me/migration-status
    admin_payments_ops_router, # /admin/payments/{summary,ledger,settlements,beneficiaries,reconciliation,reports}
    received_payments_router,  # /received-payments/{events,services}/...
    event_groups_router,       # /event-groups/...
    public_contributions_router,  # /public/contributions/{token}/...
    contact_router,            # /contact/submit  (public)
    admin_contact_router,      # /admin/contact-messages/...
]

__all__ = [
    "auth_router",
    "users_router",
    "references_router",
    "user_events_router",
    "events_router",
    "user_services_router",
    "services_router",
    "bookings_router",
    "messages_router",
    "notifications_router",
    "posts_router",
    "moments_router",
    "nuru_cards_router",
    "support_router",
    "settings_router",
    "uploads_router",
    "circles_router",
    "communities_router",
    "user_contributors_router",
    "profile_router",
    "rsvp_router",
    "templates_router",
    "expenses_router",
    "admin_router",
    "photo_libraries_router",
    "ticketing_router",
    "analytics_router",
    "whatsapp_admin_router",
    "all_routers",
    "agreements_router",
    "card_templates_router",
    "meetings_router",
]
