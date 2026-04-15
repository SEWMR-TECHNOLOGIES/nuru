"""
Task: Recompute post quality scores
====================================
Replaces the unsafe daemon thread in main.py.
Invalidates feed caches after recomputation.
"""

from core.celery_app import celery_app


@celery_app.task(
    name="tasks.quality_scores.recompute_quality_scores_task",
    bind=True,
    max_retries=2,
    default_retry_delay=120,
)
def recompute_quality_scores_task(self, max_posts: int = 500):
    """Recompute PostQualityScore for recent posts, then bust feed caches."""
    from core.database import SessionLocal
    db = SessionLocal()
    try:
        from services.feed_ranking import recompute_quality_scores
        recompute_quality_scores(db, max_posts=max_posts)

        # Invalidate all feed caches since scores changed
        from core.redis import invalidate_all_feeds, invalidate_trending
        invalidate_all_feeds()
        invalidate_trending()

        return {"status": "ok", "max_posts": max_posts}
    except Exception as exc:
        raise self.retry(exc=exc)
    finally:
        db.close()
