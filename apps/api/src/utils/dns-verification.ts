/**
 * DNS verification utilities for custom domain management.
 *
 * Handles TXT record lookups to verify domain ownership.
 *
 * @module utils/dns-verification
 */
import { resolveTxt } from "node:dns/promises";
import { randomBytes } from "node:crypto";
import { parse as parseDomain } from "tldts";

/**
 * DNS verification timeout in milliseconds.
 */
const DNS_TIMEOUT_MS = 10_000;

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
 * Verifies domain ownership by checking for the expected TXT record.
 *
 * Looks up TXT records on _avelero-verification.{domain}
 * Expected value: The verification token (e.g., "avelero-verify-abc123...")
 *
 * Using _avelero-verification as the TXT host avoids wildcard DNS warnings.
 *
 * @param domain - The domain to verify (e.g., "passport.nike.com")
 * @param expectedToken - The verification token that should be in the TXT record
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
): Promise<DnsVerificationResult> {
  // TXT lookup on _avelero-verification.{domain}
  const txtHost = `_avelero-verification.${domain}`;

  try {
    // DNS TXT lookup with timeout
    const records = await Promise.race([
      resolveTxt(txtHost),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS_TIMEOUT")), DNS_TIMEOUT_MS),
      ),
    ]);

    // Flatten TXT record arrays (DNS TXT records can be chunked into 255-char segments)
    const flatRecords = records.map((chunks) => chunks.join(""));

    // Check if any record matches the expected token (with whitespace trimming)
    const found = flatRecords.some(
      (record) => record.trim() === expectedToken.trim(),
    );

    if (found) {
      return { success: true, foundRecords: flatRecords };
    }

    // Check if there are any avelero-verify records (helps with debugging)
    const hasAveleroRecord = flatRecords.some((r) =>
      r.includes("avelero-verify"),
    );

    return {
      success: false,
      error: hasAveleroRecord
        ? "TXT record found but token does not match"
        : "No matching TXT record found. Please add the DNS record and wait for propagation.",
      foundRecords: flatRecords,
    };
  } catch (err) {
    const error = err as NodeJS.ErrnoException;

    if (error.code === "ENOTFOUND" || error.code === "ENODATA") {
      return {
        success: false,
        error:
          "No TXT record found. Please add the DNS record and wait for propagation.",
      };
    }

    if (error.message === "DNS_TIMEOUT") {
      return {
        success: false,
        error: "DNS lookup timed out. Please try again.",
      };
    }

    return {
      success: false,
      error: `DNS lookup failed: ${error.message}`,
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
  // e.g., "passport.nike.com" -> subdomain: "passport", domain: "nike.com"
  // e.g., "nike.com" -> subdomain: null, domain: "nike.com"
  // e.g., "example.co.uk" -> subdomain: null, domain: "example.co.uk"
  // e.g., "shop.example.co.uk" -> subdomain: "shop", domain: "example.co.uk"
  const parsed = parseDomain(domain);
  const subdomain = parsed.subdomain || null;

  // CNAME host is the subdomain if present, otherwise "@" for apex domain
  const cnameHost = subdomain ?? "@";

  // TXT host must include subdomain to match verification lookup
  // Verification looks up: _avelero-verification.{domain}
  // e.g., "passport.nike.com" -> TXT host "_avelero-verification.passport" creates _avelero-verification.passport.nike.com
  // e.g., "nike.com" -> TXT host "_avelero-verification" creates _avelero-verification.nike.com
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
      host: cnameHost, // Subdomain or @ for root domain
      value: "cname.avelero.com",
      ttl: 300,
    },
  };
}
