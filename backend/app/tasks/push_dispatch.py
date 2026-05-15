"""
Task: Async push (FCM / VoIP) dispatch
======================================
Replaces the raw daemon-thread fan-out in :func:`utils.fcm.send_push_async`.
Workers open their own DB session and call the existing transport layer
(``send_push_to_user`` / ``send_push_to_tokens``) which already prunes
unregistered tokens and logs per-device results.
"""
from core.celery_app import celery_app
from core.database import SessionLocal


@celery_app.task(
    name="tasks.push_dispatch.send_to_user",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    rate_limit="600/m",
)
def send_to_user(self, user_id: str, *, title: str, body: str,
                 data: dict | None = None, high_priority: bool = False,
                 collapse_key: str | None = None, image: str | None = None):
    """Push fan-out to every registered device for ``user_id``."""
    from utils.fcm import send_push_to_user
    db = SessionLocal()
    try:
        out = send_push_to_user(
            db, user_id,
            title=title, body=body, data=data or {},
            high_priority=high_priority, collapse_key=collapse_key,
            image=image,
        )
        print(f"[push_dispatch] user={user_id} sent={out.get('sent', 0)} failed={out.get('failed', 0)}")
        return out
    except Exception as exc:  # noqa: BLE001
        print(f"[push_dispatch] retry user={user_id}: {exc}")
        try:
            db.rollback()
        except Exception:
            pass
        raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(
    name="tasks.push_dispatch.send_to_tokens",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
    rate_limit="600/m",
)
def send_to_tokens(self, tokens: list, *, title: str, body: str,
                   data: dict | None = None, high_priority: bool = False,
                   collapse_key: str | None = None, image: str | None = None):
    """Push to a raw list of FCM tokens (used for VoIP/Android wake-up)."""
    from utils.fcm import send_push_to_tokens
    try:
        out = send_push_to_tokens(
            tokens or [],
            title=title, body=body, data=data or {},
            high_priority=high_priority, collapse_key=collapse_key,
            image=image,
        )
        print(f"[push_dispatch] tokens={len(tokens or [])} sent={out.get('sent', 0)} failed={out.get('failed', 0)}")
        return out
    except Exception as exc:  # noqa: BLE001
        raise self.retry(exc=exc)
