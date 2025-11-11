-- =====================================================================
-- CLEANUP ORPHANED STAGING DATA
-- =====================================================================
-- This script safely removes staging data from completed/failed imports
-- Run this in Supabase SQL Editor
-- =====================================================================

-- Step 1: Check current staging data (DIAGNOSTIC - Safe to run)
-- =====================================================================
SELECT 
  'staging_products' as table_name,
  COUNT(*) as row_count
FROM staging_products
UNION ALL
SELECT 
  'staging_product_variants' as table_name,
  COUNT(*) as row_count
FROM staging_product_variants
UNION ALL
SELECT 
  'staging_product_materials' as table_name,
  COUNT(*) as row_count
FROM staging_product_materials
UNION ALL
SELECT 
  'staging_product_care_codes' as table_name,
  COUNT(*) as row_count
FROM staging_product_care_codes
UNION ALL
SELECT 
  'staging_product_eco_claims' as table_name,
  COUNT(*) as row_count
FROM staging_product_eco_claims;

-- Step 2: View jobs with orphaned staging data (DIAGNOSTIC - Safe to run)
-- =====================================================================
SELECT 
  sp.job_id,
  ij.status,
  ij.filename,
  ij.started_at,
  ij.finished_at,
  COUNT(sp.staging_id) as staging_product_count,
  COUNT(spv.staging_id) as staging_variant_count
FROM staging_products sp
LEFT JOIN import_jobs ij ON sp.job_id = ij.id
LEFT JOIN staging_product_variants spv ON sp.staging_id = spv.staging_product_id
GROUP BY sp.job_id, ij.status, ij.filename, ij.started_at, ij.finished_at
ORDER BY ij.started_at DESC NULLS LAST;

-- Step 3: DELETE orphaned staging data (DESTRUCTIVE - Review before running!)
-- =====================================================================
-- This will delete staging data for jobs that are:
-- - COMPLETED (already committed to production)
-- - CANCELLED (user cancelled)
-- - FAILED (commit failed)
-- - DELETED (job record was deleted)
-- =====================================================================

-- UNCOMMENT THE LINES BELOW TO RUN THE CLEANUP:

-- DELETE FROM staging_products
-- WHERE job_id IN (
--   SELECT id FROM import_jobs 
--   WHERE status IN ('COMPLETED', 'CANCELLED', 'FAILED')
-- )
-- OR job_id NOT IN (
--   SELECT id FROM import_jobs
-- );

-- Step 4: Verify cleanup (DIAGNOSTIC - Safe to run after cleanup)
-- =====================================================================
SELECT 
  'After cleanup - staging_products' as status,
  COUNT(*) as remaining_rows
FROM staging_products
UNION ALL
SELECT 
  'After cleanup - staging_product_variants' as status,
  COUNT(*) as remaining_rows
FROM staging_product_variants;

-- =====================================================================
-- ALTERNATIVE: Delete staging data for a specific job
-- =====================================================================
-- If you want to delete staging data for a specific job ID only:

-- DELETE FROM staging_products
-- WHERE job_id = 'YOUR-JOB-ID-HERE';

-- =====================================================================
-- ALTERNATIVE: Delete ALL staging data (NUCLEAR OPTION - Use with caution!)
-- =====================================================================
-- Only use this if you're sure there are no active imports running:

-- TRUNCATE TABLE staging_products CASCADE;

-- =====================================================================
-- NOTES:
-- =====================================================================
-- 1. staging_products CASCADE will automatically delete from:
--    - staging_product_variants
--    - staging_product_materials
--    - staging_product_care_codes
--    - staging_product_eco_claims
--    - staging_product_journey_steps (if migration applied)
--    - staging_product_environment (if migration applied)
--    - staging_product_identifiers (if migration applied)
--    - staging_product_variant_identifiers (if migration applied)
--
-- 2. Always check active jobs before cleanup:
--    SELECT * FROM import_jobs WHERE status IN ('VALIDATING', 'COMMITTING');
--
-- 3. Staging data should only exist for active imports
-- =====================================================================
