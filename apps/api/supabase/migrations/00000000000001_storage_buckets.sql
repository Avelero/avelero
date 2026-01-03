-- ============================================================================
-- Storage Buckets and RLS Policies
-- ============================================================================
-- This migration creates all storage buckets and their access policies.
-- Buckets:
--   1. theme-screenshots (public, 1MB, image/webp only)
--   2. dpp-assets (public)
--   3. dpp-themes (public)
--   4. products (public)
--   5. product-imports (private, 5GB, CSV/Excel only)
--   6. brand-avatars (private)
--   7. avatars (private)
-- ============================================================================

-- ============================================================================
-- 1. Create Buckets
-- ============================================================================

-- theme-screenshots (public, 1MB limit, webp only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('theme-screenshots', 'theme-screenshots', true, 1048576, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- dpp-assets (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dpp-assets', 'dpp-assets', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- dpp-themes (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('dpp-themes', 'dpp-themes', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- products (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- product-imports (private, 5GB limit, CSV/Excel only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-imports',
  'product-imports',
  false,
  5368709120, -- 5GB in bytes
  ARRAY['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- brand-avatars (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-avatars', 'brand-avatars', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- avatars (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ============================================================================
-- 2. RLS Policies for theme-screenshots
-- ============================================================================

DROP POLICY IF EXISTS "Allow everyone read theme screenshots" ON storage.objects;
CREATE POLICY "Allow everyone read theme screenshots"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'theme-screenshots');

-- ============================================================================
-- 3. RLS Policies for dpp-assets
-- ============================================================================

DROP POLICY IF EXISTS "Allow brand members delete dpp-assets" ON storage.objects;
CREATE POLICY "Allow brand members delete dpp-assets"
ON storage.objects FOR DELETE TO authenticated, service_role
USING ((bucket_id = 'dpp-assets') AND public.is_brand_member((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow brand members update dpp-assets" ON storage.objects;
CREATE POLICY "Allow brand members update dpp-assets"
ON storage.objects FOR UPDATE TO authenticated, service_role
USING ((bucket_id = 'dpp-assets') AND public.is_brand_member((path_tokens[1])::uuid))
WITH CHECK ((bucket_id = 'dpp-assets') AND public.is_brand_member((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow brand members upload dpp-assets" ON storage.objects;
CREATE POLICY "Allow brand members upload dpp-assets"
ON storage.objects FOR INSERT TO authenticated, service_role
WITH CHECK ((bucket_id = 'dpp-assets') AND public.is_brand_member((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow everyone read dpp-assets" ON storage.objects;
CREATE POLICY "Allow everyone read dpp-assets"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'dpp-assets');

-- ============================================================================
-- 4. RLS Policies for dpp-themes
-- ============================================================================

DROP POLICY IF EXISTS "Allow members delete dpp themes" ON storage.objects;
CREATE POLICY "Allow members delete dpp themes"
ON storage.objects FOR DELETE TO authenticated, service_role
USING ((bucket_id = 'dpp-themes') AND public.is_brand_member((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow members read dpp themes" ON storage.objects;
CREATE POLICY "Allow members read dpp themes"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'dpp-themes');

DROP POLICY IF EXISTS "Allow members upload dpp themes" ON storage.objects;
CREATE POLICY "Allow members upload dpp themes"
ON storage.objects FOR INSERT TO authenticated, service_role
WITH CHECK ((bucket_id = 'dpp-themes') AND public.is_brand_member((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow members update dpp themes" ON storage.objects;
CREATE POLICY "Allow members update dpp themes"
ON storage.objects FOR UPDATE TO authenticated, service_role
USING ((bucket_id = 'dpp-themes') AND public.is_brand_member((path_tokens[1])::uuid))
WITH CHECK ((bucket_id = 'dpp-themes') AND public.is_brand_member((path_tokens[1])::uuid));

-- ============================================================================
-- 5. RLS Policies for products
-- ============================================================================

DROP POLICY IF EXISTS "Allow brand members delete product images" ON storage.objects;
CREATE POLICY "Allow brand members delete product images"
ON storage.objects FOR DELETE TO authenticated, service_role
USING ((bucket_id = 'products') AND public.is_brand_member((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow brand members update product images" ON storage.objects;
CREATE POLICY "Allow brand members update product images"
ON storage.objects FOR UPDATE TO authenticated, service_role
USING ((bucket_id = 'products') AND public.is_brand_member((path_tokens[1])::uuid))
WITH CHECK ((bucket_id = 'products') AND public.is_brand_member((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow brand members upload product images" ON storage.objects;
CREATE POLICY "Allow brand members upload product images"
ON storage.objects FOR INSERT TO authenticated, service_role
WITH CHECK ((bucket_id = 'products') AND public.is_brand_member((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow everyone read product images" ON storage.objects;
CREATE POLICY "Allow everyone read product images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'products');

-- ============================================================================
-- 6. RLS Policies for product-imports
-- ============================================================================

DROP POLICY IF EXISTS "Allow brand members read import files" ON storage.objects;
CREATE POLICY "Allow brand members read import files"
ON storage.objects FOR SELECT TO authenticated, service_role
USING ((bucket_id = 'product-imports') AND public.is_brand_member((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow brand members upload import files" ON storage.objects;
CREATE POLICY "Allow brand members upload import files"
ON storage.objects FOR INSERT TO authenticated, service_role
WITH CHECK ((bucket_id = 'product-imports') AND public.is_brand_member((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow brand owners delete import files" ON storage.objects;
CREATE POLICY "Allow brand owners delete import files"
ON storage.objects FOR DELETE TO authenticated, service_role
USING ((bucket_id = 'product-imports') AND public.is_brand_owner((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow brand owners update import files" ON storage.objects;
CREATE POLICY "Allow brand owners update import files"
ON storage.objects FOR UPDATE TO authenticated, service_role
USING ((bucket_id = 'product-imports') AND public.is_brand_owner((path_tokens[1])::uuid))
WITH CHECK ((bucket_id = 'product-imports') AND public.is_brand_owner((path_tokens[1])::uuid));

-- ============================================================================
-- 7. RLS Policies for brand-avatars
-- ============================================================================

DROP POLICY IF EXISTS "Allow invitees read brand avatars" ON storage.objects;
CREATE POLICY "Allow invitees read brand avatars"
ON storage.objects FOR SELECT TO authenticated, service_role
USING (
  bucket_id = 'brand-avatars'
  AND EXISTS (
    SELECT 1 FROM public.brand_invites bi
    WHERE bi.brand_id = (path_tokens[1])::uuid
    AND lower(bi.email) = lower(auth.email())
  )
);

DROP POLICY IF EXISTS "Allow members read brand avatars" ON storage.objects;
CREATE POLICY "Allow members read brand avatars"
ON storage.objects FOR SELECT TO authenticated, service_role
USING ((bucket_id = 'brand-avatars') AND public.is_brand_member((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow owner delete brand avatars" ON storage.objects;
CREATE POLICY "Allow owner delete brand avatars"
ON storage.objects FOR DELETE TO authenticated, service_role
USING ((bucket_id = 'brand-avatars') AND public.is_brand_owner((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow owner update brand avatars" ON storage.objects;
CREATE POLICY "Allow owner update brand avatars"
ON storage.objects FOR UPDATE TO authenticated, service_role
USING ((bucket_id = 'brand-avatars') AND public.is_brand_owner((path_tokens[1])::uuid))
WITH CHECK ((bucket_id = 'brand-avatars') AND public.is_brand_owner((path_tokens[1])::uuid));

DROP POLICY IF EXISTS "Allow owner upload brand avatars" ON storage.objects;
CREATE POLICY "Allow owner upload brand avatars"
ON storage.objects FOR INSERT TO authenticated, service_role
WITH CHECK ((bucket_id = 'brand-avatars') AND public.is_brand_owner((path_tokens[1])::uuid));

-- ============================================================================
-- 8. RLS Policies for avatars
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated uploads to avatars" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to avatars"
ON storage.objects FOR INSERT TO authenticated, service_role
WITH CHECK (
  bucket_id = 'avatars'
  AND (path_tokens[1] = (auth.uid())::text)
);

DROP POLICY IF EXISTS "Allow owner delete avatars" ON storage.objects;
CREATE POLICY "Allow owner delete avatars"
ON storage.objects FOR DELETE TO authenticated, service_role
USING (bucket_id = 'avatars' AND path_tokens[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "Allow owner update avatars" ON storage.objects;
CREATE POLICY "Allow owner update avatars"
ON storage.objects FOR UPDATE TO authenticated, service_role
USING (bucket_id = 'avatars' AND path_tokens[1] = (auth.uid())::text)
WITH CHECK (bucket_id = 'avatars' AND path_tokens[1] = (auth.uid())::text);

DROP POLICY IF EXISTS "Allow select of user avatars by owner or brand members" ON storage.objects;
CREATE POLICY "Allow select of user avatars by owner or brand members"
ON storage.objects FOR SELECT TO authenticated, service_role
USING (
  bucket_id = 'avatars'
  AND (
    (path_tokens[1] = (auth.uid())::text)
    OR public.shares_brand_with((path_tokens[1])::uuid)
  )
);

-- ============================================================================
-- Done
-- ============================================================================
SELECT 'Storage buckets and policies created successfully' as message;
