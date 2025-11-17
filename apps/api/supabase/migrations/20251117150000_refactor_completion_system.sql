-- Migration: Refactor completion system from passports to products
-- This migration moves completion tracking from passport-level to product-level

-- Create new product_module_completion table
CREATE TABLE IF NOT EXISTS product_module_completion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  module_key varchar NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  last_evaluated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  CONSTRAINT product_module_completion_product_module_unq UNIQUE(product_id, module_key)
);

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS product_module_completion_product_id_idx ON product_module_completion(product_id);

-- Migrate existing completion data from passport_module_completion to product_module_completion
-- This preserves completion history for products that had passports
INSERT INTO product_module_completion (product_id, module_key, is_completed, last_evaluated_at)
SELECT
  p.product_id,
  pmc.module_key,
  pmc.is_completed,
  pmc.last_evaluated_at
FROM passport_module_completion pmc
JOIN passports p ON p.id = pmc.passport_id
ON CONFLICT (product_id, module_key) DO UPDATE SET
  is_completed = EXCLUDED.is_completed,
  last_evaluated_at = EXCLUDED.last_evaluated_at,
  updated_at = now();

-- Enable RLS on new table
ALTER TABLE product_module_completion ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_module_completion
CREATE POLICY product_module_completion_select_for_brand_members
  ON product_module_completion FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_module_completion.product_id
      AND is_brand_member(p.brand_id)
    )
  );

CREATE POLICY product_module_completion_insert_for_brand_members
  ON product_module_completion FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_module_completion.product_id
      AND is_brand_member(p.brand_id)
    )
  );

CREATE POLICY product_module_completion_update_for_brand_members
  ON product_module_completion FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_module_completion.product_id
      AND is_brand_member(p.brand_id)
    )
  );

CREATE POLICY product_module_completion_delete_for_brand_members
  ON product_module_completion FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_module_completion.product_id
      AND is_brand_member(p.brand_id)
    )
  );

-- Service role bypass policy
CREATE POLICY product_module_completion_service_role_all
  ON product_module_completion FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Drop old passport-related tables
-- These are no longer needed as passport logic moves to products.template_id
DROP TABLE IF EXISTS passport_module_completion CASCADE;
DROP TABLE IF EXISTS passports CASCADE;

-- Note: passport_templates and passport_template_modules tables are kept
-- as they define template configurations independent of specific passports
