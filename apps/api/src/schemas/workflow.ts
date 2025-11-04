/**
 * Validation schemas for the workflow domain (brands, members, invites).
 *
 * These schemas back the tRPC procedures that manage team workflows inside
 * `apps/api/src/trpc/routers/v2/workflow`. They intentionally mirror the new
 * API contract described in `docs/NEW_API_ENDPOINTS.txt`.
 */
import { z } from "zod";
import { roleSchema } from "./_shared/domain.js";
import { updateWithNullable } from "./_shared/patterns.js";
import {
  avatarHueSchema,
  countryCodeSchema,
  emailSchema,
  shortStringSchema,
  uuidSchema,
} from "./_shared/primitives.js";

/**
 * Payload for creating a workflow (brand) record.
 *
 * Accepts the same optional metadata as the legacy brand create mutation but
 * renames `logo_path` to the API-facing `logo_url` to reflect the proxied URL.
 */
export const workflowCreateSchema = z.object({
  name: shortStringSchema,
  email: emailSchema.optional().nullable(),
  country_code: countryCodeSchema.optional().nullable(),
  logo_url: shortStringSchema.optional().nullable(),
  avatar_hue: avatarHueSchema.optional(),
});

export const workflowUpdateSchema = updateWithNullable(workflowCreateSchema, [
  "email",
  "country_code",
  "logo_url",
  "avatar_hue",
]);

export type WorkflowUpdateInput = z.infer<typeof workflowUpdateSchema>;

/**
 * Shared schema for endpoints that require a workflow/brand identifier.
 */
export const workflowBrandIdSchema = z.object({
  brand_id: uuidSchema,
});

/**
 * Payload for the multi-purpose members mutation supporting leave, removal,
 * and role updates. Validation ensures that either:
 * - both `user_id` and `role` are provided (update)
 * - `user_id` is provided with `role` explicitly `null` (remove)
 * - neither `user_id` nor `role` are provided (leave current user)
 */
export const workflowMembersUpdateSchema = z
  .object({
    brand_id: uuidSchema,
    user_id: uuidSchema.optional(),
    role: roleSchema.nullable().optional(),
  })
  .refine(
    (value) => {
      if (!value.user_id) {
        return value.role === undefined;
      }
      return value.role !== undefined;
    },
    {
      message:
        "Provide both user_id and role to change roles, set role to null to remove a member, or omit both to leave the brand.",
      path: ["role"],
    },
  );

/**
 * Payload for listing pending invites for a workflow.
 */
export const workflowInvitesListSchema = workflowBrandIdSchema;

/**
 * Payload for sending a workflow invite.
 */
export const workflowInvitesSendSchema = z.object({
  brand_id: uuidSchema,
  email: emailSchema,
  role: roleSchema.default("member"),
});

/**
 * Payload for responding to an invite (accept, decline, revoke).
 */
export const workflowInvitesRespondSchema = z.object({
  invite_id: uuidSchema,
  action: z.enum(["accept", "decline", "revoke"]),
});

export type WorkflowMembersUpdateInput = z.infer<
  typeof workflowMembersUpdateSchema
>;
