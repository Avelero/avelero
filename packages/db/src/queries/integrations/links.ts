import { and, eq, gt, lt, sql } from "drizzle-orm";
import type { Database } from "../../client";
import {
  integrationProductLinks,
  integrationVariantLinks,
  integrationMaterialLinks,
  integrationFacilityLinks,
  integrationManufacturerLinks,
  integrationSeasonLinks,
  integrationColorLinks,
  integrationSizeLinks,
  integrationTagLinks,
  integrationEcoClaimLinks,
  integrationCertificationLinks,
  oauthStates,
  brandMaterials,
  brandFacilities,
  brandManufacturers,
  brandSeasons,
  brandColors,
  brandSizes,
  brandTags,
  brandEcoClaims,
  brandCertifications,
  products,
} from "../../schema";

// =============================================================================
// TYPES
// =============================================================================

export type EntityLinkType =
  | "material"
  | "facility"
  | "manufacturer"
  | "season"
  | "color"
  | "size"
  | "tag"
  | "eco_claim"
  | "certification";

// =============================================================================
// PRODUCT LINKS (Mapping external products to internal)
// =============================================================================

/**
 * Find a product link by external ID.
 */
export async function findProductLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationProductLinks.id,
      brandIntegrationId: integrationProductLinks.brandIntegrationId,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
      createdAt: integrationProductLinks.createdAt,
      updatedAt: integrationProductLinks.updatedAt,
    })
    .from(integrationProductLinks)
    .where(
      and(
        eq(integrationProductLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationProductLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a product link by product ID.
 */
export async function findProductLinkByProductId(
  db: Database,
  brandIntegrationId: string,
  productId: string,
) {
  const [row] = await db
    .select({
      id: integrationProductLinks.id,
      brandIntegrationId: integrationProductLinks.brandIntegrationId,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
      createdAt: integrationProductLinks.createdAt,
      updatedAt: integrationProductLinks.updatedAt,
    })
    .from(integrationProductLinks)
    .where(
      and(
        eq(integrationProductLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationProductLinks.productId, productId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Create a product link.
 */
export async function createProductLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    productId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationProductLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      productId: input.productId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationProductLinks.id,
      brandIntegrationId: integrationProductLinks.brandIntegrationId,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
      createdAt: integrationProductLinks.createdAt,
    });
  return row;
}

/**
 * Update a product link.
 */
export async function updateProductLink(
  db: Database,
  id: string,
  input: {
    externalName?: string | null;
    lastSyncedAt?: string;
  },
) {
  const [row] = await db
    .update(integrationProductLinks)
    .set({
      externalName: input.externalName,
      lastSyncedAt: input.lastSyncedAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(integrationProductLinks.id, id))
    .returning({
      id: integrationProductLinks.id,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
      updatedAt: integrationProductLinks.updatedAt,
    });
  return row;
}

/**
 * List all product links for a brand integration.
 */
export async function listProductLinks(
  db: Database,
  brandIntegrationId: string,
) {
  return db
    .select({
      id: integrationProductLinks.id,
      productId: integrationProductLinks.productId,
      externalId: integrationProductLinks.externalId,
      externalName: integrationProductLinks.externalName,
      lastSyncedAt: integrationProductLinks.lastSyncedAt,
    })
    .from(integrationProductLinks)
    .where(eq(integrationProductLinks.brandIntegrationId, brandIntegrationId));
}

// =============================================================================
// VARIANT LINKS (Primary matching table - SKU, EAN, GTIN, barcode are variant-level)
// =============================================================================

/**
 * Find a variant link by external ID.
 * This is the primary lookup during sync - variants are matched by SKU/barcode.
 */
export async function findVariantLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      lastSyncedHash: integrationVariantLinks.lastSyncedHash,
      createdAt: integrationVariantLinks.createdAt,
      updatedAt: integrationVariantLinks.updatedAt,
    })
    .from(integrationVariantLinks)
    .where(
      and(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationVariantLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a variant link by variant ID.
 * Useful for checking if a variant is already linked to an external system.
 */
export async function findVariantLinkByVariantId(
  db: Database,
  brandIntegrationId: string,
  variantId: string,
) {
  const [row] = await db
    .select({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      lastSyncedHash: integrationVariantLinks.lastSyncedHash,
      createdAt: integrationVariantLinks.createdAt,
      updatedAt: integrationVariantLinks.updatedAt,
    })
    .from(integrationVariantLinks)
    .where(
      and(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationVariantLinks.variantId, variantId),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Create a variant link.
 * Called when a variant is first synced from an external system.
 */
export async function createVariantLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    variantId: string;
    externalId: string;
    externalProductId?: string | null;
    externalSku?: string | null;
    externalBarcode?: string | null;
    lastSyncedHash?: string | null;
  },
) {
  const now = new Date().toISOString();
  const [row] = await db
    .insert(integrationVariantLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      variantId: input.variantId,
      externalId: input.externalId,
      externalProductId: input.externalProductId ?? null,
      externalSku: input.externalSku ?? null,
      externalBarcode: input.externalBarcode ?? null,
      lastSyncedAt: now,
      lastSyncedHash: input.lastSyncedHash ?? null,
    })
    .returning({
      id: integrationVariantLinks.id,
      brandIntegrationId: integrationVariantLinks.brandIntegrationId,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      createdAt: integrationVariantLinks.createdAt,
    });
  return row;
}

/**
 * Update a variant link.
 * Called after subsequent syncs to update sync metadata.
 */
export async function updateVariantLink(
  db: Database,
  id: string,
  input: {
    externalSku?: string | null;
    externalBarcode?: string | null;
    lastSyncedHash?: string | null;
  },
) {
  const now = new Date().toISOString();
  const [row] = await db
    .update(integrationVariantLinks)
    .set({
      ...input,
      lastSyncedAt: now,
      updatedAt: now,
    })
    .where(eq(integrationVariantLinks.id, id))
    .returning({
      id: integrationVariantLinks.id,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
      updatedAt: integrationVariantLinks.updatedAt,
    });
  return row;
}

/**
 * List all variant links for a brand integration.
 */
export async function listVariantLinks(
  db: Database,
  brandIntegrationId: string,
) {
  return db
    .select({
      id: integrationVariantLinks.id,
      variantId: integrationVariantLinks.variantId,
      externalId: integrationVariantLinks.externalId,
      externalProductId: integrationVariantLinks.externalProductId,
      externalSku: integrationVariantLinks.externalSku,
      externalBarcode: integrationVariantLinks.externalBarcode,
      lastSyncedAt: integrationVariantLinks.lastSyncedAt,
    })
    .from(integrationVariantLinks)
    .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
}

/**
 * Delete a variant link.
 * Called when unlinking a variant from an external system.
 */
export async function deleteVariantLink(db: Database, id: string) {
  await db
    .delete(integrationVariantLinks)
    .where(eq(integrationVariantLinks.id, id));
}

/**
 * Delete all variant links for a brand integration.
 * Called when disconnecting an integration.
 */
export async function deleteAllVariantLinks(
  db: Database,
  brandIntegrationId: string,
) {
  await db
    .delete(integrationVariantLinks)
    .where(eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId));
}

// =============================================================================
// ENTITY LINKS (All 9 entity types)
// =============================================================================

// Material Links
export async function findMaterialLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationMaterialLinks.id,
      brandIntegrationId: integrationMaterialLinks.brandIntegrationId,
      materialId: integrationMaterialLinks.materialId,
      externalId: integrationMaterialLinks.externalId,
      externalName: integrationMaterialLinks.externalName,
      lastSyncedAt: integrationMaterialLinks.lastSyncedAt,
    })
    .from(integrationMaterialLinks)
    .where(
      and(
        eq(integrationMaterialLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationMaterialLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createMaterialLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    materialId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationMaterialLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      materialId: input.materialId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationMaterialLinks.id,
      materialId: integrationMaterialLinks.materialId,
      externalId: integrationMaterialLinks.externalId,
    });
  return row;
}

// Facility Links
export async function findFacilityLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationFacilityLinks.id,
      brandIntegrationId: integrationFacilityLinks.brandIntegrationId,
      facilityId: integrationFacilityLinks.facilityId,
      externalId: integrationFacilityLinks.externalId,
      externalName: integrationFacilityLinks.externalName,
      lastSyncedAt: integrationFacilityLinks.lastSyncedAt,
    })
    .from(integrationFacilityLinks)
    .where(
      and(
        eq(integrationFacilityLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationFacilityLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createFacilityLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    facilityId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationFacilityLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      facilityId: input.facilityId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationFacilityLinks.id,
      facilityId: integrationFacilityLinks.facilityId,
      externalId: integrationFacilityLinks.externalId,
    });
  return row;
}

