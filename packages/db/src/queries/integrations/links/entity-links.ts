/**
 * Entity link query functions.
 * 
 * Handles mapping external entities to internal catalog entities.
 * Supports: material, facility, manufacturer, season, color, size, tag, eco_claim, certification
 */

import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../../../client";
import {
  integrationMaterialLinks,
  integrationFacilityLinks,
  integrationManufacturerLinks,
  integrationSeasonLinks,
  integrationColorLinks,
  integrationSizeLinks,
  integrationTagLinks,
  integrationEcoClaimLinks,
  integrationCertificationLinks,
  brandMaterials,
  brandFacilities,
  brandManufacturers,
  brandSeasons,
  brandColors,
  brandSizes,
  brandTags,
  brandEcoClaims,
  brandCertifications,
} from "../../../schema";

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

