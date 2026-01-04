/**
 * User profile validation schemas.
 *
 * These Zod definitions are shared between the API and front end to ensure
 * consistent validation for account management flows.
 */
import { z } from "zod";
import {
  emailSchema,
  urlSchema,
  uuidSchema,
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
});

/**
 * Validates payloads for the v2 `user.update` procedure.
 *
 * Only permits updating the display name and avatar URL/path while allowing
 * callers to explicitly clear fields by passing `null`.
 * Note: Use `user.brands.setActive` to change the active brand.
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
        message: "Must be a valid URL or storage path (e.g., user-id/file.jpg)",
      },
    )
    .nullable()
    .optional(),
});

/**
 * Payload for accepting an invite to join a brand.
 * Moved from workflow.invites.respond to user.invites.accept.
 */
export const inviteAcceptSchema = z.object({
  invite_id: uuidSchema,
});

/**
 * Payload for rejecting an invite to join a brand.
 * Moved from workflow.invites.respond to user.invites.reject.
 */
export const inviteRejectSchema = z.object({
  invite_id: uuidSchema,
});

/**
 * Payload for leaving a brand.
 * Moved from workflow.members.update (no user_id case) to user.brands.leave.
 */
export const brandLeaveSchema = z.object({
  brand_id: uuidSchema.optional(), // Optional, uses active brand if not provided
});

/**
 * Payload for setting the user's active brand.
 * Moved from workflow.setActive to user.brands.setActive.
 */
export const brandSetActiveSchema = z.object({
  brand_id: uuidSchema,
});

export type InviteAcceptInput = z.infer<typeof inviteAcceptSchema>;
export type InviteRejectInput = z.infer<typeof inviteRejectSchema>;
export type BrandLeaveInput = z.infer<typeof brandLeaveSchema>;
export type BrandSetActiveInput = z.infer<typeof brandSetActiveSchema>;