// Manufacturer Links
export async function findManufacturerLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationManufacturerLinks.id,
      brandIntegrationId: integrationManufacturerLinks.brandIntegrationId,
      manufacturerId: integrationManufacturerLinks.manufacturerId,
      externalId: integrationManufacturerLinks.externalId,
      externalName: integrationManufacturerLinks.externalName,
      lastSyncedAt: integrationManufacturerLinks.lastSyncedAt,
    })
    .from(integrationManufacturerLinks)
    .where(
      and(
        eq(integrationManufacturerLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationManufacturerLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createManufacturerLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    manufacturerId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationManufacturerLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      manufacturerId: input.manufacturerId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationManufacturerLinks.id,
      manufacturerId: integrationManufacturerLinks.manufacturerId,
      externalId: integrationManufacturerLinks.externalId,
    });
  return row;
}

// Season Links
export async function findSeasonLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationSeasonLinks.id,
      brandIntegrationId: integrationSeasonLinks.brandIntegrationId,
      seasonId: integrationSeasonLinks.seasonId,
      externalId: integrationSeasonLinks.externalId,
      externalName: integrationSeasonLinks.externalName,
      lastSyncedAt: integrationSeasonLinks.lastSyncedAt,
    })
    .from(integrationSeasonLinks)
    .where(
      and(
        eq(integrationSeasonLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationSeasonLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createSeasonLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    seasonId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationSeasonLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      seasonId: input.seasonId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationSeasonLinks.id,
      seasonId: integrationSeasonLinks.seasonId,
      externalId: integrationSeasonLinks.externalId,
    });
  return row;
}

