CREATE TABLE IF NOT EXISTS public.free_hello_promo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semi_premium_total integer NOT NULL DEFAULT 5,
  semi_premium_used integer NOT NULL DEFAULT 0,
  standard_total integer NOT NULL DEFAULT 10,
  standard_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.free_hello_promo (
  semi_premium_total,
  semi_premium_used,
  standard_total,
  standard_used
)
SELECT 5, 0, 10, 0
WHERE NOT EXISTS (
  SELECT 1 FROM public.free_hello_promo
);

ALTER TABLE public.free_hello_promo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage free hello promo"
ON public.free_hello_promo
FOR ALL
TO authenticated
USING (
  lower(auth.jwt() ->> 'email') = 'jameswills86@hotmail.com'
)
WITH CHECK (
  lower(auth.jwt() ->> 'email') = 'jameswills86@hotmail.com'
);
