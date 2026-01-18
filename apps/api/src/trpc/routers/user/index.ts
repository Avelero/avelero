import { TRPCError } from "@trpc/server";
/**
 * User domain router for the reorganized API surface.
 *
 * Implements the `user.*` namespace described in
 * `docs/NEW_API_ENDPOINTS.txt`, covering profile reads/updates, account
 * deletion, invite inbox retrieval, and brand management.
 *
 * Phase 3 additions:
 * - user.invites.accept/reject - Accept or reject brand invites
 * - user.brands.list/create/leave/setActive - Manage user's brand memberships
 */
import {
  acceptBrandInvite,
  createBrand,
  declineBrandInvite,
  getBrandsByUserId,
  getOwnerCountsByBrandIds,
  isSlugTaken,
  leaveBrand,
  listPendingInvitesForEmail,
  setActiveBrand,
} from "@v1/db/queries/brand";
import type { UserInviteSummaryRow } from "@v1/db/queries/brand";
import {
  deleteUser,
  getUserById,
  isEmailTaken,
  updateUser,
} from "@v1/db/queries/user";
import { logger } from "@v1/logger";
import { getAppUrl } from "@v1/utils/envs";
import { brandCreateSchema } from "../../../schemas/brand.js";
import {
  brandLeaveSchema,
  brandSetActiveSchema,
  inviteAcceptSchema,
  inviteRejectSchema,
  userDomainUpdateSchema,
} from "../../../schemas/user.js";
import {
  badRequest,
  internalServerError,
  soleOwnerError,
  unauthorized,
  wrapError,
} from "../../../utils/errors.js";
import { createSuccessResponse } from "../../../utils/response.js";
import { createTRPCRouter, protectedProcedure } from "../../init.js";

interface MinimalUserRecord {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarPath: string | null;
  brandId: string | null;
}

/**
 * Constructs a publicly accessible URL for a user avatar.
 *
 * @param path - Relative storage path (e.g., "user-123/avatar.png")
 * @returns Full URL to avatar, or null if no path provided
 */
function buildUserAvatarUrl(path: string | null): string | null {
  if (!path) return null;
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${getAppUrl()}/api/storage/avatars/${encoded}`;
}

/**
 * Extracts storage path from a URL or returns the input if already a path.
 *
 * @param urlOrPath - Full URL or storage path
 * @returns Storage path (e.g., "user-123/avatar.png")
 */
function extractAvatarPath(
  urlOrPath: string | null | undefined,
): string | null {
  if (!urlOrPath) return null;

  // If it's already a storage path (no protocol, doesn't start with /), return as-is
  if (!/^https?:\/\//i.test(urlOrPath) && !urlOrPath.startsWith("/")) {
    return urlOrPath;
  }

  // Extract from full URL or path: /api/storage/avatars/user-id/file.jpg -> user-id/file.jpg
  const match = urlOrPath.match(/\/api\/storage\/avatars\/(.+)$/);
  if (match?.[1]) {
    // Decode each segment to handle URL encoding
    return match[1]
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  }

  // Fallback: return as-is
  return urlOrPath;
}

/**
 * Constructs a publicly accessible URL for a brand logo.
 *
 * @param path - Relative storage path (e.g., "brand-123/logo.png")
 * @returns Full URL to logo, or null if no path provided
 */
function buildBrandLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const encoded = path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${getAppUrl()}/api/storage/brand-avatars/${encoded}`;
}

function mapUserProfile(
  record: MinimalUserRecord,
  fallbackEmail: string | null,
) {
  const email = record.email ?? fallbackEmail;
  if (!email) {
    throw internalServerError(
      "Authenticated user record is missing an email address",
    );
  }

  return {
    id: record.id,
    email,
    full_name: record.fullName ?? null,
    avatar_url: buildUserAvatarUrl(record.avatarPath),
    brand_id: record.brandId ?? null,
  };
}

