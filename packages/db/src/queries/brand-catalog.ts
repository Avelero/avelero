import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  brandColors,
  brandEcoClaims,
  brandFacilities,
  brandMaterials,
  brandSizes,
  brandTags,
  brandSeasons,
  brandCertifications,
  showcaseBrands,
} from "../schema";

export type CatalogEntityType =
  | "COLOR"
  | "SIZE"
  | "MATERIAL"
  | "ECO_CLAIM"
  | "FACILITY"
  | "SHOWCASE_BRAND"
  | "CERTIFICATION";

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// Seasons
export async function listSeasonsForBrand(db: Database, brandId: string) {
  return db
    .select({
      id: brandSeasons.id,
      name: brandSeasons.name,
      startDate: brandSeasons.startDate,
      endDate: brandSeasons.endDate,
      ongoing: brandSeasons.ongoing,
      createdAt: brandSeasons.createdAt,
      updatedAt: brandSeasons.updatedAt,
    })
    .from(brandSeasons)
    .where(eq(brandSeasons.brandId, brandId))
    .orderBy(asc(brandSeasons.name));
}

export async function getSeasonById(
  db: Database,
  brandId: string,
  seasonId: string,
) {
  const [row] = await db
    .select({
      id: brandSeasons.id,
      name: brandSeasons.name,
      startDate: brandSeasons.startDate,
      endDate: brandSeasons.endDate,
      ongoing: brandSeasons.ongoing,
      createdAt: brandSeasons.createdAt,
      updatedAt: brandSeasons.updatedAt,
    })
    .from(brandSeasons)
    .where(and(eq(brandSeasons.id, seasonId), eq(brandSeasons.brandId, brandId)))
    .limit(1);
  return row;
}

export async function createSeason(
  db: Database,
  brandId: string,
  input: {
    name: string;
    startDate?: Date | null;
    endDate?: Date | null;
    ongoing?: boolean;
  },
) {
  const [row] = await db
    .insert(brandSeasons)
    .values({
      brandId,
      name: input.name,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      ongoing: input.ongoing ?? false,
    })
    .returning({
      id: brandSeasons.id,
      name: brandSeasons.name,
      startDate: brandSeasons.startDate,
      endDate: brandSeasons.endDate,
      ongoing: brandSeasons.ongoing,
      createdAt: brandSeasons.createdAt,
      updatedAt: brandSeasons.updatedAt,
    });
  return row;
}

export async function updateSeason(
  db: Database,
  brandId: string,
  seasonId: string,
  input: {
    name?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    ongoing?: boolean;
  },
) {
  const [row] = await db
    .update(brandSeasons)
    .set({
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      ongoing: input.ongoing,
    })
    .where(and(eq(brandSeasons.id, seasonId), eq(brandSeasons.brandId, brandId)))
    .returning({
      id: brandSeasons.id,
      name: brandSeasons.name,
      startDate: brandSeasons.startDate,
      endDate: brandSeasons.endDate,
      ongoing: brandSeasons.ongoing,
      createdAt: brandSeasons.createdAt,
      updatedAt: brandSeasons.updatedAt,
    });
  return row;
}

export async function deleteSeason(
  db: Database,
  brandId: string,
  seasonId: string,
) {
  const [row] = await db
    .delete(brandSeasons)
    .where(and(eq(brandSeasons.id, seasonId), eq(brandSeasons.brandId, brandId)))
    .returning({ id: brandSeasons.id });
  return row;
}

// Colors
export async function listColors(db: Database, brandId: string) {
  return db
    .select({
      id: brandColors.id,
      name: brandColors.name,
      hex: brandColors.hex,
      created_at: brandColors.createdAt,
      updated_at: brandColors.updatedAt,
    })
    .from(brandColors)
    .where(eq(brandColors.brandId, brandId))
    .orderBy(asc(brandColors.name));
}

export async function createColor(
  db: Database,
  brandId: string,
  input: { name: string; hex: string },
) {
  const [row] = await db
    .insert(brandColors)
    .values({ brandId, name: input.name, hex: input.hex })
    .returning({
      id: brandColors.id,
      name: brandColors.name,
      hex: brandColors.hex,
      created_at: brandColors.createdAt,
      updated_at: brandColors.updatedAt,
    });
  return row;
}