// Color Links
export async function findColorLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationColorLinks.id,
      brandIntegrationId: integrationColorLinks.brandIntegrationId,
      colorId: integrationColorLinks.colorId,
      externalId: integrationColorLinks.externalId,
      externalName: integrationColorLinks.externalName,
      lastSyncedAt: integrationColorLinks.lastSyncedAt,
    })
    .from(integrationColorLinks)
    .where(
      and(
        eq(integrationColorLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationColorLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createColorLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    colorId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationColorLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      colorId: input.colorId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationColorLinks.id,
      colorId: integrationColorLinks.colorId,
      externalId: integrationColorLinks.externalId,
    });
  return row;
}

// Size Links
export async function findSizeLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationSizeLinks.id,
      brandIntegrationId: integrationSizeLinks.brandIntegrationId,
      sizeId: integrationSizeLinks.sizeId,
      externalId: integrationSizeLinks.externalId,
      externalName: integrationSizeLinks.externalName,
      lastSyncedAt: integrationSizeLinks.lastSyncedAt,
    })
    .from(integrationSizeLinks)
    .where(
      and(
        eq(integrationSizeLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationSizeLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createSizeLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    sizeId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationSizeLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      sizeId: input.sizeId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationSizeLinks.id,
      sizeId: integrationSizeLinks.sizeId,
      externalId: integrationSizeLinks.externalId,
    });
  return row;
}

