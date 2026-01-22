/**
 * Domain resolution utilities for DPP custom domains.
 *
 * Provides caching and helper functions for resolving custom domains
 * to their associated brands.
 */
import { cache } from "react";
import superjson from "superjson";
import type { SuperJSONResult } from "superjson";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result of resolving a custom domain to its brand.
 */
export interface ResolvedDomain {
  brandId: string;
  brandSlug: string;
  domain: string;
  isVerified: boolean;
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
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const API_URL = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;

/**
 * Get the list of primary (non-custom) domains.
 *
 * These are the default Avelero domains - requests from these domains
 * are NOT treated as custom domain requests.
 *
 * Environment-specific:
 * - Production: passport.avelero.com (via PRIMARY_DOMAIN env var)
 * - Preview: Uses VERCEL_URL automatically set by Vercel
 * - Local: Defaults to localhost detection
 */
function getPrimaryDomains(): string[] {
  const domains: string[] = [];

  // Production domain (explicit)
  if (process.env.PRIMARY_DOMAIN) {
    domains.push(process.env.PRIMARY_DOMAIN.toLowerCase());
  }

  // Vercel preview deployments
  if (process.env.VERCEL_URL) {
    domains.push(process.env.VERCEL_URL.toLowerCase());
  }

  // Local development fallback
  if (domains.length === 0) {
    domains.push("localhost");
  }

  return domains;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a custom domain to its brand.
 *
 * Uses React cache for request deduplication within a single render.
 * Results are cached via Next.js fetch cache for 5 minutes.
 *
 * @param domain - The domain hostname to resolve
 * @returns Resolved domain info or null if not found/unverified
 */
export const resolveDomain = cache(
  async (domain: string): Promise<ResolvedDomain | null> => {
    if (!API_URL) {
      console.error("[Domain] API_URL not configured");
      return null;
    }

    try {
      // Serialize input with superjson
      const serialized = superjson.serialize({ domain: domain.toLowerCase() });

      // Build query parameters for tRPC batch link
      const queryParams = new URLSearchParams({
        batch: "1",
        input: JSON.stringify({ "0": serialized }),
      });

      const response = await fetch(
        `${API_URL}/trpc/dppPublic.resolveDomain?${queryParams.toString()}`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          // Cache for 5 minutes with revalidation tag
          next: { tags: [`domain-${domain}`], revalidate: 300 },
        },
      );

      if (!response.ok) {
        console.error(`[Domain] Resolution failed: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as TrpcBatchResponse[];
      const result = data[0]?.result?.data;

      if (!result || result.json === null) {
        return null;
      }

      // Deserialize with superjson
      const resolved = superjson.deserialize<ResolvedDomain | null>(result);

      // Only return if verified
      if (!resolved || !resolved.isVerified) {
        return null;
      }

      return resolved;
    } catch (error) {
      console.error("[Domain] Resolution error:", error);
      return null;
    }
  },
);

/**
 * Check if a host is a custom domain (not a primary Avelero domain).
 *
 * @param host - The hostname to check (may include port)
 * @returns true if this is a custom domain
 */
export function isCustomDomain(host: string): boolean {
  // Normalize: lowercase and remove port
  const normalized = host.toLowerCase().replace(/:\d+$/, "");

  const primaryDomains = getPrimaryDomains();

  // Check if host matches any primary domain
  return !primaryDomains.some(
    (primary) =>
      normalized === primary ||
      normalized.endsWith(`.${primary}`) ||
      // Handle localhost with any port
      (primary === "localhost" && normalized.startsWith("localhost")),
  );
}
