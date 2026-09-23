ALTER TABLE public.adverts
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

UPDATE public.adverts
SET published_at = created_at
WHERE status = 'published'
  AND published_at IS NULL;
