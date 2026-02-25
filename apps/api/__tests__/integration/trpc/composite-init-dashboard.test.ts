import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "@v1/db/queries";
import {
  createDefaultBrandControl,
  upsertBrandControl,
} from "@v1/db/queries/brand";
import * as schema from "@v1/db/schema";
import { createTestBrand, createTestUser, testDb } from "@v1/db/testing";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";
import { compositeRouter } from "../../../src/trpc/routers/composite";

function createMockContext(options: {
  userId: string;
  userEmail: string;
  brandId: string | null;
}): AuthenticatedTRPCContext {
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
    role: "owner",
    db: testDb,
    loaders: {} as any,
    supabase: {} as any,
    supabaseAdmin: null,
    geo: { ip: null },
  };
}

async function createMembership(
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

async function setUserActiveBrand(userId: string, brandId: string | null) {
  await testDb
    .update(schema.users)
    .set({ brandId })
    .where(eq(schema.users.id, userId));
}

describe("composite.initDashboard brand access bootstrap", () => {
  let userId: string;
  let userEmail: string;
  let brandId: string;

  beforeEach(async () => {
    userEmail = `phase3-${Math.random().toString(36).slice(2, 10)}@example.com`;
    userId = await createTestUser(userEmail);
    brandId = await createTestBrand("Phase 3 Access Brand");
  });

  it("returns allowed decision when brand is qualified and billing is active", async () => {
    await createMembership(userId, brandId, "owner");
    await setUserActiveBrand(userId, brandId);
    await upsertBrandControl(testDb, {
      brandId,
      qualificationStatus: "qualified",
      operationalStatus: "active",
      billingStatus: "active",
      planType: "starter",
    });

    const ctx = createMockContext({ userId, userEmail, brandId });
    const result = await compositeRouter.createCaller(ctx).initDashboard();

    expect(result.brandAccess.decision.code).toBe("allowed");
    expect(result.brandAccess.controlSnapshot?.planType).toBe("starter");
    expect(result.brandAccess.controlSnapshot?.billingStatus).toBe("active");
  });

  it("returns billing-blocked decision when payment is pending", async () => {
    await createMembership(userId, brandId, "owner");
    await setUserActiveBrand(userId, brandId);
    await upsertBrandControl(testDb, {
      brandId,
      qualificationStatus: "qualified",
      operationalStatus: "active",
      billingStatus: "pending_payment",
      planType: "growth",
    });

    const ctx = createMockContext({ userId, userEmail, brandId });
    const result = await compositeRouter.createCaller(ctx).initDashboard();

    expect(result.brandAccess.decision.code).toBe("blocked_pending_payment");
    expect(result.brandAccess.controlSnapshot?.billingStatus).toBe(
      "pending_payment",
    );
  });

  it("returns non-billing-blocked decision for suspended brands", async () => {
    await createMembership(userId, brandId, "owner");
    await setUserActiveBrand(userId, brandId);
    await upsertBrandControl(testDb, {
      brandId,
      qualificationStatus: "qualified",
      operationalStatus: "suspended",
      billingStatus: "active",
    });

    const ctx = createMockContext({ userId, userEmail, brandId });
    const result = await compositeRouter.createCaller(ctx).initDashboard();

    expect(result.brandAccess.decision.code).toBe("blocked_suspended");
  });

  it("returns blocked_no_active_brand when membership exists but no active brand is selected", async () => {
    await createMembership(userId, brandId, "owner");
    await createDefaultBrandControl(testDb, brandId);
    await setUserActiveBrand(userId, null);

    const ctx = createMockContext({ userId, userEmail, brandId: null });
    const result = await compositeRouter.createCaller(ctx).initDashboard();

    expect(result.brandAccess.decision.code).toBe("blocked_no_active_brand");
    expect(result.brandAccess.controlSnapshot).toBeNull();
  });

  it("returns blocked_no_membership when user has no brand memberships", async () => {
    await setUserActiveBrand(userId, null);

    const ctx = createMockContext({ userId, userEmail, brandId: null });
    const result = await compositeRouter.createCaller(ctx).initDashboard();

    expect(result.brandAccess.decision.code).toBe("blocked_no_membership");
    expect(result.brandAccess.controlSnapshot).toBeNull();
  });

  it("falls back to default brand control values when row is missing", async () => {
    await createMembership(userId, brandId, "owner");
    await setUserActiveBrand(userId, brandId);

    const ctx = createMockContext({ userId, userEmail, brandId });
    const result = await compositeRouter.createCaller(ctx).initDashboard();

    expect(result.brandAccess.controlSnapshot?.planCurrency).toBe("EUR");
    expect(result.brandAccess.controlSnapshot?.billingStatus).toBe("unconfigured");
    expect(result.brandAccess.decision.code).toBe("blocked_pending_qualification");
  });
});

