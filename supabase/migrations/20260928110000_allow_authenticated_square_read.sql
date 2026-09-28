CREATE POLICY "Authenticated users can read squares"
ON public.squares
FOR SELECT
TO authenticated
USING (true);
