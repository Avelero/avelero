/**
 * Test Data Helpers - Brand & Integration
 *
 * Provides helper functions for creating test brands, integrations,
 * and field configurations.
 *
 * @module @v1/db/testing/brand
 */

import { sql } from "drizzle-orm";
import * as schema from "../schema/index";
import { testDb } from "./connection";

/**
 * Create a test brand for integration tests.
 * Returns the brand ID for use in tests.
 */
export async function createTestBrand(name = "Test Brand"): Promise<string> {
  // Generate unique slug with random suffix to prevent collisions
  // when tests run concurrently or cleanup is incomplete
  const randomSuffix = Math.random().toString(36).substring(2, 10);
  const baseSlug = name.toLowerCase().replace(/\s+/g, "-");

  const [brand] = await testDb
    .insert(schema.brands)
    .values({
      name,
      slug: `${baseSlug}-${randomSuffix}`,
    })
    .returning({ id: schema.brands.id });

  if (!brand) {
    throw new Error("Failed to create test brand");
  }

  return brand.id;
}

/**
 * Create a test brand integration.
 * Returns the brand integration ID for use in tests.
 */
export async function createTestBrandIntegration(
  brandId: string,
  integrationSlug = "shopify",
  options?: { isPrimary?: boolean },
): Promise<string> {
  // First ensure the integration exists
  const [existingIntegration] = await testDb
    .select()
    .from(schema.integrations)
    .where(sql`${schema.integrations.slug} = ${integrationSlug}`)
    .limit(1);

  let integrationId: string;

  if (existingIntegration) {
    integrationId = existingIntegration.id;
  } else {
    const [integration] = await testDb
      .insert(schema.integrations)
      .values({
        slug: integrationSlug,
        name:
          integrationSlug.charAt(0).toUpperCase() + integrationSlug.slice(1),
        description: `Test ${integrationSlug} integration`,
        authType: "oauth",
        status: "active",
      })
      .returning({ id: schema.integrations.id });

    if (!integration) {
      throw new Error("Failed to create test integration");
    }

    integrationId = integration.id;
  }

  // Create brand integration
  const [brandIntegration] = await testDb
    .insert(schema.brandIntegrations)
    .values({
      brandId,
      integrationId,
      status: "active",
      isPrimary: options?.isPrimary ?? false,
      credentials: JSON.stringify({
        accessToken: "test-access-token",
        shopDomain: "test-shop.myshopify.com",
      }),
    })
    .returning({ id: schema.brandIntegrations.id });

  if (!brandIntegration) {
    throw new Error("Failed to create test brand integration");
  }

  return brandIntegration.id;
}

/**
 * Create default field configs for a brand integration.
 * Enables all standard Shopify fields with default sources.
 */
export async function createDefaultFieldConfigs(
  brandIntegrationId: string,
): Promise<void> {
  const defaultConfigs = [
    {
      fieldKey: "product.name",
      ownershipEnabled: true,
      sourceOptionKey: "title",
    },
    {
      fieldKey: "product.description",
      ownershipEnabled: true,
      sourceOptionKey: "description",
    },
    {
      fieldKey: "product.imagePath",
      ownershipEnabled: true,
      sourceOptionKey: "featured_image",
    },
    {
      fieldKey: "product.webshopUrl",
      ownershipEnabled: true,
      sourceOptionKey: "online_store_url",
    },
    {
      fieldKey: "product.salesStatus",
      ownershipEnabled: true,
      sourceOptionKey: "status",
    },
    {
      fieldKey: "product.tags",
      ownershipEnabled: true,
      sourceOptionKey: "tags",
    },
    {
      fieldKey: "product.categoryId",
      ownershipEnabled: true,
      sourceOptionKey: "category",
    },
    {
      fieldKey: "product.price",
      ownershipEnabled: true,
      sourceOptionKey: "price",
    },
    {
      fieldKey: "product.currency",
      ownershipEnabled: true,
      sourceOptionKey: "currency",
    },
    { fieldKey: "variant.sku", ownershipEnabled: true, sourceOptionKey: "sku" },
    {
      fieldKey: "variant.barcode",
      ownershipEnabled: true,
      sourceOptionKey: "barcode",
    },
    {
      fieldKey: "variant.attributes",
      ownershipEnabled: true,
      sourceOptionKey: "selectedOptions",
    },
  ];

  await testDb.insert(schema.integrationFieldConfigs).values(
    defaultConfigs.map((config) => ({
      brandIntegrationId,
      ...config,
    })),
  );
}
