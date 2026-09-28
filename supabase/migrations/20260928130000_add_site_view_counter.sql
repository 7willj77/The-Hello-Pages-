CREATE TABLE IF NOT EXISTS public.site_view_counter (
  id integer PRIMARY KEY,
  view_count bigint NOT NULL DEFAULT 8342
);

INSERT INTO public.site_view_counter (id, view_count)
VALUES (1, 8342)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.site_view_counter ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.increment_site_view_count()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count bigint;
BEGIN
  UPDATE public.site_view_counter
  SET view_count = view_count + 1
  WHERE id = 1
  RETURNING view_count INTO new_count;

  RETURN new_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_site_view_count() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_site_view_count() TO anon, authenticated;
