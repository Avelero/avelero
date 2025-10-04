import { z } from "zod";

// Products core
export const filterSchemaV2 = z.object({
  brandIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
  search: z.string().optional(),
  fuzzySearchEnabled: z.boolean().optional(),
  status: z.enum(["active", "inactive", "archived"]).optional(),
  seasonIds: z.array(z.string().uuid()).optional(),
  certificationIds: z.array(z.string().uuid()).optional(),
  showcaseBrandIds: z.array(z.string().uuid()).optional(),
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }).optional(),
});

export const sortSchemaV2 = z.object({
  sortBy: z.enum(["createdAt", "price", "name"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

export const paginationSchemaV2 = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(1000).default(10),
});

export const productListSchemaV2 = z.object({
  pagination: z.object({
    method: z.enum(["cursor", "offset"]).default("offset"),
    cursor: z.string().optional(),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(10).max(1000).default(50),
  }).optional(),
  sort: sortSchemaV2.optional(),
  filters: filterSchemaV2.optional(),
});

export const listProductsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  filters: z
    .object({
      category_id: z.string().uuid().optional(),
      season: z.string().optional(),
      search: z.string().optional(),
    })
    .optional(),
});

export const getProductSchema = z.object({ id: z.string().uuid() });

export const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category_id: z.string().uuid().optional(),
  season: z.string().optional(),
  brand_certification_id: z.string().uuid().optional(),
  showcase_brand_id: z.string().uuid().optional(),
  primary_image_url: z.string().url().optional(),
});

export const updateProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  season: z.string().optional().nullable(),
  brand_certification_id: z.string().uuid().optional().nullable(),
  showcase_brand_id: z.string().uuid().optional().nullable(),
  primary_image_url: z.string().url().optional().nullable(),
});

export const deleteProductSchema = z.object({ id: z.string().uuid() });

export const upsertProductIdentifierSchema = z.object({
  product_id: z.string().uuid(),
  id_type: z.string().min(1),
  value: z.string().min(1),
});

// Variants (consolidated under products)
export const listVariantsSchema = z.object({ product_id: z.string().uuid() });

export const createVariantSchema = z.object({
  product_id: z.string().uuid(),
  color_id: z.string().uuid().optional(),
  size_id: z.string().uuid().optional(),
  sku: z.string().optional(),
  upid: z.string().min(1),
  product_image_url: z.string().url().optional(),
});

export const updateVariantSchema = z.object({
  id: z.string().uuid(),
  color_id: z.string().uuid().optional().nullable(),
  size_id: z.string().uuid().optional().nullable(),
  sku: z.string().optional().nullable(),
  upid: z.string().min(1).optional(),
  product_image_url: z.string().url().optional().nullable(),
});

export const deleteVariantSchema = z.object({ id: z.string().uuid() });

export const upsertVariantIdentifierSchema = z.object({
  variant_id: z.string().uuid(),
  id_type: z.string().min(1),
  value: z.string().min(1),
});

