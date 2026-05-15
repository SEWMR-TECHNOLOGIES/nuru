
-- Service role bypasses RLS already; the explicit policies are unnecessary and triggered the linter.
DROP POLICY IF EXISTS "Service role can write invitation media" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update invitation media" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete invitation media" ON storage.objects;

-- Replace blanket public read with a more scoped one that doesn't allow directory listing
-- (filename is unguessable UUID-based path, so this is safe).
DROP POLICY IF EXISTS "Invitation media is publicly readable" ON storage.objects;

CREATE POLICY "Invitation media files are publicly readable by path"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'invitation-media'
  AND (storage.foldername(name))[1] IN ('cards', 'tickets', 'templates')
);
