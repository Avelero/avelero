/**
 * Unit Tests: DNS Verification Utilities
 *
 * Tests the DNS verification functions for custom domain management:
 * - generateVerificationToken: Creates cryptographically secure tokens
 * - verifyDomainDns: Performs DNS TXT record lookups via Google DoH
 * - buildDnsInstructions: Generates DNS configuration instructions
 *
 * Mocks fetch() to simulate Google DNS-over-HTTPS responses.
 * Following TDD principles - tests define expected behavior.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
  buildDnsInstructions,
  generateVerificationToken,
  verifyDomainDns,
} from "../../../src/utils/dns-verification";

// ============================================================================
// Google DoH Mock Helpers
// ============================================================================

/**
 * Creates a mock Google DoH JSON response for TXT records.
 * Google DoH wraps TXT values in quotes.
 */
function createDohResponse(
  txtRecords: string[][],
  status = 0,
): { Status: number; Answer?: Array<{ type: number; data: string }> } {
  if (status === 3 || txtRecords.length === 0) {
    return { Status: status };
  }

  return {
    Status: status,
    Answer: txtRecords.map((chunks) => ({
      type: 16, // TXT record type
      // Google DoH returns TXT data with quotes, and concatenates chunks
      data: `"${chunks.join("")}"`,
    })),
  };
}

/**
 * Creates a mock fetch Response with JSON body.
 */