export async function updateColor(
  db: Database,
  brandId: string,
  id: string,
  input: { name?: string; hex?: string },
) {
  const updateData: Partial<{
    name: string;
    hex: string;
  }> = {};
  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.hex !== undefined) {
    updateData.hex = input.hex;
  }

  const [row] = await db
    .update(brandColors)
    .set(updateData)
    .where(and(eq(brandColors.id, id), eq(brandColors.brandId, brandId)))
    .returning({
      id: brandColors.id,
      name: brandColors.name,
      hex: brandColors.hex,
      created_at: brandColors.createdAt,
      updated_at: brandColors.updatedAt,
    });
  return row;
}

export async function deleteColor(db: Database, brandId: string, id: string) {
  const [row] = await db
    .delete(brandColors)
    .where(and(eq(brandColors.id, id), eq(brandColors.brandId, brandId)))
    .returning({ id: brandColors.id });
  return row;
}

// Tags
export async function listBrandTags(db: Database, brandId: string) {
  return db
    .select({
      id: brandTags.id,
      name: brandTags.name,
      hex: brandTags.hex,
      created_at: brandTags.createdAt,
      updated_at: brandTags.updatedAt,
    })
    .from(brandTags)
    .where(eq(brandTags.brandId, brandId))
    .orderBy(asc(brandTags.name));
}

export async function createBrandTag(
  db: Database,
  brandId: string,
  input: { name: string; hex: string },
) {
  const [row] = await db
    .insert(brandTags)
    .values({
      brandId,
      name: input.name,
      hex: input.hex,
    })
    .returning({
      id: brandTags.id,
      name: brandTags.name,
      hex: brandTags.hex,
      created_at: brandTags.createdAt,
      updated_at: brandTags.updatedAt,
    });
  return row;
}

export async function updateBrandTag(
  db: Database,
  brandId: string,
  id: string,
  input: { name?: string; hex?: string },
) {
  const [row] = await db
    .update(brandTags)
    .set({
      name: input.name,
      hex: input.hex,
    })
    .where(and(eq(brandTags.id, id), eq(brandTags.brandId, brandId)))
    .returning({
      id: brandTags.id,
      name: brandTags.name,
      hex: brandTags.hex,
      created_at: brandTags.createdAt,
      updated_at: brandTags.updatedAt,
    });
  return row;
}

export async function deleteBrandTag(db: Database, brandId: string, id: string) {
  const [row] = await db
    .delete(brandTags)
    .where(and(eq(brandTags.id, id), eq(brandTags.brandId, brandId)))
    .returning({ id: brandTags.id });
  return row;
}

// Sizes
export async function listSizes(
  db: Database,
  brandId: string,
  opts?: { categoryId?: string },
) {
  const where = opts?.categoryId
    ? and(eq(brandSizes.brandId, brandId), eq(brandSizes.categoryId, opts.categoryId))
    : eq(brandSizes.brandId, brandId);

  return db
    .select({
      id: brandSizes.id,
      name: brandSizes.name,
      category_id: brandSizes.categoryId,
      sort_index: brandSizes.sortIndex,
      created_at: brandSizes.createdAt,
      updated_at: brandSizes.updatedAt,
    })
    .from(brandSizes)
    .where(where)
    .orderBy(asc(brandSizes.name), asc(brandSizes.sortIndex));
}

export async function createSize(
  db: Database,
  brandId: string,
  input: {
    name: string;
    categoryId?: string;
    sortIndex?: number;
  },
) {
  const [row] = await db
    .insert(brandSizes)
    .values({
      brandId,
      name: input.name,
      categoryId: input.categoryId ?? null,
      sortIndex: input.sortIndex ?? null,
    })
    .returning({ id: brandSizes.id });
  return row;
}

