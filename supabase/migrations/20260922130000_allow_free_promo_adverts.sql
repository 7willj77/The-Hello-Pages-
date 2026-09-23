DROP POLICY IF EXISTS "Published paid adverts are publicly readable"
ON public.adverts;

CREATE POLICY "Published paid or free adverts are publicly readable"
ON public.adverts
FOR SELECT
TO anon, authenticated
USING (
  status = 'published'
  AND payment_status IN ('paid', 'free')
);
