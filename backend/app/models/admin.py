from sqlalchemy import Column, Boolean, DateTime, Text, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from core.base import Base
import enum


class AdminRoleEnum(str, enum.Enum):
    admin = "admin"
    moderator = "moderator"
    support = "support"


class AdminUser(Base):
    __tablename__ = 'admin_users'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    full_name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False)
    username = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    role = Column(SAEnum(AdminRoleEnum, name="admin_role"), nullable=False, default=AdminRoleEnum.support)
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
