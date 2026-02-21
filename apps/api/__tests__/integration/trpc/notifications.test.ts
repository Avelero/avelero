// Load setup first (loads .env.test and configures cleanup)
import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { createNotification } from "@v1/db/queries/notifications";
import * as schema from "@v1/db/schema";
import {
  createTestBrand,
  createTestUser,
  testDb,
} from "@v1/db/testing";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";
import { notificationsRouter } from "../../../src/trpc/routers/notifications";

function createMockContext(options: {
  brandId: string;
  userId: string;
  userEmail: string | null;
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
    role: "owner" as const,
    db: testDb,
    loaders: {} as any,
    supabase: {} as any,
    supabaseAdmin: null,
    geo: { ip: null },
  };
}

describe("Notifications TRPC Router", () => {
  let brandId: string;
  let userId: string;
  let userEmail: string;
  let otherUserId: string;

  beforeEach(async () => {
    brandId = await createTestBrand("Notifications Router Brand");
    userEmail = `notifications-${Math.random().toString(36).substring(2, 8)}@example.com`;
    userId = await createTestUser(userEmail);
    otherUserId = await createTestUser(
      `notifications-other-${Math.random().toString(36).substring(2, 8)}@example.com`,
    );

    await testDb.insert(schema.brandMembers).values([
      { brandId, userId, role: "owner" },
      { brandId, userId: otherUserId, role: "member" },
    ]);
  });

  it("marks multiple notifications as seen and updates unread count", async () => {
    const ctx = createMockContext({ brandId, userId, userEmail });
    const caller = notificationsRouter.createCaller(ctx);

    const n1 = await createNotification(testDb, {
      userId,
      brandId,
      type: "import_success",
      title: "Import done",
      resourceType: "import_job",
      resourceId: crypto.randomUUID(),
    });

    const n2 = await createNotification(testDb, {
      userId,
      brandId,
      type: "export_ready",
      title: "Export ready",
      resourceType: "export_job",
      resourceId: crypto.randomUUID(),
    });

    await createNotification(testDb, {
      userId: otherUserId,
      brandId,
      type: "import_failure",
      title: "Other user notification",
      resourceType: "import_job",
      resourceId: crypto.randomUUID(),
    });

    const before = await caller.getUnreadCount();
    expect(before.count).toBe(2);

    const marked = await caller.markManyAsSeen({ ids: [n1.id, n2.id] });
    expect(marked.success).toBe(true);
    expect(marked.count).toBe(2);

    const after = await caller.getUnreadCount();
    expect(after.count).toBe(0);

    const recent = await caller.getRecent({
      limit: 20,
      unreadOnly: false,
      includeDismissed: false,
    });

    const seenIds = recent.notifications
      .filter((notification) => notification.seenAt !== null)
      .map((notification) => notification.id);
    expect(seenIds).toContain(n1.id);
    expect(seenIds).toContain(n2.id);
  });
});
