-- Account setup tokens + user flags for tokenised WhatsApp registration flow
-- and temporary-password mobile/SMS flow.

CREATE TABLE IF NOT EXISTS public.account_setup_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL DEFAULT 'account_setup',
    delivery_channel TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    extra JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_setup_tokens_user_active
    ON public.account_setup_tokens (user_id) WHERE used_at IS NULL;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS temporary_password_expires_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS account_setup_completed_at TIMESTAMP;
