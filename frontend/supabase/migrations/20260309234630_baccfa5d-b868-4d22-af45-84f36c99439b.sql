
CREATE TABLE public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  user_id TEXT,
  purpose TEXT NOT NULL DEFAULT 'phone_verification',
  is_used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_otp_codes_phone_purpose ON public.otp_codes (phone, purpose, is_used);

-- RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service role) full access; no direct client access
CREATE POLICY "Service role only" ON public.otp_codes
  FOR ALL USING (false) WITH CHECK (false);
