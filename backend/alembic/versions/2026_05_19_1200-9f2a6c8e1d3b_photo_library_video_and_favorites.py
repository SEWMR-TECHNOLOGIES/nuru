"""photo libraries: video support, uploader, and per-user favorites

Revision ID: 9f2a6c8e1d3b
Revises: b6c7d8e9f0a1
Create Date: 2026-05-19 12:00:00.000000
"""
from alembic import op


revision = "9f2a6c8e1d3b"
down_revision = "b6c7d8e9f0a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE service_photo_library_images
            ADD COLUMN IF NOT EXISTS media_type VARCHAR(16) NOT NULL DEFAULT 'photo',
            ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
            ADD COLUMN IF NOT EXISTS uploaded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS idx_photo_library_images_media_type
            ON service_photo_library_images (library_id, media_type);

        CREATE TABLE IF NOT EXISTS service_photo_library_favorites (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            library_id UUID NOT NULL REFERENCES service_photo_libraries(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_library_user_favorite UNIQUE (library_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_photo_library_favorites_user
            ON service_photo_library_favorites (user_id);
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS idx_photo_library_favorites_user;
        DROP TABLE IF EXISTS service_photo_library_favorites;
        DROP INDEX IF EXISTS idx_photo_library_images_media_type;
        ALTER TABLE service_photo_library_images
            DROP COLUMN IF EXISTS uploaded_by_user_id,
            DROP COLUMN IF EXISTS duration_seconds,
            DROP COLUMN IF EXISTS media_type;
        """
    )
