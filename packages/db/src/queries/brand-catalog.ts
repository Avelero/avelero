import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client";
import {
  brandCertifications,
  brandColors,
  brandEcoClaims,
  brandFacilities,
  brandMaterials,
  brandSizes,
  showcaseBrands,
} from "../schema";

// Colors
export async function listColors(db: Database, brandId: string) {
  return db
    .select({
      id: brandColors.id,
      name: brandColors.name,
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
  input: { name: string },
) {
  const [row] = await db
    .insert(brandColors)
    .values({ brandId, name: input.name })
    .returning({ id: brandColors.id });
  return row;
}

export async function updateColor(
  db: Database,
  brandId: string,
  id: string,
  input: { name: string },
) {
  const [row] = await db
    .update(brandColors)
    .set({ name: input.name })
    .where(and(eq(brandColors.id, id), eq(brandColors.brandId, brandId)))
    .returning({ id: brandColors.id });
  return row;
}

export async function deleteColor(db: Database, brandId: string, id: string) {
  const [row] = await db
    .delete(brandColors)
    .where(and(eq(brandColors.id, id), eq(brandColors.brandId, brandId)))
    .returning({ id: brandColors.id });
  return row;
}

// Sizes
export async function listSizes(
  db: Database,
  brandId: string,
  opts?: { categoryId?: string },
) {
  const where = opts?.categoryId
    ? and(
        eq(brandSizes.brandId, brandId),
        eq(brandSizes.categoryId, opts.categoryId),
      )
    : eq(brandSizes.brandId, brandId);
  return db
    .select({
      id: brandSizes.id,
      name: brandSizes.name,
      sort_index: brandSizes.sortIndex,
      category_id: brandSizes.categoryId,
      created_at: brandSizes.createdAt,
      updated_at: brandSizes.updatedAt,
    })
    .from(brandSizes)
    .where(where)
    .orderBy(asc(brandSizes.sortIndex), asc(brandSizes.name));
}

export async function createSize(
  db: Database,
  brandId: string,
  input: { name: string; categoryId?: string; sortIndex?: number },
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
