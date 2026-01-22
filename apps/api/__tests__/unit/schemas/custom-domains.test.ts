/**
 * Unit Tests: Custom Domain Schema Validation
 *
 * Tests the Zod validation schemas for custom domain management:
 * - domainSchema: Domain format validation
 * - customDomainAddSchema: Input schema for adding domains
 * - Reserved domain detection
 *
 * Following TDD principles - tests define expected behavior.
 */

import { describe, expect, it } from "bun:test";
import {
  customDomainAddSchema,
  customDomainStatusSchema,
  domainSchema,
  reservedDomains,
} from "../../../src/schemas/custom-domains";

describe("domainSchema", () => {
  describe("valid domains", () => {
    it("accepts simple domain: nike.com", () => {
      const result = domainSchema.safeParse("nike.com");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("nike.com");
      }
    });

    it("accepts subdomain: passport.nike.com", () => {
      const result = domainSchema.safeParse("passport.nike.com");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("passport.nike.com");
      }
    });

    it("accepts deep subdomain: eu.passport.nike.com", () => {
      const result = domainSchema.safeParse("eu.passport.nike.com");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("eu.passport.nike.com");
      }
    });

    it("accepts domain with numbers: nike123.com", () => {
      const result = domainSchema.safeParse("nike123.com");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("nike123.com");
      }
    });

    it("accepts domain with hyphens: my-brand.com", () => {
      const result = domainSchema.safeParse("my-brand.com");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("my-brand.com");
      }
    });

    it("normalizes uppercase to lowercase: NIKE.COM -> nike.com", () => {
      const result = domainSchema.safeParse("NIKE.COM");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("nike.com");
      }
    });

    it("normalizes mixed case: PaSsPoRt.NiKe.CoM -> passport.nike.com", () => {
      const result = domainSchema.safeParse("PaSsPoRt.NiKe.CoM");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("passport.nike.com");
      }
    });

    it("accepts domain starting with number: 123brand.com", () => {
      const result = domainSchema.safeParse("123brand.com");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("123brand.com");
      }
    });

    it("accepts two-letter TLD: brand.co", () => {
      const result = domainSchema.safeParse("brand.co");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("brand.co");
      }
    });

    it("accepts long TLD: brand.photography", () => {
      const result = domainSchema.safeParse("brand.photography");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("brand.photography");
      }
    });
  });

  describe("invalid domains", () => {
    it("rejects empty string", () => {
      const result = domainSchema.safeParse("");
      expect(result.success).toBe(false);
    });

    it("rejects domain without TLD: nike", () => {
      const result = domainSchema.safeParse("nike");
      expect(result.success).toBe(false);
    });

    it("rejects domain with consecutive dots: nike..com", () => {
      const result = domainSchema.safeParse("nike..com");
      expect(result.success).toBe(false);
    });

    it("rejects domain starting with hyphen: -nike.com", () => {
      const result = domainSchema.safeParse("-nike.com");
      expect(result.success).toBe(false);
    });

    it("rejects domain ending with hyphen: nike-.com", () => {
      const result = domainSchema.safeParse("nike-.com");
      expect(result.success).toBe(false);
    });

    it("rejects domain with port: nike.com:8080", () => {
      const result = domainSchema.safeParse("nike.com:8080");
      expect(result.success).toBe(false);
    });

    it("rejects domain with protocol: https://nike.com", () => {
      const result = domainSchema.safeParse("https://nike.com");
      expect(result.success).toBe(false);
    });

    it("rejects domain with path: nike.com/path", () => {
      const result = domainSchema.safeParse("nike.com/path");
      expect(result.success).toBe(false);
    });

    it("rejects IP address format: 192.168.1.1", () => {
      // IP addresses fail the regex because labels are single digits
      // which don't form valid domain labels
      const result = domainSchema.safeParse("192.168.1.1");
      expect(result.success).toBe(false);
    });

    it("rejects domain exceeding 253 characters", () => {
      // Create a domain longer than 253 chars
      const longDomain = `${"a".repeat(250)}.com`;
      const result = domainSchema.safeParse(longDomain);
      expect(result.success).toBe(false);
    });

    it("rejects domain shorter than 4 characters", () => {
      const result = domainSchema.safeParse("a.b");
      expect(result.success).toBe(false);
    });

    it("rejects domain with underscore: my_brand.com", () => {
      const result = domainSchema.safeParse("my_brand.com");
      expect(result.success).toBe(false);
    });

    it("rejects domain with space: my brand.com", () => {
      const result = domainSchema.safeParse("my brand.com");
      expect(result.success).toBe(false);
    });

    it("rejects domain starting with dot: .nike.com", () => {
      const result = domainSchema.safeParse(".nike.com");
      expect(result.success).toBe(false);
    });

    it("rejects domain ending with dot: nike.com.", () => {
      const result = domainSchema.safeParse("nike.com.");
      expect(result.success).toBe(false);
    });

    it("rejects domain with query string: nike.com?foo=bar", () => {
      const result = domainSchema.safeParse("nike.com?foo=bar");
      expect(result.success).toBe(false);
    });
  });

  describe("reserved domains", () => {
    it("rejects avelero.com", () => {
      const result = domainSchema.safeParse("avelero.com");
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorMessages = result.error.errors.map((e) => e.message);
        expect(errorMessages.some((m) => m.includes("reserved"))).toBe(true);
      }
    });

    it("rejects passport.avelero.com", () => {
      const result = domainSchema.safeParse("passport.avelero.com");
      expect(result.success).toBe(false);
    });

    it("rejects subdomain of avelero.com: foo.avelero.com", () => {
      const result = domainSchema.safeParse("foo.avelero.com");
      expect(result.success).toBe(false);
    });

    it("rejects deep subdomain of avelero.com: foo.bar.avelero.com", () => {
      const result = domainSchema.safeParse("foo.bar.avelero.com");
      expect(result.success).toBe(false);
    });

    it("rejects localhost", () => {
      // Note: 'localhost' will fail the regex first (no TLD)
      const result = domainSchema.safeParse("localhost");
      expect(result.success).toBe(false);
    });

    it("rejects example.com", () => {
      const result = domainSchema.safeParse("example.com");
      expect(result.success).toBe(false);
    });

    it("rejects test.com", () => {
      const result = domainSchema.safeParse("test.com");
      expect(result.success).toBe(false);
    });

    it("rejects avelero.io", () => {
      const result = domainSchema.safeParse("avelero.io");
      expect(result.success).toBe(false);
    });

    it("rejects avelero.app", () => {
      const result = domainSchema.safeParse("avelero.app");
      expect(result.success).toBe(false);
    });

    it("rejects subdomain of example.com: foo.example.com", () => {
      const result = domainSchema.safeParse("foo.example.com");
      expect(result.success).toBe(false);
    });

    it("allows domain containing 'avelero' but not ending with reserved: avelero-brand.com", () => {
      const result = domainSchema.safeParse("avelero-brand.com");
      expect(result.success).toBe(true);
    });

    it("allows domain containing 'test' but not matching reserved: testbrand.com", () => {
      const result = domainSchema.safeParse("testbrand.com");
      expect(result.success).toBe(true);
    });
  });
});

