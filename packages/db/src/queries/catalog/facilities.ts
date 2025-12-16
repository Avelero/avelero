import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandFacilities } from "../../schema";
import { buildPartialUpdate } from "../_shared/patch.js";

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
  const updateData = buildPartialUpdate({
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
  });

  const [row] = await db
    .update(brandFacilities)
    .set(updateData)
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

