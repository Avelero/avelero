/**
 * Product count and selection summary query helpers.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../../client";
import { productVariants, products } from "../../schema";
import { listProductIds } from "./list";
import type { ListFilters } from "./types";

export interface ProductSelectionOptions {
  selectionMode: "all" | "explicit";
  includeIds: string[];
  excludeIds: string[];
  filterState?: ListFilters["filterState"] | null;
  searchQuery?: string | null;
}

export interface ProductSelectionCounts {
  selectedProducts: number;
  selectedVariants: number;
  variantsWithBarcode: number;
  variantsWithoutBarcode: number;
}

/**
 * Resolves selected product IDs for explicit and "all" selection modes.
 */
export async function resolveSelectedProductIds(
  db: Database,
  brandId: string,
  options: ProductSelectionOptions,
): Promise<string[]> {
  if (options.selectionMode === "explicit") {
    const dedupedIds = Array.from(new Set(options.includeIds));
    if (dedupedIds.length === 0) {
      return [];
    }

    // Guard against cross-brand ID injection by re-scoping in DB.
    const rows = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.brandId, brandId), inArray(products.id, dedupedIds)));

    const allowed = new Set(rows.map((row) => row.id));
    return dedupedIds.filter((id) => allowed.has(id));
  }

  return listProductIds(
    db,
    brandId,
    {
      filterState: options.filterState ?? undefined,
      search: options.searchQuery ?? undefined,
    },
    options.excludeIds,
  );
}

/**
 * Computes selected product + variant summary counts (excluding ghost variants).
 */
export async function getProductSelectionCounts(
  db: Database,
  brandId: string,
  productIds: string[],
): Promise<ProductSelectionCounts> {
  if (productIds.length === 0) {
    return {
      selectedProducts: 0,
      selectedVariants: 0,
      variantsWithBarcode: 0,
      variantsWithoutBarcode: 0,
    };
  }

  const [countRow] = await db
    .select({
      selectedVariants: sql<number>`count(*)::int`,
      variantsWithBarcode: sql<number>`count(*) filter (where ${productVariants.barcode} is not null and btrim(${productVariants.barcode}) <> '')::int`,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(
        eq(products.brandId, brandId),
        inArray(productVariants.productId, productIds),
        eq(productVariants.isGhost, false),
      ),
    );

  const selectedVariants = countRow?.selectedVariants ?? 0;
  const variantsWithBarcode = countRow?.variantsWithBarcode ?? 0;

  return {
    selectedProducts: productIds.length,
    selectedVariants,
    variantsWithBarcode,
    variantsWithoutBarcode: selectedVariants - variantsWithBarcode,
  };
}
