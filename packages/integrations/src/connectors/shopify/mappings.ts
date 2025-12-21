/**
 * Shopify Field Mappings & Transforms
 *
 * Transform functions that convert Shopify data to Avelero format.
 */

// =============================================================================
// STATUS TRANSFORMS
// =============================================================================

/**
 * Transform Shopify product status to Avelero publication status.
 * Shopify: ACTIVE, DRAFT, ARCHIVED
 * Avelero: published, unpublished, archived
 */
export function transformStatus(status: unknown): string {
  const s = String(status).toUpperCase();
  if (s === "ACTIVE") return "published";
  if (s === "DRAFT") return "unpublished";
  if (s === "ARCHIVED") return "archived";
  return "unpublished";
}

/**
 * Transform Shopify product status to Avelero sales status.
 * Shopify: ACTIVE, DRAFT, ARCHIVED
 * Avelero: active, inactive, discontinued
 */
export function transformSalesStatus(status: unknown): string {
  const s = String(status).toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "DRAFT") return "inactive";
  if (s === "ARCHIVED") return "discontinued";
  return "inactive";
}

/**
 * Extract numeric ID from Shopify GID.
 * Example: "gid://shopify/Product/123456" → "123456"
 */
export function extractShopifyId(gid: unknown): string | null {
  if (!gid || typeof gid !== "string") return null;
  const match = gid.match(/\/(\d+)$/);
  return match?.[1] ?? null;
}

/**
 * Safely parse a price value to number.
 */
export function parseShopifyPrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Truncate string to max length.
 */
export function truncateString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

/**
 * Clean HTML tags from description (basic).
 */
export function stripHtmlTags(html: unknown): string | null {
  if (!html || typeof html !== "string") return null;
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Transform Shopify tags to normalized strings.
 * 
 * Handles two possible formats from Shopify:
 * - GraphQL Admin API: Array of strings ["summer", "sports"]
 * - String format: Comma-separated "summer, sports"
 * 
 * The GraphQL API should return an array, but we handle both for robustness.
 */
export function transformTags(tags: unknown): string[] {
  if (!tags) return [];
  
  // Handle array format (expected from GraphQL API)
  if (Array.isArray(tags)) {
    return tags
      .map((t) => String(t).trim())
      .filter((t) => t.length > 0);
  }
  
  // Handle comma-separated string format (defensive handling)
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }
  
  return [];
}
