import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandCertifications } from "../../schema";
import { buildPartialUpdate } from "../_shared/patch.js";

export async function listCertifications(db: Database, brandId: string) {
  return db
    .select({
      id: brandCertifications.id,
      title: brandCertifications.title,
      certification_code: brandCertifications.certificationCode,
      institute_name: brandCertifications.instituteName,
      institute_email: brandCertifications.instituteEmail,
      institute_website: brandCertifications.instituteWebsite,
      institute_address_line_1: brandCertifications.instituteAddressLine1,
      institute_address_line_2: brandCertifications.instituteAddressLine2,
      institute_city: brandCertifications.instituteCity,
      institute_state: brandCertifications.instituteState,
      institute_zip: brandCertifications.instituteZip,
      institute_country_code: brandCertifications.instituteCountryCode,
      issue_date: brandCertifications.issueDate,
      expiry_date: brandCertifications.expiryDate,
      file_path: brandCertifications.filePath,
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
    instituteEmail?: string;
    instituteWebsite?: string;
    instituteAddressLine1?: string;
    instituteAddressLine2?: string;
    instituteCity?: string;
    instituteState?: string;
    instituteZip?: string;
    instituteCountryCode?: string;
    issueDate?: string;
    expiryDate?: string;
    filePath?: string;
  },
) {
  const [row] = await db
    .insert(brandCertifications)
    .values({
      brandId,
      title: input.title,
      certificationCode: input.certificationCode ?? null,
      instituteName: input.instituteName ?? null,
      instituteEmail: input.instituteEmail ?? null,
      instituteWebsite: input.instituteWebsite ?? null,
      instituteAddressLine1: input.instituteAddressLine1 ?? null,
      instituteAddressLine2: input.instituteAddressLine2 ?? null,
      instituteCity: input.instituteCity ?? null,
      instituteState: input.instituteState ?? null,
      instituteZip: input.instituteZip ?? null,
      instituteCountryCode: input.instituteCountryCode ?? null,
      issueDate: input.issueDate ?? null,
      expiryDate: input.expiryDate ?? null,
      filePath: input.filePath ?? null,
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
    instituteEmail: string | null;
    instituteWebsite: string | null;
    instituteAddressLine1: string | null;
    instituteAddressLine2: string | null;
    instituteCity: string | null;
    instituteState: string | null;
    instituteZip: string | null;
    instituteCountryCode: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    filePath: string | null;
  }>,
) {
  const updateData = buildPartialUpdate({
    title: input.title,
    certificationCode: input.certificationCode ?? null,
    instituteName: input.instituteName ?? null,
    instituteEmail: input.instituteEmail ?? null,
    instituteWebsite: input.instituteWebsite ?? null,
    instituteAddressLine1: input.instituteAddressLine1 ?? null,
    instituteAddressLine2: input.instituteAddressLine2 ?? null,
    instituteCity: input.instituteCity ?? null,
    instituteState: input.instituteState ?? null,
    instituteZip: input.instituteZip ?? null,
    instituteCountryCode: input.instituteCountryCode ?? null,
    issueDate: input.issueDate ?? null,
    expiryDate: input.expiryDate ?? null,
    filePath: input.filePath ?? null,
  });

  const [row] = await db
    .update(brandCertifications)
    .set(updateData)
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