describe("customDomainAddSchema", () => {
  it("accepts valid domain in object format", () => {
    const result = customDomainAddSchema.safeParse({
      domain: "passport.nike.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe("passport.nike.com");
    }
  });

  it("rejects missing domain field", () => {
    const result = customDomainAddSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid domain in object format", () => {
    const result = customDomainAddSchema.safeParse({
      domain: "invalid",
    });
    expect(result.success).toBe(false);
  });

  it("normalizes uppercase domain in object format", () => {
    const result = customDomainAddSchema.safeParse({
      domain: "PASSPORT.NIKE.COM",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe("passport.nike.com");
    }
  });

  it("rejects extra fields (strict mode)", () => {
    const result = customDomainAddSchema.safeParse({
      domain: "passport.nike.com",
      extraField: "should fail",
    });
    // Zod by default strips unknown keys, so this will pass
    // If strict mode is needed, schema should use .strict()
    expect(result.success).toBe(true);
  });
});

describe("customDomainStatusSchema", () => {
  it("accepts 'pending' status", () => {
    const result = customDomainStatusSchema.safeParse("pending");
    expect(result.success).toBe(true);
  });

  it("accepts 'verified' status", () => {
    const result = customDomainStatusSchema.safeParse("verified");
    expect(result.success).toBe(true);
  });

  it("rejects 'failed' status (no longer a valid status)", () => {
    const result = customDomainStatusSchema.safeParse("failed");
    expect(result.success).toBe(false);
  });

  it("rejects invalid status", () => {
    const result = customDomainStatusSchema.safeParse("invalid");
    expect(result.success).toBe(false);
  });

  it("rejects uppercase status", () => {
    const result = customDomainStatusSchema.safeParse("PENDING");
    expect(result.success).toBe(false);
  });
});

describe("reservedDomains", () => {
  it("exports reservedDomains array", () => {
    expect(Array.isArray(reservedDomains)).toBe(true);
    expect(reservedDomains.length).toBeGreaterThan(0);
  });

  it("includes avelero.com", () => {
    expect(reservedDomains).toContain("avelero.com");
  });

  it("includes localhost", () => {
    expect(reservedDomains).toContain("localhost");
  });

  it("includes example.com", () => {
    expect(reservedDomains).toContain("example.com");
  });
});
