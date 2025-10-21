import enum
class EventStatusEnum(enum.Enum):
    draft = "draft"
    confirmed = "confirmed"
    completed = "completed"
    cancelled = "cancelled"

class PaymentStatusEnum(enum.Enum):
    pending = "pending"
    completed = "completed"
    refunded = "refunded"

class PaymentMethodEnum(enum.Enum):
    mobile = "mobile"
    bank = "bank"
    card = "card"

class RSVPStatusEnum(enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    declined = "declined"
    checked_in = "checked_in"

class VerificationStatusEnum(enum.Enum):
    pending = "pending"
    verified = "verified"
    rejected = "rejected"

class OTPVerificationTypeEnum(enum.Enum):
    phone = "phone"
    email = "email"

class ConversationTypeEnum(enum.Enum):
    user_to_user = "user_to_user"
    user_to_service = "user_to_service"

class EventServiceStatusEnum(enum.Enum):
    pending = "pending"
    assigned = "assigned"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

class ServiceAvailabilityEnum(enum.Enum):
    available = "available"
    limited = "limited"
    unavailable = "unavailable"

class NotificationTypeEnum(enum.Enum):
    glow = "glow"
    echo = "echo"
    spark = "spark"
    follow = "follow"
    event_invite = "event_invite"
    service_approved = "service_approved"
    service_rejected = "service_rejected"
    account_created = "account_created"
    system = "system"

class UploadFileTypeEnum(enum.Enum):
    image = "image"
    pdf = "pdf"
    video = "video"
    doc = "doc"

class PriorityLevelEnum(enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"