/**
 * Test Database Utility
 *
 * Connects to test PostgreSQL database and provides cleanup functions.
 * Tables are cleaned in correct order to respect foreign key constraints.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@v1/db/schema";
import { sql } from "drizzle-orm";

// Use test database URL from environment
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required for tests");
}

const client = postgres(connectionString);
export const testDb = drizzle(client, { schema });

/**
 * Tables to clean between tests, ordered by foreign key dependencies.
 * Delete child tables before parent tables to avoid FK violations.
 */
const tablesToClean = [
    // Integration links (depend on products/variants and brand_integrations)
    "integration_variant_links",
    "integration_product_links",
    "integration_entity_links",

    // Sync jobs (depend on brand_integrations)
    "sync_jobs",

    // Variant-level override tables (depend on product_variants)
    "variant_commercial",
    "variant_environment",
    "variant_eco_claims",
    "variant_materials",
    "variant_weight",
    "variant_journey_steps",

    // Variant attributes (depends on product_variants + brand_attribute_values)
    "product_variant_attributes",

    // Variants (depend on products)
    "product_variants",

    // Product-level tables (depend on products)
    "product_tags",
    "product_materials",
    "product_journey_steps",
    "product_environment",
    "product_eco_claims",
    "product_commercial",
    "product_weight",

    // Products (depend on brands)
    "products",

    // Catalog tables (depend on brands)
    "brand_tags",
    "brand_attribute_values",
    "brand_attributes",

    // Brand integrations (depend on brands and integrations)
    "integration_field_configs",
    "brand_integrations",
] as const;

/**
 * Clean all test tables. Called after each test.
 * Uses TRUNCATE with CASCADE for speed and to handle all dependencies.
 */
export async function cleanupTables(): Promise<void> {
    // Use TRUNCATE CASCADE for faster cleanup and to handle all dependencies
    for (const table of tablesToClean) {
        await testDb.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`));
    }
}

/**
 * Close database connection. Called after all tests complete.
 */
export async function closeTestDb(): Promise<void> {
    await client.end();
}

/**
 * Create a test brand for integration tests.
 * Returns the brand ID for use in tests.
 */
export async function createTestBrand(name = "Test Brand"): Promise<string> {
    const [brand] = await testDb
        .insert(schema.brands)
        .values({
            name,
            slug: name.toLowerCase().replace(/\s+/g, "-"),
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
    integrationSlug = "shopify"
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
                name: integrationSlug.charAt(0).toUpperCase() + integrationSlug.slice(1),
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
    brandIntegrationId: string
): Promise<void> {
    const defaultConfigs = [
        { fieldKey: "product.name", ownershipEnabled: true, sourceOptionKey: "title" },
        { fieldKey: "product.description", ownershipEnabled: true, sourceOptionKey: "description" },
        { fieldKey: "product.imagePath", ownershipEnabled: true, sourceOptionKey: "featured_image" },
        { fieldKey: "product.webshopUrl", ownershipEnabled: true, sourceOptionKey: "online_store_url" },
        { fieldKey: "product.salesStatus", ownershipEnabled: true, sourceOptionKey: "status" },
        { fieldKey: "product.tags", ownershipEnabled: true, sourceOptionKey: "tags" },
        { fieldKey: "product.categoryId", ownershipEnabled: true, sourceOptionKey: "category" },
        { fieldKey: "product.price", ownershipEnabled: true, sourceOptionKey: "price" },
        { fieldKey: "product.currency", ownershipEnabled: true, sourceOptionKey: "currency" },
        { fieldKey: "variant.sku", ownershipEnabled: true, sourceOptionKey: "sku" },
        { fieldKey: "variant.barcode", ownershipEnabled: true, sourceOptionKey: "barcode" },
        { fieldKey: "variant.attributes", ownershipEnabled: true, sourceOptionKey: "selectedOptions" },
    ];

    await testDb.insert(schema.integrationFieldConfigs).values(
        defaultConfigs.map((config) => ({
            brandIntegrationId,
            ...config,
        }))
    );
}