export async function updateSize(
  db: Database,
  brandId: string,
  id: string,
  input: {
    name?: string;
    categoryId?: string | null;
    sortIndex?: number | null;
  },
) {
  const [row] = await db
    .update(brandSizes)
    .set({
      name: input.name,
      categoryId: input.categoryId ?? null,
      sortIndex: input.sortIndex ?? null,
    })
    .where(and(eq(brandSizes.id, id), eq(brandSizes.brandId, brandId)))
    .returning({ id: brandSizes.id });
  return row;
}

export async function deleteSize(db: Database, brandId: string, id: string) {
  const [row] = await db
    .delete(brandSizes)
    .where(and(eq(brandSizes.id, id), eq(brandSizes.brandId, brandId)))
    .returning({ id: brandSizes.id });
  return row;
}

// Materials
export async function listMaterials(db: Database, brandId: string) {
  return db
    .select({
      id: brandMaterials.id,
      name: brandMaterials.name,
      certification_id: brandMaterials.certificationId,
      recyclable: brandMaterials.recyclable,
      country_of_origin: brandMaterials.countryOfOrigin,
      created_at: brandMaterials.createdAt,
      updated_at: brandMaterials.updatedAt,
    })
    .from(brandMaterials)
    .where(eq(brandMaterials.brandId, brandId))
    .orderBy(asc(brandMaterials.name));
}

export async function createMaterial(
  db: Database,
  brandId: string,
  input: {
    name: string;
    certificationId?: string;
    recyclable?: boolean;
    countryOfOrigin?: string;
  },
) {
  const [row] = await db
    .insert(brandMaterials)
    .values({
      brandId,
      name: input.name,
      certificationId: input.certificationId ?? null,
      recyclable: input.recyclable ?? null,
      countryOfOrigin: input.countryOfOrigin ?? null,
    })
    .returning({ id: brandMaterials.id });
  return row;
}

export async function updateMaterial(
  db: Database,
  brandId: string,
  id: string,
  input: {
    name?: string;
    certificationId?: string | null;
    recyclable?: boolean | null;
    countryOfOrigin?: string | null;
  },
) {
  const [row] = await db
    .update(brandMaterials)
    .set({
      name: input.name,
      certificationId: input.certificationId ?? null,
      recyclable: input.recyclable ?? null,
      countryOfOrigin: input.countryOfOrigin ?? null,
    })
    .where(and(eq(brandMaterials.id, id), eq(brandMaterials.brandId, brandId)))
    .returning({ id: brandMaterials.id });
  return row;
}

export async function deleteMaterial(
  db: Database,
  brandId: string,
  id: string,
) {
  const [row] = await db
    .delete(brandMaterials)
    .where(and(eq(brandMaterials.id, id), eq(brandMaterials.brandId, brandId)))
    .returning({ id: brandMaterials.id });
  return row;
}

// Certifications
export async function listCertifications(db: Database, brandId: string) {
  return db
    .select({
      id: brandCertifications.id,
      title: brandCertifications.title,
      certification_code: brandCertifications.certificationCode,
      institute_name: brandCertifications.instituteName,
      institute_address: brandCertifications.instituteAddress,
      institute_contact: brandCertifications.instituteContact,
      issue_date: brandCertifications.issueDate,
      expiry_date: brandCertifications.expiryDate,
      file_asset_id: brandCertifications.fileAssetId,
      external_url: brandCertifications.externalUrl,
      notes: brandCertifications.notes,
      created_at: brandCertifications.createdAt,
      updated_at: brandCertifications.updatedAt,
    })
    .from(brandCertifications)
    .where(eq(brandCertifications.brandId, brandId))
    .orderBy(asc(brandCertifications.title));
}

export async function createCertification(
  db: Database,
  brandId: string,
  input: {
    title: string;
    certificationCode?: string;
    instituteName?: string;
    instituteAddress?: string;
    instituteContact?: string;
    issueDate?: string;
    expiryDate?: string;
    fileAssetId?: string;
    externalUrl?: string;
    notes?: string;
  },
) {
  const [row] = await db
    .insert(brandCertifications)
    .values({
      brandId,
      title: input.title,
      certificationCode: input.certificationCode ?? null,
      instituteName: input.instituteName ?? null,
      instituteAddress: input.instituteAddress ?? null,
      instituteContact: input.instituteContact ?? null,
      issueDate: input.issueDate ?? null,
      expiryDate: input.expiryDate ?? null,
      fileAssetId: input.fileAssetId ?? null,
      externalUrl: input.externalUrl ?? null,
      notes: input.notes ?? null,
    })
    .returning({ id: brandCertifications.id });
  return row;
}

