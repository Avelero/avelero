-- Seed file for Avelero database
-- This runs after migrations on db reset and can be used for initial data setup

-- ============================================
-- Seed Integrations (Available Platforms)
-- ============================================
INSERT INTO public.integrations (id, slug, name, description, auth_type, status)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'shopify',
  'Shopify',
  'Connect your Shopify store to sync product information with Avelero',
  'oauth',
  'active'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  auth_type = EXCLUDED.auth_type,
  status = EXCLUDED.status,
  updated_at = now();
