/**
 * Backfills legacy ghost-only product variants into real variants before
 * the `is_ghost` column is removed from the schema.
 */
import { sql } from "drizzle-orm";
import type { Database } from "../client";
import { serviceDb } from "../client";

type ScriptDatabase = Pick<Database, "execute" | "transaction">;

type ProductVariantGhostStateRow = {
  product_id: string;
  product_handle: string;
  total_variant_count: number;
  ghost_variant_count: number;
  real_variant_count: number;
  ghost_variants_with_attributes: number;
};

export type GhostVariantBackfillSummary = {
  columnPresent: boolean;
  before: {
    ghostProducts: number;
    ghostVariants: number;
  };
  converted: {
    products: number;
    variants: number;
  };
  after: {
    ghostProducts: number;
    ghostVariants: number;
  };
};

/**
 * Reports whether `product_variants.is_ghost` still exists in the database.
 */
async function hasGhostColumn(db: ScriptDatabase): Promise<boolean> {
  const [row] = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'product_variants'
        AND column_name = 'is_ghost'
    ) AS exists
  `);

  return row?.exists ?? false;
}

/**
 * Loads the current ghost-variant state for every affected product.
 */
async function loadGhostVariantState(
  db: ScriptDatabase,
): Promise<ProductVariantGhostStateRow[]> {
  return db.execute<ProductVariantGhostStateRow>(sql`
    SELECT
      p.id AS product_id,
      p.product_handle,
      COUNT(pv.id)::int AS total_variant_count,
      COUNT(*) FILTER (WHERE pv.is_ghost = true)::int AS ghost_variant_count,
      COUNT(*) FILTER (WHERE pv.is_ghost = false)::int AS real_variant_count,
      COUNT(*) FILTER (
        WHERE pv.is_ghost = true
          AND EXISTS (
            SELECT 1
            FROM product_variant_attributes pva
            WHERE pva.variant_id = pv.id
          )
      )::int AS ghost_variants_with_attributes
    FROM products p
    INNER JOIN product_variants pv
      ON pv.product_id = p.id
    GROUP BY p.id, p.product_handle
    HAVING COUNT(*) FILTER (WHERE pv.is_ghost = true) > 0
    ORDER BY p.product_handle ASC
  `);
}

/**
 * Builds a stable count summary from the loaded ghost state rows.
 */
function summarizeGhostState(rows: ProductVariantGhostStateRow[]): {
  ghostProducts: number;
  ghostVariants: number;
} {
  return {
    ghostProducts: rows.length,
    ghostVariants: rows.reduce(
      (count, row) => count + row.ghost_variant_count,
      0,
    ),
  };
}

/**
 * Returns whether a product is safe to backfill automatically.
 */
function isConvertibleGhostProduct(row: ProductVariantGhostStateRow): boolean {
  return (
    row.total_variant_count === 1 &&
    row.ghost_variant_count === 1 &&
    row.real_variant_count === 0 &&
    row.ghost_variants_with_attributes === 0
  );
}

/**
 * Throws when the database contains ghost states that are not safe to rewrite.
 */
function assertConvertibleGhostProducts(
  rows: ProductVariantGhostStateRow[],
): asserts rows is ProductVariantGhostStateRow[] {
  const invalidRows = rows.filter((row) => !isConvertibleGhostProduct(row));
  if (invalidRows.length === 0) {
    return;
  }

  const details = invalidRows
    .map(
      (row) =>
        `${row.product_handle} (${row.product_id}): total=${row.total_variant_count}, ghost=${row.ghost_variant_count}, real=${row.real_variant_count}, ghostWithAttributes=${row.ghost_variants_with_attributes}`,
    )
    .join("\n");

  throw new Error(
    `Cannot backfill mixed ghost variant state.\n${details}`,
  );
}

/**
 * Converts legacy ghost-only variants into real variants in place.
 */
export async function backfillGhostProductVariants(
  db: ScriptDatabase = serviceDb,
): Promise<GhostVariantBackfillSummary> {
  if (!(await hasGhostColumn(db))) {
    return {
      columnPresent: false,
      before: { ghostProducts: 0, ghostVariants: 0 },
      converted: { products: 0, variants: 0 },
      after: { ghostProducts: 0, ghostVariants: 0 },
    };
  }

  return db.transaction(async (tx) => {
    const beforeRows = await loadGhostVariantState(tx);
    assertConvertibleGhostProducts(beforeRows);

    const convertibleProductIds = beforeRows
      .filter((row) => isConvertibleGhostProduct(row))
      .map((row) => row.product_id);

    if (convertibleProductIds.length > 0) {
      const convertibleProductIdList = sql.join(
        convertibleProductIds.map((productId) => sql`${productId}`),
        sql`, `,
      );

      await tx.execute(sql`
        UPDATE product_variants
        SET
          is_ghost = false,
          updated_at = NOW()
        WHERE product_id IN (${convertibleProductIdList})
          AND is_ghost = true
      `);
    }

    const afterRows = await loadGhostVariantState(tx);

    return {
      columnPresent: true,
      before: summarizeGhostState(beforeRows),
      converted: {
        products: convertibleProductIds.length,
        variants: convertibleProductIds.length,
      },
      after: summarizeGhostState(afterRows),
    };
  });
}

/**
 * Runs the backfill as a standalone script.
 */
async function main() {
  const summary = await backfillGhostProductVariants();
  console.log("Ghost product variant backfill complete");
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Ghost product variant backfill failed");
    console.error(error);
    process.exit(1);
  });
}
