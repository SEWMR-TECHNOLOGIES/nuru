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
    "all_routers",
]
