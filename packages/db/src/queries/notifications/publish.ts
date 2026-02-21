import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import type { Database } from "../../client";
import { getMembersByBrandId } from "../brand/members";
import { userNotifications } from "../../schema";
import { createNotificationsBulk } from "./notifications";
import {
  type NotificationEventKey,
  notificationEventDefinitions,
  type PublishNotificationInput,
} from "./event-definitions";

export interface PublishNotificationResult {
  created: number;
  recipients: string[];
}

/**
 * Publishes a notification event using audience rules from the event registry.
 */
export async function publishNotificationEvent<K extends NotificationEventKey>(
  db: Database,
  input: PublishNotificationInput<K>,
): Promise<PublishNotificationResult> {
  const definition = notificationEventDefinitions[input.event];
  const resolved = definition.resolve(input.payload);

  const recipients = await resolveRecipients(db, {
    audience: definition.audience,
    brandId: input.brandId,
    actorUserId: input.actorUserId ?? null,
  });

  if (recipients.length === 0) {
    return { created: 0, recipients: [] };
  }

  const existingRecipients = await findExistingActiveRecipients(db, {
    recipients,
    brandId: input.brandId,
    type: resolved.type,
    resourceType: resolved.resourceType,
    resourceId: resolved.resourceId,
  });

  const recipientsToCreate = recipients.filter(
    (userId) => !existingRecipients.has(userId),
  );

  if (recipientsToCreate.length === 0) {
    return { created: 0, recipients: [] };
  }

  const created = await createNotificationsBulk(
    db,
    recipientsToCreate.map((userId) => ({
      userId,
      brandId: input.brandId,
      type: resolved.type,
      title: resolved.title,
      message: resolved.message ?? null,
      resourceType: resolved.resourceType,
      resourceId: resolved.resourceId,
      actionUrl: resolved.actionUrl ?? null,
      actionData: resolved.actionData ?? null,
      expiresInMs: resolved.expiresInMs,
    })),
  );

  return {
    created: created.length,
    recipients: recipientsToCreate,
  };
}

async function resolveRecipients(
  db: Database,
  input: {
    audience: "actor_only" | "brand_members" | "brand_members_except_actor";
    brandId: string;
    actorUserId: string | null;
  },
): Promise<string[]> {
  if (input.audience === "actor_only") {
    return input.actorUserId ? [input.actorUserId] : [];
  }

  const members = await getMembersByBrandId(db, input.brandId);
  const memberIds = members.map((member) => member.userId);

  if (input.audience === "brand_members_except_actor" && input.actorUserId) {
    return memberIds.filter((id) => id !== input.actorUserId);
  }

  return memberIds;
}

async function findExistingActiveRecipients(
  db: Database,
  input: {
    recipients: string[];
    brandId: string;
    type: string;
    resourceType: string;
    resourceId: string;
  },
): Promise<Set<string>> {
  const rows = await db
    .select({ userId: userNotifications.userId })
    .from(userNotifications)
    .where(
      and(
        inArray(userNotifications.userId, input.recipients),
        eq(userNotifications.brandId, input.brandId),
        eq(userNotifications.type, input.type),
        eq(userNotifications.resourceType, input.resourceType),
        eq(userNotifications.resourceId, input.resourceId),
        isNull(userNotifications.dismissedAt),
        or(
          isNull(userNotifications.expiresAt),
          gt(userNotifications.expiresAt, new Date().toISOString()),
        ),
      ),
    );

  return new Set(rows.map((row) => row.userId));
}
