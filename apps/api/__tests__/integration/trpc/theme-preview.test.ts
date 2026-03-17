/**
 * Integration Tests: Theme Preview Router
 *
 * Verifies that the theme editor real-data preview returns the full material,
 * manufacturer, and operator fields consumed by the preview UI.
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import {
  CERTIFICATIONS_BUCKET,
  buildPublicStorageUrl,
  getSupabaseUrlFromEnv,
} from "@v1/db/utils";
import * as schema from "@v1/db/schema";
import { createTestBrand, createTestUser, testDb } from "@v1/db/testing";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";
import { themePreviewRouter } from "../../../src/trpc/routers/brand/theme-preview";

/**
 * Build a stable short suffix for unique test rows.
 */
function randomSuffix(): string {
  // Keep seeded record names distinct across isolated test transactions.
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Create a mock authenticated tRPC context for theme preview router calls.
 */
function createMockContext(options: {
  brandId: string;
  userEmail: string;
  userId: string;
}): AuthenticatedTRPCContext & { brandId: string } {
  // Provide the minimum authenticated context required by brand-scoped reads.
  return {
    user: {
      id: options.userId,
      email: options.userEmail,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as any,
    brandId: options.brandId,
    role: "owner",
    db: testDb,
    loaders: {} as any,
    supabase: {
      storage: {
        from: () => ({
          getPublicUrl: () => ({ data: { publicUrl: "" } }),
        }),
      },
    } as any,
    supabaseAdmin: null,
    geo: { ip: null },
  };
}

/**
 * Create a brand membership for the supplied test user.
 */
async function createBrandMembership(
  brandId: string,
  userId: string,
): Promise<void> {
  // Authorize the mock caller against the brand middleware.
  await testDb.insert(schema.brandMembers).values({
    brandId,
    userId,
    role: "owner",
  });
}

/**
 * Seed one product with full preview-facing catalog relationships.
 */
async function seedThemePreviewFixture(brandId: string): Promise<{
  certificationPath: string;
  operatorDisplayName: string;
  operatorLegalName: string;
  productId: string;
}> {
  // Create the working-layer rows the theme preview query stitches into DppData.
  const manufacturerId = crypto.randomUUID();
  const operatorId = crypto.randomUUID();
  const certificationId = crypto.randomUUID();
  const materialId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  const certificationPath = `${brandId}/theme-preview-grs.pdf`;
  const operatorDisplayName = "North Loom";
  const operatorLegalName = "North Loom B.V.";

  await testDb.insert(schema.brandManufacturers).values({
    id: manufacturerId,
    brandId,
    name: "Dryrobe",
    legalName: "Dryrobe Holdings Ltd.",
    email: "manufacturer@example.com",
    phone: "+44 20 1234 5678",
    website: "https://manufacturer.example.com",
    addressLine1: "1 Maker Street",
    addressLine2: "Unit 4",
    city: "Manchester",
    state: "Greater Manchester",
    zip: "M1 1AA",
    countryCode: "GB",
  });

  await testDb.insert(schema.brandOperators).values({
    id: operatorId,
    brandId,
    displayName: operatorDisplayName,
    legalName: operatorLegalName,
    email: "operator@example.com",
    phone: "+31 20 999 0000",
    website: "https://operator.example.com",
    addressLine1: "10 Canal Road",
    addressLine2: "Floor 2",
    city: "Amsterdam",
    state: "Noord-Holland",
    zip: "1011 AB",
    countryCode: "NL",
  });

  await testDb.insert(schema.brandCertifications).values({
    id: certificationId,
    brandId,
    title: "Global Recycled Standard",
    certificationCode: "GRS-012",
    issueDate: "2025-01-01 00:00:00",
    expiryDate: "2028-01-01 00:00:00",
    certificationPath,
    instituteName: "Textile Exchange",
    instituteEmail: "info@textileexchange.org",
    instituteWebsite: "https://textileexchange.org/",
    instituteAddressLine1: "331 E. Evelyn Ave",
    instituteAddressLine2: "Suite 212",
    instituteCity: "Burbank",
    instituteState: "CA",
    instituteZip: "91505",
    instituteCountryCode: "US",
  });

  await testDb.insert(schema.brandMaterials).values({
    id: materialId,
    brandId,
    name: "Recycled Polyester",
    certificationId,
    recyclable: true,
    countryOfOrigin: "GB",
  });

  await testDb.insert(schema.products).values({
    id: productId,
    brandId,
    manufacturerId,
    name: "Black Dryrobe Nexus",
    productHandle: `theme-preview-${randomSuffix()}`,
    description: "Preview data for the theme editor.",
    status: "draft",
  });

  await testDb.insert(schema.productMaterials).values({
    productId,
    brandMaterialId: materialId,
    percentage: "80.00",
  });

  await testDb.insert(schema.productJourneySteps).values({
    productId,
    operatorId,
    stepType: "RAW_MATERIAL",
    sortIndex: 0,
  });

  return {
    certificationPath,
    operatorDisplayName,
    operatorLegalName,
    productId,
  };
}

describe("Theme Preview Router", () => {
  let brandId: string;
  let userEmail: string;
  let userId: string;

  beforeEach(async () => {
    // Create a fresh authenticated brand-scoped caller for each test.
    brandId = await createTestBrand("Theme Preview Router Brand");
    userEmail = `theme-preview-${randomSuffix()}@example.com`;
    userId = await createTestUser(userEmail);
    await createBrandMembership(brandId, userId);
  });

  it("returns the full certification, manufacturer, and operator fields used by the preview consumers", async () => {
    // Load one fully linked product and assert the preview payload preserves the modal fields.
    const fixture = await seedThemePreviewFixture(brandId);
    const ctx = createMockContext({ brandId, userEmail, userId });
    const data = await themePreviewRouter.createCaller(ctx).getProduct({
      productId: fixture.productId,
    });

    expect(data).not.toBeNull();
    expect(data?.productAttributes.brand).toBe("Theme Preview Router Brand");

    const material = data?.materials?.composition[0];
    expect(material?.certification?.type).toBe("Global Recycled Standard");
    expect(material?.certification?.code).toBe("GRS-012");
    expect(material?.certification?.issueDate).toBe("2025-01-01 00:00:00");
    expect(material?.certification?.expiryDate).toBe("2028-01-01 00:00:00");
    expect(material?.certification?.documentUrl).toBe(
      buildPublicStorageUrl(
        getSupabaseUrlFromEnv(),
        CERTIFICATIONS_BUCKET,
        fixture.certificationPath,
      ) ?? undefined,
    );
    expect(material?.certification?.testingInstitute).toEqual({
      legalName: "Textile Exchange",
      email: "info@textileexchange.org",
      website: "https://textileexchange.org/",
      addressLine1: "331 E. Evelyn Ave",
      addressLine2: "Suite 212",
      city: "Burbank",
      state: "CA",
      postalCode: "91505",
      country: "US",
    });

    expect(data?.manufacturing?.manufacturer).toEqual({
      manufacturerId: 0,
      name: "Dryrobe",
      legalName: "Dryrobe Holdings Ltd.",
      email: "manufacturer@example.com",
      phone: "+44 20 1234 5678",
      website: "https://manufacturer.example.com",
      addressLine1: "1 Maker Street",
      addressLine2: "Unit 4",
      city: "Manchester",
      state: "Greater Manchester",
      zip: "M1 1AA",
      countryCode: "GB",
    });

    expect(data?.manufacturing?.supplyChain?.[0]).toEqual({
      processStep: "RAW MATERIAL",
      operator: {
        operatorId: 0,
        name: fixture.operatorDisplayName,
        legalName: fixture.operatorLegalName,
        email: "operator@example.com",
        phone: "+31 20 999 0000",
        website: "https://operator.example.com",
        addressLine1: "10 Canal Road",
        addressLine2: "Floor 2",
        city: "Amsterdam",
        state: "Noord-Holland",
        zip: "1011 AB",
        countryCode: "NL",
      },
    });
  });
});
