import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string().min(1),
  country_code: z.string().optional().nullable(),
  logo_path: z.string().optional().nullable(),
  avatar_hue: z.number().int().min(1).max(359).optional(),
});

export const updateBrandSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  logo_path: z.string().optional().nullable(),
  avatar_hue: z.number().int().min(1).max(359).optional().nullable(),
  country_code: z.string().optional().nullable(),
});

export const idParamSchema = z.object({ id: z.string().uuid() });

export const sendInviteSchema = z.object({
  brand_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(["owner", "member"]).default("member"),
});

export const revokeInviteSchema = z.object({ invite_id: z.string().uuid() });

export const listInvitesSchema = z.object({ brand_id: z.string().uuid() });

export const acceptInviteSchema = z.object({ id: z.string().uuid() });
export const rejectInviteSchema = z.object({ id: z.string().uuid() });


