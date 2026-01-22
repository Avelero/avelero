/**
 * Unit Tests: DNS Verification Utilities
 *
 * Tests the DNS verification functions for custom domain management:
 * - generateVerificationToken: Creates cryptographically secure tokens
 * - verifyDomainDns: Performs DNS TXT record lookups
 * - buildDnsInstructions: Generates DNS configuration instructions
 *
 * Uses Bun's mock.module to mock the node:dns/promises module.
 * Following TDD principles - tests define expected behavior.
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";

// Mock DNS before importing the module under test
const mockResolveTxt = mock(() => Promise.resolve([["mock-token"]]));

mock.module("node:dns/promises", () => ({
  resolveTxt: mockResolveTxt,
}));

// Import after mocking
import {
  buildDnsInstructions,
  generateVerificationToken,
  verifyDomainDns,
} from "../../../src/utils/dns-verification";

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
    // Reset mock before each test
    mockResolveTxt.mockClear();
    mockResolveTxt.mockImplementation(() => Promise.resolve([["mock-token"]]));
  });

  describe("successful verification", () => {
    it("returns success when TXT record matches token", async () => {
      const expectedToken = "avelero-verify-abc123";
      mockResolveTxt.mockImplementation(() =>
        Promise.resolve([[expectedToken]]),
      );

      const result = await verifyDomainDns("passport.nike.com", expectedToken);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      // TXT lookup is on _avelero-verification.{domain}
      expect(mockResolveTxt).toHaveBeenCalledWith(
        "_avelero-verification.passport.nike.com",
      );
    });

    it("returns success when one of multiple TXT records matches", async () => {
      const expectedToken = "avelero-verify-abc123";
      mockResolveTxt.mockImplementation(() =>
        Promise.resolve([
          ["some-other-record"],
          [expectedToken],
          ["another-record"],
        ]),
      );

      const result = await verifyDomainDns("passport.nike.com", expectedToken);

      expect(result.success).toBe(true);
    });

    it("handles chunked TXT records by concatenating", async () => {
      // DNS TXT records can be chunked into 255-char segments
      const expectedToken = "avelero-verify-abc123";
      mockResolveTxt.mockImplementation(() =>
        Promise.resolve([
          ["avelero-verify-", "abc123"], // Chunked record
        ]),
      );

      const result = await verifyDomainDns("passport.nike.com", expectedToken);

      expect(result.success).toBe(true);
    });

    it("trims whitespace from TXT record value", async () => {
      const expectedToken = "avelero-verify-abc123";
      mockResolveTxt.mockImplementation(() =>
        Promise.resolve([["  avelero-verify-abc123  "]]),
      );

      const result = await verifyDomainDns("passport.nike.com", expectedToken);

      expect(result.success).toBe(true);
    });

    it("trims whitespace from expected token", async () => {
      mockResolveTxt.mockImplementation(() =>
        Promise.resolve([["avelero-verify-abc123"]]),
      );

      const result = await verifyDomainDns(
        "passport.nike.com",
        "  avelero-verify-abc123  ",
      );

      expect(result.success).toBe(true);
    });

    it("returns found records in result", async () => {
      const expectedToken = "avelero-verify-abc123";
      mockResolveTxt.mockImplementation(() =>
        Promise.resolve([
          ["other-record"],
          [expectedToken],
        ]),
      );

      const result = await verifyDomainDns("passport.nike.com", expectedToken);

      expect(result.foundRecords).toEqual(["other-record", expectedToken]);
    });
  });

  describe("failed verification", () => {
    it("returns failure when no TXT record exists (ENOTFOUND)", async () => {
      const error = new Error("queryTxt ENOTFOUND") as NodeJS.ErrnoException;
      error.code = "ENOTFOUND";
      mockResolveTxt.mockImplementation(() => Promise.reject(error));

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("No TXT record found");
    });

    it("returns failure when no TXT record exists (ENODATA)", async () => {
      const error = new Error("queryTxt ENODATA") as NodeJS.ErrnoException;
      error.code = "ENODATA";
      mockResolveTxt.mockImplementation(() => Promise.reject(error));

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("No TXT record found");
    });

    it("returns failure when TXT record exists but token mismatches", async () => {
      // Use an avelero-verify token that doesn't match
      mockResolveTxt.mockImplementation(() =>
        Promise.resolve([["avelero-verify-wrong-token"]]),
      );

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("token does not match");
    });

    it("returns failure with found records for debugging", async () => {
      const wrongRecords = ["wrong-token-1", "wrong-token-2"];
      mockResolveTxt.mockImplementation(() =>
        Promise.resolve(wrongRecords.map((r) => [r])),
      );

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
      );

      expect(result.success).toBe(false);
      expect(result.foundRecords).toEqual(wrongRecords);
    });
  });

  describe("error handling", () => {
    it("returns failure on DNS timeout", async () => {
      // Simulate timeout by rejecting with DNS_TIMEOUT message
      mockResolveTxt.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error("DNS_TIMEOUT")), 10);
          }),
      );

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
    });

    it("returns failure on DNS resolution error", async () => {
      mockResolveTxt.mockImplementation(() =>
        Promise.reject(new Error("DNS server error")),
      );

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("DNS lookup failed");
    });

    it("includes error message in response", async () => {
      const errorMessage = "Custom DNS error message";
      mockResolveTxt.mockImplementation(() =>
        Promise.reject(new Error(errorMessage)),
      );

      const result = await verifyDomainDns(
        "passport.nike.com",
        "avelero-verify-abc123",
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain(errorMessage);
    });
  });

  describe("DNS host construction", () => {
    it("looks up TXT on _avelero-verification.{domain} for subdomain", async () => {
      mockResolveTxt.mockImplementation(() =>
        Promise.resolve([["avelero-verify-abc123"]]),
      );

      await verifyDomainDns("passport.nike.com", "avelero-verify-abc123");

      // TXT lookup is on _avelero-verification.{domain}
      expect(mockResolveTxt).toHaveBeenCalledWith(
        "_avelero-verification.passport.nike.com",
      );
    });

    it("looks up TXT on _avelero-verification.{domain} for root domain", async () => {
      mockResolveTxt.mockImplementation(() =>
        Promise.resolve([["avelero-verify-abc123"]]),
      );

      await verifyDomainDns("nike.com", "avelero-verify-abc123");

      expect(mockResolveTxt).toHaveBeenCalledWith("_avelero-verification.nike.com");
    });

    it("looks up TXT on _avelero-verification.{domain} for deep subdomain", async () => {
      mockResolveTxt.mockImplementation(() =>
        Promise.resolve([["avelero-verify-abc123"]]),
      );

      await verifyDomainDns("eu.passport.nike.com", "avelero-verify-abc123");

      expect(mockResolveTxt).toHaveBeenCalledWith(
        "_avelero-verification.eu.passport.nike.com",
      );
    });
  });
});

describe("buildDnsInstructions", () => {
  it("returns TXT record with subdomain included in host for subdomain", () => {
    const instructions = buildDnsInstructions(
      "passport.nike.com",
      "avelero-verify-abc123",
    );

    // TXT host includes subdomain to match verification lookup
    expect(instructions.txt).toEqual({
      recordType: "TXT",
      host: "_avelero-verification.passport",
      value: "avelero-verify-abc123",
      ttl: 300,
    });
  });

  it("returns CNAME record with subdomain as host", () => {
    const instructions = buildDnsInstructions(
      "passport.nike.com",
      "avelero-verify-abc123",
    );

    expect(instructions.cname).toEqual({
      recordType: "CNAME",
      host: "passport",
      value: "cname.avelero.com",
      ttl: 300,
    });
  });

  it("handles root domain with @ for CNAME and plain _avelero-verification for TXT", () => {
    const instructions = buildDnsInstructions(
      "nike.com",
      "avelero-verify-abc123",
    );

    // TXT host is _avelero-verification for root domain
    expect(instructions.txt.host).toBe("_avelero-verification");
    // CNAME host is @ for root domain
    expect(instructions.cname.host).toBe("@");
  });

  it("handles deep subdomain correctly", () => {
    const instructions = buildDnsInstructions(
      "eu.passport.nike.com",
      "avelero-verify-abc123",
    );

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
    const instructions = buildDnsInstructions(
      "passport.nike.com",
      "avelero-verify-abc123",
    );

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
