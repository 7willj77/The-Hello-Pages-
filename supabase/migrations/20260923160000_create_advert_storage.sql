INSERT INTO storage.buckets (id, name, public)
VALUES ('adverts', 'adverts', true)
ON CONFLICT (id) DO UPDATE
SET public = true;
