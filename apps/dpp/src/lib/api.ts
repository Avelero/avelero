/**
 * API client for DPP app.
 *
 * Provides server-side functions to fetch DPP data from the API.
 * Uses tRPC's HTTP batch link protocol with superjson serialization.
 */
import superjson from "superjson";
import type { SuperJSONResult } from "superjson";
import type { DppData } from "@v1/dpp-components";

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
 * Theme configuration from the API response
 */
export interface DppApiResponse {
  dppData: DppData;
  themeConfig: unknown | null;
  themeStyles: unknown | null;
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
 * @param path - The procedure path (e.g., "dppPublic.getByProductUpid")
 * @param input - The input object for the procedure
 * @returns The parsed response data or null
 */
async function trpcQuery<T>(
  path: string,
  input: Record<string, unknown>,
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
      // Use no-store to ensure fresh data for each request
      cache: "no-store",
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
 * @param brandSlug - URL-friendly brand identifier
 * @param productUpid - 16-character product UPID
 * @returns DppApiResponse or null if not found/not published
 */
export async function fetchProductDpp(
  brandSlug: string,
  productUpid: string,
): Promise<DppApiResponse | null> {
  return trpcQuery<DppApiResponse>("dppPublic.getByProductUpid", {
    brandSlug,
    productUpid,
  });
}

/**
 * Fetch DPP data for a variant-level passport.
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
  return trpcQuery<DppApiResponse>("dppPublic.getByVariantUpid", {
    brandSlug,
    productUpid,
    variantUpid,
  });
}

