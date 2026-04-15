
-- Page views tracking table for admin analytics
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  referrer text,
  user_agent text,
  country text,
  city text,
  device_type text, -- 'mobile', 'tablet', 'desktop'
  browser text,
  session_id text,
  visitor_id text, -- anonymous fingerprint
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (tracking)
CREATE POLICY "Anyone can insert page views"
ON public.page_views
FOR INSERT
WITH CHECK (true);

-- Only admins can read analytics
CREATE POLICY "Admins can read page views"
ON public.page_views
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Index for efficient querying
CREATE INDEX idx_page_views_created_at ON public.page_views (created_at DESC);
CREATE INDEX idx_page_views_path ON public.page_views (path);
CREATE INDEX idx_page_views_visitor ON public.page_views (visitor_id);

-- Enable realtime for live dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE public.page_views;
