CREATE POLICY "Public can view advert artwork"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'adverts'
);

CREATE POLICY "Authenticated users can upload advert artwork"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'adverts'
);

CREATE POLICY "Authenticated users can update advert artwork"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'adverts'
)
WITH CHECK (
  bucket_id = 'adverts'
);

CREATE POLICY "Authenticated users can delete advert artwork"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'adverts'
);
