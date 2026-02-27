from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import threading
import time
from datetime import datetime, timedelta
import pytz

from api.routes import all_routers
from api.routes.card_templates import router as card_templates_router

app = FastAPI(
    title="Nuru API",
    version="1.0.0",
)

API_PREFIX = "/api/v1"

# ------------------------------------------------------------------
# CORS
# ------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://192.168.100.11:8080",
        "https://app.nuru.tz",
        "https://www.nuru.tz",
        "https://nuru.tz",
        "https://workspace.nuru.tz",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------
@app.get("/")
def root():
    return {"message": "Welcome to Nuru API"}

for router in all_routers:
    app.include_router(router, prefix=API_PREFIX)

# Ensure card-templates routes are always mounted (safety fallback)
registered_paths = {route.path for route in app.router.routes}
if f"{API_PREFIX}/card-templates" not in registered_paths:
    app.include_router(card_templates_router, prefix=API_PREFIX)

# ------------------------------------------------------------------
# Error handling
# ------------------------------------------------------------------
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "message": exc.detail,
            "data": None,
        },
    )


# ------------------------------------------------------------------
# Background: Auto-delete removed content with no appeal after 7 days
# ------------------------------------------------------------------
def _auto_delete_removed_content():
    """
    Runs every 6 hours. Permanently deletes posts and moments that:
    - have is_active = False (removed by admin)
    - were removed more than 7 days ago
    - have no pending/approved appeal
    """
    EAT = pytz.timezone("Africa/Nairobi")
    INTERVAL_SECONDS = 6 * 60 * 60  # 6 hours

    while True:
        try:
            from core.database import SessionLocal
            db = SessionLocal()
            try:
                cutoff = datetime.now(EAT) - timedelta(days=7)
                # Make cutoff timezone-naive for comparison with naive DB timestamps
                cutoff_naive = cutoff.replace(tzinfo=None)

                # Posts
                try:
                    from models.feeds import UserFeed
                    from models.appeals import ContentAppeal
                    from models.enums import AppealStatusEnum

                    # Find posts removed >7 days ago with no pending/approved appeal
                    removed_posts = db.query(UserFeed).filter(
                        UserFeed.is_active == False,
                        UserFeed.updated_at <= cutoff_naive,
                    ).all()

                    for post in removed_posts:
                        appeal = db.query(ContentAppeal).filter(
                            ContentAppeal.content_id == post.id,
                            ContentAppeal.content_type == "post",
                            ContentAppeal.status.in_([AppealStatusEnum.pending, AppealStatusEnum.approved]),
                        ).first()
                        if not appeal:
                            db.delete(post)

                    db.commit()
                except Exception:
                    db.rollback()

                # Moments
                try:
                    from models.moments import UserMoment
                    removed_moments = db.query(UserMoment).filter(
                        UserMoment.is_active == False,
                        UserMoment.updated_at <= cutoff_naive,
                    ).all()

                    for moment in removed_moments:
                        appeal = db.query(ContentAppeal).filter(
                            ContentAppeal.content_id == moment.id,
                            ContentAppeal.content_type == "moment",
                            ContentAppeal.status.in_([AppealStatusEnum.pending, AppealStatusEnum.approved]),
                        ).first()
                        if not appeal:
                            db.delete(moment)

                    db.commit()
                except Exception:
                    db.rollback()

            finally:
                db.close()

        except Exception:
            pass  # Never crash the background thread

        time.sleep(INTERVAL_SECONDS)


# ------------------------------------------------------------------
# Background: Recompute post quality scores every 30 minutes
# ------------------------------------------------------------------
def _recompute_quality_scores():
    """
    Periodically recomputes PostQualityScore for recent posts.
    Runs every 30 minutes to keep ranking features fresh.
    """
    INTERVAL_SECONDS = 30 * 60  # 30 minutes

    while True:
        try:
            from core.database import SessionLocal
            db = SessionLocal()
            try:
                from services.feed_ranking import recompute_quality_scores
                recompute_quality_scores(db, max_posts=500)
            finally:
                db.close()
        except Exception:
            pass  # Never crash the background thread

        time.sleep(INTERVAL_SECONDS)


@app.on_event("startup")
def start_background_tasks():
    t1 = threading.Thread(target=_auto_delete_removed_content, daemon=True)
    t1.start()
    t2 = threading.Thread(target=_recompute_quality_scores, daemon=True)
    t2.start()
