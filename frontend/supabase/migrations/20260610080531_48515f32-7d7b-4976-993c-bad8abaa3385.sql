DO $$
DECLARE
  enum_name text;
BEGIN
  FOR enum_name IN
    SELECT typname
    FROM pg_type
    WHERE typname IN ('rsvp_status', 'rsvp_status_enum')
  LOOP
    EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_name, 'maybe');
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.phone_whatsapp_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_phone text,
  normalized_phone text NOT NULL,
  country_code varchar(8),
  national_number text,
  normalization_status varchar(32) NOT NULL DEFAULT 'ok',
  normalization_error text,
  is_whatsapp boolean,
  status varchar(32) NOT NULL DEFAULT 'unknown',
  provider varchar(64) NOT NULL DEFAULT 'whatsapp_cloud_api',
  provider_response_code varchar(64),
  provider_error_code varchar(64),
  provider_error_message text,
  last_checked_at timestamptz,
  next_check_after timestamptz,
  check_attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.phone_whatsapp_statuses TO service_role;

ALTER TABLE public.phone_whatsapp_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage phone whatsapp statuses" ON public.phone_whatsapp_statuses;
CREATE POLICY "Service role can manage phone whatsapp statuses"
ON public.phone_whatsapp_statuses
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE UNIQUE INDEX IF NOT EXISTS ux_phone_whatsapp_statuses_normalized_phone
ON public.phone_whatsapp_statuses (normalized_phone);

CREATE INDEX IF NOT EXISTS ix_phone_whatsapp_statuses_status_next_check
ON public.phone_whatsapp_statuses (status, next_check_after);

CREATE INDEX IF NOT EXISTS ix_phone_whatsapp_statuses_last_checked
ON public.phone_whatsapp_statuses (last_checked_at);