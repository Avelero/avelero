/**
 * Integration Tests: DPP Snapshot Certification Enrichment
 *
 * Verifies that certification issue dates, expiry dates, and public document
 * URLs are preserved in both single-snapshot generation and set-based publish
 * snapshots.
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import type { DppSnapshot } from "@v1/db/queries/products";
import {
  generateDppSnapshot,
  publishProductsSetBased,
} from "@v1/db/queries/products";
import * as schema from "@v1/db/schema";
import {
  cleanupTables,
  createTestBrand,
  createTestProduct,
  createTestVariant,
  testDb,
} from "@v1/db/testing";

const STORAGE_BASE_URL = "https://example.supabase.co";

/**
 * Seed one certified material linked to a product.
 */
async function seedCertifiedMaterial(input: {
  brandId: string;
  productId: string;
}) {
  const issueDate = "2024-02-15 00:00:00";
  const expiryDate = "2027-02-15 00:00:00";
  const certificationPath = `${input.brandId}/grs-2024-12345.pdf`;

  const [certification] = await testDb
    .insert(schema.brandCertifications)
    .values({
      brandId: input.brandId,
      title: "Global Recycled Standard",
      certificationCode: "GRS-2024-12345",
      issueDate,
      expiryDate,
      certificationPath,
      instituteName: "Textile Certification Council",
      instituteEmail: "compliance@textilecouncil.example",
      instituteWebsite: "https://certifications.example.com/grs",
      instituteAddressLine1: "12 Observatory Lane",
      instituteAddressLine2: "Suite 400",
      instituteCity: "Amsterdam",
      instituteState: "Noord-Holland",
      instituteZip: "1017 AB",
      instituteCountryCode: "NL",
    })
    .returning({ id: schema.brandCertifications.id });

  const [material] = await testDb
    .insert(schema.brandMaterials)
    .values({
      brandId: input.brandId,
      name: "Recycled Polyester",
      certificationId: certification!.id,
      recyclable: true,
      countryOfOrigin: "CN",
    })
    .returning({ id: schema.brandMaterials.id });

  await testDb.insert(schema.productMaterials).values({
    productId: input.productId,
    brandMaterialId: material!.id,
    percentage: "85.00",
  });

  return {
    certificationPath,
    expiryDate,
    issueDate,
  };
}

/**
 * Load the latest materialized snapshot for a variant passport.
 */
async function getLatestSnapshotForVariant(
  variantId: string,
): Promise<DppSnapshot | null> {
  const [passport] = await testDb
    .select({
      currentVersionId: schema.productPassports.currentVersionId,
    })
    .from(schema.productPassports)
    .where(eq(schema.productPassports.workingVariantId, variantId))
    .limit(1);

  if (!passport?.currentVersionId) {
    return null;
  }

  const [version] = await testDb
    .select({
      dataSnapshot: schema.productPassportVersions.dataSnapshot,
    })
    .from(schema.productPassportVersions)
    .where(eq(schema.productPassportVersions.id, passport.currentVersionId))
    .limit(1);

  return (version?.dataSnapshot as DppSnapshot | null) ?? null;
}

/**
 * Resolve the storage base URL used by the set-based publish path in tests.
 */
function getRuntimeStorageBaseUrl(): string {
  const storageBaseUrl =
    process.env.SUPABASE_STORAGE_URL ??
    process.env.NEXT_PUBLIC_STORAGE_URL ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!storageBaseUrl) {
    throw new Error("Missing storage base URL in test environment");
  }

  return storageBaseUrl;
}

describe("DPP snapshot certification enrichment", () => {
  beforeEach(async () => {
    // Reset test data between cases.
    await cleanupTables();
  });

  it("includes certification dates and document URL in single snapshot generation", async () => {
    const brandId = await createTestBrand("Snapshot Brand");
    const product = await createTestProduct(brandId, {
      status: "published",
    });
    const variant = await createTestVariant(product.id, {
      upid: "UPID-CERT-SNAPSHOT-1",
    });
    const certification = await seedCertifiedMaterial({
      brandId,
      productId: product.id,
    });

    const snapshot = await generateDppSnapshot(
      testDb,
      variant.id,
      variant.upid!,
      { storageBaseUrl: STORAGE_BASE_URL },
    );

    const materialCertification =
      snapshot?.materials?.composition[0]?.certification ?? null;

    expect(materialCertification).not.toBeNull();
    expect(materialCertification?.issueDate).toBe(certification.issueDate);
    expect(materialCertification?.expiryDate).toBe(certification.expiryDate);
    expect(materialCertification?.documentUrl).toBe(
      `${STORAGE_BASE_URL}/storage/v1/object/public/certifications/${certification.certificationPath}`,
    );
  });

  it("includes certification dates and document URL in published version snapshots", async () => {
    const brandId = await createTestBrand("Published Snapshot Brand");
    const product = await createTestProduct(brandId, {
      status: "published",
    });
    const variant = await createTestVariant(product.id, {
      upid: "UPID-CERT-PUBLISH-1",
    });
    const certification = await seedCertifiedMaterial({
      brandId,
      productId: product.id,
    });

    const result = await publishProductsSetBased(testDb, {
      brandId,
      productIds: [product.id],
    });

    expect(result.versionsCreated).toBe(1);

    const snapshot = await getLatestSnapshotForVariant(variant.id);
    const materialCertification =
      snapshot?.materials?.composition[0]?.certification ?? null;

    expect(materialCertification).not.toBeNull();
    expect(materialCertification?.issueDate).toBe(certification.issueDate);
    expect(materialCertification?.expiryDate).toBe(certification.expiryDate);
    expect(materialCertification?.documentUrl).toBe(
      `${getRuntimeStorageBaseUrl()}/storage/v1/object/public/certifications/${certification.certificationPath}`,
    );
  });
});
