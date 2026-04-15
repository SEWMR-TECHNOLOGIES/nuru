from sqlalchemy import Column, ForeignKey, DateTime, Integer, Text, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from core.base import Base
from models.enums import UploadFileTypeEnum


# ──────────────────────────────────────────────
# File Uploads
# ──────────────────────────────────────────────

class FileUpload(Base):
    __tablename__ = 'file_uploads'

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'))
    file_url = Column(Text, nullable=False)
    file_type = Column(Enum(UploadFileTypeEnum, name="upload_file_type_enum"))
    file_size = Column(Integer)
    original_name = Column(Text)
    entity_type = Column(Text)
    entity_id = Column(UUID(as_uuid=True))
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="file_uploads")
