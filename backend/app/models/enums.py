# models/enums.py
# Contains all ENUM types: event_status_enum, payment_status_enum, payment_method_enum, rsvp_status_enum, verification_status_enum, otp_verification_type_enum

from sqlalchemy import Enum
from sqlalchemy.dialects.postgresql import ENUM

event_status_enum = ENUM('draft', 'confirmed', 'completed', 'cancelled', name='event_status', create_type=True)
payment_status_enum = ENUM('pending', 'completed', 'refunded', name='payment_status', create_type=True)
payment_method_enum = ENUM('mobile', 'bank', 'card', name='payment_method', create_type=True)
rsvp_status_enum = ENUM('pending', 'confirmed', 'declined', 'checked_in', name='rsvp_status', create_type=True)
verification_status_enum = ENUM('pending', 'verified', 'rejected', name='verification_status', create_type=True)
otp_verification_type_enum = ENUM('phone', 'email', name='otp_verification_type', create_type=True)
