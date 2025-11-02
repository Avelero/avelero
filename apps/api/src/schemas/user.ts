/**
 * User profile validation schemas.
 *
 * These Zod definitions are shared between the API and front end to ensure
 * consistent validation for account management flows.
 */
import { z } from "zod";
import {
  avatarHueSchema,
  emailSchema,
  urlSchema,
} from "./_shared/primitives.js";

/**
 * Validates payloads for updating the authenticated user's profile.
 */
export const updateUserSchema = z.object({
  email: emailSchema.optional(),
  full_name: z.string().optional(),
  // legacy (ignored if column dropped)
  avatar_url: urlSchema.optional(),
  // new storage path: "<uid>/<file>"
  avatar_path: z.string().optional(),
  avatar_hue: avatarHueSchema.optional(),
});

/**
 * Validates payloads for the v2 `user.update` procedure.
 *
 * Only permits updating the display name and avatar URL/path while allowing
 * callers to explicitly clear fields by passing `null`.
 */
export const userDomainUpdateSchema = z.object({
  email: emailSchema.optional(),
  full_name: z
    .string()
    .trim()
    .min(1, "Full name cannot be empty")
    .nullable()
    .optional(),
  // Accept either full URLs or storage paths (e.g., "user-id/file.jpg")
  avatar_url: z
    .string()
    .refine(
      (val) => {
        // Allow full URLs (http/https)
        if (/^https?:\/\//i.test(val)) return true;
        // Allow relative paths starting with /
        if (val.startsWith("/")) return true;
        // Allow storage paths (e.g., "user-id/file.jpg")
        if (/^[^/\s]+\/[^/\s]+/.test(val)) return true;
        return false;
      },
      {
        message:
          "Must be a valid URL or storage path (e.g., user-id/file.jpg)",
      },
    )
    .nullable()
    .optional(),
});
