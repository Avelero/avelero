/**
 * Error Report Utilities
 *
 * Helper functions for error report generation logic.
 */

import type { RowError } from "@v1/db/queries/bulk";

export interface VariantData {
  rowNumber: number;
  rawData: Record<string, string>;
  errors: RowError[];
}

export interface ProductData {
  rowStatus: "PENDING" | "BLOCKED" | "PENDING_WITH_WARNINGS";
  productErrors: RowError[];
  variants: VariantData[];
}

export interface ErrorReportRowResult {
  rowNumber: number;
  raw: Record<string, string>;
  errors: RowError[];
}

/**
 * Determines which rows should be included in the error report.
 *
 * When a product has errors (BLOCKED or PENDING_WITH_WARNINGS status),
 * ALL variants should be included in the error report, not just variants
 * with their own errors. This gives users complete product context for corrections.
 *
 * - Parent row (first variant) gets product-level errors + its own variant errors
 * - Child variants get only their own errors (can be empty)
 * - Empty cells with errors referenced will NOT be colored (handled by Excel generation)
 */
export function getErrorReportRows(
  product: ProductData,
): ErrorReportRowResult[] {
  const rows: ErrorReportRowResult[] = [];

  // Only products with errors should be in the error report
  const productHasErrors =
    product.rowStatus === "BLOCKED" ||
    product.rowStatus === "PENDING_WITH_WARNINGS";

  if (!productHasErrors) {
    return rows;
  }

  // Include ALL variants when product has errors
  for (let variantIdx = 0; variantIdx < product.variants.length; variantIdx++) {
    const variant = product.variants[variantIdx];
    if (!variant) continue;

    // First variant (parent row) gets product-level errors + its own errors
    // Child variants get only their own errors
    const isParentRow = variantIdx === 0;
    const variantErrors = variant.errors ?? [];
    const rowErrors = isParentRow
      ? [...product.productErrors, ...variantErrors]
      : variantErrors;

    rows.push({
      rowNumber: variant.rowNumber,
      raw: variant.rawData,
      errors: rowErrors,
    });
  }

  return rows;
}
