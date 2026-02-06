# models/localizations.py
from sqlalchemy import Column, String, Text, Integer, Boolean, ForeignKey, DateTime, CHAR
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from core.base import Base

class Currency(Base):
    __tablename__ = "currencies"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    code = Column(CHAR(3), unique=True, nullable=False)
    name = Column(Text, nullable=False)
    symbol = Column(Text, nullable=False)
    decimal_places = Column(Integer, default=2)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

    countries = relationship("Country", back_populates="currency")


class Country(Base):
    __tablename__ = "countries"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    code = Column(CHAR(2), unique=True, nullable=False)
    name = Column(Text, nullable=False)
    phone_code = Column(Text, nullable=False)
    currency_id = Column(UUID(as_uuid=True), ForeignKey("currencies.id"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now())

    currency = relationship("Currency", back_populates="countries")
