-- Verification script for product-imports bucket and policies
-- Run this in Supabase SQL Editor to check if everything is configured correctly

-- 1. Check if bucket exists
SELECT 
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets 
WHERE id = 'product-imports';
-- Expected: 1 row with public=false, file_size_limit=5368709120

-- 2. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'objects' 
  AND policyname LIKE '%import%'
ORDER BY policyname;
-- Expected: 4 policies (insert, select, update, delete)

-- 3. Test if storage.objects has RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'storage' 
  AND tablename = 'objects';
-- Expected: rowsecurity = true

-- 4. Check if helper functions exist
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_brand_member', 'is_brand_owner')
ORDER BY routine_name;
-- Expected: 2 functions

-- If any checks fail, apply the migration:
-- apps/api/supabase/migrations/20251107180000_create_product_imports_bucket.sql
