/**
 * Publishing state queries.
 *
 * Keeps the lightweight product-level publishing state helpers that are still
 * used by the UI, while snapshot materialization now lives in projector.ts.
 */

import { and, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { products } from "../../schema";

/**
 * Check whether a product is currently published.
 */
export async function hasPublishedVariants(
  db: Database,
  productId: string,
): Promise<boolean> {
  // A product-level published status means its variants are publicly visible.
  const [product] = await db
    .select({ status: products.status })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  return product?.status === "published";
}

/**
 * Read the current publishing state for a brand-owned product.
 */
export async function getPublishingState(
  db: Database,
  productId: string,
  brandId: string,
) {
  // Scope the lookup to the active brand before returning UI state.
  const [product] = await db
    .select({
      status: products.status,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);

  if (!product) {
    return null;
  }

  return {
    status: product.status as "published" | "unpublished" | "scheduled",
  };
}