function createMockResponse(body: object, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

// Track fetch calls for assertions
let fetchCalls: { url: string; options: RequestInit }[] = [];
let mockFetchImpl: (url: string, options?: RequestInit) => Promise<Response>;

// Store original fetch
const originalFetch = globalThis.fetch;

describe("generateVerificationToken", () => {
  it("returns string starting with 'avelero-verify-'", () => {
    const token = generateVerificationToken();
    expect(token.startsWith("avelero-verify-")).toBe(true);
  });

  it("has sufficient entropy (64 hex chars after prefix)", () => {
    const token = generateVerificationToken();
    const hexPart = token.replace("avelero-verify-", "");

    // Should be 64 hex characters (32 bytes = 256 bits)
    expect(hexPart.length).toBe(64);

    // Should only contain hex characters
    expect(/^[0-9a-f]+$/.test(hexPart)).toBe(true);
  });

  it("each call returns unique token", () => {
    const tokens = new Set<string>();

    // Generate 100 tokens and ensure they're all unique
    for (let i = 0; i < 100; i++) {
      tokens.add(generateVerificationToken());
    }

    expect(tokens.size).toBe(100);
  });

  it("token has expected format: avelero-verify-{64 hex chars}", () => {
    const token = generateVerificationToken();
    const regex = /^avelero-verify-[0-9a-f]{64}$/;
    expect(regex.test(token)).toBe(true);
  });
});

describe("verifyDomainDns", () => {
  beforeEach(() => {
    // Reset fetch tracking
    fetchCalls = [];

    // Default mock implementation
    mockFetchImpl = async (url: string, options?: RequestInit) => {
      fetchCalls.push({ url, options: options || {} });
      return createMockResponse(createDohResponse([["mock-token"]]));
    };

    // Override global fetch
    (globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      return mockFetchImpl(url, init);
    };
  });

  afterEach(() => {
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  describe("successful verification", () => {
    it("returns success when TXT record matches token", async () => {
      const expectedToken = "avelero-verify-abc123";
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        return createMockResponse(createDohResponse([[expectedToken]]));
      };

      const result = await verifyDomainDns("passport.nike.com", expectedToken);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      // Check URL was called with correct hostname
      expect(fetchCalls[0]?.url).toContain("name=_avelero-verification.passport.nike.com");
    });

    it("returns success when one of multiple TXT records matches", async () => {
      const expectedToken = "avelero-verify-abc123";
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        return createMockResponse(
          createDohResponse([["some-other-record"], [expectedToken], ["another-record"]]),
        );
      };

      const result = await verifyDomainDns("passport.nike.com", expectedToken);

      expect(result.success).toBe(true);
    });

    it("handles chunked TXT records by concatenating", async () => {
      // DNS TXT records can be chunked into 255-char segments
      const expectedToken = "avelero-verify-abc123";
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        // Google DoH concatenates chunks in the data field
        return createMockResponse(createDohResponse([["avelero-verify-", "abc123"]]));
      };

      const result = await verifyDomainDns("passport.nike.com", expectedToken);

      expect(result.success).toBe(true);
    });

    it("trims whitespace from TXT record value", async () => {
      const expectedToken = "avelero-verify-abc123";
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        return createMockResponse(createDohResponse([["  avelero-verify-abc123  "]]));
      };

      const result = await verifyDomainDns("passport.nike.com", expectedToken);

      expect(result.success).toBe(true);
    });

    it("trims whitespace from expected token", async () => {
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        return createMockResponse(createDohResponse([["avelero-verify-abc123"]]));
      };

      const result = await verifyDomainDns("passport.nike.com", "  avelero-verify-abc123  ");

      expect(result.success).toBe(true);
    });

    it("returns found records in result", async () => {
      const expectedToken = "avelero-verify-abc123";
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        return createMockResponse(createDohResponse([["other-record"], [expectedToken]]));
      };

      const result = await verifyDomainDns("passport.nike.com", expectedToken);

      expect(result.foundRecords).toEqual(["other-record", expectedToken]);
    });
  });

  describe("failed verification", () => {
    it("returns failure when no TXT record exists (NXDOMAIN)", async () => {
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        // Status 3 = NXDOMAIN
        return createMockResponse(createDohResponse([], 3));
      };

      const result = await verifyDomainDns("passport.nike.com", "avelero-verify-abc123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No TXT record found");
    });

    it("returns failure when no TXT record exists (empty answer)", async () => {
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        return createMockResponse({ Status: 0, Answer: [] });
      };

      const result = await verifyDomainDns("passport.nike.com", "avelero-verify-abc123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No TXT record found");
    });

    it("returns failure when TXT record exists but token mismatches", async () => {
      // Use an avelero-verify token that doesn't match
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        return createMockResponse(createDohResponse([["avelero-verify-wrong-token"]]));
      };

      const result = await verifyDomainDns("passport.nike.com", "avelero-verify-abc123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("token does not match");
    });

    it("returns failure with found records for debugging", async () => {
      const wrongRecords = ["wrong-token-1", "wrong-token-2"];
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        return createMockResponse(createDohResponse(wrongRecords.map((r) => [r])));
      };

      const result = await verifyDomainDns("passport.nike.com", "avelero-verify-abc123");

      expect(result.success).toBe(false);
      expect(result.foundRecords).toEqual(wrongRecords);
    });
  });

  describe("error handling", () => {
    it("returns failure on DNS timeout", async () => {
      mockFetchImpl = async () => {
        const error = new Error("Aborted");
        error.name = "AbortError";
        throw error;
      };

      const result = await verifyDomainDns("passport.nike.com", "avelero-verify-abc123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
    });

    it("returns failure on DNS resolution error", async () => {
      mockFetchImpl = async () => {
        throw new Error("DNS server error");
      };

      const result = await verifyDomainDns("passport.nike.com", "avelero-verify-abc123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("DNS lookup failed");
    });

    it("includes error message in response", async () => {
      const errorMessage = "Custom DNS error message";
      mockFetchImpl = async () => {
        throw new Error(errorMessage);
      };

      const result = await verifyDomainDns("passport.nike.com", "avelero-verify-abc123");

      expect(result.success).toBe(false);
      expect(result.error).toContain(errorMessage);
    });
  });

  describe("DNS host construction", () => {
    it("looks up TXT on _avelero-verification.{domain} for subdomain", async () => {
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        return createMockResponse(createDohResponse([["avelero-verify-abc123"]]));
      };

      await verifyDomainDns("passport.nike.com", "avelero-verify-abc123");

      // TXT lookup is on _avelero-verification.{domain}
      expect(fetchCalls[0]?.url).toContain("name=_avelero-verification.passport.nike.com");
    });

    it("looks up TXT on _avelero-verification.{domain} for root domain", async () => {
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        return createMockResponse(createDohResponse([["avelero-verify-abc123"]]));
      };

      await verifyDomainDns("nike.com", "avelero-verify-abc123");

      expect(fetchCalls[0]?.url).toContain("name=_avelero-verification.nike.com");
    });

    it("looks up TXT on _avelero-verification.{domain} for deep subdomain", async () => {
      mockFetchImpl = async (url) => {
        fetchCalls.push({ url, options: {} });
        return createMockResponse(createDohResponse([["avelero-verify-abc123"]]));
      };

      await verifyDomainDns("eu.passport.nike.com", "avelero-verify-abc123");

      expect(fetchCalls[0]?.url).toContain("name=_avelero-verification.eu.passport.nike.com");
    });
  });
});

