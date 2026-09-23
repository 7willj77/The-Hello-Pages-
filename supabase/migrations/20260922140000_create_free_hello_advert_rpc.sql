CREATE OR REPLACE FUNCTION public.create_free_hello_advert(
  p_business_name text,
  p_email text,
  p_website text,
  p_telephone text,
  p_tagline text,
  p_image_url text,
  p_page_number integer,
  p_square_ids bigint[],
  p_customer_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_advert_id uuid;
  v_order_id uuid;
  v_promo_id uuid;
  v_square_count integer;
  v_updated_count integer;
  v_min_row integer;
  v_max_row integer;
  v_min_col integer;
  v_max_col integer;
  v_width integer;
  v_height integer;
  v_tier text;
  v_semi_used integer;
  v_semi_total integer;
  v_standard_used integer;
  v_standard_total integer;
BEGIN
  IF p_business_name IS NULL OR trim(p_business_name) = '' THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  IF p_email IS NULL OR trim(p_email) = '' THEN
    RAISE EXCEPTION 'Email address is required';
  END IF;

  IF p_page_number < 1 OR p_page_number > 50 THEN
    RAISE EXCEPTION 'Invalid page number';
  END IF;

  IF p_square_ids IS NULL OR array_length(p_square_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'No squares selected';
  END IF;

  v_square_count := array_length(p_square_ids, 1);

  IF v_square_count < 3 THEN
    RAISE EXCEPTION 'At least 3 squares are required';
  END IF;

  IF v_square_count <> (
    SELECT COUNT(DISTINCT id)
    FROM unnest(p_square_ids) AS x(id)
  ) THEN
    RAISE EXCEPTION 'Duplicate squares selected';
  END IF;

  SELECT tier
  INTO v_tier
  FROM pages
  WHERE id = p_page_number;

  IF v_tier IS NULL THEN
    RAISE EXCEPTION 'Invalid page';
  END IF;

  IF v_tier NOT IN ('SEMI-PREMIUM', 'STANDARD') THEN
    RAISE EXCEPTION 'Free Hello adverts are only available on Semi-Premium and Standard pages';
  END IF;

  SELECT
    MIN(row_number),
    MAX(row_number),
    MIN(column_number),
    MAX(column_number)
  INTO
    v_min_row,
    v_max_row,
    v_min_col,
    v_max_col
  FROM squares
  WHERE page_number = p_page_number
    AND id = ANY(p_square_ids);

  IF v_min_row IS NULL THEN
    RAISE EXCEPTION 'Selected squares not found on page';
  END IF;

  SELECT COUNT(*)
  INTO v_updated_count
  FROM squares
  WHERE page_number = p_page_number
    AND id = ANY(p_square_ids)
    AND status = 'available';

  IF v_updated_count <> v_square_count THEN
    RAISE EXCEPTION 'One or more selected squares are no longer available';
  END IF;

  v_width := v_max_col - v_min_col + 1;
  v_height := v_max_row - v_min_row + 1;

  IF v_width * v_height <> v_square_count THEN
    RAISE EXCEPTION 'Selected squares must form a single rectangle';
  END IF;

  SELECT
    id,
    semi_premium_total,
    semi_premium_used,
    standard_total,
    standard_used
  INTO
    v_promo_id,
    v_semi_total,
    v_semi_used,
    v_standard_total,
    v_standard_used
  FROM free_hello_promo
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF v_promo_id IS NULL THEN
    RAISE EXCEPTION 'Free Hello promotion is not configured';
  END IF;

  IF v_tier = 'SEMI-PREMIUM' THEN
    IF v_semi_used >= v_semi_total THEN
      RAISE EXCEPTION 'All Semi-Premium Free Hellos have been used';
    END IF;
  ELSE
    IF v_standard_used >= v_standard_total THEN
      RAISE EXCEPTION 'All Standard Free Hellos have been used';
    END IF;
  END IF;

  INSERT INTO adverts (
    business_name,
    email,
    website,
    telephone,
    tagline,
    image_url,
    page_number,
    width_squares,
    height_squares,
    square_count,
    amount,
    payment_status,
    status,
    customer_id,
    published_at
  )
  VALUES (
    trim(p_business_name),
    trim(p_email),
    NULLIF(trim(p_website), ''),
    NULLIF(trim(p_telephone), ''),
    NULLIF(trim(p_tagline), ''),
    NULLIF(trim(p_image_url), ''),
    p_page_number,
    v_width,
    v_height,
    v_square_count,
    0,
    'free',
    'published',
    p_customer_id,
    now()
  )
  RETURNING id INTO v_advert_id;

  UPDATE squares
  SET
    status = 'sold',
    reserved_until = NULL,
    advert_id = v_advert_id
  WHERE page_number = p_page_number
    AND id = ANY(p_square_ids)
    AND status = 'available';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> v_square_count THEN
    RAISE EXCEPTION 'One or more selected squares are no longer available';
  END IF;

  INSERT INTO orders (
    advert_id,
    amount,
    currency,
    status
  )
  VALUES (
    v_advert_id,
    0,
    'gbp',
    'free'
  )
  RETURNING id INTO v_order_id;

  IF v_tier = 'SEMI-PREMIUM' THEN
    UPDATE free_hello_promo
    SET
      semi_premium_used = semi_premium_used + 1,
      updated_at = now()
    WHERE id = v_promo_id;
  ELSE
    UPDATE free_hello_promo
    SET
      standard_used = standard_used + 1,
      updated_at = now()
    WHERE id = v_promo_id;
  END IF;

  RETURN json_build_object(
    'advert_id', v_advert_id,
    'order_id', v_order_id,
    'tier', v_tier,
    'square_count', v_square_count,
    'width_squares', v_width,
    'height_squares', v_height,
    'amount', 0
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.create_free_hello_advert(
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  bigint[],
  uuid
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_free_hello_advert(
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  bigint[],
  uuid
) TO service_role;
