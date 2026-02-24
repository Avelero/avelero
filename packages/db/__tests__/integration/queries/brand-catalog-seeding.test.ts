// Load setup first (env + per-test transaction isolation)
import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { and, eq, sql } from "drizzle-orm";
import { createBrand } from "@v1/db/queries/brand";
import { seedBrandCatalogDefaults } from "@v1/db/queries/catalog";
import * as schema from "@v1/db/schema";
import {
  createTestBrand,
  createTestUser,
  testDb,
} from "@v1/db/testing";

describe("Brand catalog default seeding", () => {
  let taxonomyAttributeCount = 0;
  let taxonomyValueCount = 0;

  beforeEach(async () => {
    const taxAttrs = await testDb
      .select({ id: schema.taxonomyAttributes.id })
      .from(schema.taxonomyAttributes);
    const taxVals = await testDb
      .select({ id: schema.taxonomyValues.id })
      .from(schema.taxonomyValues);

    taxonomyAttributeCount = taxAttrs.length;
    taxonomyValueCount = taxVals.length;

    expect(taxonomyAttributeCount).toBeGreaterThan(0);
    expect(taxonomyValueCount).toBeGreaterThan(0);
  });

  it("seeds brand attributes and values from taxonomy with copied metadata and sort order", async () => {
    const brandId = await createTestBrand("Catalog Seed Target");

    const result = await seedBrandCatalogDefaults(testDb, brandId);

    expect(result.attributesCreated).toBe(taxonomyAttributeCount);
    expect(result.valuesCreated).toBe(taxonomyValueCount);

    const brandAttrs = await testDb
      .select({
        id: schema.brandAttributes.id,
        taxonomyAttributeId: schema.brandAttributes.taxonomyAttributeId,
      })
      .from(schema.brandAttributes)
      .where(eq(schema.brandAttributes.brandId, brandId));

    const brandVals = await testDb
      .select({
        id: schema.brandAttributeValues.id,
        taxonomyValueId: schema.brandAttributeValues.taxonomyValueId,
        metadata: schema.brandAttributeValues.metadata,
        sortOrder: schema.brandAttributeValues.sortOrder,
      })
      .from(schema.brandAttributeValues)
      .where(eq(schema.brandAttributeValues.brandId, brandId));

    expect(brandAttrs.length).toBe(taxonomyAttributeCount);
    expect(brandVals.length).toBe(taxonomyValueCount);
    expect(brandAttrs.every((a) => a.taxonomyAttributeId)).toBe(true);
    expect(brandVals.every((v) => v.taxonomyValueId)).toBe(true);

    const [sampleSeededValue] = brandVals;
    expect(sampleSeededValue).toBeDefined();

    const [sourceTaxonomyValue] = await testDb
      .select({
        metadata: schema.taxonomyValues.metadata,
        sortOrder: schema.taxonomyValues.sortOrder,
      })
      .from(schema.taxonomyValues)
      .where(eq(schema.taxonomyValues.id, sampleSeededValue!.taxonomyValueId!))
      .limit(1);

    expect(sourceTaxonomyValue).toBeDefined();
    expect(sampleSeededValue?.sortOrder).toBe(sourceTaxonomyValue?.sortOrder);
    expect(sampleSeededValue?.metadata).toEqual(sourceTaxonomyValue?.metadata ?? {});
  });

  it("is idempotent for the same brand", async () => {
    const brandId = await createTestBrand("Catalog Seed Idempotent");

    const first = await seedBrandCatalogDefaults(testDb, brandId);
    const second = await seedBrandCatalogDefaults(testDb, brandId);

    expect(first.attributesCreated).toBe(taxonomyAttributeCount);
    expect(first.valuesCreated).toBe(taxonomyValueCount);
    expect(second).toEqual({
      attributesCreated: 0,
      valuesCreated: 0,
    });

    const [attrCountRow] = await testDb
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.brandAttributes)
      .where(eq(schema.brandAttributes.brandId, brandId));

    const [valueCountRow] = await testDb
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.brandAttributeValues)
      .where(eq(schema.brandAttributeValues.brandId, brandId));

    expect(attrCountRow?.count).toBe(taxonomyAttributeCount);
    expect(valueCountRow?.count).toBe(taxonomyValueCount);
  });

  it("createBrand seeds defaults in the same transaction", async () => {
    const userId = await createTestUser("seeded-brand-owner@example.com");

    const created = await createBrand(testDb, userId, {
      name: "Transactional Seed Brand",
    });

    expect(created.id).toBeDefined();

    const brandId = created.id;

    const brandAttrs = await testDb
      .select({ id: schema.brandAttributes.id })
      .from(schema.brandAttributes)
      .where(eq(schema.brandAttributes.brandId, brandId));
    const brandVals = await testDb
      .select({ id: schema.brandAttributeValues.id })
      .from(schema.brandAttributeValues)
      .where(eq(schema.brandAttributeValues.brandId, brandId));

    expect(brandAttrs.length).toBe(taxonomyAttributeCount);
    expect(brandVals.length).toBe(taxonomyValueCount);

    const [membership] = await testDb
      .select({ id: schema.brandMembers.id })
      .from(schema.brandMembers)
      .where(
        and(
          eq(schema.brandMembers.brandId, brandId),
          eq(schema.brandMembers.userId, userId),
        ),
      )
      .limit(1);
    expect(membership).toBeDefined();

    const [user] = await testDb
      .select({ brandId: schema.users.brandId })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);
    expect(user?.brandId).toBe(brandId);
  });
});
