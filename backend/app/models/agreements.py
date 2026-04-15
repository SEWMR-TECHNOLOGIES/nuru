from sqlalchemy import Column, Text, Integer, DateTime, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from core.base import Base
from models.enums import AgreementTypeEnum


class AgreementVersion(Base):
    __tablename__ = 'agreement_versions'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    agreement_type = Column(Enum(AgreementTypeEnum, name="agreement_type_enum"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    summary = Column(Text)
    document_path = Column(Text, nullable=False)
    published_at = Column(DateTime, server_default=func.now())
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('agreement_type', 'version', name='uq_agreement_type_version'),
    )


class UserAgreementAcceptance(Base):
    __tablename__ = 'user_agreement_acceptances'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    agreement_version_id = Column(UUID(as_uuid=True), ForeignKey('agreement_versions.id', ondelete='CASCADE'), nullable=False)
    agreement_type = Column(Enum(AgreementTypeEnum, name="agreement_type_enum"), nullable=False)
    version_accepted = Column(Integer, nullable=False)
    ip_address = Column(Text)
    user_agent = Column(Text)
    accepted_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        UniqueConstraint('user_id', 'agreement_type', 'version_accepted', name='uq_user_agreement_acceptance'),
    )
