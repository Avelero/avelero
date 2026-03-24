/**
 * Unit tests for the ghost product variant backfill script.
 */
import { describe, expect, it } from "bun:test";
import { backfillGhostProductVariants } from "../../../src/scripts/backfill-ghost-product-variants";

type ExecuteResult = unknown[];

type MockDb = {
  execute: () => Promise<ExecuteResult>;
  transaction: <T>(callback: (tx: MockDb) => Promise<T>) => Promise<T>;
};

/**
 * Builds a queued mock database for the backfill script.
 */
function createMockDb(responses: ExecuteResult[]) {
  const calls: ExecuteResult[] = [];
  const queue = [...responses];

  const db: MockDb = {
    async execute() {
      const next = queue.shift();
      if (!next) {
        throw new Error("Unexpected execute() call");
      }

      calls.push(next);
      return next;
    },
    async transaction(callback) {
      return callback(db);
    },
  };

  return { db, calls };
}

describe("backfillGhostProductVariants", () => {
  it("returns a no-op summary when the legacy column is already gone", async () => {
    const { db } = createMockDb([[{ exists: false }]]);

    await expect(backfillGhostProductVariants(db as any)).resolves.toEqual({
      columnPresent: false,
      before: { ghostProducts: 0, ghostVariants: 0 },
      converted: { products: 0, variants: 0 },
      after: { ghostProducts: 0, ghostVariants: 0 },
    });
  });

  it("converts lone ghost-only variants in place", async () => {
    const { db, calls } = createMockDb([
      [{ exists: true }],
      [
        {
          product_id: "product-1",
          product_handle: "product-1",
          total_variant_count: 1,
          ghost_variant_count: 1,
          real_variant_count: 0,
          ghost_variants_with_attributes: 0,
        },
      ],
      [],
      [],
    ]);

    await expect(backfillGhostProductVariants(db as any)).resolves.toEqual({
      columnPresent: true,
      before: { ghostProducts: 1, ghostVariants: 1 },
      converted: { products: 1, variants: 1 },
      after: { ghostProducts: 0, ghostVariants: 0 },
    });
    expect(calls).toHaveLength(4);
  });

  it("rejects mixed ghost states instead of guessing", async () => {
    const { db, calls } = createMockDb([
      [{ exists: true }],
      [
        {
          product_id: "product-1",
          product_handle: "product-1",
          total_variant_count: 2,
          ghost_variant_count: 1,
          real_variant_count: 1,
          ghost_variants_with_attributes: 0,
        },
      ],
    ]);

    await expect(backfillGhostProductVariants(db as any)).rejects.toThrow(
      /Cannot backfill mixed ghost variant state/i,
    );
    expect(calls).toHaveLength(2);
  });
});
