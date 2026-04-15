"""
Task: Auto-delete removed content with no appeal after 7 days
=============================================================
Replaces the unsafe daemon thread in main.py.
"""

from datetime import datetime, timedelta
import pytz
from core.celery_app import celery_app


@celery_app.task(
    name="tasks.content_cleanup.auto_delete_removed_content",
    bind=True,
    max_retries=2,
    default_retry_delay=300,
)
def auto_delete_removed_content(self):
    """
    Permanently deletes posts and moments that:
    - have is_active = False (removed by admin)
    - were removed more than 7 days ago
    - have no pending/approved appeal
    """
    EAT = pytz.timezone("Africa/Nairobi")

    from core.database import SessionLocal
    db = SessionLocal()
    try:
        cutoff = datetime.now(EAT) - timedelta(days=7)
        cutoff_naive = cutoff.replace(tzinfo=None)

        # Posts
        from models.feeds import UserFeed
        from models.appeals import ContentAppeal
        from models.enums import AppealStatusEnum

        removed_posts = db.query(UserFeed).filter(
            UserFeed.is_active == False,
            UserFeed.updated_at <= cutoff_naive,
        ).all()

        deleted_posts = 0
        for post in removed_posts:
            appeal = db.query(ContentAppeal).filter(
                ContentAppeal.content_id == post.id,
                ContentAppeal.content_type == "post",
                ContentAppeal.status.in_([AppealStatusEnum.pending, AppealStatusEnum.approved]),
            ).first()
            if not appeal:
                db.delete(post)
                deleted_posts += 1

        db.commit()

        # Moments
        from models.moments import UserMoment

        removed_moments = db.query(UserMoment).filter(
            UserMoment.is_active == False,
            UserMoment.updated_at <= cutoff_naive,
        ).all()

        deleted_moments = 0
        for moment in removed_moments:
            appeal = db.query(ContentAppeal).filter(
                ContentAppeal.content_id == moment.id,
                ContentAppeal.content_type == "moment",
                ContentAppeal.status.in_([AppealStatusEnum.pending, AppealStatusEnum.approved]),
            ).first()
            if not appeal:
                db.delete(moment)
                deleted_moments += 1

        db.commit()

        return {
            "deleted_posts": deleted_posts,
            "deleted_moments": deleted_moments,
        }

    except Exception as exc:
        db.rollback()
        raise self.retry(exc=exc)
    finally:
        db.close()
