-- Per-user "hide conversation" so deleting a chat only hides it on the user's side.
-- The conversation reappears for that user when a new message arrives after hidden_at.
CREATE TABLE IF NOT EXISTS public.conversation_hides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  user_id uuid NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_hides_user ON public.conversation_hides(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_hides_conv ON public.conversation_hides(conversation_id);
