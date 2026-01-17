/**
 * Bulk Operations Utilities
 *
 * Utilities for handling bulk database operations.
 *
 * **Throttling Strategy:**
 * Database-level throttling is implemented in `realtime.broadcast_domain_changes()`.
 * This ensures only one broadcast per domain/brand_id per second, preventing:
 * - Client overload during bulk updates (1000+ rows)
 * - Supabase Realtime queue flooding
 * - Message backlog in realtime.messages table
 *
 * The `sendBulkBroadcast` function can still be used to send guaranteed notifications
 * at the end of batch operations (the database throttle will allow it through if
 * a second has passed since the last broadcast).
 *
 * @module bulk-operations
 */

import { sql } from "drizzle-orm";
import type { Database } from "../client";

/**
 * Broadcast payload for domain changes.
 * Sent once per batch instead of per-row.
 */
export interface BulkBroadcastPayload {
  /** Domain being updated (products, catalog, integrations, etc.) */
  domain: "products" | "catalog" | "integrations" | "team" | "jobs" | "theme";
  /** Brand ID the changes belong to */
  brandId: string;
  /** Operation type */
  operation: "BULK_INSERT" | "BULK_UPDATE" | "BULK_DELETE" | "BULK_SYNC";
  /** Summary of changes in this batch */
  summary: {
    /** Number of items created */
    created?: number;
    /** Number of items updated */
    updated?: number;
    /** Number of items deleted */
    deleted?: number;
    /** Total items affected */
    total: number;
  };
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * @deprecated No longer needed - database-level throttling handles this automatically.
 *
 * The `realtime.broadcast_domain_changes()` trigger function now includes
 * built-in throttling that limits broadcasts to 1 per domain/brand per second.
 *
 * This function is kept for backwards compatibility but does nothing useful
 * in a connection pool environment.
 *
 * @param _db - Database instance (unused)
 */
export async function disableTriggers(_db: Database): Promise<void> {
  // No-op: Database-level throttling handles this automatically
}

/**
 * @deprecated No longer needed - database-level throttling handles this automatically.
 *
 * @param _db - Database instance (unused)
 */
export async function enableTriggers(_db: Database): Promise<void> {
  // No-op: Database-level throttling handles this automatically
}

/**
 * Send a single broadcast message for bulk changes.
 *
 * This function sends a guaranteed broadcast message at the end of batch operations.
 * The database-level throttle will allow it through if a second has passed since
 * the last broadcast for this domain/brand.
 *
 * **Usage:** Call this at the end of each batch to ensure clients receive
 * a notification even if per-row triggers were throttled.
 *
 * @param db - Database instance
 * @param payload - Broadcast payload with change summary
 */
export async function sendBulkBroadcast(
  db: Database,
  payload: BulkBroadcastPayload,
): Promise<void> {
  const topic = `${payload.domain}:${payload.brandId}`;
  const event = payload.operation;

  // Use raw SQL to call realtime.send directly
  // This bypasses RLS and sends the message immediately
  await db.execute(sql`
    SELECT realtime.send(
      ${JSON.stringify(payload)}::jsonb,
      ${event}::text,
      ${topic}::text,
      true
    )
  `);
}

/**
 * @deprecated No longer recommended - database-level throttling handles rate limiting automatically.
 *
 * This wrapper is kept for backwards compatibility. For new code, simply:
 * 1. Perform your bulk operations normally (triggers are auto-throttled)
 * 2. Call sendBulkBroadcast at the end if you want a guaranteed notification
 *
 * @param db - Database instance
 * @param payload - Broadcast payload describing the changes
 * @param operation - Async function containing the bulk operations
 * @returns Result of the operation function
 */
export async function withBulkOperation<T>(
  db: Database,
  payload: BulkBroadcastPayload,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    const result = await operation();
    return result;
  } finally {
    // Send consolidated broadcast
    try {
      await sendBulkBroadcast(db, payload);
    } catch (broadcastError) {
      // Log but don't throw - the main operation may have succeeded
      console.warn(
        "[withBulkOperation] Failed to send broadcast:",
        broadcastError,
      );
    }
  }
}
