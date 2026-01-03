-- Migration: Batch insert staging data with single round trip
-- Date: 2025-11-17
-- Description: Creates a PostgreSQL function that performs all 3 staging operations
-- (insert products, insert variants, update import rows) in a single database round trip
-- to reduce network latency overhead.
--
-- Performance Impact:
-- - Reduces 3 round trips → 1 round trip per batch
-- - Saves ~400ms per batch at 200ms latency (20 batches = 8 seconds saved)
-- - Expected 30-40% improvement when combined with batch size optimization

CREATE OR REPLACE FUNCTION batch_insert_staging_with_status(
  p_products jsonb,
  p_variants jsonb,
  p_status_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_product_ids uuid[];
  v_variant_ids uuid[];
  v_result jsonb;
  v_rows_updated integer;
BEGIN
  -- Insert products and collect staging IDs
  WITH inserted_products AS (
    INSERT INTO staging_products (
      job_id, row_number, action, existing_product_id,
      id, brand_id, product_identifier, product_upid,
      name, description, showcase_brand_id, primary_image_url,
      additional_image_urls, category_id, season, season_id,
      tags, brand_certification_id, status
    )
    SELECT
      (value->>'jobId')::uuid,
      (value->>'rowNumber')::int,
      (value->>'action')::text,
      (value->>'existingProductId')::uuid,
      (value->>'id')::uuid,
      (value->>'brandId')::uuid,
      value->>'productIdentifier',
      value->>'productUpid',
      value->>'name',
      value->>'description',
      (value->>'showcaseBrandId')::uuid,
      value->>'primaryImageUrl',
      value->>'additionalImageUrls',
      (value->>'categoryId')::uuid,
      value->>'season',
      (value->>'seasonId')::uuid,
      value->>'tags',
      (value->>'brandCertificationId')::uuid,
      value->>'status'
    FROM jsonb_array_elements(p_products)
    RETURNING staging_id
  )
  SELECT array_agg(staging_id ORDER BY staging_id) INTO v_product_ids FROM inserted_products;

  -- Insert variants using corresponding product IDs by index
  WITH indexed_variants AS (
    SELECT
      value,
      row_number() OVER () as idx
    FROM jsonb_array_elements(p_variants)
  ),
  inserted_variants AS (
    INSERT INTO staging_product_variants (
      staging_product_id, job_id, row_number, action,
      existing_variant_id, id, product_id, color_id, size_id,
      sku, ean, upid, product_image_url, status
    )
    SELECT
      v_product_ids[idx],
      (value->>'jobId')::uuid,
      (value->>'rowNumber')::int,
      (value->>'action')::text,
      (value->>'existingVariantId')::uuid,
      (value->>'id')::uuid,
      (value->>'productId')::uuid,
      (value->>'colorId')::uuid,
      (value->>'sizeId')::uuid,
      value->>'sku',
      value->>'ean',
      value->>'upid',
      value->>'productImageUrl',
      value->>'status'
    FROM indexed_variants
    RETURNING staging_id
  )
  SELECT array_agg(staging_id ORDER BY staging_id) INTO v_variant_ids FROM inserted_variants;

  -- Update import_rows status in bulk
  WITH status_updates AS (
    SELECT
      (value->>'id')::uuid as row_id,
      (value->>'status')::text as new_status,
      (value->'normalized')::jsonb as normalized_data,
      value->>'error' as error_msg
    FROM jsonb_array_elements(p_status_updates)
  )
  UPDATE import_rows
  SET
    status = status_updates.new_status,
    normalized = status_updates.normalized_data,
    error = status_updates.error_msg,
    updated_at = now()
  FROM status_updates
  WHERE import_rows.id = status_updates.row_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  -- Return summary
  SELECT jsonb_build_object(
    'products_inserted', coalesce(array_length(v_product_ids, 1), 0),
    'variants_inserted', coalesce(array_length(v_variant_ids, 1), 0),
    'rows_updated', v_rows_updated,
    'product_ids', CASE WHEN v_product_ids IS NOT NULL THEN to_jsonb(v_product_ids) ELSE '[]'::jsonb END,
    'variant_ids', CASE WHEN v_variant_ids IS NOT NULL THEN to_jsonb(v_variant_ids) ELSE '[]'::jsonb END
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated and service role users
GRANT EXECUTE ON FUNCTION batch_insert_staging_with_status(jsonb, jsonb, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION batch_insert_staging_with_status IS
  'Batch inserts staging products, variants, and updates import row statuses in a single database round trip.
   Used for performance optimization during bulk product imports to reduce network latency overhead.

   Parameters:
   - p_products: Array of staging product objects
   - p_variants: Array of staging variant objects (order must match products)
   - p_status_updates: Array of import row status updates

   Returns: JSON object with counts and IDs of inserted records';

SELECT 'Migration completed: Added batch_insert_staging_with_status function' as message;
