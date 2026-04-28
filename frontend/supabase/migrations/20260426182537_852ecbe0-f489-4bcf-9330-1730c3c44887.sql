-- Note: This is the dev/preview Supabase. The real schema lives in the main backend Postgres,
-- but mirroring here keeps Lovable Cloud aware. The actual production change happens via
-- the Alembic migration (file added in this same response).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='conversations') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='conversations' AND column_name='is_encrypted') THEN
      ALTER TABLE public.conversations ADD COLUMN is_encrypted boolean NOT NULL DEFAULT false;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='messages') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='encryption_version') THEN
      ALTER TABLE public.messages ADD COLUMN encryption_version text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='reply_snapshot_text') THEN
      ALTER TABLE public.messages ADD COLUMN reply_snapshot_text text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='messages' AND column_name='reply_snapshot_sender') THEN
      ALTER TABLE public.messages ADD COLUMN reply_snapshot_sender text;
    END IF;
  END IF;
END $$;