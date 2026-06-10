CREATE POLICY "Clients cannot access phone whatsapp statuses"
ON public.phone_whatsapp_statuses
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);