function mapInvite(invite: UserInviteSummaryRow) {
  return {
    id: invite.id,
    brand_id: invite.brandId ?? null,
    brand_name: invite.brandName,
    brand_logo: buildBrandLogoUrl(invite.brandLogoPath),
    role: invite.role,
    invited_by: invite.invitedByFullName ?? invite.invitedByEmail ?? null,
    invited_by_avatar_url: buildUserAvatarUrl(invite.invitedByAvatarPath),
    created_at: invite.createdAt,
    expires_at: invite.expiresAt,
  };
}

export const userRouter = createTRPCRouter({
  /**
   * Retrieves the profile of the currently authenticated user.
   *
   * @returns The normalized profile or `null` when no application record exists.
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const { db, user } = ctx;
    const profile = await getUserById(db, user.id);
    if (!profile) return null;
    return mapUserProfile(profile, user.email ?? null);
  }),

  /**
   * Updates the caller's profile with the provided payload.
   *
   * Supports changing the display name and avatar URL, allowing fields to be
   * explicitly cleared by passing `null`.
   *
   * **Email changes** are synchronized with Supabase Auth:
   * 1. Validates format and checks uniqueness
   * 2. Updates Supabase Auth first (triggers verification email)
   * 3. Only updates app DB after auth update succeeds
   * 4. Rolls back on failure to maintain consistency
   */
  update: protectedProcedure
    .input(userDomainUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      // Ensure we have a valid authenticated user
      if (!user) {
        throw unauthorized("Authentication required to update profile");
      }

      const payload: {
        email?: string;
        fullName?: string | null;
        avatarPath?: string | null;
      } = {};

      // Handle email sync to users table
      // Note: Supabase Auth email is already updated via OTP verification flow
      // This simply syncs the new email to our application database
      if (input.email !== undefined && input.email !== null) {
        const newEmail = input.email.trim().toLowerCase();

        // Validate email format (already validated by Zod, but double-check)
        if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
          throw badRequest("Invalid email format");
        }

        // Check if email is already taken by another user in our DB
        const emailTaken = await isEmailTaken(db, newEmail, user.id);
        if (emailTaken) {
          throw badRequest(
            "Email address is already in use by another account",
          );
        }

        // Set email for DB update - auth is already updated via OTP flow
        payload.email = newEmail;

        logger.info(
          {
            userId: user.id,
            newEmail,
          },
          "Syncing email to application database",
        );
      }

      // Handle other profile fields
      if (input.full_name !== undefined) {
        payload.fullName = input.full_name;
      }
      if (input.avatar_url !== undefined) {
        // Extract storage path from URL if needed, otherwise use as-is
        payload.avatarPath = extractAvatarPath(input.avatar_url);
      }

      // If no changes, return current profile
      if (Object.keys(payload).length === 0) {
        const existing = await getUserById(db, user.id);
        if (!existing) return null;
        return mapUserProfile(existing, user.email ?? null);
      }

      // Apply updates to application database
      try {
        const updated = await updateUser(db, {
          id: user.id,
          ...payload,
        });

        if (!updated) {
          logger.error(
            {
              userId: user.id,
              payload,
            },
            "User update returned null",
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to update user profile",
          });
        }

        logger.info(
          {
            userId: user.id,
            updatedFields: Object.keys(payload),
          },
          "User profile updated successfully",
        );

        return mapUserProfile(updated, user.email ?? null);
      } catch (error) {
        logger.error(
          {
            userId: user.id,
            error: error instanceof Error ? error.message : String(error),
            payload,
          },
          "Failed to update user in application database",
        );

        // If we already updated auth but DB update failed, log critical error
        if (payload.email) {
          logger.error(
            {
              userId: user.id,
              newEmail: payload.email,
              error: error instanceof Error ? error.message : String(error),
            },
            "CRITICAL: Email updated in Auth but DB update failed",
          );
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message:
              "Email was updated in authentication system but profile sync failed. Please contact support.",
            cause: error,
          });
        }

        throw wrapError(error, "Failed to update user profile");
      }
    }),

  /**
   * Deletes the caller's account, associated assets, and Supabase auth user.
   *
   * The application record is removed before cascading to Supabase auth to
   * avoid orphaned data.
   */
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    const { db, supabaseAdmin, user } = ctx;

    try {
      if (supabaseAdmin) {
        const { data: files } = await supabaseAdmin.storage
          .from("avatars")
          .list(user.id);
        if (files && files.length > 0) {
          const filePaths = files.map((file) => `${user.id}/${file.name}`);
          const { error: removeError } = await supabaseAdmin.storage
            .from("avatars")
            .remove(filePaths);
          if (removeError) {
            throw internalServerError(
              `Failed to delete avatar files: ${removeError.message}`,
              removeError,
            );
          }
        }
      }

      const appDeleted = await deleteUser(db, user.id);

      if (supabaseAdmin) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (error) {
          throw internalServerError(
            `Failed to delete auth user: ${error.message}`,
            error,
          );
        }
      }

      return appDeleted ?? { id: user.id };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("Service key not configured") ||
          error.message.includes("Supabase admin client not configured"))
      ) {
        throw internalServerError(
          "Supabase admin client is not configured to delete users",
          error,
        );
      }
      throw wrapError(error, "Failed to delete user account");
    }
  }),

  invites: createTRPCRouter({
    /**
     * Lists invites sent to the current user's email address.
     *
     * The list is independent of any active brand context and only reflects
     * pending invites that have not expired.
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const { db, user } = ctx;
      const email = user.email;
      if (!email) {
        throw unauthorized("Email address required to fetch invites");
      }
      const invites = await listPendingInvitesForEmail(db, email);
      return invites.map(mapInvite);
    }),

    /**
     * Accepts an invite to join a brand.
     * Moved from workflow.invites.respond(action="accept").
     */
    accept: protectedProcedure
      .input(inviteAcceptSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, user } = ctx;
        try {
          const res = await acceptBrandInvite(db, {
            id: input.invite_id,
            userId: user.id,
          });
          logger.info(
            {
              userId: user.id,
              inviteId: input.invite_id,
              brandId: res.brandId,
            },
            "Brand invite accepted",
          );
          return { success: true as const, brandId: res.brandId };
        } catch (error) {
          throw wrapError(error, "Failed to accept brand invite");
        }
      }),

    /**
     * Rejects an invite to join a brand.
     * Moved from workflow.invites.respond(action="decline").
     */
    reject: protectedProcedure
      .input(inviteRejectSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, user } = ctx;
        const email = user.email;
        if (!email) {
          throw internalServerError(
            "Authenticated user record is missing an email address",
          );
        }
        try {
          await declineBrandInvite(db, { id: input.invite_id, email });
          logger.info(
            {
              userId: user.id,
              inviteId: input.invite_id,
            },
            "Brand invite rejected",
          );
          return { success: true as const };
        } catch (error) {
          throw wrapError(error, "Failed to reject brand invite");
        }
      }),
  }),

  /**
   * Brand management for the current user.
   * Moved from workflow.list, workflow.create, workflow.members.update (leave case).
   */
  brands: createTRPCRouter({
    /**
     * Lists the user's brand memberships.
     * Moved from workflow.list.
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const { db, user } = ctx;
      const memberships = await getBrandsByUserId(db, user.id);
      if (memberships.length === 0) return [];

      const ownerBrandIds = memberships
        .filter((brand) => brand.role === "owner")
        .map((brand) => brand.id);

      // Use standardized query function to get owner counts
      const ownerCounts = await getOwnerCountsByBrandIds(db, ownerBrandIds);

      return memberships.map((membership) => {
        const ownerCount = ownerCounts.get(membership.id) ?? 1;
        return {
          id: membership.id,
          name: membership.name,
          slug: membership.slug ?? null,
          email: membership.email ?? null,
          country_code: membership.country_code ?? null,
          logo_url: buildBrandLogoUrl(membership.logo_path ?? null),
          role: membership.role,
          canLeave: canLeaveFromRole(membership.role, ownerCount),
        };
      });
    }),

    /**
     * Creates a new brand with the current user as owner.
     * Moved from workflow.create.
     */
    create: protectedProcedure
      .input(brandCreateSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, user } = ctx;

        // Validate slug uniqueness if provided
        if (input.slug) {
          const taken = await isSlugTaken(db, input.slug);
          if (taken) {
            throw badRequest("This slug is already taken");
          }
        }

        const payload = {
          name: input.name,
          slug: input.slug ?? null,
          email: input.email ?? user.email ?? null,
          country_code: input.country_code ?? null,
          logo_path: extractStoragePath(input.logo_url),
        };

        try {
          const result = await createBrand(db, user.id, payload);
          logger.info(
            {
              userId: user.id,
              brandId: result.id,
              brandSlug: result.slug,
            },
            "Brand created successfully",
          );
          return result;
        } catch (error) {
          throw wrapError(error, "Failed to create brand");
        }
      }),

    /**
     * Leaves a brand the user is a member of.
     * Moved from workflow.members.update (no user_id case).
     */
    leave: protectedProcedure
      .input(brandLeaveSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, user, brandId: activeBrandId } = ctx;
        const brandIdToLeave = input.brand_id ?? activeBrandId;

        if (!brandIdToLeave) {
          throw badRequest("No brand specified and no active brand to leave");
        }

        const result = await leaveBrand(db, user.id, brandIdToLeave);
        if (!result.ok && result.code === "SOLE_OWNER") {
          throw soleOwnerError();
        }
        if (!result.ok) {
          throw badRequest("Unable to leave brand");
        }

        logger.info(
          {
            userId: user.id,
            brandId: brandIdToLeave,
            nextBrandId: result.nextBrandId,
          },
          "User left brand",
        );

        return {
          success: true as const,
          nextBrandId: result.nextBrandId ?? null,
        };
      }),

    /**
     * Sets the user's active brand.
     * Moved from workflow.setActive.
     */
    setActive: protectedProcedure
      .input(brandSetActiveSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, user } = ctx;

        try {
          await setActiveBrand(db, user.id, input.brand_id);
          logger.info(
            {
              userId: user.id,
              brandId: input.brand_id,
            },
            "Active brand set successfully",
          );
          return createSuccessResponse();
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "Not a member of this brand"
          ) {
            throw badRequest("You are not a member of this brand");
          }
          throw wrapError(error, "Failed to set active brand");
        }
      }),
  }),
});

/**
 * Helper to determine if a user can leave a brand based on their role.
 */
function canLeaveFromRole(
  role: "owner" | "member",
  ownerCount: number,
): boolean {
  if (role !== "owner") return true;
  return ownerCount > 1;
}

/**
 * Extracts storage path from a URL or returns the input if already a path.
 */
function extractStoragePath(url: string | null | undefined): string | null {
  if (!url) return null;
  const knownPrefixes = [
    "/api/storage/brand-avatars/",
    `${getAppUrl()}/api/storage/brand-avatars/`,
  ];
  for (const prefix of knownPrefixes) {
    if (url.startsWith(prefix)) {
      return url.slice(prefix.length);
    }
  }
  const match = url.match(/brand-avatars\/(.+)$/);
  if (match?.[1]) {
    // Decode each segment to handle URL encoding (e.g., %20 for spaces)
    // This matches the pattern in extractAvatarPath for consistent path handling
    return match[1]
      .split("/")
      .map((segment) => decodeURIComponent(segment))
      .join("/");
  }
  return url;
}

type UserRouter = typeof userRouter;
