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
    text = "text"


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
    reserved = "reserved"


class TicketApprovalStatusEnum(enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    removed = "removed"


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


class AgreementTypeEnum(enum.Enum):
    vendor_agreement = "vendor_agreement"
    organiser_agreement = "organiser_agreement"


class MeetingStatusEnum(enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    ended = "ended"


class MeetingParticipantRoleEnum(enum.Enum):
    creator = "creator"
    co_host = "co_host"
    participant = "participant"


class MeetingJoinRequestStatusEnum(enum.Enum):
    waiting = "waiting"
    approved = "approved"
    rejected = "rejected"


# ──────────────────────────────────────────────
# Escrow / Booking money state machine (Phase 1.1)
# ──────────────────────────────────────────────

class BookingStateEnum(enum.Enum):
    """Authoritative booking states — string-compatible with legacy `status` text column."""
    pending = "pending"                # vendor has not responded
    accepted = "accepted"              # vendor accepted, awaiting deposit
    funds_secured = "funds_secured"    # deposit (or full) received → Nuru holds escrow
    in_progress = "in_progress"        # event day window
    delivered = "delivered"            # OTP check-in done
    released = "released"              # escrow released to vendor side
    refunded = "refunded"              # full/partial refund issued
    disputed = "disputed"              # dispute open → freezes auto-release
    rejected = "rejected"
    cancelled = "cancelled"
    completed = "completed"            # legacy alias kept for back-compat


class EscrowHoldStatusEnum(enum.Enum):
    pending = "pending"                        # row created, no funds yet
    held = "held"                              # funds secured (deposit and/or balance)
    partially_released = "partially_released"
    released = "released"
    refunded = "refunded"
    disputed = "disputed"


class EscrowTransactionTypeEnum(enum.Enum):
    HOLD_DEPOSIT = "HOLD_DEPOSIT"
    HOLD_BALANCE = "HOLD_BALANCE"
    RELEASE_TO_VENDOR = "RELEASE_TO_VENDOR"
    REFUND_TO_ORGANISER = "REFUND_TO_ORGANISER"
    COMMISSION_TO_NURU = "COMMISSION_TO_NURU"
    FEE = "FEE"
    ADJUSTMENT = "ADJUSTMENT"
    SETTLED_TO_VENDOR = "SETTLED_TO_VENDOR"  # admin marks MPesa/card payout done


class CancellationTierEnum(enum.Enum):
    """Refund-tier classification per service category (Phase 1.2)."""
    flexible = "flexible"
    moderate = "moderate"
    strict = "strict"


# ──────────────────────────────────────────────
# Payments / Wallet (Phase 1)
# ──────────────────────────────────────────────

class PaymentProviderTypeEnum(enum.Enum):
    """Type of payout/collection provider an admin can register."""
    mobile_money = "mobile_money"
    bank = "bank"


class PaymentTargetTypeEnum(enum.Enum):
    """What the payment is funding — drives credit routing."""
    contribution = "contribution"
    ticket = "ticket"
    booking = "booking"
    wallet_topup = "wallet_topup"
    withdrawal = "withdrawal"
    settlement = "settlement"


class TransactionStatusEnum(enum.Enum):
    """Lifecycle of any money movement."""
    pending = "pending"          # created, not yet sent to gateway
    processing = "processing"    # STK pushed / awaiting confirmation
    paid = "paid"                # funds received in Nuru collection
    credited = "credited"        # beneficiary wallet credited
    failed = "failed"
    reversed = "reversed"


class WalletEntryTypeEnum(enum.Enum):
    """Direction & nature of a wallet ledger entry."""
    credit = "credit"            # money in
    debit = "debit"              # money out
    hold = "hold"                # placed on pending balance
    release = "release"          # moved from pending → available
    commission = "commission"    # platform fee
    refund = "refund"
    withdrawal = "withdrawal"
    adjustment = "adjustment"


class CountrySourceEnum(enum.Enum):
    """How the user's country was determined."""
    ip = "ip"
    phone_prefix = "phone_prefix"
    locale = "locale"
    manual = "manual"


class PayoutMethodTypeEnum(enum.Enum):
    """How a beneficiary wants to be paid out."""
    mobile_money = "mobile_money"
    bank = "bank"


class WithdrawalRequestStatusEnum(enum.Enum):
    """Lifecycle of an admin-mediated withdrawal request.

    pending   — submitted by user, funds held; awaiting admin review.
    approved  — admin acknowledged; funds still pending while paying out.
    settled   — admin confirmed external payout sent; wallet `withdrawal()` recorded.
    rejected  — admin declined; held funds released back to available.
    cancelled — user cancelled before admin action; held funds released.
    """
    pending = "pending"
    approved = "approved"
    settled = "settled"
    rejected = "rejected"
    cancelled = "cancelled"

