import { z } from "zod";

export const updateUserSchema = z.object({
  full_name: z.string().optional(),
  email: z.string().optional(),
  avatar_path: z.string().optional(),
});