export async function updateCertification(
  db: Database,
  brandId: string,
  id: string,
  input: Partial<{
    title: string;
    certificationCode: string | null;
    instituteName: string | null;
    instituteAddress: string | null;
    instituteContact: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    fileAssetId: string | null;
    externalUrl: string | null;
    notes: string | null;
  }>,
) {
  const [row] = await db
    .update(brandCertifications)
    .set({
      title: input.title,
      certificationCode: input.certificationCode ?? null,
      instituteName: input.instituteName ?? null,
      instituteAddress: input.instituteAddress ?? null,
      instituteContact: input.instituteContact ?? null,
      issueDate: input.issueDate ?? null,
      expiryDate: input.expiryDate ?? null,
      fileAssetId: input.fileAssetId ?? null,
      externalUrl: input.externalUrl ?? null,
      notes: input.notes ?? null,
    })
    .where(
      and(
        eq(brandCertifications.id, id),
        eq(brandCertifications.brandId, brandId),
      ),
    )
    .returning({ id: brandCertifications.id });
  return row;
}

export async function deleteCertification(
  db: Database,
  brandId: string,
  id: string,
) {
  const [row] = await db
    .delete(brandCertifications)
    .where(
      and(
        eq(brandCertifications.id, id),
        eq(brandCertifications.brandId, brandId),
      ),
    )
    .returning({ id: brandCertifications.id });
  return row;
}

// Eco-claims
export async function listEcoClaims(db: Database, brandId: string) {
  return db
    .select({
      id: brandEcoClaims.id,
      claim: brandEcoClaims.claim,
      created_at: brandEcoClaims.createdAt,
      updated_at: brandEcoClaims.updatedAt,
    })
    .from(brandEcoClaims)
    .where(eq(brandEcoClaims.brandId, brandId))
    .orderBy(asc(brandEcoClaims.claim));
}

export async function createEcoClaim(
  db: Database,
  brandId: string,
  input: { claim: string },
) {
  const [row] = await db
    .insert(brandEcoClaims)
    .values({ brandId, claim: input.claim })
    .returning({ id: brandEcoClaims.id });
  return row;
}

export async function updateEcoClaim(
  db: Database,
  brandId: string,
  id: string,
  input: { claim?: string },
) {
  const [row] = await db
    .update(brandEcoClaims)
    .set({ claim: input.claim })
    .where(and(eq(brandEcoClaims.id, id), eq(brandEcoClaims.brandId, brandId)))
    .returning({ id: brandEcoClaims.id });
  return row;
}

export async function deleteEcoClaim(
  db: Database,
  brandId: string,
  id: string,
) {
  const [row] = await db
    .delete(brandEcoClaims)
    .where(and(eq(brandEcoClaims.id, id), eq(brandEcoClaims.brandId, brandId)))
    .returning({ id: brandEcoClaims.id });
  return row;
}

// Facilities
export async function listFacilities(db: Database, brandId: string) {
  return db
    .select({
      id: brandFacilities.id,
      display_name: brandFacilities.displayName,
      legal_name: brandFacilities.legalName,
      email: brandFacilities.email,
      phone: brandFacilities.phone,
      website: brandFacilities.website,
      address_line_1: brandFacilities.addressLine1,
      address_line_2: brandFacilities.addressLine2,
      city: brandFacilities.city,
      state: brandFacilities.state,
      zip: brandFacilities.zip,
      country_code: brandFacilities.countryCode,
      created_at: brandFacilities.createdAt,
      updated_at: brandFacilities.updatedAt,
    })
    .from(brandFacilities)
    .where(eq(brandFacilities.brandId, brandId))
    .orderBy(asc(brandFacilities.displayName));
}