// Tag Links
export async function findTagLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationTagLinks.id,
      brandIntegrationId: integrationTagLinks.brandIntegrationId,
      tagId: integrationTagLinks.tagId,
      externalId: integrationTagLinks.externalId,
      externalName: integrationTagLinks.externalName,
      lastSyncedAt: integrationTagLinks.lastSyncedAt,
    })
    .from(integrationTagLinks)
    .where(
      and(
        eq(integrationTagLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationTagLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createTagLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    tagId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationTagLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      tagId: input.tagId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationTagLinks.id,
      tagId: integrationTagLinks.tagId,
      externalId: integrationTagLinks.externalId,
    });
  return row;
}

// Eco Claim Links
export async function findEcoClaimLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationEcoClaimLinks.id,
      brandIntegrationId: integrationEcoClaimLinks.brandIntegrationId,
      ecoClaimId: integrationEcoClaimLinks.ecoClaimId,
      externalId: integrationEcoClaimLinks.externalId,
      externalName: integrationEcoClaimLinks.externalName,
      lastSyncedAt: integrationEcoClaimLinks.lastSyncedAt,
    })
    .from(integrationEcoClaimLinks)
    .where(
      and(
        eq(integrationEcoClaimLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationEcoClaimLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createEcoClaimLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    ecoClaimId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationEcoClaimLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      ecoClaimId: input.ecoClaimId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationEcoClaimLinks.id,
      ecoClaimId: integrationEcoClaimLinks.ecoClaimId,
      externalId: integrationEcoClaimLinks.externalId,
    });
  return row;
}

// Certification Links
export async function findCertificationLink(
  db: Database,
  brandIntegrationId: string,
  externalId: string,
) {
  const [row] = await db
    .select({
      id: integrationCertificationLinks.id,
      brandIntegrationId: integrationCertificationLinks.brandIntegrationId,
      certificationId: integrationCertificationLinks.certificationId,
      externalId: integrationCertificationLinks.externalId,
      externalName: integrationCertificationLinks.externalName,
      lastSyncedAt: integrationCertificationLinks.lastSyncedAt,
    })
    .from(integrationCertificationLinks)
    .where(
      and(
        eq(integrationCertificationLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationCertificationLinks.externalId, externalId),
      ),
    )
    .limit(1);
  return row;
}

export async function createCertificationLink(
  db: Database,
  input: {
    brandIntegrationId: string;
    certificationId: string;
    externalId: string;
    externalName?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationCertificationLinks)
    .values({
      brandIntegrationId: input.brandIntegrationId,
      certificationId: input.certificationId,
      externalId: input.externalId,
      externalName: input.externalName ?? null,
      lastSyncedAt: new Date().toISOString(),
    })
    .returning({
      id: integrationCertificationLinks.id,
      certificationId: integrationCertificationLinks.certificationId,
      externalId: integrationCertificationLinks.externalId,
    });
  return row;
}

// =============================================================================
// ENTITY LOOKUP (Find entities by name for name-fallback matching)
// =============================================================================

/**
 * Find a material by name (case-insensitive).
 */
