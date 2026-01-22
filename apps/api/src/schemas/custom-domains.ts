/**
 * Validation schemas for custom domain management.
 *
 * These schemas back the tRPC procedures that manage brand custom domains
 * in `apps/api/src/trpc/routers/brand/custom-domains.ts`.
 *
 * @module schemas/custom-domains
 */
import { z } from "zod";

/**
 * Reserved domains that cannot be claimed by brands.
 * Includes Avelero-owned domains and common test domains.
 */
export const reservedDomains = [
  "avelero.com",
  "avelero.io",
  "avelero.app",
  "passport.avelero.com",
  "localhost",
  "example.com",
  "test.com",
] as const;

/**
 * Checks if a domain is reserved or a subdomain of a reserved domain.
 */
function isReservedDomain(domain: string): boolean {
  return reservedDomains.some(
    (reserved) => domain === reserved || domain.endsWith(`.${reserved}`),
  );
}

/**
 * Checks if a string looks like an IPv4 address.
 */
function isIpAddress(value: string): boolean {
  // IPv4 pattern: 4 groups of 1-3 digits separated by dots
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  return ipv4Pattern.test(value);
}

/**
 * Domain format validation.
 *
 * Accepts: subdomain.domain.tld, domain.tld
 * Rejects: IP addresses, localhost, ports, protocols, paths
 *
 * @example
 * - Valid: "nike.com", "passport.nike.com", "eu.passport.nike.com"
 * - Invalid: "192.168.1.1", "nike.com:8080", "https://nike.com"
 */
export const domainSchema = z
  .string()
  .min(4, "Domain must be at least 4 characters")
  .max(253, "Domain must be at most 253 characters")
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
    "Invalid domain format. Enter a domain like passport.yourbrand.com",
  )
  .transform((val) => val.toLowerCase())
  .refine((val) => !val.includes(".."), "Domain cannot contain consecutive dots")
  .refine((val) => !isIpAddress(val), "IP addresses are not allowed")
  .refine((val) => !isReservedDomain(val), "This domain is reserved");

/**
 * Schema for adding a new custom domain.
 */
export const customDomainAddSchema = z.object({
  domain: domainSchema,
});

/**
 * Domain verification status enum.
 */
export const customDomainStatusSchema = z.enum(["pending", "verified", "failed"]);

export type CustomDomainStatus = z.infer<typeof customDomainStatusSchema>;
