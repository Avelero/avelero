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
  listPendingInvitesForEmail,
  updateUser,
} from "@v1/db/queries";
import type { UserInviteSummaryRow } from "@v1/db/queries";
import { userDomainUpdateSchema } from "../../../schemas/user.js";
import { createTRPCRouter, protectedProcedure } from "../../init.js";
import {
  internalServerError,
  unauthorized,
  wrapError,
} from "../../../utils/errors.js";

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
   */
  update: protectedProcedure
    .input(userDomainUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;

      const payload: { fullName?: string | null; avatarPath?: string | null } =
        {};

      if (input.full_name !== undefined) {
        payload.fullName = input.full_name;
      }
      if (input.avatar_url !== undefined) {
        payload.avatarPath = input.avatar_url;
      }

      if (Object.keys(payload).length === 0) {
        const existing = await getUserById(db, user.id);
        if (!existing) return null;
        return mapUserProfile(existing, user.email ?? null);
      }

      try {
        const updated = await updateUser(db, {
          id: user.id,
          ...payload,
        });
        if (!updated) return null;
        return mapUserProfile(updated, user.email ?? null);
      } catch (error) {
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
