/**
 * DataLoader utilities for efficient batch loading and caching.
 *
 * Implements the DataLoader pattern to solve N+1 query problems by:
 * - Batching multiple individual loads into a single database query
 * - Caching results within a single request context
 * - Deduplicating identical requests
 *
 * @module dataloader
 */

import type { Database } from "@v1/db/client";
import { eq, inArray } from "@v1/db/queries";
import { brandMembers, brands, users } from "@v1/db/schema";
import DataLoader from "dataloader";

/**
 * User record shape returned by dataloader queries.
 */
export interface UserRecord {
  readonly id: string;
  readonly email: string | null;
  readonly fullName: string | null;
  readonly avatarPath: string | null;
  readonly brandId: string | null;
}

/**
 * Brand record shape returned by dataloader queries.
 */
export interface BrandRecord {
  readonly id: string;
  readonly name: string;
  readonly email: string | null;
  readonly logoPath: string | null;
  readonly countryCode: string | null;
}

/**
 * Brand membership record shape with computed next brand.
 */
export interface NextBrandRecord {
  readonly userId: string;
  readonly nextBrandId: string | null;
}

/**
 * Collection of all dataloaders available in tRPC context.
 *
 * Each dataloader batches requests within a single request cycle,
 * preventing N+1 query problems in resolver functions.
 */
export interface DataLoaders {
  /** Batch load users by ID. */
  readonly userById: DataLoader<string, UserRecord | null>;
  /** Batch load brands by ID. */
  readonly brandById: DataLoader<string, BrandRecord | null>;
  /** Batch compute next brand for users when excluding a specific brand. */
  readonly nextBrandForUser: DataLoader<
    { userId: string; excludeBrandId: string | null },
    string | null
  >;
}

/**
 * Creates a dataloader that batch-fetches users by ID.
 *
 * Groups multiple user lookups into a single query using `inArray`,
 * then maps results back to the requested order.
 *
 * @param db - Drizzle database instance.
 * @returns DataLoader configured for user lookups.
 */
function createUserByIdLoader(
  db: Database,
): DataLoader<string, UserRecord | null> {
  return new DataLoader<string, UserRecord | null>(
    async (userIds: readonly string[]): Promise<Array<UserRecord | null>> => {
      try {
        const rows = await db
          .select({
            id: users.id,
            email: users.email,
            fullName: users.fullName,
            avatarPath: users.avatarPath,
            brandId: users.brandId,
          })
          .from(users)
          .where(inArray(users.id, [...userIds]));

        const userMap = new Map<string, UserRecord>(
          rows.map((row) => [row.id, row]),
        );

        return userIds.map((id) => userMap.get(id) ?? null);
      } catch (error) {
        // Handle RLS policy errors gracefully
        console.warn("[userById dataloader] Query failed:", error);
        // Return null for all requested IDs
        return userIds.map(() => null);
      }
    },
    {
      // Cache for request duration to prevent redundant queries
      cache: true,
      // Batch window: collect requests for 10ms before executing
      batchScheduleFn: (callback: () => void) => setTimeout(callback, 10),
    },
  );
}

/**
 * Creates a dataloader that batch-fetches brands by ID.
 *
 * Groups multiple brand lookups into a single query using `inArray`,
 * maintaining correct ordering for the caller.
 *
 * @param db - Drizzle database instance.
 * @returns DataLoader configured for brand lookups.
 */
function createBrandByIdLoader(
  db: Database,
): DataLoader<string, BrandRecord | null> {
  return new DataLoader<string, BrandRecord | null>(
    async (brandIds: readonly string[]): Promise<Array<BrandRecord | null>> => {
      const rows = await db
        .select({
          id: brands.id,
          name: brands.name,
          email: brands.email,
          logoPath: brands.logoPath,
          countryCode: brands.countryCode,
        })
        .from(brands)
        .where(inArray(brands.id, [...brandIds]));

      const brandMap = new Map<string, BrandRecord>(
        rows.map((row) => [row.id, row]),
      );

      return brandIds.map((id) => brandMap.get(id) ?? null);
    },
    {
      cache: true,
      batchScheduleFn: (callback: () => void) => setTimeout(callback, 10),
    },
  );
}

/**
 * Creates a dataloader that computes the next brand for users.
 *
 * This solves the N+1 problem in `deleteBrand` where we compute the next
 * active brand for multiple users. Batches all user lookups into a single
 * query with proper filtering.
 *
 * @param db - Drizzle database instance.
 * @returns DataLoader configured for next brand computation.
 */
function createNextBrandForUserLoader(
  db: Database,
): DataLoader<
  { userId: string; excludeBrandId: string | null },
  string | null
> {
  return new DataLoader<
    { userId: string; excludeBrandId: string | null },
    string | null,
    string
  >(
    async (
      keys: readonly { userId: string; excludeBrandId: string | null }[],
    ): Promise<Array<string | null>> => {
      // Extract unique user IDs for batch query
      const uniqueUserIds = keys.map((k) => k.userId);
      const userIds = Array.from(new Set(uniqueUserIds));

      // Fetch all brand memberships for these users in one query
      const memberships = await db
        .select({
          userId: brandMembers.userId,
          brandId: brandMembers.brandId,
          brandName: brands.name,
        })
        .from(brandMembers)
        .leftJoin(brands, eq(brandMembers.brandId, brands.id))
        .where(inArray(brandMembers.userId, userIds))
        .orderBy(brands.name);

      // Group memberships by user ID
      const membershipsByUser = new Map<
        string,
        Array<{ brandId: string; brandName: string | null }>
      >();

      for (const m of memberships) {
        if (!membershipsByUser.has(m.userId)) {
          membershipsByUser.set(m.userId, []);
        }
        membershipsByUser.get(m.userId)!.push({
          brandId: m.brandId,
          brandName: m.brandName,
        });
      }

      // For each key, find the first brand that is not excluded
      return keys.map((key) => {
        const userMemberships = membershipsByUser.get(key.userId) ?? [];
        const filtered = userMemberships.filter(
          (m) => m.brandId !== key.excludeBrandId,
        );
        // Return first alphabetically (already sorted by name)
        return filtered[0]?.brandId ?? null;
      });
    },
    {
      cache: true,
      batchScheduleFn: (callback: () => void) => setTimeout(callback, 10),
      // Custom cache key function since we're using objects
      cacheKeyFn: (key: { userId: string; excludeBrandId: string | null }) =>
        `${key.userId}:${key.excludeBrandId ?? "null"}`,
    },
  );
}

/**
 * Initializes all dataloaders for the current request context.
 *
 * Creates a fresh set of dataloaders scoped to a single tRPC request,
 * ensuring proper batching and caching boundaries.
 *
 * @param db - Drizzle database instance from tRPC context.
 * @returns Object containing all configured dataloaders.
 */
export function createDataLoaders(db: Database): DataLoaders {
  return {
    userById: createUserByIdLoader(db),
    brandById: createBrandByIdLoader(db),
    nextBrandForUser: createNextBrandForUserLoader(db),
  };
}
