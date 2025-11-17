import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  brandCertifications,
  brandColors,
  brandEcoClaims,
  brandFacilities,
  brandMaterials,
  brandSizes,
  brandTags,
  showcaseBrands,
} from "../schema";

/**
 * Valid category group keys for size organization.
 * Format: "gender-subgroup" (e.g., "mens-tops", "womens-bottoms")
 */
export const VALID_CATEGORY_GROUPS = [
  "mens-tops",
  "mens-bottoms",
  "mens-outerwear",
  "mens-footwear",
  "mens-accessories",
  "womens-tops",
  "womens-bottoms",
  "womens-dresses",
  "womens-outerwear",
  "womens-footwear",
  "womens-accessories",
] as const;

/**
 * Type for valid category group values
 */
export type CategoryGroup = (typeof VALID_CATEGORY_GROUPS)[number];

/**
 * Entity types for duplicate checking
 */
export type CatalogEntityType =
  | "COLOR"
  | "SIZE"
  | "MATERIAL"
  | "ECO_CLAIM"
  | "FACILITY"
  | "SHOWCASE_BRAND"
  | "CERTIFICATION";

/**
 * Validation error structure
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
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
/**
 * Validates if a category group string is valid
 *
 * @param categoryGroup - Category group to validate
 * @returns True if valid, false otherwise
 */
export function isValidCategoryGroup(
  categoryGroup: string,
): categoryGroup is CategoryGroup {
  return VALID_CATEGORY_GROUPS.includes(categoryGroup as CategoryGroup);
}

/**
 * Lists sizes for a brand, optionally filtered by category group or legacy category ID
 *
 * @param db - Database connection
 * @param brandId - Brand UUID
 * @param opts - Optional filters for categoryGroup (preferred) or categoryId (legacy)
 * @returns List of sizes
 */
export async function listSizes(
  db: Database,
  brandId: string,
  opts?: { categoryGroup?: string; categoryId?: string },
) {
  let where: ReturnType<typeof and> | ReturnType<typeof eq>;

  if (opts?.categoryGroup) {
    // New approach: filter by category group
    where = and(
      eq(brandSizes.brandId, brandId),
      eq(brandSizes.categoryGroup, opts.categoryGroup),
    );
  } else if (opts?.categoryId) {
    // Legacy approach: filter by category ID
    where = and(
      eq(brandSizes.brandId, brandId),
      eq(brandSizes.categoryId, opts.categoryId),
    );
  } else {
    // No filter: return all sizes for brand
    where = eq(brandSizes.brandId, brandId);
  }

  return db
    .select({
      id: brandSizes.id,
      name: brandSizes.name,
      sort_index: brandSizes.sortIndex,
      category_group: brandSizes.categoryGroup,
      category_id: brandSizes.categoryId,
      created_at: brandSizes.createdAt,
      updated_at: brandSizes.updatedAt,
    })
    .from(brandSizes)
    .where(where)
    .orderBy(asc(brandSizes.sortIndex), asc(brandSizes.name));
}

/**
 * Creates a new size for a brand
 *
 * @param db - Database connection
 * @param brandId - Brand UUID
 * @param input - Size data with categoryGroup (preferred) or categoryId (legacy)
 * @returns Created size ID
 */
export async function createSize(
  db: Database,
  brandId: string,
  input: {
    name: string;
    categoryGroup?: string;
    categoryId?: string;
    sortIndex?: number;
  },
) {
  // Validate category group if provided
  if (input.categoryGroup && !isValidCategoryGroup(input.categoryGroup)) {
    throw new Error(
      `Invalid category group: ${input.categoryGroup}. Must be one of: ${VALID_CATEGORY_GROUPS.join(", ")}`,
    );
  }

  const [row] = await db
    .insert(brandSizes)
    .values({
      brandId,
      name: input.name,
      categoryGroup: input.categoryGroup ?? null,
      categoryId: input.categoryId ?? null,
      sortIndex: input.sortIndex ?? null,
    })
    .returning({ id: brandSizes.id });
  return row;
}

