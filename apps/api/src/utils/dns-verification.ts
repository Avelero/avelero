/**
 * DNS verification utilities for custom domain management.
 *
 * Handles TXT record lookups to verify domain ownership.
 * Queries authoritative nameservers directly to bypass DNS caching issues.
 *
 * @module utils/dns-verification
 */
import { randomBytes } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { parse as parseDomain } from "tldts";

/**
 * DNS verification timeout in milliseconds.
 */
const DNS_TIMEOUT_MS = 10_000;

/**
 * Google DNS-over-HTTPS API endpoint.
 * Used for NS lookups (where caching is fine).
 */
const GOOGLE_DOH_URL = "https://dns.google/resolve";

/**
 * Public DNS servers for resolving nameserver hostnames.
 */
const PUBLIC_DNS_SERVERS = ["8.8.8.8", "1.1.1.1"];

/**
 * Result of a DNS verification attempt.
 */
export interface DnsVerificationResult {
  /** Whether verification was successful */
  success: boolean;
  /** Error message if verification failed */
  error?: string;
  /** TXT records found during lookup (for debugging) */
  foundRecords?: string[];
}

/**
 * Generates a cryptographically secure verification token.
 *
 * Format: avelero-verify-{64-character-hex}
 *
 * @returns Verification token with 256-bit entropy
 *
 * @example
 * generateVerificationToken()
 * // => "avelero-verify-a1b2c3d4e5f6..."
 */
export function generateVerificationToken(): string {
  const bytes = randomBytes(32);
  const hex = bytes.toString("hex");
  return `avelero-verify-${hex}`;
}

/**
 * Finds authoritative nameservers for a domain.
 * Uses DoH since NS records are stable and caching is fine here.
 *
 * @param domain - The full domain (e.g., "passport.nike.com")
 * @returns Array of nameserver hostnames
 */
export async function getAuthoritativeNameservers(
  domain: string,
): Promise<string[]> {
  // Query NS for the registrable domain, not the subdomain
  // e.g., for "passport.nike.com" we query NS for "nike.com"
  const parsed = parseDomain(domain);
  const registrableDomain = parsed.domain;

  if (!registrableDomain) {
    throw new Error(`Could not parse domain: ${domain}`);
  }

  const url = new URL(GOOGLE_DOH_URL);
  url.searchParams.set("name", registrableDomain);
  url.searchParams.set("type", "NS");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DNS_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/dns-json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NS lookup failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      Status: number;
      Answer?: Array<{ type: number; data: string }>;
    };

    if (data.Status !== 0 || !data.Answer) {
      throw new Error(`NS lookup failed: status ${data.Status}`);
    }

    // Type 2 = NS records, remove trailing dots
    const nsRecords = data.Answer.filter((a) => a.type === 2).map((a) =>
      a.data.replace(/\.$/, ""),
    );

    if (nsRecords.length === 0) {
      throw new Error("No nameservers found for domain");
    }

    return nsRecords;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Resolves nameserver hostnames to IP addresses.
 *
 * @param nameservers - Array of nameserver hostnames
 * @param resolver - Optional custom resolver (for testing)
 * @returns Array of IP addresses
 */
export async function resolveNameserverIPs(
  nameservers: string[],
  resolver?: Resolver,
): Promise<string[]> {
  const res = resolver ?? new Resolver();
  if (!resolver) {
    res.setServers(PUBLIC_DNS_SERVERS);
  }

  const ips: string[] = [];

  for (const ns of nameservers) {
    try {
      const addresses = await res.resolve4(ns);
      ips.push(...addresses);
    } catch {
      // Some nameservers might not resolve, continue with others
      console.log(`[DNS] Could not resolve ${ns}, skipping`);
    }
  }

  if (ips.length === 0) {
    throw new Error("Could not resolve any nameserver IPs");
  }

  return ips;
}

/**
 * Queries authoritative nameservers directly for TXT records.
 * Bypasses all DNS caching layers.
 *
 * @param txtHost - The full TXT record hostname to query
 * @param nameserverIPs - IP addresses of authoritative nameservers
 * @param resolver - Optional custom resolver (for testing)
 * @returns Array of TXT record values
 */
export async function queryAuthoritativeTxt(
  txtHost: string,
  nameserverIPs: string[],
  resolver?: Resolver,
): Promise<string[]> {
  const res = resolver ?? new Resolver();
  res.setServers(nameserverIPs);

  // Set timeout
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("DNS query timed out")), DNS_TIMEOUT_MS),
  );

  const queryPromise = res.resolveTxt(txtHost);

  // resolveTxt returns string[][] (each TXT record can have multiple chunks)
  const records = await Promise.race([queryPromise, timeoutPromise]);

  // Flatten the chunks into single strings
  return records.map((chunks) => chunks.join(""));
}

/**
 * Verifies domain ownership by querying authoritative nameservers directly.
 * This bypasses all DNS caching.
 *
 * Looks up TXT records on _avelero-verification.{domain}
 * Expected value: The verification token (e.g., "avelero-verify-abc123...")
 *
 * @param domain - The domain to verify (e.g., "passport.nike.com")
 * @param expectedToken - The verification token that should be in the TXT record
 * @param options - Optional configuration for testing
 * @returns Verification result with success status and any errors
 *
 * @example
 * const result = await verifyDomainDns("passport.nike.com", "avelero-verify-abc123...");
 * if (result.success) {
 *   console.log("Domain verified!");
 * } else {
 *   console.log("Verification failed:", result.error);
 * }
 */