export async function createFacility(
  db: Database,
  brandId: string,
  input: {
    displayName: string;
    legalName?: string;
    email?: string;
    phone?: string;
    website?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
    countryCode?: string;
  },
) {
  const [row] = await db
    .insert(brandFacilities)
    .values({
      brandId,
      displayName: input.displayName,
      legalName: input.legalName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zip: input.zip ?? null,
      countryCode: input.countryCode ?? null,
    })
    .returning({ id: brandFacilities.id });
  return row;
}

export async function updateFacility(
  db: Database,
  brandId: string,
  id: string,
  input: Partial<{
    displayName: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    countryCode: string | null;
  }>,
) {
  const [row] = await db
    .update(brandFacilities)
    .set({
      displayName: input.displayName,
      legalName: input.legalName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zip: input.zip ?? null,
      countryCode: input.countryCode ?? null,
    })
    .where(and(eq(brandFacilities.id, id), eq(brandFacilities.brandId, brandId)))
    .returning({ id: brandFacilities.id });
  return row;
}

export async function deleteFacility(
  db: Database,
  brandId: string,
  id: string,
) {
  const [row] = await db
    .delete(brandFacilities)
    .where(and(eq(brandFacilities.id, id), eq(brandFacilities.brandId, brandId)))
    .returning({ id: brandFacilities.id });
  return row;
}

// Showcase brands
export async function listShowcaseBrands(db: Database, brandId: string) {
  return db
    .select({
      id: showcaseBrands.id,
      name: showcaseBrands.name,
      legal_name: showcaseBrands.legalName,
      email: showcaseBrands.email,
      phone: showcaseBrands.phone,
      website: showcaseBrands.website,
      address_line_1: showcaseBrands.addressLine1,
      address_line_2: showcaseBrands.addressLine2,
      city: showcaseBrands.city,
      state: showcaseBrands.state,
      zip: showcaseBrands.zip,
      country_code: showcaseBrands.countryCode,
      created_at: showcaseBrands.createdAt,
      updated_at: showcaseBrands.updatedAt,
    })
    .from(showcaseBrands)
    .where(eq(showcaseBrands.brandId, brandId))
    .orderBy(asc(showcaseBrands.name));
}

export async function createShowcaseBrand(
  db: Database,
  brandId: string,
  input: {
    name: string;
    legalName?: string;
    email?: string;
    phone?: string;
    website?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
    countryCode?: string;
  },
) {
  const [row] = await db
    .insert(showcaseBrands)
    .values({
      brandId,
      name: input.name,
      legalName: input.legalName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zip: input.zip ?? null,
      countryCode: input.countryCode ?? null,
    })
    .returning({ id: showcaseBrands.id });
  return row;
}

export async function updateShowcaseBrand(
  db: Database,
  brandId: string,
  id: string,
  input: Partial<{
    name: string;
    legalName: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    countryCode: string | null;
  }>,
) {
  const [row] = await db
    .update(showcaseBrands)
    .set({
      name: input.name,
      legalName: input.legalName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      website: input.website ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      zip: input.zip ?? null,
      countryCode: input.countryCode ?? null,
    })
    .where(and(eq(showcaseBrands.id, id), eq(showcaseBrands.brandId, brandId)))
    .returning({ id: showcaseBrands.id });
  return row;
}

export async function deleteShowcaseBrand(
  db: Database,
  brandId: string,
  id: string,
) {
  const [row] = await db
    .delete(showcaseBrands)
    .where(and(eq(showcaseBrands.id, id), eq(showcaseBrands.brandId, brandId)))
    .returning({ id: showcaseBrands.id });
  return row;
}

// ============================================================================
// Duplicate Detection & Validation Helpers
// ============================================================================

