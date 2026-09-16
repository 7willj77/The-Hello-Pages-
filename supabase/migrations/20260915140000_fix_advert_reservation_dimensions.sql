CREATE OR REPLACE FUNCTION public.create_advert_reservation(
  p_business_name text,
  p_email text,
  p_website text,
  p_telephone text,
  p_tagline text,
  p_page_number integer,
  p_square_ids bigint[],
  p_reserved_until timestamptz
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_advert_id uuid;
  v_order_id uuid;
  v_price numeric(10,2);
  v_price_per_square numeric(10,2);
  v_square_count integer;
  v_updated_count integer;
  v_min_row integer;
  v_max_row integer;
  v_min_col integer;
  v_max_col integer;
  v_width integer;
  v_height integer;
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

  SELECT price_per_square
  INTO v_price_per_square
  FROM pages
  WHERE id = p_page_number;

  IF v_price_per_square IS NULL THEN
    RAISE EXCEPTION 'Invalid page';
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

  v_price := v_square_count * v_price_per_square;

  INSERT INTO adverts (
    business_name,
    email,
    website,
    telephone,
    tagline,
    page_number,
    width_squares,
    height_squares,
    square_count,
    amount,
    payment_status,
    status
  )
  VALUES (
    trim(p_business_name),
    trim(p_email),
    NULLIF(trim(p_website), ''),
    NULLIF(trim(p_telephone), ''),
    NULLIF(trim(p_tagline), ''),
    p_page_number,
    v_width,
    v_height,
    v_square_count,
    v_price,
    'pending',
    'reserved'
  )
  RETURNING id INTO v_advert_id;

  UPDATE squares
  SET
    status = 'reserved',
    reserved_until = p_reserved_until,
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
    v_price,
    'gbp',
    'pending'
  )
  RETURNING id INTO v_order_id;

  RETURN json_build_object(
    'advert_id', v_advert_id,
    'order_id', v_order_id,
    'amount', v_price,
    'price_per_square', v_price_per_square,
    'square_count', v_square_count,
    'width_squares', v_width,
    'height_squares', v_height
  );
END;
$function$;