export async function findMaterialByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandMaterials.id,
      name: brandMaterials.name,
    })
    .from(brandMaterials)
    .where(
      and(
        eq(brandMaterials.brandId, brandId),
        sql`LOWER(${brandMaterials.name}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a facility by display name (case-insensitive).
 */
export async function findFacilityByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandFacilities.id,
      displayName: brandFacilities.displayName,
    })
    .from(brandFacilities)
    .where(
      and(
        eq(brandFacilities.brandId, brandId),
        sql`LOWER(${brandFacilities.displayName}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a manufacturer by name (case-insensitive).
 */
export async function findManufacturerByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandManufacturers.id,
      name: brandManufacturers.name,
    })
    .from(brandManufacturers)
    .where(
      and(
        eq(brandManufacturers.brandId, brandId),
        sql`LOWER(${brandManufacturers.name}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a season by name (case-insensitive).
 */
export async function findSeasonByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandSeasons.id,
      name: brandSeasons.name,
    })
    .from(brandSeasons)
    .where(
      and(
        eq(brandSeasons.brandId, brandId),
        sql`LOWER(${brandSeasons.name}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a color by name (case-insensitive).
 */
export async function findColorByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandColors.id,
      name: brandColors.name,
    })
    .from(brandColors)
    .where(
      and(
        eq(brandColors.brandId, brandId),
        sql`LOWER(${brandColors.name}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a size by name (case-insensitive).
 */
export async function findSizeByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandSizes.id,
      name: brandSizes.name,
    })
    .from(brandSizes)
    .where(
      and(
        eq(brandSizes.brandId, brandId),
        sql`LOWER(${brandSizes.name}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a tag by name (case-insensitive).
 */
export async function findTagByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandTags.id,
      name: brandTags.name,
    })
    .from(brandTags)
    .where(
      and(
        eq(brandTags.brandId, brandId),
        sql`LOWER(${brandTags.name}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find an eco claim by claim text (case-insensitive).
 */
export async function findEcoClaimByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandEcoClaims.id,
      claim: brandEcoClaims.claim,
    })
    .from(brandEcoClaims)
    .where(
      and(
        eq(brandEcoClaims.brandId, brandId),
        sql`LOWER(${brandEcoClaims.claim}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a certification by title (case-insensitive).
 */
export async function findCertificationByName(
  db: Database,
  brandId: string,
  name: string,
) {
  const [row] = await db
    .select({
      id: brandCertifications.id,
      title: brandCertifications.title,
    })
    .from(brandCertifications)
    .where(
      and(
        eq(brandCertifications.brandId, brandId),
        sql`LOWER(${brandCertifications.title}) = LOWER(${name})`,
      ),
    )
    .limit(1);
  return row;
}

/**
 * Find a product by product handle.
 */
export async function findProductByHandle(
  db: Database,
  brandId: string,
  productHandle: string,
) {
  const [row] = await db
    .select({
      id: products.id,
      productHandle: products.productHandle,
      name: products.name,
    })
    .from(products)
    .where(
      and(
        eq(products.brandId, brandId),
        eq(products.productHandle, productHandle),
      ),
    )
    .limit(1);
  return row;
}

// =============================================================================
// OAUTH STATES (For OAuth flow CSRF protection)
// =============================================================================

/**
 * Create an OAuth state for CSRF protection.
 */
export async function createOAuthState(
  db: Database,
  input: {
    state: string;
    brandId: string;
    integrationSlug: string;
    shopDomain?: string | null;
    expiresAt: string;
  },
) {
  const [row] = await db
    .insert(oauthStates)
    .values({
      state: input.state,
      brandId: input.brandId,
      integrationSlug: input.integrationSlug,
      shopDomain: input.shopDomain ?? null,
      expiresAt: input.expiresAt,
    })
    .returning({
      id: oauthStates.id,
      state: oauthStates.state,
      brandId: oauthStates.brandId,
      integrationSlug: oauthStates.integrationSlug,
      shopDomain: oauthStates.shopDomain,
      expiresAt: oauthStates.expiresAt,
      createdAt: oauthStates.createdAt,
    });
  return row;
}

/**
 * Find an OAuth state by state token.
 * Only returns if not expired.
 */
export async function findOAuthState(db: Database, state: string) {
  const now = new Date().toISOString();
  const [row] = await db
    .select({
      id: oauthStates.id,
      state: oauthStates.state,
      brandId: oauthStates.brandId,
      integrationSlug: oauthStates.integrationSlug,
      shopDomain: oauthStates.shopDomain,
      expiresAt: oauthStates.expiresAt,
      createdAt: oauthStates.createdAt,
    })
    .from(oauthStates)
    .where(and(eq(oauthStates.state, state), gt(oauthStates.expiresAt, now)))
    .limit(1);
  return row;
}

/**
 * Delete an OAuth state (after successful use).
 */
export async function deleteOAuthState(db: Database, id: string) {
  const [row] = await db
    .delete(oauthStates)
    .where(eq(oauthStates.id, id))
    .returning({ id: oauthStates.id });
  return row;
}

/**
 * Delete expired OAuth states (cleanup).
 */
export async function deleteExpiredOAuthStates(db: Database) {
  const now = new Date().toISOString();
  return db.delete(oauthStates).where(lt(oauthStates.expiresAt, now));
}

