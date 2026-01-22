/**
 * DNS verification utilities for custom domain management.
 *
 * Handles TXT record lookups to verify domain ownership.
 *
 * @module utils/dns-verification
 */
import { resolveTxt } from "node:dns/promises";
import { randomBytes } from "node:crypto";

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
 * Looks up: _avelero-verification.{domain}
 * Expected value: The verification token
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

    return {
      success: false,
      error: "TXT record found but token does not match",
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
  // Extract the subdomain part for the host field
  // e.g., "passport.nike.com" -> "passport" (user adds this to nike.com DNS)
  // e.g., "nike.com" -> "@" or "nike.com" (root domain)
  const parts = domain.split(".");
  const subdomain = parts.length > 2 ? parts.slice(0, -2).join(".") : domain;

  return {
    txt: {
      recordType: "TXT",
      host: `_avelero-verification.${subdomain}`,
      value: verificationToken,
      ttl: 300,
    },
    cname: {
      recordType: "CNAME",
      host: subdomain,
      value: "dpp.avelero.com",
      ttl: 300,
    },
  };
}
