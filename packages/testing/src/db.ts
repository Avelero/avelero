/**
 * Test Database Utility
 *
 * Connects to test PostgreSQL database and provides cleanup functions.
 * Uses dynamic table discovery instead of hardcoded lists to avoid sync issues.
 *
 * @module @v1/testing/db
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

/**
 * Drizzle database instance for tests.
 * Uses the schema from @v1/db for full type safety.
 */
export const testDb = drizzle(client, { schema });

/**
 * Tables that should NOT be cleaned between tests.
 * These contain reference data that is seeded once and should persist.
 */
const protectedTables = new Set([
    // Taxonomy data - seeded by taxonomy sync, required for all tests
    "taxonomy_categories",
    "taxonomy_attributes",
    "taxonomy_values",
    "taxonomy_external_mappings",
    // System tables
    "users",
    // Reference tables
    "integrations",
]);

/**
 * Clean all user tables between tests.
 * Dynamically queries the database for all tables and truncates them,
 * except for protected tables that contain reference data.
 *
 * Uses a single TRUNCATE statement with CASCADE for speed.
 */
export async function cleanupTables(): Promise<void> {
    // Query all user tables from the public schema
    const result = await testDb.execute<{ tablename: string }>(sql`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'drizzle_%'
        AND tablename NOT LIKE 'pg_%'
    `);

    // Filter out protected tables
    const tablesToClean = result
        .map((row) => row.tablename)
        .filter((table) => !protectedTables.has(table));

    if (tablesToClean.length === 0) {
        return;
    }

    // Build a single TRUNCATE statement for all tables
    // This is faster than truncating one by one and handles FK dependencies with CASCADE
    const tableList = tablesToClean.map((t) => `"${t}"`).join(", ");
    await testDb.execute(sql.raw(`TRUNCATE TABLE ${tableList} CASCADE`));
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
    options?: { isPrimary?: boolean }
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
