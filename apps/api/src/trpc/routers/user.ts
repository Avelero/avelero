/**
 * tRPC router handling account management for the current user.
 *
 * These procedures let authenticated users fetch, update, and delete their own
 * profile while keeping the response shape consistent with the app's needs.
 */
import { deleteUser, getUserById, updateUser } from "@v1/db/queries";
import { updateUserSchema } from "../../schemas/index.js";
import { createTRPCRouter, protectedProcedure } from "../init.js";
import {
  internalServerError,
  unauthorized,
  wrapError,
} from "../../utils/errors.js";

/**
 * User-specific procedures scoped to the authenticated caller.
 */
export const userRouter = createTRPCRouter({
  /**
   * Returns the profile of the currently authenticated user.
   *
   * @returns The normalized profile or `null` when the caller is signed out.
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const { db, user } = ctx;
    if (!user) return null;
    const r = await getUserById(db, user.id);
    if (!r) return null;
    return {
      id: r.id,
      email: r.email,
      full_name: r.fullName ?? null,
      avatar_url: r.avatarPath ?? null,
      avatar_path: r.avatarPath ?? null,
      avatar_hue: r.avatarHue ?? null,
      brand_id: r.brandId ?? null,
    };
  }),

  /**
   * Updates the caller's profile information based on the submitted payload.
   *
   * @param input - Partial profile changes matching `updateUserSchema`.
   * @returns Updated profile snapshot or `null` when nothing changed.
   */
  update: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw unauthorized();
      try {
        // Map input keys to Drizzle schema field names
        const payload = {
          id: user.id,
          email: input.email,
          fullName: input.full_name,
          avatarPath: input.avatar_path,
          avatarHue: input.avatar_hue,
        };
        const updated = await updateUser(db, payload);
        if (!updated) return null;
        return {
          id: updated.id,
          email: updated.email,
          full_name: updated.fullName ?? null,
          avatar_url: updated.avatarPath ?? null,
          avatar_path: updated.avatarPath ?? null,
          avatar_hue: updated.avatarHue ?? null,
          brand_id: updated.brandId ?? null,
        };
      } catch (error) {
        throw wrapError(error, "Failed to update user profile");
      }
    }),

  /**
   * Deletes the caller's account and associated storage assets.
   *
   * This operation removes avatar files, deletes the application user record,
   * and finally removes the Supabase auth user when the service key is
   * configured.
   *
   * @returns The deleted user record or a shape containing the removed id.
   */
  delete: protectedProcedure.mutation(async ({ ctx }) => {
    const { db, supabaseAdmin, user } = ctx;
    if (!user) throw unauthorized();

    try {
      // Delete all files in avatars/{userId}/ folder before deleting user
      if (supabaseAdmin) {
        const { data: files } = await supabaseAdmin.storage
          .from("avatars")
          .list(user.id);

        if (files && files.length > 0) {
          const filePaths = files.map((file) => `${user.id}/${file.name}`);
          await supabaseAdmin.storage.from("avatars").remove(filePaths);
        }
      }

      // Delete DB user and orphan brands FIRST (must happen before auth deletion)
      const appDeleted = await deleteUser(db, user.id);

      // Then delete the auth user (after DB deletion is complete)
      if (supabaseAdmin) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (error)
          throw internalServerError(
            `Failed to delete auth user: ${error.message}`,
            error,
          );
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
});
