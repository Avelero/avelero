import { z } from "zod";

// Global catalog: categories and care codes (read-only inputs)

export const listCategoriesSchema = z.object({});
export const listCareCodesSchema = z.object({});

export const idParamSchema = z.object({ id: z.string().uuid() });

