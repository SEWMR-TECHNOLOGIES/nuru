"""photo libraries: albums and highlights metadata

Revision ID: c7d8e9f0a1b2
Revises: 9f2a6c8e1d3b
Create Date: 2026-05-19 13:00:00.000000
"""
from alembic import op


revision = "c7d8e9f0a1b2"
down_revision = "9f2a6c8e1d3b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE service_photo_library_images
            ADD COLUMN IF NOT EXISTS is_highlight BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS album_name TEXT;

        CREATE INDEX IF NOT EXISTS idx_photo_library_images_highlight
            ON service_photo_library_images (library_id, is_highlight);

        CREATE INDEX IF NOT EXISTS idx_photo_library_images_album
            ON service_photo_library_images (library_id, album_name)
            WHERE album_name IS NOT NULL;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX IF EXISTS idx_photo_library_images_album;
        DROP INDEX IF EXISTS idx_photo_library_images_highlight;
        ALTER TABLE service_photo_library_images
            DROP COLUMN IF EXISTS album_name,
            DROP COLUMN IF EXISTS is_highlight;
        """
    )
