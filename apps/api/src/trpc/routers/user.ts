import { deleteUser, getUserById, updateUser } from "@v1/db/queries";
import { updateUserSchema } from "../../schemas/user.js";
import { createTRPCRouter, protectedProcedure } from "../init.js";

export const userRouter = createTRPCRouter({
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

  update: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, user } = ctx;
      if (!user) throw new Error("Unauthorized");
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
    }),

  delete: protectedProcedure.mutation(async ({ ctx }) => {
    const { db, supabaseAdmin, user } = ctx;
    if (!user) throw new Error("Unauthorized");
    try {
      const [appDeleted] = await Promise.all([
        deleteUser(db, user.id),
        (async () => {
          if (!supabaseAdmin)
            throw new Error("Supabase admin client not configured");
          const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
          if (error) throw new Error(`Failed to delete user: ${error.message}`);
        })(),
      ]);
      return appDeleted ?? { id: user.id };
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes("Service key not configured") ||
          error.message.includes("Supabase admin client not configured"))
      ) {
        throw new Error("Database error deleting user");
      }
      throw error;
    }
  }),
});
