-- Migration: Make template_id optional in passports table
-- Purpose: Allow passports to be created without a template initially
-- Created: 2025-11-16

-- Remove NOT NULL constraint from template_id
ALTER TABLE passports
ALTER COLUMN template_id DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN passports.template_id IS 'Optional reference to passport template. Can be null if passport is created without a template.';