/**
 * Updates an existing size
 *
 * @param db - Database connection
 * @param brandId - Brand UUID
 * @param id - Size UUID
 * @param input - Size data to update
 * @returns Updated size ID
 */
export async function updateSize(
  db: Database,
  brandId: string,
  id: string,
  input: {
    name?: string;
    categoryGroup?: string | null;
    categoryId?: string | null;
    sortIndex?: number | null;
  },
) {
  // Validate category group if provided and not null
  if (
    input.categoryGroup !== undefined &&
    input.categoryGroup !== null &&
    !isValidCategoryGroup(input.categoryGroup)
  ) {
    throw new Error(
      `Invalid category group: ${input.categoryGroup}. Must be one of: ${VALID_CATEGORY_GROUPS.join(", ")}`,
    );
  }

  const [row] = await db
    .update(brandSizes)
    .set({
      name: input.name,
      categoryGroup: input.categoryGroup ?? null,
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
      address: brandFacilities.address,
      city: brandFacilities.city,
      country_code: brandFacilities.countryCode,
      contact: brandFacilities.contact,
      vat_number: brandFacilities.vatNumber,
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
    address?: string;
    city?: string;
    countryCode?: string;
    contact?: string;
    vatNumber?: string;
  },
) {
  const [row] = await db
    .insert(brandFacilities)
    .values({
      brandId,
      displayName: input.displayName,
      legalName: input.legalName ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      countryCode: input.countryCode ?? null,
      contact: input.contact ?? null,
      vatNumber: input.vatNumber ?? null,
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
    address: string | null;
    city: string | null;
    countryCode: string | null;
    contact: string | null;
    vatNumber: string | null;
  }>,
) {
  const [row] = await db
    .update(brandFacilities)
    .set({
      displayName: input.displayName,
      legalName: input.legalName ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      countryCode: input.countryCode ?? null,
      contact: input.contact ?? null,
      vatNumber: input.vatNumber ?? null,
    })
    .where(
      and(eq(brandFacilities.id, id), eq(brandFacilities.brandId, brandId)),
    )
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
    .where(
      and(eq(brandFacilities.id, id), eq(brandFacilities.brandId, brandId)),
    )
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
// Duplicate Detection Functions
// ============================================================================

/**
 * Checks if an entity name already exists for a brand (case-insensitive)
 *
 * @param db - Database connection
 * @param brandId - Brand UUID
 * @param entityType - Type of entity to check
 * @param name - Name to check for duplicates (case-insensitive)
 * @param options - Optional filters (categoryGroup or categoryId for sizes only)
 * @returns True if duplicate exists, false otherwise
 *
 * @example
 * ```typescript
 * const exists = await checkDuplicateName(db, "brand-uuid", "COLOR", "Red");
 * if (exists) {
 *   throw new Error("Color 'Red' already exists");
 * }
 *
 * // Check size with category group
 * const existsSize = await checkDuplicateName(
 *   db,
 *   "brand-uuid",
 *   "SIZE",
 *   "XL",
 *   { categoryGroup: "mens-tops" }
 * );
 * ```
 */
export async function checkDuplicateName(
  db: Database,
  brandId: string,
  entityType: CatalogEntityType,
  name: string,
  options?: { categoryGroup?: string; categoryId?: string },
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
      // Build where clause based on categoryGroup (preferred) or categoryId (legacy)
      const conditions = [
        eq(brandSizes.brandId, brandId),
        sql`LOWER(${brandSizes.name}) = LOWER(${name})`,
      ];

      if (options?.categoryGroup) {
        // New approach: check within category group
        conditions.push(eq(brandSizes.categoryGroup, options.categoryGroup));
      } else if (options?.categoryId) {
        // Legacy approach: check within category ID
        conditions.push(eq(brandSizes.categoryId, options.categoryId));
      } else {
        // No category specified: check for sizes without category group or ID
        conditions.push(sql`${brandSizes.categoryGroup} IS NULL`);
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

/**
 * Retrieves an existing entity by name (case-insensitive)
 *
 * @param db - Database connection
 * @param brandId - Brand UUID
 * @param entityType - Type of entity to find
 * @param name - Name to search for (case-insensitive)
 * @param options - Optional filters (categoryGroup or categoryId for sizes only)
 * @returns Entity if found, null otherwise
 *
 * @example
 * ```typescript
 * const color = await findEntityByName(db, "brand-uuid", "COLOR", "red");
 * if (color) {
 *   console.log(`Found existing color with ID: ${color.id}`);
 * }
 *
 * // Find size in category group
 * const size = await findEntityByName(
 *   db,
 *   "brand-uuid",
 *   "SIZE",
 *   "XL",
 *   { categoryGroup: "mens-tops" }
 * );
 * ```
 */
export async function findEntityByName(
  db: Database,
  brandId: string,
  entityType: CatalogEntityType,
  name: string,
  options?: { categoryGroup?: string; categoryId?: string },
): Promise<{ id: string; name: string } | null> {
  switch (entityType) {
    case "COLOR": {
      const [result] = await db
        .select({ id: brandColors.id, name: brandColors.name })
        .from(brandColors)
        .where(
          and(
            eq(brandColors.brandId, brandId),
            sql`LOWER(${brandColors.name}) = LOWER(${name})`,
          ),
        )
        .limit(1);
      return result ?? null;
    }

    case "SIZE": {
      // Build where clause based on categoryGroup (preferred) or categoryId (legacy)
      const conditions = [
        eq(brandSizes.brandId, brandId),
        sql`LOWER(${brandSizes.name}) = LOWER(${name})`,
      ];

      if (options?.categoryGroup) {
        conditions.push(eq(brandSizes.categoryGroup, options.categoryGroup));
      } else if (options?.categoryId) {
        conditions.push(eq(brandSizes.categoryId, options.categoryId));
      } else {
        conditions.push(sql`${brandSizes.categoryGroup} IS NULL`);
        conditions.push(sql`${brandSizes.categoryId} IS NULL`);
      }

      const [result] = await db
        .select({ id: brandSizes.id, name: brandSizes.name })
        .from(brandSizes)
        .where(and(...conditions))
        .limit(1);
      return result ?? null;
    }

    case "MATERIAL": {
      const [result] = await db
        .select({ id: brandMaterials.id, name: brandMaterials.name })
        .from(brandMaterials)
        .where(
          and(
            eq(brandMaterials.brandId, brandId),
            sql`LOWER(${brandMaterials.name}) = LOWER(${name})`,
          ),
        )
        .limit(1);
      return result ?? null;
    }

    case "ECO_CLAIM": {
      const [result] = await db
        .select({ id: brandEcoClaims.id, name: brandEcoClaims.claim })
        .from(brandEcoClaims)
        .where(
          and(
            eq(brandEcoClaims.brandId, brandId),
            sql`LOWER(${brandEcoClaims.claim}) = LOWER(${name})`,
          ),
        )
        .limit(1);
      return result ?? null;
    }

    case "FACILITY": {
      const [result] = await db
        .select({
          id: brandFacilities.id,
          name: brandFacilities.displayName,
        })
        .from(brandFacilities)
        .where(
          and(
            eq(brandFacilities.brandId, brandId),
            sql`LOWER(${brandFacilities.displayName}) = LOWER(${name})`,
          ),
        )
        .limit(1);
      return result ?? null;
    }

    case "SHOWCASE_BRAND": {
      const [result] = await db
        .select({ id: showcaseBrands.id, name: showcaseBrands.name })
        .from(showcaseBrands)
        .where(
          and(
            eq(showcaseBrands.brandId, brandId),
            sql`LOWER(${showcaseBrands.name}) = LOWER(${name})`,
          ),
        )
        .limit(1);
      return result ?? null;
    }

    case "CERTIFICATION": {
      const [result] = await db
        .select({
          id: brandCertifications.id,
          name: brandCertifications.title,
        })
        .from(brandCertifications)
        .where(
          and(
            eq(brandCertifications.brandId, brandId),
            sql`LOWER(${brandCertifications.title}) = LOWER(${name})`,
          ),
        )
        .limit(1);
      return result ?? null;
    }

    default: {
      const _exhaustive: never = entityType;
      throw new Error(`Unknown entity type: ${_exhaustive}`);
    }
  }
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validates color input data
 *
 * @param name - Color name
 * @returns Validation result with any errors
 */
export function validateColorInput(name: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!name || name.trim().length === 0) {
    errors.push({
      field: "name",
      message: "Color name is required",
      code: "REQUIRED_FIELD",
    });
  } else if (name.length > 100) {
    errors.push({
      field: "name",
      message: "Color name cannot exceed 100 characters",
      code: "FIELD_TOO_LONG",
    });
  } else if (name.length < 1) {
    errors.push({
      field: "name",
      message: "Color name must be at least 1 character",
      code: "FIELD_TOO_SHORT",
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates size input data
 *
 * @param input - Size data
 * @returns Validation result with any errors
 */
export function validateSizeInput(input: {
  name: string;
  categoryGroup?: string;
  categoryId?: string;
  sortIndex?: number;
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push({
      field: "name",
      message: "Size name is required",
      code: "REQUIRED_FIELD",
    });
  } else if (input.name.length > 100) {
    errors.push({
      field: "name",
      message: "Size name cannot exceed 100 characters",
      code: "FIELD_TOO_LONG",
    });
  }

  // Validate category group if provided
  if (input.categoryGroup && !isValidCategoryGroup(input.categoryGroup)) {
    errors.push({
      field: "categoryGroup",
      message: `Invalid category group. Must be one of: ${VALID_CATEGORY_GROUPS.join(", ")}`,
      code: "INVALID_VALUE",
    });
  }

  if (input.sortIndex !== undefined && input.sortIndex < 0) {
    errors.push({
      field: "sortIndex",
      message: "Sort index must be non-negative",
      code: "INVALID_VALUE",
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates material input data
 *
 * @param input - Material data
 * @returns Validation result with any errors
 */
export function validateMaterialInput(input: {
  name: string;
  certificationId?: string;
  recyclable?: boolean;
  countryOfOrigin?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push({
      field: "name",
      message: "Material name is required",
      code: "REQUIRED_FIELD",
    });
  } else if (input.name.length > 100) {
    errors.push({
      field: "name",
      message: "Material name cannot exceed 100 characters",
      code: "FIELD_TOO_LONG",
    });
  }

  // Validate country code format (ISO 3166-1 alpha-2)
  if (
    input.countryOfOrigin &&
    !/^[A-Z]{2}$/.test(input.countryOfOrigin.toUpperCase())
  ) {
    errors.push({
      field: "countryOfOrigin",
      message:
        "Country of origin must be a 2-letter ISO country code (e.g., US, UK, IN)",
      code: "INVALID_FORMAT",
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates eco-claim input data
 *
 * @param claim - Eco-claim text
 * @returns Validation result with any errors
 */
export function validateEcoClaimInput(claim: string): ValidationResult {
  const errors: ValidationError[] = [];

  if (!claim || claim.trim().length === 0) {
    errors.push({
      field: "claim",
      message: "Eco-claim is required",
      code: "REQUIRED_FIELD",
    });
  } else if (claim.length > 500) {
    errors.push({
      field: "claim",
      message: "Eco-claim cannot exceed 500 characters",
      code: "FIELD_TOO_LONG",
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates facility input data
 *
 * @param input - Facility data
 * @returns Validation result with any errors
 */
export function validateFacilityInput(input: {
  displayName: string;
  legalName?: string;
  address?: string;
  city?: string;
  countryCode?: string;
  contact?: string;
  vatNumber?: string;
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (!input.displayName || input.displayName.trim().length === 0) {
    errors.push({
      field: "displayName",
      message: "Display name is required",
      code: "REQUIRED_FIELD",
    });
  } else if (input.displayName.length > 200) {
    errors.push({
      field: "displayName",
      message: "Display name cannot exceed 200 characters",
      code: "FIELD_TOO_LONG",
    });
  }

  if (input.legalName && input.legalName.length > 200) {
    errors.push({
      field: "legalName",
      message: "Legal name cannot exceed 200 characters",
      code: "FIELD_TOO_LONG",
    });
  }

  if (
    input.countryCode &&
    !/^[A-Z]{2}$/.test(input.countryCode.toUpperCase())
  ) {
    errors.push({
      field: "countryCode",
      message: "Country code must be a 2-letter ISO code (e.g., US, UK, IN)",
      code: "INVALID_FORMAT",
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates showcase brand input data
 *
 * @param input - Showcase brand data
 * @returns Validation result with any errors
 */
export function validateShowcaseBrandInput(input: {
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
}): ValidationResult {
  const errors: ValidationError[] = [];

  if (!input.name || input.name.trim().length === 0) {
    errors.push({
      field: "name",
      message: "Brand name is required",
      code: "REQUIRED_FIELD",
    });
  } else if (input.name.length > 200) {
    errors.push({
      field: "name",
      message: "Brand name cannot exceed 200 characters",
      code: "FIELD_TOO_LONG",
    });
  }

  // Email validation
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push({
      field: "email",
      message: "Invalid email format",
      code: "INVALID_FORMAT",
    });
  }

  // Website validation
  if (input.website) {
    try {
      new URL(input.website);
    } catch {
      errors.push({
        field: "website",
        message: "Invalid website URL format",
        code: "INVALID_FORMAT",
      });
    }
  }

  // Country code validation
  if (
    input.countryCode &&
    !/^[A-Z]{2}$/.test(input.countryCode.toUpperCase())
  ) {
    errors.push({
      field: "countryCode",
      message: "Country code must be a 2-letter ISO code (e.g., US, UK, IN)",
      code: "INVALID_FORMAT",
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates certification input data
 *
 * @param input - Certification data
 * @returns Validation result with any errors
 */
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
    errors.push({
      field: "title",
      message: "Certification title is required",
      code: "REQUIRED_FIELD",
    });
  } else if (input.title.length > 200) {
    errors.push({
      field: "title",
      message: "Title cannot exceed 200 characters",
      code: "FIELD_TOO_LONG",
    });
  }

  // Date validation
  if (input.issueDate) {
    const issueDate = new Date(input.issueDate);
    if (isNaN(issueDate.getTime())) {
      errors.push({
        field: "issueDate",
        message: "Invalid issue date format",
        code: "INVALID_FORMAT",
      });
    }
  }

  if (input.expiryDate) {
    const expiryDate = new Date(input.expiryDate);
    if (isNaN(expiryDate.getTime())) {
      errors.push({
        field: "expiryDate",
        message: "Invalid expiry date format",
        code: "INVALID_FORMAT",
      });
    } else if (input.issueDate) {
      const issueDate = new Date(input.issueDate);
      if (!isNaN(issueDate.getTime()) && expiryDate <= issueDate) {
        errors.push({
          field: "expiryDate",
          message: "Expiry date must be after issue date",
          code: "INVALID_VALUE",
        });
      }
    }
  }

  // External URL validation
  if (input.externalUrl) {
    try {
      new URL(input.externalUrl);
    } catch {
      errors.push({
        field: "externalUrl",
        message: "Invalid external URL format",
        code: "INVALID_FORMAT",
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates and creates a catalog entity with duplicate checking
 *
 * @param db - Database connection
 * @param brandId - Brand UUID
 * @param entityType - Entity type to create
 * @param input - Entity data
 * @returns Created entity ID or throws validation error
 *
 * @example
 * ```typescript
 * const color = await validateAndCreateEntity(db, "brand-uuid", "COLOR", { name: "Red" });
 * console.log(`Created color with ID: ${color.id}`);
 * ```
 */
export async function validateAndCreateEntity(
  db: Database,
  brandId: string,
  entityType: CatalogEntityType,
  input: unknown,
): Promise<{ id: string }> {
  let validation: ValidationResult;
  let name: string;

  // Validate input based on entity type
  switch (entityType) {
    case "COLOR":
      validation = validateColorInput((input as { name: string }).name);
      name = (input as { name: string }).name;
      break;
    case "SIZE":
      validation = validateSizeInput(
        input as {
          name: string;
          categoryGroup?: string;
          categoryId?: string;
          sortIndex?: number;
        },
      );
      name = (input as { name: string }).name;
      break;
    case "MATERIAL":
      validation = validateMaterialInput(
        input as {
          name: string;
          certificationId?: string;
          recyclable?: boolean;
          countryOfOrigin?: string;
        },
      );
      name = (input as { name: string }).name;
      break;
    case "ECO_CLAIM":
      validation = validateEcoClaimInput((input as { claim: string }).claim);
      name = (input as { claim: string }).claim;
      break;
    case "FACILITY":
      validation = validateFacilityInput(input as { displayName: string });
      name = (input as { displayName: string }).displayName;
      break;
    case "SHOWCASE_BRAND":
      validation = validateShowcaseBrandInput(input as { name: string });
      name = (input as { name: string }).name;
      break;
    case "CERTIFICATION":
      validation = validateCertificationInput(input as { title: string });
      name = (input as { title: string }).title;
      break;
    default: {
      const _exhaustive: never = entityType;
      throw new Error(`Unknown entity type: ${_exhaustive}`);
    }
  }

  // Check validation errors
  if (!validation.valid) {
    const errorMessages = validation.errors
      .map((e) => `${e.field}: ${e.message}`)
      .join("; ");
    throw new Error(`Validation failed: ${errorMessages}`);
  }

  // Check for duplicates
  const inputWithOptions = input as {
    categoryGroup?: string;
    categoryId?: string;
  };
  const duplicate = await checkDuplicateName(db, brandId, entityType, name, {
    categoryGroup: inputWithOptions.categoryGroup,
    categoryId: inputWithOptions.categoryId,
  });

  if (duplicate) {
    throw new Error(
      `${entityType} with name "${name}" already exists for this brand`,
    );
  }

  // Create entity based on type
  let result: { id: string } | undefined;

  switch (entityType) {
    case "COLOR":
      result = await createColor(db, brandId, input as { name: string });
      break;
    case "SIZE":
      result = await createSize(
        db,
        brandId,
        input as {
          name: string;
          categoryGroup?: string;
          categoryId?: string;
          sortIndex?: number;
        },
      );
      break;
    case "MATERIAL":
      result = await createMaterial(
        db,
        brandId,
        input as {
          name: string;
          certificationId?: string;
          recyclable?: boolean;
          countryOfOrigin?: string;
        },
      );
      break;
    case "ECO_CLAIM":
      result = await createEcoClaim(db, brandId, input as { claim: string });
      break;
    case "FACILITY":
      result = await createFacility(
        db,
        brandId,
        input as { displayName: string },
      );
      break;
    case "SHOWCASE_BRAND":
      result = await createShowcaseBrand(
        db,
        brandId,
        input as { name: string },
      );
      break;
    case "CERTIFICATION":
      result = await createCertification(
        db,
        brandId,
        input as { title: string },
      );
      break;
    default: {
      const _exhaustive: never = entityType;
      throw new Error(`Unknown entity type: ${_exhaustive}`);
    }
  }

  if (!result) {
    throw new Error(`Failed to create ${entityType}`);
  }

  return result;
}
