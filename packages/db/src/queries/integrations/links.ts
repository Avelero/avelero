/**
 * Integration links - backward compatibility shim.
 * 
 * This file re-exports all link functions from the organized
 * integrations/links/ directory structure. The actual implementations have been
 * split into:
 * - integrations/links/product-links.ts - Product link operations
 * - integrations/links/variant-links.ts - Variant link operations
 * - integrations/links/entity-links.ts - Entity link operations (materials, facilities, etc.)
 * - integrations/links/oauth-states.ts - OAuth state management
 * 
 * @deprecated Import directly from integrations/links/ submodules for better tree-shaking.
 */
export * from "./links/index.js";
