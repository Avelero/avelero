import { desc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../client";
import { platformAdminAuditLogs } from "../../schema";

export const PLATFORM_ADMIN_AUDIT_TARGET_TYPES = [
  "brand",
  "brand_member",
  "brand_invite",
  "billing",
  "billing_link",
  "system",
] as const;

export type PlatformAdminAuditTargetType =
  (typeof PLATFORM_ADMIN_AUDIT_TARGET_TYPES)[number];

type JsonRecord = Record<string, unknown>;

export async function insertPlatformAdminAuditLog(
  db: DatabaseOrTransaction,
  input: {
    actorUserId?: string | null;
    actorEmail: string;
    action: string;
    targetType: PlatformAdminAuditTargetType;
    targetId?: string | null;
    brandId?: string | null;
    metadata?: JsonRecord;
  },
) {
  const [row] = await db
    .insert(platformAdminAuditLogs)
    .values({
      actorUserId: input.actorUserId ?? null,
      actorEmail: input.actorEmail,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      brandId: input.brandId ?? null,
      metadata: input.metadata ?? {},
    })
    .returning({
      id: platformAdminAuditLogs.id,
      createdAt: platformAdminAuditLogs.createdAt,
    });

  if (!row) throw new Error("Failed to insert platform admin audit log");
  return row;
}

export async function listPlatformAdminAuditLogsByBrand(
  db: DatabaseOrTransaction,
  brandId: string,
  limit = 50,
) {
  const safeLimit = Math.max(1, Math.min(limit, 200));

  return db
    .select()
    .from(platformAdminAuditLogs)
    .where(eq(platformAdminAuditLogs.brandId, brandId))
    .orderBy(desc(platformAdminAuditLogs.createdAt))
    .limit(safeLimit);
}