export async function checkDuplicateName(
  db: Database,
  brandId: string,
  entityType: CatalogEntityType,
  name: string,
  options?: { categoryId?: string },
): Promise<boolean> {
  switch (entityType) {
    case "COLOR": {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(brandColors)
        .where(
          and(
            eq(brandColors.brandId, brandId),
            sql`LOWER(${brandColors.name}) = LOWER(${name})`,
          ),
        );
      return (result?.count ?? 0) > 0;
    }
    case "SIZE": {
      const conditions = [
        eq(brandSizes.brandId, brandId),
        sql`LOWER(${brandSizes.name}) = LOWER(${name})`,
      ];
      if (options?.categoryId) {
        conditions.push(eq(brandSizes.categoryId, options.categoryId));
      } else {
        conditions.push(sql`${brandSizes.categoryId} IS NULL`);
      }
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(brandSizes)
        .where(and(...conditions));
      return (result?.count ?? 0) > 0;
    }
    case "MATERIAL": {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(brandMaterials)
        .where(
          and(
            eq(brandMaterials.brandId, brandId),
            sql`LOWER(${brandMaterials.name}) = LOWER(${name})`,
          ),
        );
      return (result?.count ?? 0) > 0;
    }
    case "ECO_CLAIM": {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(brandEcoClaims)
        .where(
          and(
            eq(brandEcoClaims.brandId, brandId),
            sql`LOWER(${brandEcoClaims.claim}) = LOWER(${name})`,
          ),
        );
      return (result?.count ?? 0) > 0;
    }
    case "FACILITY": {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(brandFacilities)
        .where(
          and(
            eq(brandFacilities.brandId, brandId),
            sql`LOWER(${brandFacilities.displayName}) = LOWER(${name})`,
          ),
        );
      return (result?.count ?? 0) > 0;
    }
    case "SHOWCASE_BRAND": {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(showcaseBrands)
        .where(
          and(
            eq(showcaseBrands.brandId, brandId),
            sql`LOWER(${showcaseBrands.name}) = LOWER(${name})`,
          ),
        );
      return (result?.count ?? 0) > 0;
    }
    case "CERTIFICATION": {
      const [result] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(brandCertifications)
        .where(
          and(
            eq(brandCertifications.brandId, brandId),
            sql`LOWER(${brandCertifications.title}) = LOWER(${name})`,
          ),
        );
      return (result?.count ?? 0) > 0;
    }
    default: {
      const _exhaustive: never = entityType;
      throw new Error(`Unknown entity type: ${_exhaustive}`);
    }
  }
}

export function validateColorInput(input: { name: string; hex?: string }): ValidationResult {
  const errors: ValidationError[] = [];
  if (!input.name || input.name.trim().length === 0) {
    errors.push({ field: "name", message: "Color name is required", code: "REQUIRED" });
  } else if (input.name.length > 100) {
    errors.push({ field: "name", message: "Color name too long", code: "TOO_LONG" });
  }
  if (!input.hex || input.hex.trim().length === 0) {
    errors.push({ field: "hex", message: "Color hex is required", code: "REQUIRED" });
  }
  return { valid: errors.length === 0, errors };
}

export function validateSizeInput(input: {
  name: string;
  categoryId?: string;
  sortIndex?: number;
}): ValidationResult {
  const errors: ValidationError[] = [];
  if (!input.name || input.name.trim().length === 0) {
    errors.push({ field: "name", message: "Size name is required", code: "REQUIRED" });
  } else if (input.name.length > 100) {
    errors.push({ field: "name", message: "Size name too long", code: "TOO_LONG" });
  }
  if (input.sortIndex !== undefined && input.sortIndex !== null && input.sortIndex < 0) {
    errors.push({
      field: "sortIndex",
      message: "Sort index must be non-negative",
      code: "INVALID_VALUE",
    });
  }
  return { valid: errors.length === 0, errors };
}

export function validateMaterialInput(input: {
  name: string;
  certificationId?: string | null;
  recyclable?: boolean | null;
  countryOfOrigin?: string | null;
}): ValidationResult {
  const errors: ValidationError[] = [];
  if (!input.name || input.name.trim().length === 0) {
    errors.push({ field: "name", message: "Material name is required", code: "REQUIRED" });
  } else if (input.name.length > 100) {
    errors.push({ field: "name", message: "Material name too long", code: "TOO_LONG" });
  }
  if (input.countryOfOrigin && !/^[A-Z]{2}$/.test(input.countryOfOrigin.toUpperCase())) {
    errors.push({
      field: "countryOfOrigin",
      message: "Country of origin must be a 2-letter ISO code",
      code: "INVALID_FORMAT",
    });
  }
  return { valid: errors.length === 0, errors };
}

