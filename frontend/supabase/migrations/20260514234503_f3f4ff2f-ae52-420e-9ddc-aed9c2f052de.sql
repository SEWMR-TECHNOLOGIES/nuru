
-- Create public bucket to host rendered invitation cards and ticket PNGs (and SVG template sources)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invitation-media', 'invitation-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read for everyone (so WhatsApp can fetch the image header)
CREATE POLICY "Invitation media is publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'invitation-media');

-- Only the service role (used from edge functions) can write
CREATE POLICY "Service role can write invitation media"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'invitation-media');

CREATE POLICY "Service role can update invitation media"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'invitation-media');

CREATE POLICY "Service role can delete invitation media"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'invitation-media');
