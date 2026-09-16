-- THE HELLO PAGES
-- Add Supabase Auth ownership to customer adverts

ALTER TABLE public.adverts
  ADD COLUMN IF NOT EXISTS customer_id uuid
  REFERENCES auth.users(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS adverts_customer_id_idx
  ON public.adverts(customer_id);

COMMENT ON COLUMN public.adverts.customer_id IS
  'Supabase Auth user who owns/manages this advert. NULL for legacy/House adverts until claimed.';
