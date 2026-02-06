# models/nuru_cards.py
from sqlalchemy import Column, Text, Boolean, Integer, DateTime, Numeric, ForeignKey, CHAR, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import CardTypeEnum, CardOrderStatusEnum, PaymentStatusEnum

class NuruCard(Base):
    __tablename__ = 'nuru_cards'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    card_number = Column(CHAR(12), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    issued_at = Column(DateTime, default=func.now())
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user = relationship("User", backref="nuru_cards")


class NuruCardOrder(Base):
    __tablename__ = 'nuru_card_orders'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    card_type = Column(Enum(CardTypeEnum, name='card_type_enum'), default='standard')
    quantity = Column(Integer, default=1)
    delivery_name = Column(Text, nullable=False)
    delivery_phone = Column(Text, nullable=False)
    delivery_address = Column(Text, nullable=False)
    delivery_city = Column(Text, nullable=False)
    delivery_country_id = Column(UUID(as_uuid=True), ForeignKey('countries.id'))
    delivery_postal_code = Column(Text)
    delivery_instructions = Column(Text)
    status = Column(Enum(CardOrderStatusEnum, name='card_order_status_enum'), default='pending')
    tracking_number = Column(Text)
    shipped_at = Column(DateTime)
    delivered_at = Column(DateTime)
    amount = Column(Numeric, nullable=False)
    currency_id = Column(UUID(as_uuid=True), ForeignKey('currencies.id'))
    payment_status = Column(Enum(PaymentStatusEnum, name='payment_status_enum'), default='pending')
    payment_ref = Column(Text)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    user = relationship("User", backref="nuru_card_orders")
    delivery_country = relationship("Country")
    currency = relationship("Currency")
