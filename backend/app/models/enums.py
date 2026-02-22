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
    cash = "cash"
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
    general = "general"
    broadcast = "broadcast"
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
    circle_request = "circle_request"
    circle_accepted = "circle_accepted"
    expense_recorded = "expense_recorded"
    content_removed = "content_removed"
    post_removed = "post_removed"
    moment_removed = "moment_removed"
    identity_verified = "identity_verified"
    kyc_approved = "kyc_approved"
    password_changed = "password_changed"
    password_reset = "password_reset"


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


class ContributionStatusEnum(enum.Enum):
    confirmed = "confirmed"
    pending = "pending"
    rejected = "rejected"


class ChatSessionStatusEnum(enum.Enum):
    waiting = "waiting"
    active = "active"
    ended = "ended"
    abandoned = "abandoned"


class FeedVisibilityEnum(enum.Enum):
    public = "public"
    circle = "circle"


class GuestTypeEnum(enum.Enum):
    user = "user"
    contributor = "contributor"


class ChecklistItemStatusEnum(enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    skipped = "skipped"


class AppealStatusEnum(enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class AppealContentTypeEnum(enum.Enum):
    post = "post"
    moment = "moment"


class PhotoLibraryPrivacyEnum(enum.Enum):
    public = "public"                      # anyone with link who is a Nuru user
    event_creator_only = "event_creator_only"  # only event organizer


class TicketStatusEnum(enum.Enum):
    available = "available"
    sold_out = "sold_out"
    cancelled = "cancelled"


class TicketOrderStatusEnum(enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"
    refunded = "refunded"


class EventShareDurationEnum(enum.Enum):
    timed = "timed"          # until a specific date/time
    lifetime = "lifetime"    # user decides when to remove


class ServiceMediaTypeEnum(enum.Enum):
    video = "video"
    audio = "audio"


class BusinessPhoneStatusEnum(enum.Enum):
    pending = "pending"
    verified = "verified"


class WAMessageDirectionEnum(enum.Enum):
    inbound = "inbound"
    outbound = "outbound"


class WAMessageStatusEnum(enum.Enum):
    sent = "sent"
    delivered = "delivered"
    read = "read"
    failed = "failed"


class IssueStatusEnum(enum.Enum):
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class IssuePriorityEnum(enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class CircleRequestStatusEnum(enum.Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
