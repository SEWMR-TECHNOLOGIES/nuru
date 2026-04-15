"""
Celery Application
==================
Central Celery instance used by all background tasks.

Worker startup:
  cd backend/app
  celery -A core.celery_app worker --loglevel=info --concurrency=4

Beat (scheduler) startup:
  celery -A core.celery_app beat --loglevel=info

Combined (dev convenience):
  celery -A core.celery_app worker --beat --loglevel=info --concurrency=2
"""

import os
from celery import Celery
from celery.schedules import crontab

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "nuru",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "tasks.content_cleanup",
        "tasks.quality_scores",
        "tasks.notifications",
    ],
)

# ── Celery configuration ──
celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Nairobi",
    enable_utc=False,

    # Reliability
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,

    # Result backend
    result_expires=3600,  # 1 hour

    # Rate limits (per worker)
    task_default_rate_limit="100/m",

    # Retry defaults
    task_default_retry_delay=60,
    task_max_retries=3,

    # Periodic tasks (replaces cron / daemon threads)
    beat_schedule={
        "auto-delete-removed-content": {
            "task": "tasks.content_cleanup.auto_delete_removed_content",
            "schedule": crontab(minute=0, hour="*/6"),  # Every 6 hours
        },
        "recompute-quality-scores": {
            "task": "tasks.quality_scores.recompute_quality_scores_task",
            "schedule": crontab(minute="*/30"),  # Every 30 minutes
        },
    },
)