export function validateEcoClaimInput(claim: string): ValidationResult {
  const errors: ValidationError[] = [];
  if (!claim || claim.trim().length === 0) {
    errors.push({ field: "claim", message: "Eco claim is required", code: "REQUIRED" });
  } else if (claim.length > 500) {
    errors.push({ field: "claim", message: "Eco claim too long", code: "TOO_LONG" });
  }
  return { valid: errors.length === 0, errors };
}

export function validateFacilityInput(input: {
  displayName: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  countryCode?: string | null;
}): ValidationResult {
  const errors: ValidationError[] = [];
  if (!input.displayName || input.displayName.trim().length === 0) {
    errors.push({ field: "displayName", message: "Display name is required", code: "REQUIRED" });
  }
  if (input.email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(input.email)) {
    errors.push({ field: "email", message: "Invalid email format", code: "INVALID_FORMAT" });
  }
  if (input.website) {
    try {
      new URL(input.website);
    } catch {
      errors.push({ field: "website", message: "Invalid website URL", code: "INVALID_FORMAT" });
    }
  }
  if (input.countryCode && !/^[A-Z]{2}$/.test(input.countryCode.toUpperCase())) {
    errors.push({
      field: "countryCode",
      message: "Country code must be 2 letters",
      code: "INVALID_FORMAT",
    });
  }
  return { valid: errors.length === 0, errors };
}

export function validateShowcaseBrandInput(input: {
  name: string;
  legalName?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  countryCode?: string | null;
}): ValidationResult {
  const errors: ValidationError[] = [];
  if (!input.name || input.name.trim().length === 0) {
    errors.push({ field: "name", message: "Showcase brand name is required", code: "REQUIRED" });
  }
  if (input.email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(input.email)) {
    errors.push({ field: "email", message: "Invalid email format", code: "INVALID_FORMAT" });
  }
  if (input.website) {
    try {
      new URL(input.website);
    } catch {
      errors.push({ field: "website", message: "Invalid website URL", code: "INVALID_FORMAT" });
    }
  }
  if (input.countryCode && !/^[A-Z]{2}$/.test(input.countryCode.toUpperCase())) {
    errors.push({
      field: "countryCode",
      message: "Country code must be 2 letters",
      code: "INVALID_FORMAT",
    });
  }
  return { valid: errors.length === 0, errors };
}

