import { createTRPCRouter, protectedProcedure } from "../init.js";
import { updateUserSchema } from "../../schemas/user.js";
import { deleteUserAuth, getUserById, updateUser } from "../../queries/users.js";

export const userRouter = createTRPCRouter({
  me: protectedProcedure.query(async ({ ctx }) => {
    const { supabase, user } = ctx;
    if (!user) return null;
    return getUserById(supabase, user.id);
  }),

  update: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const { supabase, user } = ctx;
      if (!user) throw new Error("Unauthorized");
      return updateUser(supabase, user.id, input as Record<string, unknown>);
    }),

  delete: protectedProcedure.mutation(async ({ ctx }) => {
    const { supabaseAdmin, user } = ctx;
    if (!user) throw new Error("Unauthorized");
    return deleteUserAuth(supabaseAdmin ?? null, user.id);
  }),
});


