drop policy if exists "Published paid adverts are publicly readable" on public.adverts;

create policy "Published paid adverts are publicly readable"
on public.adverts
for select
to authenticated
using (
  status = 'published'
  and payment_status = 'paid'
);
