/**
 * Validation schemas for brand management operations.
 *
 * These shared schemas are consumed by both the API router and front-end forms
 * to ensure consistent validation rules across invites, membership changes,
 * and brand profile updates.
 */
import { z } from "zod";
import { roleSchema } from "./_shared/domain.js";
import {
  byIdSchema,
  byParentId,
  createFieldSelection,
  updateWithNullable,
} from "./_shared/patterns.js";
import {
  avatarHueSchema,
  countryCodeSchema,
  emailSchema,
  shortStringSchema,
  uuidSchema,
} from "./_shared/primitives.js";

/**
 * Available fields for brand queries.
 *
 * Defines which brand fields can be selectively queried by clients.
 */
export const BRAND_FIELDS = [
  "id",
  "name",
  "email",
  "logo_path",
  "avatar_hue",
  "country_code",
  "role",
] as const;

/**
 * Type representing all available brand field names.
 */
export type BrandField = (typeof BRAND_FIELDS)[number];

/**
 * Schema for listing brands with optional field selection.
 */
export const listBrandsSchema = z.object({
  fields: createFieldSelection(BRAND_FIELDS),
});

/**
 * Payload for creating a new brand.
 */
export const createBrandSchema = z.object({
  name: shortStringSchema,
  email: emailSchema.optional().nullable(),
  country_code: countryCodeSchema.optional().nullable(),
  logo_path: shortStringSchema.optional().nullable(),
  avatar_hue: avatarHueSchema.optional(),
});

/**
 * Payload for updating an existing brand.
 */
export const updateBrandSchema = updateWithNullable(createBrandSchema, [
  "email",
  "country_code",
  "logo_path",
  "avatar_hue",
]);

/**
 * Convenience schema for endpoints that take a brand identifier.
 */
export const brandIdParamSchema = byIdSchema;

/**
 * Payload for sending an invite to join a brand.
 */
export const sendInviteSchema = z.object({
  brand_id: uuidSchema,
  email: emailSchema,
  role: roleSchema.default("member"),
});

/**
 * Payload for revoking a pending invite.
 */
export const revokeInviteSchema = byParentId("invite_id");

/**
 * Payload for listing invites issued by a brand.
 */
export const listInvitesSchema = byParentId("brand_id");

/**
 * Payload for accepting an invite using its id.
 */
export const acceptInviteSchema = byIdSchema;
/**
 * Payload for rejecting an invite.
 */
export const rejectInviteSchema = byIdSchema;

/**
 * Payload for changing a member's role.
 */
export const updateMemberSchema = z.object({
  user_id: uuidSchema,
  role: roleSchema,
});

/**
 * Payload for removing a member from the brand.
 */
export const deleteMemberSchema = byParentId("user_id");
