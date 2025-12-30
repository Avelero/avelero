-- Migration: Fix missing WITH CHECK clauses in RLS policies
-- Date: 2025-11-16
-- Description: Adds WITH CHECK clauses to UPDATE policies to prevent cross-brand data manipulation
-- This fixes security vulnerabilities where brand members could update rows into other brands

-- ============================================================================
-- Fix staging tables from 20251107174000_add_missing_staging_tables.sql
-- ============================================================================

-- Fix staging_product_variants UPDATE policy (line 97)
DROP POLICY IF EXISTS "staging_product_variants_update_by_system" ON staging_product_variants;
CREATE POLICY "staging_product_variants_update_by_system"
  ON staging_product_variants
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated, service_role
  USING (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = staging_product_variants.job_id
      AND is_brand_member(import_jobs.brand_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = staging_product_variants.job_id
      AND is_brand_member(import_jobs.brand_id)
    )
  );

-- Fix staging_product_materials UPDATE policy (line 130)
DROP POLICY IF EXISTS "staging_product_materials_update_by_system" ON staging_product_materials;
CREATE POLICY "staging_product_materials_update_by_system"
  ON staging_product_materials
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated, service_role
  USING (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = staging_product_materials.job_id
      AND is_brand_member(import_jobs.brand_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = staging_product_materials.job_id
      AND is_brand_member(import_jobs.brand_id)
    )
  );

-- Fix staging_product_care_codes UPDATE policy (line 163)
DROP POLICY IF EXISTS "staging_product_care_codes_update_by_system" ON staging_product_care_codes;
CREATE POLICY "staging_product_care_codes_update_by_system"
  ON staging_product_care_codes
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated, service_role
  USING (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = staging_product_care_codes.job_id
      AND is_brand_member(import_jobs.brand_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = staging_product_care_codes.job_id
      AND is_brand_member(import_jobs.brand_id)
    )
  );

-- Fix staging_product_eco_claims UPDATE policy (line 196)
DROP POLICY IF EXISTS "staging_product_eco_claims_update_by_system" ON staging_product_eco_claims;
CREATE POLICY "staging_product_eco_claims_update_by_system"
  ON staging_product_eco_claims
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated, service_role
  USING (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = staging_product_eco_claims.job_id
      AND is_brand_member(import_jobs.brand_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM import_jobs
      WHERE import_jobs.id = staging_product_eco_claims.job_id
      AND is_brand_member(import_jobs.brand_id)
    )
  );

-- ============================================================================
-- Fix brand_seasons UPDATE policy
-- ============================================================================

DROP POLICY IF EXISTS "brand_seasons_update_by_brand_member" ON brand_seasons;
CREATE POLICY "brand_seasons_update_by_brand_member"
  ON brand_seasons
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (is_brand_member(brand_id))
  WITH CHECK (is_brand_member(brand_id));

-- ============================================================================
-- Fix import_jobs UPDATE policy from 20251111193516_gorgeous_blockbuster.sql
-- ============================================================================

DROP POLICY IF EXISTS "import_jobs_update_by_brand_member" ON import_jobs;
CREATE POLICY "import_jobs_update_by_brand_member"
  ON import_jobs
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated, service_role
  USING (is_brand_member(brand_id))
  WITH CHECK (is_brand_member(brand_id));

-- ============================================================================
-- Add comments for documentation
-- ============================================================================

COMMENT ON POLICY "staging_product_variants_update_by_system" ON staging_product_variants IS
  'Allows authenticated brand members to update staging product variants for their import jobs. WITH CHECK ensures rows cannot be moved to other brands.';

COMMENT ON POLICY "staging_product_materials_update_by_system" ON staging_product_materials IS
  'Allows authenticated brand members to update staging product materials for their import jobs. WITH CHECK ensures rows cannot be moved to other brands.';

COMMENT ON POLICY "staging_product_care_codes_update_by_system" ON staging_product_care_codes IS
  'Allows authenticated brand members to update staging product care codes for their import jobs. WITH CHECK ensures rows cannot be moved to other brands.';

COMMENT ON POLICY "staging_product_eco_claims_update_by_system" ON staging_product_eco_claims IS
  'Allows authenticated brand members to update staging product eco claims for their import jobs. WITH CHECK ensures rows cannot be moved to other brands.';

COMMENT ON POLICY "brand_seasons_update_by_brand_member" ON brand_seasons IS
  'Allows authenticated brand members to update seasons for their brand. WITH CHECK prevents moving seasons to other brands.';

COMMENT ON POLICY "import_jobs_update_by_brand_member" ON import_jobs IS
  'Allows authenticated brand members to update import jobs for their brand. WITH CHECK prevents moving jobs to other brands.';
