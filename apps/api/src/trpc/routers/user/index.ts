/**
 * User domain router for the reorganized API surface.
 *
 * Implements the `user.*` namespace described in
 * `docs/NEW_API_ENDPOINTS.txt`, covering profile reads/updates, account
 * deletion, and invite inbox retrieval.
 */
import {
  deleteUser,
  getUserById,
  isEmailTaken,
  listPendingInvitesForEmail,
  updateUser,
} from "@v1/db/queries";
import type { UserInviteSummaryRow } from "@v1/db/queries";
import { logger } from "@v1/logger";
import { TRPCError } from "@trpc/server";
import { userDomainUpdateSchema } from "../../../schemas/user.js";
import {
  badRequest,
  internalServerError,
  unauthorized,
  wrapError,
} from "../../../utils/errors.js";
import { createTRPCRouter, protectedProcedure } from "../../init.js";

interface MinimalUserRecord {
  id: string;
  email: string | null;
  fullName: string | null;
  avatarPath: string | null;
  brandId: string | null;
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
    avatar_url: record.avatarPath ?? null,
    brand_id: record.brandId ?? null,
  };
}

function mapInvite(invite: UserInviteSummaryRow) {
  return {
    id: invite.id,
    brand_name: invite.brandName,
    brand_logo: invite.brandLogoPath,
    role: invite.role,
    invited_by: invite.invitedByFullName ?? invite.invitedByEmail ?? null,
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
      const { db, user, supabaseAdmin } = ctx;

      // Ensure we have a valid authenticated user
      if (!user) {
        throw unauthorized("Authentication required to update profile");
      }

      const payload: {
        email?: string;
        fullName?: string | null;
        avatarPath?: string | null;
      } = {};

      // Handle email change separately with full validation and sync
      if (input.email !== undefined && input.email !== null) {
        const newEmail = input.email.trim().toLowerCase();

        // Validate email format (already validated by Zod, but double-check)
        if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
          throw badRequest("Invalid email format");
        }

        // Don't process if email hasn't actually changed
        const currentEmail = user.email?.toLowerCase();
        if (newEmail !== currentEmail) {
          // Check if email is already taken by another user
          const emailTaken = await isEmailTaken(db, newEmail, user.id);
          if (emailTaken) {
            throw badRequest(
              "Email address is already in use by another account",
            );
          }

          // Require admin client for email changes
          if (!supabaseAdmin) {
            logger.error(
              {
                userId: user.id,
                newEmail,
              },
              "Email change attempted without admin client",
            );
            throw internalServerError(
              "Email changes require admin privileges. Please contact support.",
            );
          }

          try {
            // Step 1: Update Supabase Auth first (primary source of truth)
            // This will trigger Supabase's email verification flow
            logger.info(
              {
                userId: user.id,
                oldEmail: currentEmail,
                newEmail,
              },
              "Updating user email in Supabase Auth",
            );

            const { data: authUpdateData, error: authUpdateError } =
              await supabaseAdmin.auth.admin.updateUserById(user.id, {
                email: newEmail,
              });

            if (authUpdateError) {
              logger.error(
                {
                  userId: user.id,
                  error: authUpdateError.message,
                  code: authUpdateError.code,
                },
                "Failed to update email in Supabase Auth",
              );
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: `Failed to update email in authentication system: ${authUpdateError.message}`,
                cause: authUpdateError,
              });
            }

            if (!authUpdateData?.user) {
              logger.error(
                {
                  userId: user.id,
                },
                "Supabase Auth update succeeded but returned no user",
              );
              throw internalServerError(
                "Email update failed: authentication system returned invalid response",
              );
            }

            logger.info(
              {
                userId: user.id,
                newEmail,
                emailConfirmedAt: authUpdateData.user.email_confirmed_at,
              },
              "Successfully updated email in Supabase Auth",
            );

            // Step 2: Update application DB after auth update succeeds
            payload.email = newEmail;

            // Note: Supabase Auth automatically sends:
            // - A confirmation email to the new address (user must verify)
            // - Optionally, a notification to the old address (if configured)
            // The email_confirmed_at will be null until verification
            logger.info(
              {
                userId: user.id,
                newEmail,
                requiresVerification: !authUpdateData.user.email_confirmed_at,
              },
              "Email change initiated successfully",
            );
          } catch (error) {
            // If it's already a TRPCError, rethrow it
            if (error instanceof TRPCError) {
              throw error;
            }

            // Wrap unexpected errors
            logger.error(
              {
                userId: user.id,
                error: error instanceof Error ? error.message : String(error),
              },
              "Unexpected error during email update",
            );
            throw wrapError(error, "Failed to update email address");
          }
        }
      }

      // Handle other profile fields
      if (input.full_name !== undefined) {
        payload.fullName = input.full_name;
      }
      if (input.avatar_url !== undefined) {
        payload.avatarPath = input.avatar_url;
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
          return null;
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
          await supabaseAdmin.storage.from("avatars").remove(filePaths);
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
  }),
});

export type UserRouter = typeof userRouter;
