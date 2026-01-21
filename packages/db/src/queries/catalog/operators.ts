import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandOperators } from "../../schema";
import { buildPartialUpdate } from "../_shared/patch.js";

export async function listOperators(db: Database, brandId: string) {
  return db
    .select({
      id: brandOperators.id,
      display_name: brandOperators.displayName,
      legal_name: brandOperators.legalName,
      email: brandOperators.email,
      phone: brandOperators.phone,
      website: brandOperators.website,
      address_line_1: brandOperators.addressLine1,
      address_line_2: brandOperators.addressLine2,
      city: brandOperators.city,
      state: brandOperators.state,
      zip: brandOperators.zip,
      country_code: brandOperators.countryCode,
      created_at: brandOperators.createdAt,
      updated_at: brandOperators.updatedAt,
    })
    .from(brandOperators)
    .where(eq(brandOperators.brandId, brandId))
    .orderBy(asc(brandOperators.displayName));
}

export async function createOperator(
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
    .insert(brandOperators)
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
    .returning({ id: brandOperators.id });
  return row;
}

export async function updateOperator(
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
    .update(brandOperators)
    .set(updateData)
    .where(and(eq(brandOperators.id, id), eq(brandOperators.brandId, brandId)))
    .returning({ id: brandOperators.id });
  return row;
}

export async function deleteOperator(
  db: Database,
  brandId: string,
  id: string,
) {
  const [row] = await db
    .delete(brandOperators)
    .where(and(eq(brandOperators.id, id), eq(brandOperators.brandId, brandId)))
    .returning({ id: brandOperators.id });
  return row;
}
