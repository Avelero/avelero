/**
 * API client for DPP app.
 *
 * Provides server-side functions to fetch DPP data from the API.
 * Uses tRPC's HTTP batch link protocol with superjson serialization.
 */
import superjson from "superjson";
import type { SuperJSONResult } from "superjson";
import type { ThemeConfig, ThemeStyles } from "@v1/dpp-components";

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
 * @param path - The procedure path (e.g., "dppPublic.getByProductHandle")
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
async function fetchThemePreview(
  brandSlug: string,
): Promise<ThemePreviewResponse | null> {
  return trpcQuery<ThemePreviewResponse>(
    "dppPublic.getThemePreview",
    { brandSlug },
    [`dpp-brand-${brandSlug}`],
  );
}

/**
 * Passport DPP API response containing snapshot data from the immutable publishing layer.
 * This is the new response format for UPID-based passport fetching.
 */
export interface PassportDppApiResponse {
  dppData: {
    "@context": {
      "@vocab": string;
      dpp: string;
      espr: string;
    };
    "@type": string;
    "@id": string;
    productIdentifiers: {
      upid: string;
      sku: string | null;
      barcode: string | null;
    };
    productAttributes: {
      name: string;
      description: string | null;
      image: string | null;
      category: string | null;
      manufacturer: {
        name: string;
        legalName: string | null;
        email: string | null;
        phone: string | null;
        website: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        countryCode: string | null;
      } | null;
      attributes: Array<{ name: string; value: string }>;
      weight: { value: number; unit: string } | null;
    };
    environmental: {
      waterLiters: { value: number; unit: string } | null;
      carbonKgCo2e: { value: number; unit: string } | null;
    } | null;
    materials: {
      composition: Array<{
        material: string;
        percentage: number | null;
        recyclable: boolean | null;
        countryOfOrigin: string | null;
        certification: {
          title: string;
          certificationCode: string | null;
          testingInstitute: {
            instituteName: string | null;
            instituteEmail: string | null;
            instituteWebsite: string | null;
            instituteAddressLine1: string | null;
            instituteAddressLine2: string | null;
            instituteCity: string | null;
            instituteState: string | null;
            instituteZip: string | null;
            instituteCountryCode: string | null;
          } | null;
        } | null;
      }>;
    } | null;
    supplyChain: Array<{
      stepType: string;
      sortIndex: number;
      operators: Array<{
        displayName: string;
        legalName: string | null;
        email: string | null;
        phone: string | null;
        website: string | null;
        addressLine1: string | null;
        addressLine2: string | null;
        city: string | null;
        state: string | null;
        zip: string | null;
        countryCode: string | null;
      }>;
    }>;
    metadata: {
      schemaVersion: string;
      publishedAt: string;
      versionNumber: number;
    };
  };
  themeConfig: ThemeConfig | null;
  themeStyles: ThemeStyles | null;
  stylesheetUrl: string | null;
  googleFontsUrl: string | null;
  passport: {
    upid: string;
    isInactive: boolean;
    version: {
      id: string;
      versionNumber: number;
      schemaVersion: string;
      publishedAt: string;
      contentHash: string;
    } | null;
  };
}

/**
 * Fetch DPP data for a passport by UPID (new immutable publishing layer).
 * URL: /{upid}
 *
 * This function fetches from the immutable publishing layer (snapshots)
 * rather than the normalized working layer, providing faster and more
 * reliable access to published passport data.
 *
 * Cache tags used for on-demand revalidation:
 * - `dpp-passport-{upid}` - Invalidated when passport is republished
 *
 * @param upid - The Universal Product Identifier (16-char alphanumeric)
 * @returns PassportDppApiResponse or null if not found/not published
 */
export async function fetchPassportDpp(
  upid: string,
): Promise<PassportDppApiResponse | null> {
  return trpcQuery<PassportDppApiResponse>(
    "dppPublic.getByPassportUpid",
    { upid },
    [`dpp-passport-${upid}`],
  );
}
