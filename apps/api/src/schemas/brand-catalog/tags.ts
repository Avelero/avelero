import { z } from "zod";
import { byIdSchema, updateFrom, voidSchema } from "../_shared/patterns.js";
import { hexColorSchema, shortStringSchema } from "../_shared/primitives.js";

export const listBrandTagsSchema = voidSchema;

export const createBrandTagSchema = z.object({
  name: shortStringSchema,
  hex: hexColorSchema,
});

export const updateBrandTagSchema = updateFrom(createBrandTagSchema);

export const deleteBrandTagSchema = byIdSchema;
