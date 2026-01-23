/**
 * Unit Tests: DNS Verification Utilities
 *
 * Tests the DNS verification functions for custom domain management:
 * - generateVerificationToken: Creates cryptographically secure tokens
 * - getAuthoritativeNameservers: Finds NS records via Google DoH
 * - resolveNameserverIPs: Resolves NS hostnames to IPs
 * - queryAuthoritativeTxt: Queries authoritative nameservers for TXT records
 * - verifyDomainDns: Full verification flow
 * - buildDnsInstructions: Generates DNS configuration instructions
 *
 * Uses mock Resolver and fetch to test without network calls.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import type { Resolver } from "node:dns/promises";

import {
  buildDnsInstructions,
  generateVerificationToken,
  getAuthoritativeNameservers,
  queryAuthoritativeTxt,
  resolveNameserverIPs,
  verifyDomainDns,
} from "../../../src/utils/dns-verification";

// ============================================================================
// Mock Helpers
// ============================================================================

/**
 * Creates a mock DoH response for NS records.
 */
function createNsResponse(
  nameservers: string[],
  status = 0,
): { Status: number; Answer?: Array<{ type: number; data: string }> } {
  if (status !== 0 || nameservers.length === 0) {
    return { Status: status };
  }

  return {
    Status: status,
    Answer: nameservers.map((ns) => ({
      type: 2, // NS record type
      data: `${ns}.`, // NS records have trailing dot
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

/**
 * Creates a mock Resolver for testing.
 */
function createMockResolver(options: {
  resolve4?: (hostname: string) => Promise<string[]>;
  resolveTxt?: (hostname: string) => Promise<string[][]>;
}): Resolver {
  const resolver = {
    setServers: mock(() => {}),
    resolve4: options.resolve4 ?? mock(() => Promise.resolve(["1.2.3.4"])),
    resolveTxt: options.resolveTxt ?? mock(() => Promise.resolve([])),
  } as unknown as Resolver;

  return resolver;
}

// Store original fetch
const originalFetch = globalThis.fetch;

// Track fetch calls
let fetchCalls: { url: string; options?: RequestInit }[] = [];
let mockFetchImpl: (url: string, options?: RequestInit) => Promise<Response>;

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

describe("getAuthoritativeNameservers", () => {
  beforeEach(() => {
    fetchCalls = [];
    mockFetchImpl = async (url) => {
      fetchCalls.push({ url });
      return createMockResponse(createNsResponse(["ns1.example.com", "ns2.example.com"]));
    };

    // @ts-expect-error - mock fetch doesn't need all properties
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      return mockFetchImpl(url, init);
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns nameservers for a domain", async () => {
    mockFetchImpl = async (url) => {
      fetchCalls.push({ url });
      return createMockResponse(createNsResponse(["ns1.nike.com", "ns2.nike.com"]));
    };

    const result = await getAuthoritativeNameservers("passport.nike.com");

    expect(result).toEqual(["ns1.nike.com", "ns2.nike.com"]);
  });

  it("queries NS for registrable domain, not subdomain", async () => {
    await getAuthoritativeNameservers("passport.nike.com");

    // Should query nike.com, not passport.nike.com
    expect(fetchCalls[0]?.url).toContain("name=nike.com");
    expect(fetchCalls[0]?.url).toContain("type=NS");
  });

  it("removes trailing dots from nameserver records", async () => {
    mockFetchImpl = async (url) => {
      fetchCalls.push({ url });
      // NS records have trailing dots in DNS
      return createMockResponse({
        Status: 0,
        Answer: [
          { type: 2, data: "ns1.example.com." },
          { type: 2, data: "ns2.example.com." },
        ],
      });
    };

    const result = await getAuthoritativeNameservers("example.com");

    expect(result).toEqual(["ns1.example.com", "ns2.example.com"]);
  });

  it("throws on invalid domain", async () => {
    await expect(getAuthoritativeNameservers("invalid")).rejects.toThrow(
      "Could not parse domain",
    );
  });

  it("throws on DNS error", async () => {
    mockFetchImpl = async () => {
      return createMockResponse(createNsResponse([], 2), true); // SERVFAIL
    };

    await expect(getAuthoritativeNameservers("example.com")).rejects.toThrow(
      "NS lookup failed",
    );
  });

  it("throws on HTTP error", async () => {
    mockFetchImpl = async () => {
      return createMockResponse({}, false, 500);
    };

    await expect(getAuthoritativeNameservers("example.com")).rejects.toThrow(
      "NS lookup failed: HTTP 500",
    );
  });

  it("throws when no NS records found", async () => {
    mockFetchImpl = async () => {
      return createMockResponse({ Status: 0, Answer: [] });
    };

    await expect(getAuthoritativeNameservers("example.com")).rejects.toThrow(
      "No nameservers found",
    );
  });
});

describe("resolveNameserverIPs", () => {
  it("resolves nameserver hostnames to IPs", async () => {
    const mockResolver = createMockResolver({
      resolve4: async (hostname) => {
        if (hostname === "ns1.example.com") return ["1.2.3.4"];
        if (hostname === "ns2.example.com") return ["5.6.7.8"];
        throw new Error("Unknown hostname");
      },
    });

    const result = await resolveNameserverIPs(
      ["ns1.example.com", "ns2.example.com"],
      mockResolver,
    );

    expect(result).toEqual(["1.2.3.4", "5.6.7.8"]);
  });

  it("continues if some nameservers fail to resolve", async () => {
    const mockResolver = createMockResolver({
      resolve4: async (hostname) => {
        if (hostname === "ns1.example.com") return ["1.2.3.4"];
        throw new Error("DNS error");
      },
    });

    const result = await resolveNameserverIPs(
      ["ns1.example.com", "ns2.example.com"],
      mockResolver,
    );

    expect(result).toEqual(["1.2.3.4"]);
  });

  it("throws when no nameservers resolve", async () => {
    const mockResolver = createMockResolver({
      resolve4: async () => {
        throw new Error("DNS error");
      },
    });

    await expect(
      resolveNameserverIPs(["ns1.example.com", "ns2.example.com"], mockResolver),
    ).rejects.toThrow("Could not resolve any nameserver IPs");
  });

  it("collects multiple IPs from a single nameserver", async () => {
    const mockResolver = createMockResolver({
      resolve4: async () => ["1.2.3.4", "5.6.7.8"],
    });

    const result = await resolveNameserverIPs(["ns1.example.com"], mockResolver);

    expect(result).toEqual(["1.2.3.4", "5.6.7.8"]);
  });
});

describe("queryAuthoritativeTxt", () => {
  it("returns TXT records from authoritative nameservers", async () => {
    const mockResolver = createMockResolver({
      resolveTxt: async () => [["avelero-verify-abc123"]],
    });

    const result = await queryAuthoritativeTxt(
      "_avelero-verification.example.com",
      ["1.2.3.4"],
      mockResolver,
    );

    expect(result).toEqual(["avelero-verify-abc123"]);
  });

  it("concatenates chunked TXT records", async () => {
    const mockResolver = createMockResolver({
      resolveTxt: async () => [["avelero-verify-", "abc123"]],
    });

    const result = await queryAuthoritativeTxt(
      "_avelero-verification.example.com",
      ["1.2.3.4"],
      mockResolver,
    );

    expect(result).toEqual(["avelero-verify-abc123"]);
  });

  it("returns multiple TXT records", async () => {
    const mockResolver = createMockResolver({
      resolveTxt: async () => [["record1"], ["record2"], ["record3"]],
    });

    const result = await queryAuthoritativeTxt(
      "_avelero-verification.example.com",
      ["1.2.3.4"],
      mockResolver,
    );

    expect(result).toEqual(["record1", "record2", "record3"]);
  });

  it("sets nameserver IPs on resolver", async () => {
    const setServersMock = mock(() => {});
    const mockResolver = {
      setServers: setServersMock,
      resolveTxt: async () => [["test"]],
    } as unknown as Resolver;

    await queryAuthoritativeTxt(
      "_avelero-verification.example.com",
      ["1.2.3.4", "5.6.7.8"],
      mockResolver,
    );

    expect(setServersMock).toHaveBeenCalledWith(["1.2.3.4", "5.6.7.8"]);
  });
});

describe("verifyDomainDns", () => {
  describe("successful verification", () => {
    it("returns success when TXT record matches token", async () => {
      const expectedToken = "avelero-verify-abc123";
      const mockResolver = createMockResolver({
        resolveTxt: async () => [[expectedToken]],
      });

      const result = await verifyDomainDns("passport.nike.com", expectedToken, {
        nameserverIPs: ["1.2.3.4"],
        resolver: mockResolver,
      });

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("returns success when one of multiple TXT records matches", async () => {
      const expectedToken = "avelero-verify-abc123";
      const mockResolver = createMockResolver({
        resolveTxt: async () => [["other-record"], [expectedToken], ["another-record"]],
      });

      const result = await verifyDomainDns("passport.nike.com", expectedToken, {
        nameserverIPs: ["1.2.3.4"],
        resolver: mockResolver,
      });

      expect(result.success).toBe(true);
    });

    it("handles chunked TXT records by concatenating", async () => {
      const expectedToken = "avelero-verify-abc123";
      const mockResolver = createMockResolver({
        resolveTxt: async () => [["avelero-verify-", "abc123"]],
      });

      const result = await verifyDomainDns("passport.nike.com", expectedToken, {
        nameserverIPs: ["1.2.3.4"],
        resolver: mockResolver,
      });

      expect(result.success).toBe(true);
    });

    it("trims whitespace from TXT record value", async () => {
      const expectedToken = "avelero-verify-abc123";
      const mockResolver = createMockResolver({
        resolveTxt: async () => [["  avelero-verify-abc123  "]],
      });

      const result = await verifyDomainDns("passport.nike.com", expectedToken, {
        nameserverIPs: ["1.2.3.4"],
        resolver: mockResolver,
      });

      expect(result.success).toBe(true);
    });

    it("trims whitespace from expected token", async () => {
      const mockResolver = createMockResolver({
        resolveTxt: async () => [["avelero-verify-abc123"]],
      });

      const result = await verifyDomainDns(
        "passport.nike.com",
        "  avelero-verify-abc123  ",
        {
          nameserverIPs: ["1.2.3.4"],
          resolver: mockResolver,
        },
      );

      expect(result.success).toBe(true);
    });

    it("returns found records in result", async () => {
      const expectedToken = "avelero-verify-abc123";
      const mockResolver = createMockResolver({
        resolveTxt: async () => [["other-record"], [expectedToken]],
      });

      const result = await verifyDomainDns("passport.nike.com", expectedToken, {
        nameserverIPs: ["1.2.3.4"],
        resolver: mockResolver,
      });

      expect(result.foundRecords).toEqual(["other-record", expectedToken]);
    });
  });

  describe("failed verification", () => {
    it("returns failure when no TXT record exists (ENODATA)", async () => {
      const mockResolver = createMockResolver({
        resolveTxt: async () => {
          const error = new Error("No data") as Error & { code: string };
          error.code = "ENODATA";
          throw error;
        },
      });

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
        {
          nameserverIPs: ["1.2.3.4"],
          resolver: mockResolver,
        },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("No TXT record found");
    });

    it("returns failure when no TXT record exists (ENOTFOUND)", async () => {
      const mockResolver = createMockResolver({
        resolveTxt: async () => {
          const error = new Error("Not found") as Error & { code: string };
          error.code = "ENOTFOUND";
          throw error;
        },
      });

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
        {
          nameserverIPs: ["1.2.3.4"],
          resolver: mockResolver,
        },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("No TXT record found");
    });

    it("returns failure when TXT records are empty", async () => {
      const mockResolver = createMockResolver({
        resolveTxt: async () => [],
      });

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
        {
          nameserverIPs: ["1.2.3.4"],
          resolver: mockResolver,
        },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("No TXT record found");
    });

    it("returns failure when TXT record exists but token mismatches", async () => {
      const mockResolver = createMockResolver({
        resolveTxt: async () => [["avelero-verify-wrong-token"]],
      });

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
        {
          nameserverIPs: ["1.2.3.4"],
          resolver: mockResolver,
        },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("token does not match");
    });

    it("returns failure with found records for debugging", async () => {
      const wrongRecords = ["wrong-token-1", "wrong-token-2"];
      const mockResolver = createMockResolver({
        resolveTxt: async () => wrongRecords.map((r) => [r]),
      });

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
        {
          nameserverIPs: ["1.2.3.4"],
          resolver: mockResolver,
        },
      );

      expect(result.success).toBe(false);
      expect(result.foundRecords).toEqual(wrongRecords);
    });
  });

  describe("error handling", () => {
    it("returns failure on DNS timeout", async () => {
      const mockResolver = createMockResolver({
        resolveTxt: async () => {
          throw new Error("DNS query timed out");
        },
      });

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
        {
          nameserverIPs: ["1.2.3.4"],
          resolver: mockResolver,
        },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
    });

    it("returns failure on DNS resolution error", async () => {
      const mockResolver = createMockResolver({
        resolveTxt: async () => {
          throw new Error("DNS server error");
        },
      });

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
        {
          nameserverIPs: ["1.2.3.4"],
          resolver: mockResolver,
        },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("DNS lookup failed");
    });

    it("returns generic error for unexpected failures (no internal details leaked)", async () => {
      const mockResolver = createMockResolver({
        resolveTxt: async () => {
          throw new Error("Internal server details: 192.168.1.1 failed");
        },
      });

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
        {
          nameserverIPs: ["1.2.3.4"],
          resolver: mockResolver,
        },
      );

      expect(result.success).toBe(false);
      // Should NOT contain internal details
      expect(result.error).not.toContain("192.168.1.1");
      // Should return user-friendly generic message
      expect(result.error).toContain("DNS lookup failed");
    });
  });

  describe("TXT host construction", () => {
    it("queries _avelero-verification.{domain} for subdomain", async () => {
      let queriedHost = "";
      const mockResolver = createMockResolver({
        resolveTxt: async (hostname) => {
          queriedHost = hostname;
          return [["avelero-verify-abc123"]];
        },
      });

      await verifyDomainDns("passport.nike.com", "avelero-verify-abc123", {
        nameserverIPs: ["1.2.3.4"],
        resolver: mockResolver,
      });

      expect(queriedHost).toBe("_avelero-verification.passport.nike.com");
    });

    it("queries _avelero-verification.{domain} for root domain", async () => {
      let queriedHost = "";
      const mockResolver = createMockResolver({
        resolveTxt: async (hostname) => {
          queriedHost = hostname;
          return [["avelero-verify-abc123"]];
        },
      });

      await verifyDomainDns("nike.com", "avelero-verify-abc123", {
        nameserverIPs: ["1.2.3.4"],
        resolver: mockResolver,
      });

      expect(queriedHost).toBe("_avelero-verification.nike.com");
    });

    it("queries _avelero-verification.{domain} for deep subdomain", async () => {
      let queriedHost = "";
      const mockResolver = createMockResolver({
        resolveTxt: async (hostname) => {
          queriedHost = hostname;
          return [["avelero-verify-abc123"]];
        },
      });

      await verifyDomainDns("eu.passport.nike.com", "avelero-verify-abc123", {
        nameserverIPs: ["1.2.3.4"],
        resolver: mockResolver,
      });

      expect(queriedHost).toBe("_avelero-verification.eu.passport.nike.com");
    });
  });
});

describe("buildDnsInstructions", () => {
  it("returns TXT record with subdomain included in host for subdomain", () => {
    const instructions = buildDnsInstructions("passport.nike.com", "avelero-verify-abc123");

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

    expect(instructions.txt.host).toBe("_avelero-verification");
    expect(instructions.cname.host).toBe("@");
  });

  it("handles deep subdomain correctly", () => {
    const instructions = buildDnsInstructions("eu.passport.nike.com", "avelero-verify-abc123");

    expect(instructions.txt.host).toBe("_avelero-verification.eu.passport");
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

    expect(instructions1.txt.host).toBe("_avelero-verification.passport");
    expect(instructions2.txt.host).toBe("_avelero-verification");
    expect(instructions3.txt.host).toBe("_avelero-verification.eu.passport");
  });
});
