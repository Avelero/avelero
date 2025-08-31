import { z } from "zod";

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  full_name: z.string().optional(),
  // legacy (ignored if column dropped)
  avatar_url: z.string().url().optional(),
  // new storage path: "<uid>/<file>"
  avatar_path: z.string().optional(),
  avatar_hue: z.number().int().min(1).max(359).optional(),
});


