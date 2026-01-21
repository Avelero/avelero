/**
 * Validation schemas for the brand domain (brands, members, invites).
 *
 * Renamed from workflow.ts in Phase 7 to align with the router rename.
 * These schemas back the tRPC procedures that manage brand lifecycle inside
 * `apps/api/src/trpc/routers/brand/`.
 */
import { z } from "zod";
import { roleSchema } from "./_shared/domain.js";
import { updateWithNullable } from "./_shared/patterns.js";
import {
  countryCodeSchema,
  emailSchema,
  shortStringSchema,
  slugSchema,
  uuidSchema,
} from "./_shared/primitives.js";

/**
 * Payload for creating a brand record.
 *
 * Accepts the same optional metadata as the legacy brand create mutation but
 * renames `logo_path` to the API-facing `logo_url` to reflect the proxied URL.
 * If slug is not provided, it will be auto-generated from the name.
 */
export const brandCreateSchema = z.object({
  name: shortStringSchema,
  slug: slugSchema.optional().nullable(),
  email: emailSchema.optional().nullable(),
  country_code: countryCodeSchema.optional().nullable(),
  logo_url: shortStringSchema.optional().nullable(),
});

export const brandUpdateSchema = updateWithNullable(brandCreateSchema, [
  "email",
  "country_code",
  "logo_url",
]);

type BrandUpdateInput = z.infer<typeof brandUpdateSchema>;

/**
 * Shared schema for endpoints that require a brand identifier.
 */
export const brandIdSchema = z.object({
  brand_id: uuidSchema,
});

/**
 * Optional schema for endpoints that use brandRequiredProcedure.
 * These endpoints automatically use the active brand from context, so
 * brand_id is optional and only used for validation if provided.
 */
export const brandIdOptionalSchema = z.object({
  brand_id: uuidSchema.optional(),
});

/**
 * Payload for the multi-purpose members mutation supporting removal
 * and role updates.
 */
export const memberUpdateSchema = z.object({
  user_id: uuidSchema,
  role: roleSchema,
});

/**
 * Payload for sending a brand invite.
 */
export const inviteSendSchema = z.object({
  brand_id: uuidSchema.optional(),
  email: emailSchema,
  role: roleSchema.default("member"),
});

type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;

// ============================================================================
// Legacy aliases for backward compatibility during migration
// These can be removed after Phase 8 client updates are complete
// ============================================================================
