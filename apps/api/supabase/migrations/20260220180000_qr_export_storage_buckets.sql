-- ============================================================================
-- QR Export Storage Buckets and RLS Policies
-- ============================================================================
-- Buckets:
--   1. product-qr-codes (public): QR PNG files for product variants
--   2. qr-code-exports (private): CSV export files with QR metadata
--
-- Required object path shape for both buckets:
--   {brand_id}/{job_id}/{filename}
-- ============================================================================

-- ============================================================================
-- 1. Create Buckets
-- ============================================================================

-- Public bucket for PNG QR files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-qr-codes',
  'product-qr-codes',
  true,
  10485760, -- 10MB per file
  ARRAY['image/png']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Private bucket for QR export CSV artifacts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'qr-code-exports',
  'qr-code-exports',
  false,
  104857600, -- 100MB per file
  ARRAY['text/csv']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 2. RLS Policies: product-qr-codes
-- ============================================================================

-- Public read access to QR PNG files
DROP POLICY IF EXISTS "Allow everyone read product QR files" ON storage.objects;
CREATE POLICY "Allow everyone read product QR files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'product-qr-codes');

-- Service role uploads QR PNGs only to strict path shape: {brand_id}/{job_id}/{filename}
DROP POLICY IF EXISTS "Allow service role upload product QR files" ON storage.objects;
CREATE POLICY "Allow service role upload product QR files"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (
  bucket_id = 'product-qr-codes'
  AND array_length(path_tokens, 1) = 3
  AND path_tokens[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND path_tokens[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND COALESCE(path_tokens[3], '') <> ''
);

-- Brand owners may delete their own QR PNG files
DROP POLICY IF EXISTS "Allow brand owners delete product QR files" ON storage.objects;
CREATE POLICY "Allow brand owners delete product QR files"
ON storage.objects FOR DELETE TO authenticated, service_role
USING (
  bucket_id = 'product-qr-codes'
  AND array_length(path_tokens, 1) = 3
  AND path_tokens[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_brand_owner((path_tokens[1])::uuid)
);

-- Brand owners may update metadata for their own QR PNG files
DROP POLICY IF EXISTS "Allow brand owners update product QR files" ON storage.objects;
CREATE POLICY "Allow brand owners update product QR files"
ON storage.objects FOR UPDATE TO authenticated, service_role
USING (
  bucket_id = 'product-qr-codes'
  AND array_length(path_tokens, 1) = 3
  AND path_tokens[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_brand_owner((path_tokens[1])::uuid)
)
WITH CHECK (
  bucket_id = 'product-qr-codes'
  AND array_length(path_tokens, 1) = 3
  AND path_tokens[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND path_tokens[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND COALESCE(path_tokens[3], '') <> ''
  AND public.is_brand_owner((path_tokens[1])::uuid)
);

-- ============================================================================
-- 3. RLS Policies: qr-code-exports
-- ============================================================================

-- Brand members can read CSV exports for their brand
DROP POLICY IF EXISTS "Allow brand members read QR export files" ON storage.objects;
CREATE POLICY "Allow brand members read QR export files"
ON storage.objects FOR SELECT TO authenticated, service_role
USING (
  bucket_id = 'qr-code-exports'
  AND array_length(path_tokens, 1) = 3
  AND path_tokens[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_brand_member((path_tokens[1])::uuid)
);

-- Service role uploads CSV exports only to strict path shape: {brand_id}/{job_id}/{filename}
DROP POLICY IF EXISTS "Allow service role upload QR export files" ON storage.objects;
CREATE POLICY "Allow service role upload QR export files"
ON storage.objects FOR INSERT TO service_role
WITH CHECK (
  bucket_id = 'qr-code-exports'
  AND array_length(path_tokens, 1) = 3
  AND path_tokens[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND path_tokens[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND COALESCE(path_tokens[3], '') <> ''
);

-- Brand owners may delete their own CSV export files
DROP POLICY IF EXISTS "Allow brand owners delete QR export files" ON storage.objects;
CREATE POLICY "Allow brand owners delete QR export files"
ON storage.objects FOR DELETE TO authenticated, service_role
USING (
  bucket_id = 'qr-code-exports'
  AND array_length(path_tokens, 1) = 3
  AND path_tokens[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_brand_owner((path_tokens[1])::uuid)
);

-- Brand owners may update metadata for their own CSV export files
DROP POLICY IF EXISTS "Allow brand owners update QR export files" ON storage.objects;
CREATE POLICY "Allow brand owners update QR export files"
ON storage.objects FOR UPDATE TO authenticated, service_role
USING (
  bucket_id = 'qr-code-exports'
  AND array_length(path_tokens, 1) = 3
  AND path_tokens[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND public.is_brand_owner((path_tokens[1])::uuid)
)
WITH CHECK (
  bucket_id = 'qr-code-exports'
  AND array_length(path_tokens, 1) = 3
  AND path_tokens[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND path_tokens[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND COALESCE(path_tokens[3], '') <> ''
  AND public.is_brand_owner((path_tokens[1])::uuid)
);

-- ============================================================================
-- Done
-- ============================================================================
SELECT 'QR export storage buckets and policies created successfully' as message;
