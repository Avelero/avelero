import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import type { Database } from "../client";

/**
 * Integration tests for product identifier system
 * Tests verify:
 * - product_identifier column is NOT NULL and unique
 * - SKU column is nullable in product_variants
 * - All existing products have valid identifiers
 */

let db: Database;
let client: ReturnType<typeof postgres>;

beforeAll(async () => {
	const connectionString = process.env.DATABASE_URL;
	if (!connectionString) {
		throw new Error("DATABASE_URL not set");
	}

	client = postgres(connectionString);
	db = drizzle(client);
});

afterAll(async () => {
	await client.end();
});

describe("product_identifier column", () => {
	test("should have no NULL product_identifiers in database", async () => {
		const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM products
      WHERE product_identifier IS NULL
    `);

		expect(result[0]?.count).toBe("0");
	});

	test("should have all unique product_identifiers", async () => {
		const result = await db.execute(sql`
      SELECT COUNT(*) as total, COUNT(DISTINCT product_identifier) as unique_count
      FROM products
    `);

		expect(result[0]?.total).toBe(result[0]?.unique_count);
	});

	test("should have product_identifier column with NOT NULL constraint", async () => {
		const result = await db.execute(sql`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'products'
      AND column_name = 'product_identifier'
    `);

		expect(result[0]?.is_nullable).toBe("NO");
	});

	test("should have unique index on (brand_id, product_identifier)", async () => {
		const result = await db.execute(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'products'
      AND indexdef LIKE '%product_identifier%'
      AND indexdef LIKE '%UNIQUE%'
    `);

		expect(result.length).toBeGreaterThan(0);
	});
});

describe("product_variants SKU column", () => {
	test("should have nullable SKU column", async () => {
		const result = await db.execute(sql`
      SELECT is_nullable
      FROM information_schema.columns
      WHERE table_name = 'product_variants'
      AND column_name = 'sku'
    `);

		expect(result[0]?.is_nullable).toBe("YES");
	});

	test("should have all variants tracked by UUID (id column)", async () => {
		const result = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM product_variants
      WHERE id IS NULL
    `);

		expect(result[0]?.count).toBe("0");
	});
});

describe("staging_products schema", () => {
	test("should have product_identifier column", async () => {
		const result = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'staging_products'
      AND column_name = 'product_identifier'
    `);

		expect(result.length).toBe(1);
		expect(result[0]?.column_name).toBe("product_identifier");
		expect(result[0]?.data_type).toBe("text");
	});
});
