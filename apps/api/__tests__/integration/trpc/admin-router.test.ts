import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { and, eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { createTestUser, testDb } from "@v1/db/testing";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";

process.env.INTERNAL_API_KEY ??= "test-internal-api-key";

import { appRouter } from "../../../src/trpc/routers/_app";

function createMockContext(options: {
  userId: string;
  userEmail: string;
  brandId?: string | null;
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
    brandId: options.brandId ?? null,
    role: null,
    db: testDb,
    loaders: {} as any,
    supabase: {} as any,
    supabaseAdmin: null,
    geo: { ip: null },
  };
}

describe("admin.* TRPC router", () => {
  let adminUserId: string;
  let adminEmail: string;
  let nonAdminUserId: string;
  let nonAdminEmail: string;

  beforeEach(async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    adminEmail = `admin-${suffix}@example.com`;
    nonAdminEmail = `member-${suffix}@example.com`;
    process.env.PLATFORM_ADMIN_EMAILS = adminEmail;

    adminUserId = await createTestUser(adminEmail);
    nonAdminUserId = await createTestUser(nonAdminEmail);
  });

  it("blocks non-platform-admin users", async () => {
    const caller = appRouter.createCaller(
      createMockContext({
        userId: nonAdminUserId,
        userEmail: nonAdminEmail,
      }),
    );

    await expect(caller.admin.brands.list({})).rejects.toThrow(
      "Platform admin access required",
    );
  });

  it("creates a brand with default control and owner membership, and writes audit log", async () => {
    const caller = appRouter.createCaller(
      createMockContext({
        userId: adminUserId,
        userEmail: adminEmail,
      }),
    );

    const created = await caller.admin.brands.create({
      name: "Admin Provisioned Brand",
      slug: null,
      email: "ops@example.com",
      country_code: "NL",
      logo_url: null,
    });

    expect(created.success).toBe(true);
    expect(created.brand_id).toBeString();

    const [membership] = await testDb
      .select({
        role: schema.brandMembers.role,
      })
      .from(schema.brandMembers)
      .where(
        and(
          eq(schema.brandMembers.brandId, created.brand_id),
          eq(schema.brandMembers.userId, adminUserId),
        ),
      )
      .limit(1);

    expect(membership?.role).toBe("owner");

    const [controlRow] = await testDb
      .select({
        brandId: schema.brandControl.brandId,
      })
      .from(schema.brandControl)
      .where(eq(schema.brandControl.brandId, created.brand_id))
      .limit(1);

    expect(controlRow?.brandId).toBe(created.brand_id);

    const [auditLog] = await testDb
      .select({
        action: schema.platformAdminAuditLogs.action,
      })
      .from(schema.platformAdminAuditLogs)
      .where(eq(schema.platformAdminAuditLogs.brandId, created.brand_id))
      .limit(1);

    expect(auditLog?.action).toBe("admin.brand.created");
  });

  it("updates brand control with validation and writes audit log", async () => {
    const caller = appRouter.createCaller(
      createMockContext({
        userId: adminUserId,
        userEmail: adminEmail,
      }),
    );

    const created = await caller.admin.brands.create({
      name: "Control Update Brand",
      slug: null,
      email: null,
      country_code: null,
      logo_url: null,
    });

    await expect(
      caller.admin.brands.updateControl({
        brand_id: created.brand_id,
        plan_type: "custom",
      }),
    ).rejects.toThrow("Custom plan requires custom_monthly_price_cents");

    const updated = await caller.admin.brands.updateControl({
      brand_id: created.brand_id,
      qualification_status: "qualified",
      operational_status: "active",
      billing_status: "pending_payment",
      billing_mode: "enterprise_invoice",
      billing_access_override: "temporary_allow",
      plan_type: "custom",
      custom_monthly_price_cents: 45000,
      plan_currency: "usd",
    });

    expect(updated.success).toBe(true);
    expect(updated.control.plan_type).toBe("custom");
    expect(updated.control.custom_monthly_price_cents).toBe(45000);
    expect(updated.control.plan_currency).toBe("USD");

    const [controlRow] = await testDb
      .select({
        planType: schema.brandControl.planType,
        customMonthlyPriceCents: schema.brandControl.customMonthlyPriceCents,
        qualificationStatus: schema.brandControl.qualificationStatus,
        billingStatus: schema.brandControl.billingStatus,
      })
      .from(schema.brandControl)
      .where(eq(schema.brandControl.brandId, created.brand_id))
      .limit(1);

    expect(controlRow?.planType).toBe("custom");
    expect(controlRow?.customMonthlyPriceCents).toBe(45000);
    expect(controlRow?.qualificationStatus).toBe("qualified");
    expect(controlRow?.billingStatus).toBe("pending_payment");

    const logs = await testDb
      .select({
        action: schema.platformAdminAuditLogs.action,
      })
      .from(schema.platformAdminAuditLogs)
      .where(eq(schema.platformAdminAuditLogs.brandId, created.brand_id));

    expect(logs.some((log) => log.action === "admin.brand.control_updated")).toBe(
      true,
    );
  });

  it("adds and removes members and enforces sole-owner protection", async () => {
    const caller = appRouter.createCaller(
      createMockContext({
        userId: adminUserId,
        userEmail: adminEmail,
      }),
    );

    const created = await caller.admin.brands.create({
      name: "Member Management Brand",
      slug: null,
      email: null,
      country_code: null,
      logo_url: null,
    });

    await expect(
      caller.admin.members.remove({
        brand_id: created.brand_id,
        user_id: adminUserId,
      }),
    ).rejects.toThrow("sole owner");

    const secondOwnerEmail = `owner-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const secondOwnerUserId = await createTestUser(secondOwnerEmail);

    const added = await caller.admin.members.add({
      brand_id: created.brand_id,
      email: secondOwnerEmail,
      role: "owner",
    });

    expect(added.success).toBe(true);
    expect(added.member.user_id).toBe(secondOwnerUserId);

    await expect(
      caller.admin.members.add({
        brand_id: created.brand_id,
        email: secondOwnerEmail,
        role: "owner",
      }),
    ).rejects.toThrow("already exists");

    const removed = await caller.admin.members.remove({
      brand_id: created.brand_id,
      user_id: adminUserId,
    });

    expect(removed.success).toBe(true);
    expect(removed.next_brand_id).toBeNull();

    const [adminUserRow] = await testDb
      .select({ brandId: schema.users.brandId })
      .from(schema.users)
      .where(eq(schema.users.id, adminUserId))
      .limit(1);

    expect(adminUserRow?.brandId).toBeNull();
  });

  it("sends/revokes invites and lists brand/audit data", async () => {
    const caller = appRouter.createCaller(
      createMockContext({
        userId: adminUserId,
        userEmail: adminEmail,
      }),
    );

    const created = await caller.admin.brands.create({
      name: "Invite Ops Brand",
      slug: null,
      email: null,
      country_code: null,
      logo_url: null,
    });

    const invitedEmail = `invite-${Math.random().toString(36).slice(2, 8)}@example.com`;

    const sendResult = await caller.admin.invites.send({
      brand_id: created.brand_id,
      email: invitedEmail,
      role: "member",
    });

    expect(sendResult.success).toBe(true);
    expect(sendResult.results.length).toBe(1);

    const [inviteRow] = await testDb
      .select({
        id: schema.brandInvites.id,
      })
      .from(schema.brandInvites)
      .where(
        and(
          eq(schema.brandInvites.brandId, created.brand_id),
          eq(schema.brandInvites.email, invitedEmail),
        ),
      )
      .limit(1);

    expect(inviteRow?.id).toBeDefined();

    const detail = await caller.admin.brands.get({ brand_id: created.brand_id });
    expect(detail.pending_invites.length).toBe(1);

    const list = await caller.admin.brands.list({ search: "Invite Ops" });
    expect(list.total).toBe(1);
    expect(list.items[0]?.pending_invite_count).toBe(1);

    await caller.admin.invites.revoke({ invite_id: inviteRow!.id });

    const [inviteAfterRevoke] = await testDb
      .select({ id: schema.brandInvites.id })
      .from(schema.brandInvites)
      .where(eq(schema.brandInvites.id, inviteRow!.id))
      .limit(1);

    expect(inviteAfterRevoke).toBeUndefined();

    const logs = await caller.admin.audit.list({
      brand_id: created.brand_id,
      limit: 20,
    });

    const actions = logs.map((log) => log.action);
    expect(actions).toContain("admin.invite.sent");
    expect(actions).toContain("admin.invite.revoked");
  });
});