describe("buildDnsInstructions", () => {
  it("returns TXT record with subdomain included in host for subdomain", () => {
    const instructions = buildDnsInstructions("passport.nike.com", "avelero-verify-abc123");

    // TXT host includes subdomain to match verification lookup
    expect(instructions.txt).toEqual({
      recordType: "TXT",
      host: "_avelero-verification.passport",
      value: "avelero-verify-abc123",
      ttl: 300,
    });
  });

  it("returns CNAME record with subdomain as host", () => {
    const instructions = buildDnsInstructions("passport.nike.com", "avelero-verify-abc123");

    expect(instructions.cname).toEqual({
      recordType: "CNAME",
      host: "passport",
      value: "cname.avelero.com",
      ttl: 300,
    });
  });

  it("handles root domain with @ for CNAME and plain _avelero-verification for TXT", () => {
    const instructions = buildDnsInstructions("nike.com", "avelero-verify-abc123");

    // TXT host is _avelero-verification for root domain
    expect(instructions.txt.host).toBe("_avelero-verification");
    // CNAME host is @ for root domain
    expect(instructions.cname.host).toBe("@");
  });

  it("handles deep subdomain correctly", () => {
    const instructions = buildDnsInstructions("eu.passport.nike.com", "avelero-verify-abc123");

    // TXT host includes full subdomain
    expect(instructions.txt.host).toBe("_avelero-verification.eu.passport");
    // CNAME host is the full subdomain part
    expect(instructions.cname.host).toBe("eu.passport");
  });

  it("preserves verification token exactly", () => {
    const token = "avelero-verify-a1b2c3d4e5f6g7h8";
    const instructions = buildDnsInstructions("passport.nike.com", token);

    expect(instructions.txt.value).toBe(token);
  });

  it("always uses cname.avelero.com as CNAME target", () => {
    const instructions1 = buildDnsInstructions("passport.nike.com", "token1");
    const instructions2 = buildDnsInstructions("dpp.adidas.com", "token2");
    const instructions3 = buildDnsInstructions("brand.io", "token3");

    expect(instructions1.cname.value).toBe("cname.avelero.com");
    expect(instructions2.cname.value).toBe("cname.avelero.com");
    expect(instructions3.cname.value).toBe("cname.avelero.com");
  });

  it("uses 300 as TTL for both records", () => {
    const instructions = buildDnsInstructions("passport.nike.com", "avelero-verify-abc123");

    expect(instructions.txt.ttl).toBe(300);
    expect(instructions.cname.ttl).toBe(300);
  });

  it("TXT host includes subdomain to match verification lookup", () => {
    const instructions1 = buildDnsInstructions("passport.nike.com", "token1");
    const instructions2 = buildDnsInstructions("nike.com", "token2");
    const instructions3 = buildDnsInstructions("eu.passport.brand.io", "token3");

    // Subdomain: _avelero-verification.{subdomain}
    expect(instructions1.txt.host).toBe("_avelero-verification.passport");
    // Root domain: just _avelero-verification
    expect(instructions2.txt.host).toBe("_avelero-verification");
    // Deep subdomain: _avelero-verification.{full.subdomain}
    expect(instructions3.txt.host).toBe("_avelero-verification.eu.passport");
  });
});