export function validateCertificationInput(input: {
  title: string;
  certificationCode?: string;
  instituteName?: string;
  instituteAddress?: string;
  instituteContact?: string;
  issueDate?: string;
  expiryDate?: string;
  fileAssetId?: string;
  externalUrl?: string;
  notes?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];
  if (!input.title || input.title.trim().length === 0) {
    errors.push({ field: "title", message: "Certification title is required", code: "REQUIRED" });
  }

  if (input.issueDate) {
    const issueDate = new Date(input.issueDate);
    if (Number.isNaN(issueDate.getTime())) {
      errors.push({ field: "issueDate", message: "Invalid issue date", code: "INVALID_FORMAT" });
    }
  }
  if (input.expiryDate) {
    const expiryDate = new Date(input.expiryDate);
    if (Number.isNaN(expiryDate.getTime())) {
      errors.push({ field: "expiryDate", message: "Invalid expiry date", code: "INVALID_FORMAT" });
    } else if (input.issueDate) {
      const issueDate = new Date(input.issueDate);
      if (!Number.isNaN(issueDate.getTime()) && expiryDate <= issueDate) {
        errors.push({
          field: "expiryDate",
          message: "Expiry date must be after issue date",
          code: "INVALID_VALUE",
        });
      }
    }
  }

  if (input.externalUrl) {
    try {
      new URL(input.externalUrl);
    } catch {
      errors.push({
        field: "externalUrl",
        message: "Invalid external URL",
        code: "INVALID_FORMAT",
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

export async function validateAndCreateEntity(
  db: Database,
  brandId: string,
  entityType: CatalogEntityType,
  input: unknown,
): Promise<{ id: string }> {
  let validation: ValidationResult;
  let name: string;

  switch (entityType) {
    case "COLOR":
      validation = validateColorInput(input as { name: string; hex: string });
      name = (input as { name: string }).name;
      break;
    case "SIZE":
      validation = validateSizeInput(
        input as { name: string; categoryId?: string; sortIndex?: number },
      );
      name = (input as { name: string }).name;
      break;
    case "MATERIAL":
      validation = validateMaterialInput(
        input as {
          name: string;
          certificationId?: string | null;
          recyclable?: boolean | null;
          countryOfOrigin?: string | null;
        },
      );
      name = (input as { name: string }).name;
      break;
    case "ECO_CLAIM":
      validation = validateEcoClaimInput((input as { claim: string }).claim);
      name = (input as { claim: string }).claim;
      break;
    case "FACILITY":
      validation = validateFacilityInput(
        input as {
          displayName: string;
          legalName?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          addressLine1?: string | null;
          addressLine2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          countryCode?: string | null;
        },
      );
      name = (input as { displayName: string }).displayName;
      break;
    case "SHOWCASE_BRAND":
      validation = validateShowcaseBrandInput(
        input as {
          name: string;
          legalName?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
          addressLine1?: string | null;
          addressLine2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          countryCode?: string | null;
        },
      );
      name = (input as { name: string }).name;
      break;
    case "CERTIFICATION":
      validation = validateCertificationInput(
        input as {
          title: string;
          certificationCode?: string;
          instituteName?: string;
          instituteAddress?: string;
          instituteContact?: string;
          issueDate?: string;
          expiryDate?: string;
          fileAssetId?: string;
          externalUrl?: string;
          notes?: string;
        },
      );
      name = (input as { title: string }).title;
      break;
    default: {
      const _exhaustive: never = entityType;
      throw new Error(`Unknown entity type: ${_exhaustive}`);
    }
  }

  if (!validation.valid) {
    const errorMsg = validation.errors.map((e) => `${e.field}: ${e.message}`).join("; ");
    throw new Error(`Validation failed: ${errorMsg}`);
  }

  const duplicate = await checkDuplicateName(db, brandId, entityType, name, {
    categoryId: (input as { categoryId?: string }).categoryId,
  });
  if (duplicate) {
    throw new Error(`${entityType} with name "${name}" already exists for this brand`);
  }

  switch (entityType) {
    case "COLOR":
      return (
        (await createColor(db, brandId, input as { name: string; hex: string })) ?? { id: "" }
      );
    case "SIZE":
      return (
        (await createSize(
          db,
          brandId,
          input as { name: string; categoryId?: string; sortIndex?: number },
        )) ?? { id: "" }
      );
    case "MATERIAL":
      return (
        (await createMaterial(
          db,
          brandId,
          input as {
            name: string;
            certificationId?: string;
            recyclable?: boolean;
            countryOfOrigin?: string;
          },
        )) ?? { id: "" }
      );
    case "ECO_CLAIM":
      return (await createEcoClaim(db, brandId, input as { claim: string })) ?? { id: "" };
    case "FACILITY":
      return (
        (await createFacility(
          db,
          brandId,
          input as {
            displayName: string;
            legalName?: string;
            email?: string;
            phone?: string;
            website?: string;
            addressLine1?: string;
            addressLine2?: string;
            city?: string;
            state?: string;
            zip?: string;
            countryCode?: string;
          },
        )) ?? { id: "" }
      );
    case "SHOWCASE_BRAND":
      return (
        (await createShowcaseBrand(db, brandId, input as { name: string })) ?? { id: "" }
      );
    case "CERTIFICATION":
      return (
        (await createCertification(db, brandId, input as { title: string })) ?? { id: "" }
      );
    default: {
      const _exhaustive: never = entityType;
      throw new Error(`Unknown entity type: ${_exhaustive}`);
    }
  }
}
