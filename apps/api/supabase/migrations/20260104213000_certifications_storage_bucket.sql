-- ============================================================================
-- Certifications Storage Bucket and RLS Policies
-- ============================================================================
-- This migration creates the certifications storage bucket for storing
-- certification documents (PDFs, images) uploaded by brand members.
--
-- Bucket configuration:
--   - Name: certifications
--   - Public: true (for DPP transparency - certificates are publicly viewable)
--   - File size limit: 50MB (52428800 bytes)
--   - Allowed MIME types: PDF, JPEG, PNG, WEBP
--
-- Path structure: certifications/{brand_id}/{filename}
-- ============================================================================

-- ============================================================================
-- 1. Create Bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certifications',
  'certifications',
  true,
  52428800, -- 50MB in bytes
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 2. RLS Policies for certifications bucket
-- ============================================================================

-- Allow everyone to read certificates (for DPP public display)
DROP POLICY IF EXISTS "Allow everyone read certifications" ON storage.objects;
CREATE POLICY "Allow everyone read certifications"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'certifications');

-- Allow brand members to upload certificates
-- Path: certifications/{brand_id}/{filename}
DROP POLICY IF EXISTS "Allow brand members upload certifications" ON storage.objects;
CREATE POLICY "Allow brand members upload certifications"
ON storage.objects FOR INSERT TO authenticated, service_role
WITH CHECK (
  (bucket_id = 'certifications') 
  AND public.is_brand_member((path_tokens[1])::uuid)
);

-- Allow brand members to update certificates
DROP POLICY IF EXISTS "Allow brand members update certifications" ON storage.objects;
CREATE POLICY "Allow brand members update certifications"
ON storage.objects FOR UPDATE TO authenticated, service_role
USING ((bucket_id = 'certifications') AND public.is_brand_member((path_tokens[1])::uuid))
WITH CHECK ((bucket_id = 'certifications') AND public.is_brand_member((path_tokens[1])::uuid));

-- Allow brand members to delete certificates
DROP POLICY IF EXISTS "Allow brand members delete certifications" ON storage.objects;
CREATE POLICY "Allow brand members delete certifications"
ON storage.objects FOR DELETE TO authenticated, service_role
USING ((bucket_id = 'certifications') AND public.is_brand_member((path_tokens[1])::uuid));

-- ============================================================================
-- Done
-- ============================================================================
SELECT 'Certifications storage bucket and policies created successfully' as message;
