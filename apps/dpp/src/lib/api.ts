/**
 * API client for DPP app.
 *
 * Provides server-side functions to fetch DPP data from the API.
 * Uses tRPC's HTTP batch link protocol with superjson serialization.
 */
import superjson from "superjson";
import type { SuperJSONResult } from "superjson";
import type {
  DppContent,
  DppData,
  ThemeConfig,
  ThemeStyles,
} from "@v1/dpp-components";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * API base URL - should be set in environment variables.
 * Falls back to localhost for development.
 */
const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error(
    "INTERNAL_API_URL or NEXT_PUBLIC_API_URL must be set for DPP API access",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * DPP API response containing all data needed for rendering
 */
export interface DppApiResponse {
  dppData: DppData;
  dppContent: DppContent;
  themeConfig: ThemeConfig | null;
  themeStyles: ThemeStyles | null;
  stylesheetUrl: string | null;
  googleFontsUrl: string | null;
}

/**
 * Theme preview response for screenshot generation
 */
export interface ThemePreviewResponse {
  brandName: string;
  themeConfig: ThemeConfig | null;
  themeStyles: ThemeStyles | null;
  stylesheetUrl: string | null;
  googleFontsUrl: string | null;
}

/**
 * tRPC batch response format (superjson-encoded)
 */
interface TrpcBatchResponse {
  result: {
    data: SuperJSONResult;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Make a tRPC query request using the HTTP batch link protocol.
 *
 * Uses Next.js cache tags for on-demand revalidation instead of no-store,
 * enabling request deduplication during SSR while maintaining fresh data
 * when products are updated.
 *
 * @param path - The procedure path (e.g., "dppPublic.getByProductUpid")
 * @param input - The input object for the procedure
 * @param tags - Cache tags for on-demand revalidation
 * @returns The parsed response data or null
 */
async function trpcQuery<T>(
  path: string,
  input: Record<string, unknown>,
  tags: string[] = [],
): Promise<T | null> {
  // Serialize input with superjson
  const serialized = superjson.serialize(input);

  // Build query parameters for tRPC batch link
  const queryParams = new URLSearchParams({
    batch: "1",
    input: JSON.stringify({ "0": serialized }),
  });

  const url = `${API_URL}/trpc/${path}?${queryParams.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      // Use cache tags for on-demand revalidation
      // This enables request deduplication during SSR while allowing
      // cache invalidation when data changes via revalidateTag()
      next: { tags },
    });

    if (!response.ok) {
      console.error(`[DPP API] Request failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as TrpcBatchResponse[];

    // Extract superjson result from batch response
    const result = data[0]?.result?.data;

    if (!result || result.json === null) {
      return null;
    }

    // Deserialize with superjson
    const deserialized = superjson.deserialize<T>(result);

    return deserialized;
  } catch (error) {
    console.error("[DPP API] Request error:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch DPP data for a product-level passport.
 *
 * Cache tags used for on-demand revalidation:
 * - `dpp-product-{productUpid}` - Invalidated when product is updated
 * - `dpp-brand-{brandSlug}` - Invalidated when brand theme/config changes
 *
 * @param brandSlug - URL-friendly brand identifier
 * @param productUpid - 16-character product UPID
 * @returns DppApiResponse or null if not found/not published
 */
export async function fetchProductDpp(
  brandSlug: string,
  productUpid: string,
): Promise<DppApiResponse | null> {
  return trpcQuery<DppApiResponse>(
    "dppPublic.getByProductUpid",
    { brandSlug, productUpid },
    [`dpp-product-${productUpid}`, `dpp-brand-${brandSlug}`],
  );
}

/**
 * Fetch DPP data for a variant-level passport.
 *
 * Cache tags used for on-demand revalidation:
 * - `dpp-variant-{variantUpid}` - Invalidated when variant is updated
 * - `dpp-product-{productUpid}` - Invalidated when parent product is updated
 * - `dpp-brand-{brandSlug}` - Invalidated when brand theme/config changes
 *
 * @param brandSlug - URL-friendly brand identifier
 * @param productUpid - 16-character product UPID
 * @param variantUpid - 16-character variant UPID
 * @returns DppApiResponse or null if not found/not published
 */
export async function fetchVariantDpp(
  brandSlug: string,
  productUpid: string,
  variantUpid: string,
): Promise<DppApiResponse | null> {
  return trpcQuery<DppApiResponse>(
    "dppPublic.getByVariantUpid",
    { brandSlug, productUpid, variantUpid },
    [
      `dpp-variant-${variantUpid}`,
      `dpp-product-${productUpid}`,
      `dpp-brand-${brandSlug}`,
    ],
  );
}

/**
 * Fetch theme data for screenshot preview.
 *
 * Used by the /ahw_preview_jja/ route to render a brand's theme with demo data
 * for screenshot generation. Does not require any products to exist.
 *
 * Cache tags used for on-demand revalidation:
 * - `dpp-brand-{brandSlug}` - Invalidated when brand theme/config changes
 *
 * @param brandSlug - URL-friendly brand identifier
 * @returns ThemePreviewResponse or null if brand not found
 */
export async function fetchThemePreview(
  brandSlug: string,
): Promise<ThemePreviewResponse | null> {
  return trpcQuery<ThemePreviewResponse>(
    "dppPublic.getThemePreview",
    { brandSlug },
    [`dpp-brand-${brandSlug}`],
  );
}

