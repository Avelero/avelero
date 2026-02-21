// Load setup first (loads .env.test and configures cleanup)
import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import {
  getUnreadNotificationCount,
  publishNotificationEvent,
} from "@v1/db/queries/notifications";
import { eq } from "drizzle-orm";
import * as schema from "@v1/db/schema";
import { createTestBrand, createTestUser, testDb } from "@v1/db/testing";

describe("Notifications Publish", () => {
  let brandId: string;
  let ownerUserId: string;
  let memberUserId: string;
  let newMemberUserId: string;

  beforeEach(async () => {
    brandId = await createTestBrand("Notifications Publish Brand");
    ownerUserId = await createTestUser(
      `owner-${Math.random().toString(36).substring(2, 8)}@example.com`,
    );
    memberUserId = await createTestUser(
      `member-${Math.random().toString(36).substring(2, 8)}@example.com`,
    );
    newMemberUserId = await createTestUser(
      `new-member-${Math.random().toString(36).substring(2, 8)}@example.com`,
    );

    await testDb.insert(schema.brandMembers).values([
      { brandId, userId: ownerUserId, role: "owner" },
      { brandId, userId: memberUserId, role: "member" },
      { brandId, userId: newMemberUserId, role: "member" },
    ]);
  });

  it("fans out brand-level import notifications to all members", async () => {
    const result = await publishNotificationEvent(testDb, {
      event: "import_success",
      brandId,
      actorUserId: ownerUserId,
      payload: {
        jobId: crypto.randomUUID(),
        productsCreated: 4,
        productsUpdated: 2,
        totalProcessed: 6,
      },
    });

    expect(result.created).toBe(3);
    expect(result.recipients.sort()).toEqual(
      [ownerUserId, memberUserId, newMemberUserId].sort(),
    );

    expect(
      await getUnreadNotificationCount(testDb, ownerUserId, brandId),
    ).toBe(1);
    expect(
      await getUnreadNotificationCount(testDb, memberUserId, brandId),
    ).toBe(1);
    expect(
      await getUnreadNotificationCount(testDb, newMemberUserId, brandId),
    ).toBe(1);
  });

  it("sends actor-only export notifications to only the triggering user", async () => {
    const result = await publishNotificationEvent(testDb, {
      event: "export_ready",
      brandId,
      actorUserId: ownerUserId,
      payload: {
        jobId: crypto.randomUUID(),
        productsExported: 12,
        downloadUrl: "https://example.com/export.xlsx",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        filename: "export.xlsx",
      },
    });

    expect(result.created).toBe(1);
    expect(result.recipients).toEqual([ownerUserId]);

    const rows = await testDb
      .select({
        userId: schema.userNotifications.userId,
      })
      .from(schema.userNotifications)
      .where(eq(schema.userNotifications.type, "export_ready"));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.userId).toBe(ownerUserId);
  });

  it("deduplicates active notifications by user + type + resource", async () => {
    const jobId = crypto.randomUUID();

    const first = await publishNotificationEvent(testDb, {
      event: "export_ready",
      brandId,
      actorUserId: ownerUserId,
      payload: {
        jobId,
        productsExported: 3,
        downloadUrl: "https://example.com/export.xlsx",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        filename: "export.xlsx",
      },
    });

    const second = await publishNotificationEvent(testDb, {
      event: "export_ready",
      brandId,
      actorUserId: ownerUserId,
      payload: {
        jobId,
        productsExported: 3,
        downloadUrl: "https://example.com/export.xlsx",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        filename: "export.xlsx",
      },
    });

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);

    const rows = await testDb
      .select({ id: schema.userNotifications.id })
      .from(schema.userNotifications)
      .where(
        eq(schema.userNotifications.resourceId, jobId),
      );

    expect(rows).toHaveLength(1);
  });

  it("excludes the accepted member for invite accepted events", async () => {
    const inviteId = crypto.randomUUID();

    const result = await publishNotificationEvent(testDb, {
      event: "invite_accepted",
      brandId,
      actorUserId: newMemberUserId,
      payload: {
        inviteId,
        acceptedUserId: newMemberUserId,
        acceptedUserEmail: "accepted@example.com",
        acceptedUserName: "Accepted User",
        brandName: "Test Brand",
      },
    });

    expect(result.created).toBe(2);
    expect(result.recipients.sort()).toEqual(
      [ownerUserId, memberUserId].sort(),
    );
    expect(result.recipients).not.toContain(newMemberUserId);
  });
});
