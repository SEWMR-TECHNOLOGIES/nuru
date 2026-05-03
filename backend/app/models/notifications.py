from sqlalchemy import Column, Boolean, ForeignKey, DateTime, Text, Enum, Index, event
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import NotificationTypeEnum


# ──────────────────────────────────────────────
# Notifications
# ──────────────────────────────────────────────

class Notification(Base):
    __tablename__ = 'notifications'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    recipient_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    sender_ids = Column(JSONB)
    type = Column(Enum(NotificationTypeEnum, name="notification_type_enum"), nullable=False)
    reference_id = Column(UUID(as_uuid=True))
    reference_type = Column(Text)
    message_template = Column(Text, nullable=False)
    message_data = Column(JSONB, server_default="'{}'::jsonb")
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index('idx_notifications_recipient_created', 'recipient_id', 'created_at'),
        Index('idx_notifications_recipient_unread', 'recipient_id', 'is_read'),
        Index('idx_notifications_reference', 'reference_type', 'reference_id'),
    )

    recipient = relationship("User", back_populates="notifications")


# ─────────────────────────────────────────────────────────────────────
# Auto-push fan-out: every Notification row inserted into the DB
# triggers a best-effort FCM push to the recipient's devices, no matter
# which call site created it (utils.notify.create_notification, direct
# Notification(...) inserts in admin/payments/etc.). Auth OTPs do NOT
# use the Notification table, so they are naturally excluded.
# ─────────────────────────────────────────────────────────────────────
@event.listens_for(Notification, "after_insert")
def _fanout_push_on_notification_insert(mapper, connection, target):  # noqa: ANN001
    try:
        from utils.fcm import send_push_async
        from utils.notification_titles import title_for_notification

        n_type = target.type.value if hasattr(target.type, "value") else str(target.type)
        data = dict(target.message_data or {})
        title = title_for_notification(n_type, data)
        sender_name = data.get("sender_name") if isinstance(data, dict) else None
        body = (target.message_template or "").strip()
        if sender_name and body and not body.lower().startswith(str(sender_name).lower()):
            body = f"{sender_name} {body}".strip()

        push_data = {
            "type": n_type,
            "reference_id": str(target.reference_id) if target.reference_id else "",
            "reference_type": target.reference_type or "",
        }
        sender_avatar = data.get("sender_avatar") if isinstance(data, dict) else None
        if sender_name:
            push_data["sender_name"] = str(sender_name)
        if sender_avatar:
            push_data["sender_avatar"] = str(sender_avatar)

        # send_push_async opens its own SessionLocal in a background thread,
        # so we just pass None for the db arg here.
        send_push_async(
            None,
            target.recipient_id,
            title=title,
            body=body,
            data=push_data,
            high_priority=True,
            collapse_key=f"{target.reference_type or n_type}:{target.reference_id or target.id}",
            image=sender_avatar or None,
        )
    except Exception as _e:  # noqa: BLE001
        print(f"[notifications] auto push fan-out skipped: {_e}")
