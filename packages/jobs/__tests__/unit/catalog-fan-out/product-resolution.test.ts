/**
 * Unit Tests: Catalog Fan-Out Product Resolution
 *
 * Verifies how the fan-out job chooses affected product IDs before publishing.
 */

import { describe, expect, it, mock } from "bun:test";
import { resolveCatalogFanOutProductIds } from "../../../src/trigger/catalog/fan-out";

describe("resolveCatalogFanOutProductIds", () => {
  it("prefers product IDs supplied in the payload", async () => {
    // Skip entity lookups when the API already captured the affected products.
    const manufacturerResolver = mock(async () => {
      throw new Error(
        "Manufacturer resolver should not run when productIds are provided",
      );
    });

    const result = await resolveCatalogFanOutProductIds(
      {
        brandId: "brand_1",
        entityType: "manufacturer",
        entityId: "manufacturer_1",
        productIds: ["product_1", "product_2", "product_1"],
      },
      {
        findPublishedProductIdsByCertification: mock(async () => []),
        findPublishedProductIdsByManufacturer: manufacturerResolver as any,
        findPublishedProductIdsByMaterial: mock(async () => []),
        findPublishedProductIdsByOperator: mock(async () => []),
      },
    );

    expect(result).toEqual(["product_1", "product_2"]);
    expect(manufacturerResolver).toHaveBeenCalledTimes(0);
  });

  it("falls back to the entity resolver when payload product IDs are absent", async () => {
    // Delegate to the entity-specific resolver when no pre-delete IDs are available.
    let seenBrandId: string | null = null;
    let seenEntityId: string | null = null;

    const manufacturerResolver = mock(
      async (_db: unknown, brandId: string, entityId: string) => {
        seenBrandId = brandId;
        seenEntityId = entityId;
        return ["product_3"];
      },
    );

    const result = await resolveCatalogFanOutProductIds(
      {
        brandId: "brand_2",
        entityType: "manufacturer",
        entityId: "manufacturer_2",
      },
      {
        findPublishedProductIdsByCertification: mock(async () => []),
        findPublishedProductIdsByManufacturer: manufacturerResolver,
        findPublishedProductIdsByMaterial: mock(async () => []),
        findPublishedProductIdsByOperator: mock(async () => []),
      },
    );

    expect(result).toEqual(["product_3"]);
    expect(manufacturerResolver).toHaveBeenCalledTimes(1);
    expect(seenBrandId ?? "").toBe("brand_2");
    expect(seenEntityId ?? "").toBe("manufacturer_2");
  });
});
