/**
 * Integration Tests: Custom Domains TRPC Router
 *
 * Tests the custom domains TRPC router endpoints:
 * - customDomains.get - Get the brand's custom domain (if any)
 * - customDomains.add - Add a new custom domain
 * - customDomains.verify - Trigger DNS verification
 * - customDomains.remove - Remove the custom domain
 *
 * Uses real database connections with mocked DNS lookups (via fetch mock).
 */

// Load setup first (loads .env.test and configures cleanup)
import "../../setup";

import { afterAll, afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { cleanupTables, createTestBrand, createTestUser, testDb } from "@v1/db/testing";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";

// ============================================================================
// DNS Mock Setup
// ============================================================================

/**
 * Creates a mock Google DoH JSON response for NS records.
 * The refactored DNS verification uses DoH only for NS lookups.
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

// Store original fetch
const originalFetch = globalThis.fetch;

// Mock DNS resolver state
let mockTxtRecords: string[][] = [["avelero-verify-mock-token"]];
let mockTxtError: Error | null = null;

// Setup fetch mock for NS lookups (DoH)
(globalThis as any).fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input.toString();
  // Mock Google DoH NS requests - return fake nameservers
  if (url.includes("dns.google") && url.includes("type=NS")) {
    return createMockResponse(createNsResponse(["ns1.mock.com", "ns2.mock.com"]));
  }
  // Pass through other requests to original fetch
  return originalFetch(input, init);
};

// Mock node:dns/promises Resolver class
// The refactored DNS verification uses native DNS for TXT lookups
import { mock } from "bun:test";

const MockResolver = class {
  setServers = mock(() => {});
  resolve4 = mock(async () => ["1.2.3.4", "5.6.7.8"]);
  resolveTxt = mock(async () => {
    if (mockTxtError) {
      throw mockTxtError;
    }
    return mockTxtRecords;
  });
};

// Apply the mock before importing the router
mock.module("node:dns/promises", () => ({
  Resolver: MockResolver,
}));

// Import router AFTER mocking fetch
import { brandCustomDomainsRouter } from "../../../src/trpc/routers/brand/custom-domains";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock context for testing router procedures.
 * NOTE: The role here is ignored by the middleware - it queries the database.
 * To test authorization, create users with appropriate DB roles.
 */
function createMockContext(options: {
  brandId: string;
  userId: string;
  userEmail: string;
}): AuthenticatedTRPCContext & { brandId: string } {
  return {
    user: {
      id: options.userId,
      email: options.userEmail,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as any,
    brandId: options.brandId,
    role: "owner", // This gets overwritten by middleware from DB lookup
    db: testDb,
    loaders: {} as any,
    supabase: {} as any,
    supabaseAdmin: null,
    geo: { ip: null },
  };
}

/**
 * Creates a brand membership for testing.
 */
async function createBrandMembership(
  userId: string,
  brandId: string,
  role: "owner" | "member" = "owner",
) {
  await testDb.insert(schema.brandMembers).values({
    userId,
    brandId,
    role,
  });
}

/**
 * Creates a custom domain record directly in the database.
 */
async function createCustomDomain(options: {
  brandId: string;
  domain: string;
  status?: "pending" | "verified";
  verificationToken?: string;
  verificationError?: string | null;
  verifiedAt?: string | null;
}): Promise<string> {
  const [domain] = await testDb
    .insert(schema.brandCustomDomains)
    .values({
      brandId: options.brandId,
      domain: options.domain,
      status: options.status ?? "pending",
      verificationToken: options.verificationToken ?? "avelero-verify-test-token-1234567890",
      verificationError: options.verificationError ?? null,
      verifiedAt: options.verifiedAt ?? null,
    })
    .returning({ id: schema.brandCustomDomains.id });

  if (!domain) {
    throw new Error("Failed to create test custom domain");
  }

  return domain.id;
}

/**
 * Gets the custom domain for a brand directly from the database.
 */
async function getCustomDomainFromDb(brandId: string) {
  const [domain] = await testDb
    .select()
    .from(schema.brandCustomDomains)
    .where(eq(schema.brandCustomDomains.brandId, brandId))
    .limit(1);

  return domain ?? null;
}

// Helper to call procedures
async function callGet(ctx: AuthenticatedTRPCContext & { brandId: string }) {
  return brandCustomDomainsRouter.createCaller(ctx).get();
}

async function callAdd(
  ctx: AuthenticatedTRPCContext & { brandId: string },
  input: { domain: string },
) {
  return brandCustomDomainsRouter.createCaller(ctx).add(input);
}

async function callVerify(ctx: AuthenticatedTRPCContext & { brandId: string }) {
  return brandCustomDomainsRouter.createCaller(ctx).verify();
}

async function callRemove(ctx: AuthenticatedTRPCContext & { brandId: string }) {
  return brandCustomDomainsRouter.createCaller(ctx).remove();
}

/**
 * Helper to set mock DNS TXT response for tests.
 * Sets the records that the mocked native DNS Resolver will return.
 */
function setMockDnsResponse(txtRecords: string[][]) {
  mockTxtRecords = txtRecords;
  mockTxtError = null;
}

/**
 * Helper to set mock DNS error (ENOTFOUND/NXDOMAIN).
 * Simulates no TXT record found.
 */
function setMockDnsNotFound() {
  mockTxtRecords = [];
  const error = new Error("queryTxt ENOTFOUND") as Error & { code: string };
  error.code = "ENOTFOUND";
  mockTxtError = error;
}

// ============================================================================
// Tests
// ============================================================================

describe("Custom Domains Router", () => {
  let brandId: string;
  let userId: string;
  let userEmail: string;

  beforeEach(async () => {
    // Reset DNS mock to default
    mockTxtRecords = [["avelero-verify-mock-token"]];
    mockTxtError = null;

    // Clean database
    await cleanupTables();

    // Create unique email for each test
    const uniqueSuffix = Math.random().toString(36).substring(2, 10);
    userEmail = `test-${uniqueSuffix}@example.com`;

    // Create test brand and user
    brandId = await createTestBrand("Custom Domain Test Brand");
    userId = await createTestUser(userEmail);

    // Create brand membership as OWNER by default
    await createBrandMembership(userId, brandId, "owner");
  });

  afterEach(() => {
    // Reset mock to default behavior between tests
    mockTxtRecords = [["avelero-verify-mock-token"]];
    mockTxtError = null;
  });

  afterAll(() => {
    // Restore original fetch after all tests in this file
    globalThis.fetch = originalFetch;
  });

  // ==========================================================================
  // customDomains.get
  // ==========================================================================

  describe("customDomains.get", () => {
    it("returns null when no domain configured", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      const result = await callGet(ctx);

      expect(result).toBeDefined();
      expect(result.domain).toBeNull();
    });

    it("returns domain config for brand member", async () => {
      // Create a member user
      const memberEmail = "member@example.com";
      const memberId = await createTestUser(memberEmail);
      await createBrandMembership(memberId, brandId, "member");

      const ctx = createMockContext({ brandId, userId: memberId, userEmail: memberEmail });

      // Create a domain
      await createCustomDomain({
        brandId,
        domain: "passport.mybrand.org",
        status: "pending",
      });

      const result = await callGet(ctx);

      expect(result.domain).toBeDefined();
      expect(result.domain?.domain).toBe("passport.mybrand.org");
      expect(result.domain?.status).toBe("pending");
    });

    it("includes verification token for pending domain", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });
      const token = "avelero-verify-test-token-abc123";

      await createCustomDomain({
        brandId,
        domain: "passport.mybrand.org",
        status: "pending",
        verificationToken: token,
      });

      const result = await callGet(ctx);

      expect(result.domain?.verificationToken).toBe(token);
    });

    it("includes verifiedAt for verified domain", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      await createCustomDomain({
        brandId,
        domain: "passport.mybrand.org",
        status: "verified",
        verifiedAt: new Date().toISOString(),
      });

      const result = await callGet(ctx);

      expect(result.domain?.status).toBe("verified");
      expect(result.domain?.verifiedAt).toBeDefined();
      expect(result.domain?.verifiedAt).not.toBeNull();
    });

    it("includes error message for pending domain with verification error", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });
      const errorMessage = "No TXT record found";

      await createCustomDomain({
        brandId,
        domain: "passport.mybrand.org",
        status: "pending",
        verificationError: errorMessage,
      });

      const result = await callGet(ctx);

      expect(result.domain?.status).toBe("pending");
      expect(result.domain?.verificationError).toBe(errorMessage);
    });
  });

  // ==========================================================================
  // customDomains.add
  // ==========================================================================

  describe("customDomains.add", () => {
    describe("success cases", () => {
      it("creates domain with pending status", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        const result = await callAdd(ctx, { domain: "passport.mybrand.com" });

        expect(result).toBeDefined();
        expect(result.status).toBe("pending");
        expect(result.domain).toBe("passport.mybrand.com");
      });

      it("generates unique verification token", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        const result = await callAdd(ctx, { domain: "passport.mybrand.com" });

        expect(result.verificationToken).toBeDefined();
        expect(result.verificationToken).toMatch(/^avelero-verify-[a-f0-9]{64}$/);
      });

      it("returns DNS instructions", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        const result = await callAdd(ctx, { domain: "passport.mybrand.com" });

        expect(result.dnsInstructions).toBeDefined();
        expect(result.dnsInstructions.txt).toBeDefined();
        expect(result.dnsInstructions.txt.recordType).toBe("TXT");
        expect(result.dnsInstructions.cname).toBeDefined();
        expect(result.dnsInstructions.cname.recordType).toBe("CNAME");
        expect(result.dnsInstructions.cname.value).toBe("cname.avelero.com");
      });

      it("normalizes domain to lowercase", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        const result = await callAdd(ctx, { domain: "PASSPORT.MYBRAND.COM" });

        expect(result.domain).toBe("passport.mybrand.com");
      });

      it("stores domain in database", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        await callAdd(ctx, { domain: "passport.mybrand.com" });

        const dbDomain = await getCustomDomainFromDb(brandId);
        expect(dbDomain).not.toBeNull();
        expect(dbDomain?.domain).toBe("passport.mybrand.com");
        expect(dbDomain?.status).toBe("pending");
      });
    });

    describe("authorization", () => {
      it("allows brand owner", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        const result = await callAdd(ctx, { domain: "passport.mybrand.com" });

        expect(result).toBeDefined();
        expect(result.domain).toBe("passport.mybrand.com");
      });

      it("denies brand member (non-owner)", async () => {
        // Create a member user (not owner)
        const memberEmail = "member@example.com";
        const memberId = await createTestUser(memberEmail);
        await createBrandMembership(memberId, brandId, "member");

        const ctx = createMockContext({ brandId, userId: memberId, userEmail: memberEmail });

        await expect(callAdd(ctx, { domain: "passport.mybrand.com" })).rejects.toThrow(
          "You do not have the required role",
        );
      });
    });

    describe("validation", () => {
      it("rejects invalid domain format", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        await expect(callAdd(ctx, { domain: "not-a-valid-domain" })).rejects.toThrow();
      });

      it("rejects domain with protocol", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        await expect(callAdd(ctx, { domain: "https://passport.mybrand.com" })).rejects.toThrow();
      });

      it("rejects reserved domain (avelero.com)", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        await expect(callAdd(ctx, { domain: "avelero.com" })).rejects.toThrow();
      });

      it("rejects subdomain of reserved domain", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        await expect(callAdd(ctx, { domain: "passport.avelero.com" })).rejects.toThrow();
      });

      it("rejects localhost", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        // localhost without TLD fails the regex (needs at least one dot)
        await expect(callAdd(ctx, { domain: "localhost" })).rejects.toThrow();
      });
    });

    describe("uniqueness constraints", () => {
      it("rejects if brand already has domain", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        // First domain should succeed
        await callAdd(ctx, { domain: "passport.mybrand.com" });

        // Second domain should fail
        await expect(callAdd(ctx, { domain: "other.mybrand.com" })).rejects.toThrow(
          "You already have a custom domain configured",
        );
      });

      it("rejects if domain claimed by another brand", async () => {
        // Create another brand and user
        const otherBrandId = await createTestBrand("Other Brand");
        const otherUserId = await createTestUser("other@example.com");
        await createBrandMembership(otherUserId, otherBrandId, "owner");

        // Add domain to other brand
        await createCustomDomain({
          brandId: otherBrandId,
          domain: "claimed.domain.com",
        });

        // Try to add same domain to our brand
        const ctx = createMockContext({ brandId, userId, userEmail });

        await expect(callAdd(ctx, { domain: "claimed.domain.com" })).rejects.toThrow(
          "This domain is already in use by another brand",
        );
      });
    });
  });

  // ==========================================================================
  // customDomains.verify
  // ==========================================================================

  describe("customDomains.verify", () => {
    describe("success cases", () => {
      it("updates status to verified on success", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });
        const token = "avelero-verify-test-token-xyz";

        await createCustomDomain({
          brandId,
          domain: "passport.mybrand.org",
          status: "pending",
          verificationToken: token,
        });

        // Mock DNS to return matching token
        setMockDnsResponse([[token]]);

        const result = await callVerify(ctx);

        expect(result.success).toBe(true);
        expect(result.status).toBe("verified");
      });

      it("sets verifiedAt timestamp", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });
        const token = "avelero-verify-test-token-xyz";

        await createCustomDomain({
          brandId,
          domain: "passport.mybrand.org",
          status: "pending",
          verificationToken: token,
        });

        setMockDnsResponse([[token]]);

        const result = await callVerify(ctx);

        expect(result.verifiedAt).toBeDefined();

        // Verify in database
        const dbDomain = await getCustomDomainFromDb(brandId);
        expect(dbDomain?.verifiedAt).toBeDefined();
        expect(dbDomain?.verifiedAt).not.toBeNull();
      });

      it("clears verificationError on success", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });
        const token = "avelero-verify-test-token-xyz";

        await createCustomDomain({
          brandId,
          domain: "passport.mybrand.org",
          status: "pending",
          verificationToken: token,
          verificationError: "Previous error",
        });

        setMockDnsResponse([[token]]);

        await callVerify(ctx);

        const dbDomain = await getCustomDomainFromDb(brandId);
        expect(dbDomain?.verificationError).toBeNull();
        expect(dbDomain?.status).toBe("verified");
      });

      it("handles multiple TXT records (one matches)", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });
        const token = "avelero-verify-test-token-xyz";

        await createCustomDomain({
          brandId,
          domain: "passport.mybrand.org",
          status: "pending",
          verificationToken: token,
        });

        // Return multiple records, one matches
        setMockDnsResponse([["other-record"], [token], ["another-record"]]);

        const result = await callVerify(ctx);

        expect(result.success).toBe(true);
        expect(result.status).toBe("verified");
      });
    });

    describe("failure cases", () => {
      it("keeps status as pending on DNS failure", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        await createCustomDomain({
          brandId,
          domain: "passport.mybrand.org",
          status: "pending",
        });

        // Mock DNS to return NXDOMAIN
        setMockDnsNotFound();

        const result = await callVerify(ctx);

        expect(result.success).toBe(false);
        expect(result.status).toBe("pending");
      });

      it("stores error message", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        await createCustomDomain({
          brandId,
          domain: "passport.mybrand.org",
          status: "pending",
        });

        setMockDnsNotFound();

        const result = await callVerify(ctx);

        expect(result.error).toBeDefined();

        const dbDomain = await getCustomDomainFromDb(brandId);
        expect(dbDomain?.verificationError).toBeDefined();
      });

      it("updates lastVerificationAttempt", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        await createCustomDomain({
          brandId,
          domain: "passport.mybrand.org",
          status: "pending",
        });

        setMockDnsNotFound();

        await callVerify(ctx);

        const dbDomain = await getCustomDomainFromDb(brandId);
        expect(dbDomain?.lastVerificationAttempt).toBeDefined();
      });

      it("keeps status as pending when token does not match", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        await createCustomDomain({
          brandId,
          domain: "passport.mybrand.org",
          status: "pending",
          verificationToken: "avelero-verify-expected-token",
        });

        // Return wrong token
        setMockDnsResponse([["avelero-verify-wrong-token"]]);

        const result = await callVerify(ctx);

        expect(result.success).toBe(false);
        expect(result.status).toBe("pending");
        expect(result.error).toContain("token does not match");
      });
    });

    describe("edge cases", () => {
      it("returns error when no domain configured", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        await expect(callVerify(ctx)).rejects.toThrow(
          "No custom domain is configured for your brand",
        );
      });

      it("returns error when already verified", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });

        await createCustomDomain({
          brandId,
          domain: "passport.mybrand.org",
          status: "verified",
          verifiedAt: new Date().toISOString(),
        });

        await expect(callVerify(ctx)).rejects.toThrow("Your domain is already verified");
      });

      it("allows retry on pending domain with previous error", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });
        const token = "avelero-verify-test-token-xyz";

        await createCustomDomain({
          brandId,
          domain: "passport.mybrand.org",
          status: "pending",
          verificationToken: token,
          verificationError: "Previous failure",
        });

        setMockDnsResponse([[token]]);

        const result = await callVerify(ctx);

        expect(result.success).toBe(true);
        expect(result.status).toBe("verified");
      });
    });

    describe("authorization", () => {
      it("allows brand owner", async () => {
        const ctx = createMockContext({ brandId, userId, userEmail });
        const token = "avelero-verify-test-token-xyz";

        await createCustomDomain({
          brandId,
          domain: "passport.mybrand.org",
          status: "pending",
          verificationToken: token,
        });

        setMockDnsResponse([[token]]);

        const result = await callVerify(ctx);

        expect(result.success).toBe(true);
      });

      it("denies brand member (non-owner)", async () => {
        // Create a member user (not owner)
        const memberEmail = "member@example.com";
        const memberId = await createTestUser(memberEmail);
        await createBrandMembership(memberId, brandId, "member");

        const ctx = createMockContext({ brandId, userId: memberId, userEmail: memberEmail });

        await createCustomDomain({
          brandId,
          domain: "passport.mybrand.org",
          status: "pending",
        });

        await expect(callVerify(ctx)).rejects.toThrow("You do not have the required role");
      });
    });
  });

  // ==========================================================================
  // customDomains.remove
  // ==========================================================================

  describe("customDomains.remove", () => {
    it("deletes pending domain", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      await createCustomDomain({
        brandId,
        domain: "passport.mybrand.org",
        status: "pending",
      });

      const result = await callRemove(ctx);

      expect(result.success).toBe(true);

      const dbDomain = await getCustomDomainFromDb(brandId);
      expect(dbDomain).toBeNull();
    });

    it("deletes verified domain", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      await createCustomDomain({
        brandId,
        domain: "passport.mybrand.org",
        status: "verified",
        verifiedAt: new Date().toISOString(),
      });

      const result = await callRemove(ctx);

      expect(result.success).toBe(true);

      const dbDomain = await getCustomDomainFromDb(brandId);
      expect(dbDomain).toBeNull();
    });

    it("deletes pending domain with verification error", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      await createCustomDomain({
        brandId,
        domain: "passport.mybrand.org",
        status: "pending",
        verificationError: "Some error",
      });

      const result = await callRemove(ctx);

      expect(result.success).toBe(true);

      const dbDomain = await getCustomDomainFromDb(brandId);
      expect(dbDomain).toBeNull();
    });

    it("returns error when no domain configured", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      await expect(callRemove(ctx)).rejects.toThrow(
        "No custom domain is configured for your brand",
      );
    });

    it("denies brand member (non-owner)", async () => {
      // Create a member user (not owner)
      const memberEmail = "member@example.com";
      const memberId = await createTestUser(memberEmail);
      await createBrandMembership(memberId, brandId, "member");

      const ctx = createMockContext({ brandId, userId: memberId, userEmail: memberEmail });

      await createCustomDomain({
        brandId,
        domain: "passport.mybrand.org",
        status: "pending",
      });

      await expect(callRemove(ctx)).rejects.toThrow("You do not have the required role");
    });

    it("allows domain to be reclaimed after removal", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });
      const domainName = "passport.mybrand.org";

      // Add domain
      await createCustomDomain({
        brandId,
        domain: domainName,
        status: "verified",
      });

      // Remove it
      await callRemove(ctx);

      // Should be able to add it again
      const result = await callAdd(ctx, { domain: domainName });

      expect(result.domain).toBe(domainName);
      expect(result.status).toBe("pending");
    });

    it("allows different brand to claim after removal", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });
      const domainName = "passport.mybrand.org";

      // Add domain to first brand
      await createCustomDomain({
        brandId,
        domain: domainName,
        status: "verified",
      });

      // Remove it
      await callRemove(ctx);

      // Create another brand
      const otherBrandId = await createTestBrand("Other Brand");
      const otherUserId = await createTestUser("other@example.com");
      await createBrandMembership(otherUserId, otherBrandId, "owner");

      const otherCtx = createMockContext({
        brandId: otherBrandId,
        userId: otherUserId,
        userEmail: "other@example.com",
      });

      // Other brand should be able to claim it
      const result = await callAdd(otherCtx, { domain: domainName });

      expect(result.domain).toBe(domainName);
    });
  });
});
