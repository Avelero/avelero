import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandManufacturers } from "../../schema";
import { buildPartialUpdate } from "../_shared/patch.js";

export async function listBrandManufacturers(db: Database, brandId: string) {
  return db
    .select({
      id: brandManufacturers.id,
      name: brandManufacturers.name,
      legal_name: brandManufacturers.legalName,
      email: brandManufacturers.email,
      phone: brandManufacturers.phone,
      website: brandManufacturers.website,
      address_line_1: brandManufacturers.addressLine1,
      address_line_2: brandManufacturers.addressLine2,
      city: brandManufacturers.city,
      state: brandManufacturers.state,
      zip: brandManufacturers.zip,
      country_code: brandManufacturers.countryCode,
      created_at: brandManufacturers.createdAt,
      updated_at: brandManufacturers.updatedAt,
    })
    .from(brandManufacturers)
    .where(eq(brandManufacturers.brandId, brandId))
    .orderBy(asc(brandManufacturers.name));
}

export async function createBrandManufacturer(
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
    .insert(brandManufacturers)
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
    .returning({ id: brandManufacturers.id });
  return row;
}

export async function updateBrandManufacturer(
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
  const updateData = buildPartialUpdate({
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
  });

  const [row] = await db
    .update(brandManufacturers)
    .set(updateData)
    .where(and(eq(brandManufacturers.id, id), eq(brandManufacturers.brandId, brandId)))
    .returning({ id: brandManufacturers.id });
  return row;
}

export async function deleteBrandManufacturer(
  db: Database,
  brandId: string,
  id: string,
) {
  const [row] = await db
    .delete(brandManufacturers)
    .where(and(eq(brandManufacturers.id, id), eq(brandManufacturers.brandId, brandId)))
    .returning({ id: brandManufacturers.id });
  return row;
}

