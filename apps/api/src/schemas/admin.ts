import { z } from "zod";
import { roleSchema } from "./_shared/domain.js";
import {
  emailSchema,
  paginationLimitSchema,
  shortStringSchema,
  uuidSchema,
} from "./_shared/primitives.js";
import { brandCreateSchema } from "./brand.js";

const qualificationStatusSchema = z.enum(["pending", "qualified", "rejected"]);
const operationalStatusSchema = z.enum(["active", "suspended"]);
const billingStatusSchema = z.enum([
  "unconfigured",
  "pending_payment",
  "active",
  "past_due",
  "canceled",
]);
const billingModeSchema = z.enum(["standard_checkout", "enterprise_invoice"]);
const billingAccessOverrideSchema = z.enum([
  "none",
  "temporary_allow",
  "temporary_block",
]);
const planTypeSchema = z.enum(["starter", "growth", "scale", "custom"]);

export const adminBrandsListSchema = z.object({
  search: shortStringSchema.max(120).optional(),
  limit: paginationLimitSchema.default(25),
  offset: z.number().int().min(0).default(0),
  include_deleted: z.boolean().default(false),
});

export const adminBrandGetSchema = z.object({
  brand_id: uuidSchema,
});

export const adminBrandCreateSchema = brandCreateSchema;

export const adminBrandUpdateControlSchema = z.object({
  brand_id: uuidSchema,
  qualification_status: qualificationStatusSchema.optional(),
  operational_status: operationalStatusSchema.optional(),
  billing_status: billingStatusSchema.optional(),
  billing_mode: billingModeSchema.nullable().optional(),
  billing_access_override: billingAccessOverrideSchema.optional(),
  plan_type: planTypeSchema.nullable().optional(),
  plan_currency: z
    .string()
    .trim()
    .length(3, "Plan currency must be a 3-character ISO code")
    .transform((value) => value.toUpperCase())
    .optional(),
  custom_monthly_price_cents: z.number().int().positive().nullable().optional(),
});

export const adminMemberAddSchema = z.object({
  brand_id: uuidSchema,
  email: emailSchema,
  role: roleSchema.default("member"),
});

export const adminMemberRemoveSchema = z.object({
  brand_id: uuidSchema,
  user_id: uuidSchema,
});

export const adminInviteSendSchema = z.object({
  brand_id: uuidSchema,
  email: emailSchema,
  role: roleSchema.default("member"),
});

export const adminInviteRevokeSchema = z.object({
  invite_id: uuidSchema,
});

export const adminAuditListSchema = z.object({
  brand_id: uuidSchema,
  limit: z.number().int().min(1).max(200).default(50),
});

export type AdminBrandUpdateControlInput = z.infer<
  typeof adminBrandUpdateControlSchema
>;
