/**
 * API client for DPP app.
 *
 * Provides server-side functions to fetch DPP data from the API.
 * Uses tRPC's HTTP batch link protocol with superjson serialization.
 */
import type { Passport } from "@v1/dpp-components";
import superjson from "superjson";
import type { SuperJSONResult } from "superjson";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error(
    "INTERNAL_API_URL or NEXT_PUBLIC_API_URL must be set for DPP API access",
  );
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

async function trpcQuery<T>(
  path: string,
  input: Record<string, unknown>,
  tags: string[] = [],
): Promise<T | null> {
  const serialized = superjson.serialize(input);

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
      next: { tags },
    });

    if (!response.ok) {
      console.error(`[DPP API] Request failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as TrpcBatchResponse[];

    const result = data[0]?.result?.data;

    if (!result || result.json === null) {
      return null;
    }

    return superjson.deserialize<T>(result);
  } catch (error) {
    console.error("[DPP API] Request error:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Passport DPP API response from the immutable publishing layer.
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
          issueDate: string | null;
          expiryDate: string | null;
          documentUrl: string | null;
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
  brandPassport: Passport | null;
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
 * Fetch DPP data for a passport by UPID.
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

/**
 * Fetch DPP data for a passport by barcode within a specific brand.
 */
export async function fetchPassportByBarcode(
  brandId: string,
  barcode: string,
): Promise<PassportDppApiResponse | null> {
  return trpcQuery<PassportDppApiResponse>(
    "dppPublic.getByBarcode",
    { brandId, barcode },
    [`dpp-barcode-${brandId}-${barcode}`],
  );
}
