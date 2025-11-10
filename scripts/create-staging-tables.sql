-- Create staging tables for bulk import
-- These tables temporarily hold validated data before committing to production

-- Staging products table
CREATE TABLE IF NOT EXISTS staging_products (
  staging_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE ON UPDATE CASCADE,
  row_number INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE')),
  existing_product_id UUID REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,

  -- Product fields
  id UUID NOT NULL,
  brand_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  showcase_brand_id UUID,
  primary_image_url TEXT,
  category_id UUID,
  season TEXT,
  brand_certification_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (job_id, row_number)
);

CREATE INDEX IF NOT EXISTS staging_products_job_id_idx ON staging_products(job_id);
CREATE INDEX IF NOT EXISTS staging_products_brand_id_idx ON staging_products(brand_id);
CREATE INDEX IF NOT EXISTS staging_products_action_idx ON staging_products(action);
CREATE INDEX IF NOT EXISTS staging_products_existing_product_id_idx ON staging_products(existing_product_id);

-- Staging product variants table
CREATE TABLE IF NOT EXISTS staging_product_variants (
  staging_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staging_product_id UUID NOT NULL REFERENCES staging_products(staging_id) ON DELETE CASCADE ON UPDATE CASCADE,
  job_id UUID NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE ON UPDATE CASCADE,
  row_number INTEGER NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE')),
  existing_variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE ON UPDATE CASCADE,

  -- Variant fields
  id UUID NOT NULL,
  product_id UUID NOT NULL,
  color_id UUID,
  size_id UUID,
  sku TEXT,
  upid TEXT NOT NULL,
  product_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (job_id, row_number)
);

CREATE INDEX IF NOT EXISTS staging_product_variants_job_id_idx ON staging_product_variants(job_id);
CREATE INDEX IF NOT EXISTS staging_product_variants_staging_product_id_idx ON staging_product_variants(staging_product_id);
CREATE INDEX IF NOT EXISTS staging_product_variants_action_idx ON staging_product_variants(action);
CREATE INDEX IF NOT EXISTS staging_product_variants_existing_variant_id_idx ON staging_product_variants(existing_variant_id);
CREATE INDEX IF NOT EXISTS staging_product_variants_upid_idx ON staging_product_variants(upid);

-- Enable RLS on staging tables
ALTER TABLE staging_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging_product_variants ENABLE ROW LEVEL SECURITY;

-- RLS policies for staging_products
DROP POLICY IF EXISTS staging_products_select_for_brand_members ON staging_products;
CREATE POLICY staging_products_select_for_brand_members ON staging_products
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  ));

DROP POLICY IF EXISTS staging_products_insert_by_system ON staging_products;
CREATE POLICY staging_products_insert_by_system ON staging_products
  FOR INSERT TO authenticated, service_role
  WITH CHECK (EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  ));

DROP POLICY IF EXISTS staging_products_update_by_system ON staging_products;
CREATE POLICY staging_products_update_by_system ON staging_products
  FOR UPDATE TO authenticated, service_role
  USING (EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  ));

DROP POLICY IF EXISTS staging_products_delete_by_system ON staging_products;
CREATE POLICY staging_products_delete_by_system ON staging_products
  FOR DELETE TO authenticated, service_role
  USING (EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  ));

-- RLS policies for staging_product_variants
DROP POLICY IF EXISTS staging_product_variants_select_for_brand_members ON staging_product_variants;
CREATE POLICY staging_product_variants_select_for_brand_members ON staging_product_variants
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  ));

DROP POLICY IF EXISTS staging_product_variants_insert_by_system ON staging_product_variants;
CREATE POLICY staging_product_variants_insert_by_system ON staging_product_variants
  FOR INSERT TO authenticated, service_role
  WITH CHECK (EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  ));

DROP POLICY IF EXISTS staging_product_variants_update_by_system ON staging_product_variants;
CREATE POLICY staging_product_variants_update_by_system ON staging_product_variants
  FOR UPDATE TO authenticated, service_role
  USING (EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  ));

DROP POLICY IF EXISTS staging_product_variants_delete_by_system ON staging_product_variants;
CREATE POLICY staging_product_variants_delete_by_system ON staging_product_variants
  FOR DELETE TO authenticated, service_role
  USING (EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  ));