export async function verifyDomainDns(
  domain: string,
  expectedToken: string,
  options?: {
    /** Custom resolver for testing */
    resolver?: Resolver;
    /** Override nameservers (for testing) */
    nameservers?: string[];
    /** Override nameserver IPs (for testing) */
    nameserverIPs?: string[];
  },
): Promise<DnsVerificationResult> {
  const txtHost = `_avelero-verification.${domain}`;

  try {
    // Step 1: Find authoritative nameservers (skip if provided)
    let nameservers: string[];
    if (options?.nameservers) {
      nameservers = options.nameservers;
    } else {
      console.log(`[DNS] Finding authoritative nameservers for ${domain}`);
      nameservers = await getAuthoritativeNameservers(domain);
      console.log("[DNS] Found nameservers:", nameservers);
    }

    // Step 2: Resolve nameserver IPs (skip if provided)
    let nameserverIPs: string[];
    if (options?.nameserverIPs) {
      nameserverIPs = options.nameserverIPs;
    } else {
      nameserverIPs = await resolveNameserverIPs(nameservers, options?.resolver);
      console.log("[DNS] Resolved nameserver IPs:", nameserverIPs);
    }

    // Step 3: Query authoritative nameservers directly
    console.log(`[DNS] Querying ${txtHost} from authoritative nameservers`);
    const txtRecords = await queryAuthoritativeTxt(
      txtHost,
      nameserverIPs,
      options?.resolver,
    );
    console.log("[DNS] Found TXT records:", txtRecords);

    if (txtRecords.length === 0) {
      return {
        success: false,
        error:
          "No TXT record found. Please add the DNS record and wait for propagation.",
        foundRecords: [],
      };
    }

    // Check for matching token (with whitespace trimming)
    const found = txtRecords.some(
      (record) => record.trim() === expectedToken.trim(),
    );

    if (found) {
      return { success: true, foundRecords: txtRecords };
    }

    // Check if there are any avelero-verify records (helps with debugging)
    const hasAveleroRecord = txtRecords.some((r) =>
      r.includes("avelero-verify"),
    );

    return {
      success: false,
      error: hasAveleroRecord
        ? "TXT record found but token does not match"
        : "No matching TXT record found. Please add the DNS record and wait for propagation.",
      foundRecords: txtRecords,
    };
  } catch (err) {
    const error = err as Error & { code?: string };

    // Log the full error server-side for debugging
    console.error("[DNS] Verification error:", error.message, error.code);

    // Handle ENODATA/ENOTFOUND - means no record exists
    if (error.code === "ENODATA" || error.code === "ENOTFOUND") {
      return {
        success: false,
        error:
          "No TXT record found. Please add the DNS record and wait for propagation.",
      };
    }

    // Handle timeout
    if (error.message === "DNS query timed out" || error.name === "AbortError") {
      return {
        success: false,
        error: "DNS lookup timed out. Please try again.",
      };
    }

    // Handle domain parsing errors (user input issue)
    if (error.message.includes("Could not parse domain")) {
      return {
        success: false,
        error: "Invalid domain format. Please check the domain and try again.",
      };
    }

    // Handle nameserver resolution failures
    if (
      error.message.includes("No nameservers found") ||
      error.message.includes("Could not resolve any nameserver")
    ) {
      return {
        success: false,
        error:
          "Could not find DNS servers for this domain. Please verify the domain is correct.",
      };
    }

    // Generic error for anything else - don't expose internal details
    return {
      success: false,
      error:
        "DNS lookup failed. Please try again later or contact support if the issue persists.",
    };
  }
}

/**
 * Builds DNS instructions for the user to add their verification record.
 *
 * TXT record host includes the subdomain to match the verification lookup.
 * CNAME record host is the subdomain if exists, otherwise @ for root domain.
 *
 * @param domain - The domain being verified
 * @param verificationToken - The token to include in the TXT record
 * @returns DNS record instructions
 */
export function buildDnsInstructions(
  domain: string,
  verificationToken: string,
): {
  txt: {
    recordType: "TXT";
    host: string;
    value: string;
    ttl: number;
  };
  cname: {
    recordType: "CNAME";
    host: string;
    value: string;
    ttl: number;
  };
} {
  // Use public suffix parser to correctly handle multi-part TLDs (e.g., co.uk, com.au)
  const parsed = parseDomain(domain);
  const subdomain = parsed.subdomain || null;

  // CNAME host is the subdomain if present, otherwise "@" for apex domain
  const cnameHost = subdomain ?? "@";

  // TXT host must include subdomain to match verification lookup
  const txtHost = subdomain
    ? `_avelero-verification.${subdomain}`
    : "_avelero-verification";

  return {
    txt: {
      recordType: "TXT",
      host: txtHost,
      value: verificationToken,
      ttl: 300,
    },
    cname: {
      recordType: "CNAME",
      host: cnameHost,
      value: "cname.avelero.com",
      ttl: 300,
    },
  };
}
