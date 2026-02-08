import enum


class EventStatusEnum(enum.Enum):
    draft = "draft"
    confirmed = "confirmed"
    completed = "completed"
    published = "published"
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
    contribution_received = "contribution_received"
    booking_request = "booking_request"
    booking_accepted = "booking_accepted"
    booking_rejected = "booking_rejected"
    rsvp_received = "rsvp_received"
    committee_invite = "committee_invite"
    moment_view = "moment_view"
    moment_reaction = "moment_reaction"
    comment = "comment"
    mention = "mention"
    circle_add = "circle_add"


class UploadFileTypeEnum(enum.Enum):
    image = "image"
    pdf = "pdf"
    video = "video"
    doc = "doc"


class PriorityLevelEnum(enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


class SocialProviderEnum(enum.Enum):
    google = "google"
    facebook = "facebook"
    apple = "apple"
    twitter = "twitter"


class MomentContentTypeEnum(enum.Enum):
    image = "image"
    video = "video"


class MomentPrivacyEnum(enum.Enum):
    everyone = "everyone"
    circle_only = "circle_only"
    close_friends = "close_friends"


class StickerTypeEnum(enum.Enum):
    poll = "poll"
    question = "question"
    countdown = "countdown"
    mention = "mention"
    location = "location"
    link = "link"
    hashtag = "hashtag"


class CardOrderStatusEnum(enum.Enum):
    pending = "pending"
    processing = "processing"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


class CardTypeEnum(enum.Enum):
    standard = "standard"
    premium = "premium"
    custom = "custom"


class ChatSessionStatusEnum(enum.Enum):
    waiting = "waiting"
    active = "active"
    ended = "ended"
    abandoned = "abandoned"
