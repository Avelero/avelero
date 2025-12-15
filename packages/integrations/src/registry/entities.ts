/**
 * Entity Definitions
 *
 * Defines all syncable entities and their metadata.
 */

import type { EntityDefinition } from "./types";

/**
 * All syncable entities in the system.
 */
export const entities: Record<string, EntityDefinition> = {
  product: {
    table: "products",
    label: "Product",
    description: "Core product information",
    identifiedBy: "productHandle",
    brandScoped: true,
  },

  variant: {
    table: "product_variants",
    label: "Product Variant",
    description: "Color/size variants of a product",
    identifiedBy: "upid",
    parentEntity: "product",
    brandScoped: true,
  },

  environment: {
    table: "product_environment",
    label: "Environmental Data",
    description: "Environmental impact metrics (1:1 with product)",
    identifiedBy: "productId",
    parentEntity: "product",
    brandScoped: true,
  },

  material: {
    table: "brand_materials",
    label: "Material",
    description: "Material definitions (cotton, polyester, etc.)",
    identifiedBy: "name",
    brandScoped: true,
  },

  productMaterial: {
    table: "product_materials",
    label: "Product Material",
    description: "Junction table linking products to materials with percentage",
    identifiedBy: "id",
    parentEntity: "product",
    brandScoped: true,
  },

  facility: {
    table: "brand_facilities",
    label: "Facility",
    description: "Manufacturing facilities and suppliers",
    identifiedBy: "displayName",
    brandScoped: true,
  },

  journeyStep: {
    table: "product_journey_steps",
    label: "Journey Step",
    description: "Supply chain step linking product to facility",
    identifiedBy: "id",
    parentEntity: "product",
    brandScoped: true,
  },

  manufacturer: {
    table: "brand_manufacturers",
    label: "Manufacturer",
    description: "Product manufacturer/brand owner",
    identifiedBy: "name",
    brandScoped: true,
  },

  season: {
    table: "brand_seasons",
    label: "Season",
    description: "Fashion seasons (SS25, FW24, etc.)",
    identifiedBy: "name",
    brandScoped: true,
  },

  category: {
    table: "categories",
    label: "Category",
    description: "Product category hierarchy",
    identifiedBy: "name",
    brandScoped: false, // Global categories
  },

  color: {
    table: "brand_colors",
    label: "Color",
    description: "Color definitions with optional hex code",
    identifiedBy: "name",
    brandScoped: true,
  },

  size: {
    table: "brand_sizes",
    label: "Size",
    description: "Size definitions with sort order",
    identifiedBy: "name",
    brandScoped: true,
  },

  tag: {
    table: "brand_tags",
    label: "Tag",
    description: "Custom product tags",
    identifiedBy: "name",
    brandScoped: true,
  },

  ecoClaim: {
    table: "brand_eco_claims",
    label: "Eco Claim",
    description: "Environmental/sustainability claims",
    identifiedBy: "claim",
    brandScoped: true,
  },

  certification: {
    table: "brand_certifications",
    label: "Certification",
    description: "Certification documents and details",
    identifiedBy: "title",
    brandScoped: true,
  },
} as const;

/**
 * Entity names as a type union
 */
export type EntityName = keyof typeof entities;

/**
 * Get an entity definition by name
 */
export function getEntity(name: string): EntityDefinition | undefined {
  return entities[name];
}

/**
 * Get all brand-scoped entities
 */
export function getBrandScopedEntities(): Record<string, EntityDefinition> {
  return Object.fromEntries(
    Object.entries(entities).filter(([, def]) => def.brandScoped)
  );
}

/**
 * Get all global (non-brand-scoped) entities
 */
export function getGlobalEntities(): Record<string, EntityDefinition> {
  return Object.fromEntries(
    Object.entries(entities).filter(([, def]) => !def.brandScoped)
  );
}

