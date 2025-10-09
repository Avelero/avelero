// @ts-nocheck
import { TRPCError } from "@trpc/server";
import {
  type ProductVariant,
  brandColors,
  brandSizes,
  categories,
  passports,
  productVariantIdentifiers,
  productVariants,
  products,
} from "@v1/db/schema";
import {
  bulkUpdateVariantSchema,
  calculateVariantCompleteness,
  checkVariantIdentifierDuplicates,
  createVariantSchema,
  generateVariantDisplayName,
  getVariantSchema,
  listVariantsSchema,
  transformVariantData,
  updateVariantSchema,
  validateVariantSku,
  validateVariantUpid,
  variantMetricsSchema,
} from "@v1/db/extensions/modules";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init.js";

// Shared schemas for consistent API patterns
const paginationSchema = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.number().min(1).max(1000).default(20),
});

const sortSchema = z.object({
  field: z.enum([
    "createdAt",
    "updatedAt",
    "sku",
    "upid",
    "productName",
    "colorName",
    "sizeName",
    "completenessScore",
  ]),
  direction: z.enum(["asc", "desc"]).default("desc"),
});

const filterSchema = z.object({
  // Product relationships
  productIds: z.array(z.string().uuid()).optional(),
  categoryIds: z.array(z.string().uuid()).optional(),

  // Variant attributes
  colorIds: z.array(z.string().uuid()).optional(),
  sizeIds: z.array(z.string().uuid()).optional(),
  colorNames: z.array(z.string()).optional(),
  sizeNames: z.array(z.string()).optional(),

  // Identifiers
  skus: z.array(z.string()).optional(),
  upids: z.array(z.string()).optional(),
  skuPattern: z.string().optional(),
  upidPattern: z.string().optional(),

  // Search
  search: z.string().optional(),

  // Date ranges
  createdRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .optional(),

  // Image filtering
  hasProductImage: z.boolean().optional(),
  imageUrlPattern: z.string().optional(),

  // Completeness filtering
  completenessScore: z
    .object({
      min: z.number().min(0).max(100).optional(),
      max: z.number().min(0).max(100).optional(),
    })
    .optional(),

  // Validation status
  hasValidSku: z.boolean().optional(),
  hasValidUpid: z.boolean().optional(),
  isComplete: z.boolean().optional(),

  // Duplication detection
  hasDuplicateIdentifiers: z.boolean().optional(),
  identifierType: z.enum(["sku", "upid", "both"]).optional(),
});

const includeSchema = z.object({
  product: z.boolean().default(false),
  color: z.boolean().default(false),
  size: z.boolean().default(false),
  passports: z.boolean().default(false),
  identifiers: z.boolean().default(false),
  statistics: z.boolean().default(false),
});

export const variantsRouter = createTRPCRouter({
  /**
   * List variants with advanced filtering, sorting, and cursor pagination
   */
  list: protectedProcedure
    .input(
      z.object({
        filter: filterSchema.optional(),
        sort: sortSchema.optional(),
        pagination: paginationSchema.optional(),
        include: includeSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active brand context",
        });
      }

      const {
        filter = {},
        sort = { field: "createdAt", direction: "desc" },
        pagination = {},
        include = {},
      } = input;

      const { cursor, limit = 20 } = pagination;

      // Build base conditions - filter through products for brand isolation
      const conditions = [
        eq(products.brandId, brandId),
        eq(productVariants.productId, products.id),
      ];

      // Apply product filters
      if (filter.productIds && filter.productIds.length > 0) {
        conditions.push(inArray(productVariants.productId, filter.productIds));
      }

      if (filter.categoryIds && filter.categoryIds.length > 0) {
        conditions.push(inArray(products.categoryId, filter.categoryIds));
      }

      // Apply variant attribute filters
      if (filter.colorIds && filter.colorIds.length > 0) {
        conditions.push(inArray(productVariants.colorId, filter.colorIds));
      }

      if (filter.sizeIds && filter.sizeIds.length > 0) {
        conditions.push(inArray(productVariants.sizeId, filter.sizeIds));
      }

      // Apply identifier filters
      if (filter.skus && filter.skus.length > 0) {
        conditions.push(inArray(productVariants.sku, filter.skus));
      }

      if (filter.upids && filter.upids.length > 0) {
        conditions.push(inArray(productVariants.upid, filter.upids));
      }

      if (filter.skuPattern) {
        conditions.push(ilike(productVariants.sku, `%${filter.skuPattern}%`));
      }

      if (filter.upidPattern) {
        conditions.push(ilike(productVariants.upid, `%${filter.upidPattern}%`));
      }

      // Image filtering
      if (filter.hasProductImage !== undefined) {
        if (filter.hasProductImage) {
          conditions.push(isNotNull(productVariants.productImageUrl));
        } else {
          conditions.push(isNull(productVariants.productImageUrl));
        }
      }

      if (filter.imageUrlPattern) {
        conditions.push(
          ilike(productVariants.productImageUrl, `%${filter.imageUrlPattern}%`),
        );
      }

      // Date range filters
      if (filter.createdRange?.from) {
        conditions.push(
          gte(
            productVariants.createdAt,
            filter.createdRange.from.toISOString(),
          ),
        );
      }
      if (filter.createdRange?.to) {
        conditions.push(
          lte(productVariants.createdAt, filter.createdRange.to.toISOString()),
        );
      }

      // Search filter (across variant and product fields)
      if (filter.search) {
        const searchTerm = `%${filter.search}%`;
        conditions.push(
          or(
            ilike(productVariants.sku, searchTerm),
            ilike(productVariants.upid, searchTerm),
            ilike(products.name, searchTerm),
          )!,
        );
      }

      // Cursor-based pagination
      if (cursor) {
        try {
          const cursorData = JSON.parse(
            Buffer.from(cursor, "base64").toString(),
          );
          const cursorField =
            sort.field === "createdAt"
              ? productVariants.createdAt
              : sort.field === "updatedAt"
                ? productVariants.updatedAt
                : sort.field === "sku"
                  ? productVariants.sku
                  : sort.field === "upid"
                    ? productVariants.upid
                    : productVariants.createdAt; // fallback

          if (sort.direction === "desc") {
            conditions.push(
              or(
                lte(cursorField, cursorData[sort.field]),
                and(
                  eq(cursorField, cursorData[sort.field]),
                  lte(productVariants.id, cursorData.id),
                ),
              )!,
            );
          } else {
            conditions.push(
              or(
                gte(cursorField, cursorData[sort.field]),
                and(
                  eq(cursorField, cursorData[sort.field]),
                  gte(productVariants.id, cursorData.id),
                ),
              )!,
            );
          }
        } catch (e) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid cursor format",
          });
        }
      }

      // Build query with optional includes
      let query: any;

      if (
        include.product ||
        include.color ||
        include.size ||
        include.passports
      ) {
        // Use joins when includes are requested
        query = db
          .select({
            variant: productVariants,
            ...(include.product && { product: products }),
            ...(include.color && { color: brandColors }),
            ...(include.size && { size: brandSizes }),
          })
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(and(...conditions));

        if (include.color) {
          query = query.leftJoin(
            brandColors,
            eq(productVariants.colorId, brandColors.id),
          );
        }
        if (include.size) {
          query = query.leftJoin(
            brandSizes,
            eq(productVariants.sizeId, brandSizes.id),
          );
        }
      } else {
        // Simple select when no includes needed
        query = db
          .select({ variant: productVariants })
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(and(...conditions));
      }

      // Apply sorting
      const sortField =
        sort.field === "createdAt"
          ? productVariants.createdAt
          : sort.field === "updatedAt"
            ? productVariants.updatedAt
            : sort.field === "sku"
              ? productVariants.sku
              : sort.field === "upid"
                ? productVariants.upid
                : sort.field === "productName"
                  ? products.name
                  : sort.field === "colorName"
                    ? brandColors.name
                    : sort.field === "sizeName"
                      ? brandSizes.name
                      : productVariants.createdAt;

      query = query.orderBy(
        sort.direction === "asc" ? asc(sortField) : desc(sortField),
        sort.direction === "asc"
          ? asc(productVariants.id)
          : desc(productVariants.id), // Secondary sort for consistency
      );

      // Apply limit (+1 to check for more results)
      query = query.limit(limit + 1);

      // Execute query
      const results = await query;

      // Check if there are more results
      const hasMore = results.length > limit;
      if (hasMore) {
        results.pop(); // Remove the extra item
      }

      // Generate next cursor
      const nextCursor =
        hasMore && results.length > 0
          ? Buffer.from(
              JSON.stringify({
                [sort.field]: results[results.length - 1].variant[sort.field],
                id: results[results.length - 1].variant.id,
              }),
            ).toString("base64")
          : null;

      // Format response data with includes
      const data = results.map((result) => {
        const item = {
          ...result.variant,
          ...(include.product && result.product && { product: result.product }),
          ...(include.color && result.color && { color: result.color }),
          ...(include.size && result.size && { size: result.size }),
        };

        // Calculate completeness score if not stored
        if (include.statistics) {
          const completenessScore = calculateVariantCompleteness(item);
          return { ...item, completenessScore };
        }

        return item;
      });

      // Add passport data if requested
      if (include.passports && data.length > 0) {
        const variantIds = data.map((variant) => variant.id);
        const variantPassports = await db.query.passports.findMany({
          where: and(
            eq(passports.brandId, brandId),
            inArray(passports.variantId, variantIds),
          ),
        });

        const passportsByVariantId = variantPassports.reduce(
          (acc, passport) => {
            if (passport.variantId) {
              acc[passport.variantId] = (acc[passport.variantId] || []).concat(
                passport,
              );
            }
            return acc;
          },
          {} as Record<string, typeof variantPassports>,
        );

        data.forEach((variant, index) => {
          data[index] = {
            ...variant,
            passports: passportsByVariantId[variant.id] || [],
          };
        });
      }

      // Add identifier data if requested
      if (include.identifiers && data.length > 0) {
        const variantIds = data.map((variant) => variant.id);
        const identifiers = await db.query.productVariantIdentifiers.findMany({
          where: inArray(productVariantIdentifiers.variantId, variantIds),
        });

        const identifiersByVariantId = identifiers.reduce(
          (acc, identifier) => {
            acc[identifier.variantId] = (
              acc[identifier.variantId] || []
            ).concat(identifier);
            return acc;
          },
          {} as Record<string, typeof identifiers>,
        );

        data.forEach((variant, index) => {
          data[index] = {
            ...variant,
            identifiers: identifiersByVariantId[variant.id] || [],
          };
        });
      }

      return {
        data,
        cursorInfo: {
          nextCursor,
          hasMore,
        },
        meta: {
          total: undefined, // Optional: could add total count if needed
        },
      };
    }),

  /**
   * Get variant(s) by flexible where conditions
   */
  get: protectedProcedure
    .input(
      z.object({
        where: z.object({
          variantId: z.string().uuid().optional(),
          productId: z.string().uuid().optional(),
          sku: z.string().optional(),
          upid: z.string().optional(),
          colorId: z.string().uuid().optional(),
          sizeId: z.string().uuid().optional(),
        }),
        include: includeSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active brand context",
        });
      }

      const { where, include = {} } = input;

      // Build conditions - filter through products for brand isolation
      const conditions = [
        eq(products.brandId, brandId),
        eq(productVariants.productId, products.id),
      ];

      if (where.variantId) {
        conditions.push(eq(productVariants.id, where.variantId));
      }
      if (where.productId) {
        conditions.push(eq(productVariants.productId, where.productId));
      }
      if (where.sku) {
        conditions.push(eq(productVariants.sku, where.sku));
      }
      if (where.upid) {
        conditions.push(eq(productVariants.upid, where.upid));
      }
      if (where.colorId) {
        conditions.push(eq(productVariants.colorId, where.colorId));
      }
      if (where.sizeId) {
        conditions.push(eq(productVariants.sizeId, where.sizeId));
      }

      // Build query with optional includes
      if (include.product || include.color || include.size) {
        const result = await db
          .select({
            variant: productVariants,
            ...(include.product && { product: products }),
            ...(include.color && { color: brandColors }),
            ...(include.size && { size: brandSizes }),
          })
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .leftJoin(brandColors, eq(productVariants.colorId, brandColors.id))
          .leftJoin(brandSizes, eq(productVariants.sizeId, brandSizes.id))
          .where(and(...conditions))
          .limit(1);

        if (result.length === 0) return null;

        const item = result[0];
        const variant: any = {
          ...item.variant,
          ...(include.product && item.product && { product: item.product }),
          ...(include.color && item.color && { color: item.color }),
          ...(include.size && item.size && { size: item.size }),
        };

        // Add passport data if requested
        if (include.passports) {
          const variantPassports = await db.query.passports.findMany({
            where: and(
              eq(passports.brandId, brandId),
              eq(passports.variantId, variant.id),
            ),
          });
          variant.passports = variantPassports;
        }

        // Add identifier data if requested
        if (include.identifiers) {
          const identifiers = await db.query.productVariantIdentifiers.findMany(
            {
              where: eq(productVariantIdentifiers.variantId, variant.id),
            },
          );
          variant.identifiers = identifiers;
        }

        // Calculate completeness score if requested
        if (include.statistics) {
          variant.completenessScore = calculateVariantCompleteness(variant);
        }

        return variant;
      }

      const result = await db
        .select({ variant: productVariants })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(and(...conditions))
        .limit(1);

      if (result.length === 0) return null;

      const variant: any = result[0].variant;

      // Add includes even for simple queries if requested
      if (include.passports || include.identifiers || include.statistics) {
        if (include.passports) {
          const variantPassports = await db.query.passports.findMany({
            where: and(
              eq(passports.brandId, brandId),
              eq(passports.variantId, variant.id),
            ),
          });
          variant.passports = variantPassports;
        }

        if (include.identifiers) {
          const identifiers = await db.query.productVariantIdentifiers.findMany(
            {
              where: eq(productVariantIdentifiers.variantId, variant.id),
            },
          );
          variant.identifiers = identifiers;
        }

        if (include.statistics) {
          variant.completenessScore = calculateVariantCompleteness(variant);
        }
      }

      return variant;
    }),

  /**
   * Create a new variant with uniqueness enforcement
   */
  create: protectedProcedure
    .input(createVariantSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active brand context",
        });
      }

      // Validate product belongs to brand
      const product = await db.query.products.findFirst({
        where: and(
          eq(products.id, input.productId),
          eq(products.brandId, brandId),
        ),
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Product not found or does not belong to your brand",
        });
      }

      // Validate color and size belong to brand if provided
      if (input.colorId) {
        const color = await db.query.brandColors.findFirst({
          where: and(
            eq(brandColors.id, input.colorId),
            eq(brandColors.brandId, brandId),
          ),
        });

        if (!color) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Color not found or does not belong to your brand",
          });
        }
      }

      if (input.sizeId) {
        const size = await db.query.brandSizes.findFirst({
          where: and(
            eq(brandSizes.id, input.sizeId),
            eq(brandSizes.brandId, brandId),
          ),
        });

        if (!size) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Size not found or does not belong to your brand",
          });
        }
      }

      // Check for duplicate UPID within brand (through product relationship)
      const existingUpid = await db
        .select()
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(
          and(
            eq(products.brandId, brandId),
            eq(productVariants.upid, input.upid),
          ),
        )
        .limit(1);

      if (existingUpid.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `UPID "${input.upid}" already exists in your brand`,
        });
      }

      // Check for duplicate SKU if provided
      if (input.sku) {
        const existingSku = await db
          .select()
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(
            and(
              eq(products.brandId, brandId),
              eq(productVariants.sku, input.sku),
            ),
          )
          .limit(1);

        if (existingSku.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `SKU "${input.sku}" already exists in your brand`,
          });
        }

        // Validate SKU format
        if (!validateVariantSku(input.sku)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "SKU format is invalid. Must be 6-15 characters, alphanumeric with dashes.",
          });
        }
      }

      // Validate UPID format
      if (!validateVariantUpid(input.upid)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "UPID format is invalid. Must be 8-12 characters, alphanumeric.",
        });
      }

      // Check for duplicate color+size combination for the product
      if (input.colorId && input.sizeId) {
        const existingCombination = await db.query.productVariants.findFirst({
          where: and(
            eq(productVariants.productId, input.productId),
            eq(productVariants.colorId, input.colorId),
            eq(productVariants.sizeId, input.sizeId),
          ),
        });

        if (existingCombination) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "A variant with this color and size combination already exists for this product",
          });
        }
      }

      // Transform and prepare data for insertion
      const transformedData = transformVariantData(input);

      const newVariantData = {
        ...transformedData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Create the variant
      const [newVariant] = await db
        .insert(productVariants)
        .values(newVariantData)
        .returning();

      return {
        data: [newVariant],
        affectedCount: 1,
      };
    }),

  /**
   * Update a variant with validation and automatic completeness calculation
   */
  update: protectedProcedure
    .input(updateVariantSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active brand context",
        });
      }

      const { id, ...updateData } = input;

      // Check if variant exists and belongs to brand (through product)
      const existingVariant = await db
        .select({ variant: productVariants, product: products })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(and(eq(productVariants.id, id), eq(products.brandId, brandId)))
        .limit(1);

      if (existingVariant.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Variant not found or does not belong to your brand",
        });
      }

      const currentVariant = existingVariant[0].variant;

      // Validate SKU uniqueness if changing
      if (updateData.sku && updateData.sku !== currentVariant.sku) {
        const existingSku = await db
          .select()
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(
            and(
              eq(products.brandId, brandId),
              eq(productVariants.sku, updateData.sku),
              // Exclude current variant
            ),
          )
          .limit(1);

        if (existingSku.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `SKU "${updateData.sku}" already exists in your brand`,
          });
        }

        // Validate SKU format
        if (!validateVariantSku(updateData.sku)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "SKU format is invalid. Must be 6-15 characters, alphanumeric with dashes.",
          });
        }
      }

      // Validate UPID uniqueness if changing
      if (updateData.upid && updateData.upid !== currentVariant.upid) {
        const existingUpid = await db
          .select()
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(
            and(
              eq(products.brandId, brandId),
              eq(productVariants.upid, updateData.upid),
              // Exclude current variant
            ),
          )
          .limit(1);

        if (existingUpid.length > 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `UPID "${updateData.upid}" already exists in your brand`,
          });
        }

        // Validate UPID format
        if (!validateVariantUpid(updateData.upid)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "UPID format is invalid. Must be 8-12 characters, alphanumeric.",
          });
        }
      }

      // Validate color belongs to brand if changing
      if (updateData.colorId && updateData.colorId !== currentVariant.colorId) {
        const color = await db.query.brandColors.findFirst({
          where: and(
            eq(brandColors.id, updateData.colorId),
            eq(brandColors.brandId, brandId),
          ),
        });

        if (!color) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Color not found or does not belong to your brand",
          });
        }
      }

      // Validate size belongs to brand if changing
      if (updateData.sizeId && updateData.sizeId !== currentVariant.sizeId) {
        const size = await db.query.brandSizes.findFirst({
          where: and(
            eq(brandSizes.id, updateData.sizeId),
            eq(brandSizes.brandId, brandId),
          ),
        });

        if (!size) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Size not found or does not belong to your brand",
          });
        }
      }

      // Transform update data
      const transformedData = transformVariantData(updateData);

      // Perform the update
      const finalUpdateData = {
        ...transformedData,
        updatedAt: new Date().toISOString(),
      };

      const [updatedVariant] = await db
        .update(productVariants)
        .set(finalUpdateData)
        .where(eq(productVariants.id, id))
        .returning();

      return {
        data: [updatedVariant],
        affectedCount: 1,
      };
    }),

  /**
   * Bulk update variants with safety guards and preview mode
   */
  bulkUpdate: protectedProcedure
    .input(bulkUpdateVariantSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active brand context",
        });
      }

      const { selection, data: updateData, preview } = input;

      // Build base conditions (always include brand isolation through products)
      const baseConditions = [
        eq(products.brandId, brandId),
        eq(productVariants.productId, products.id),
      ];

      // Build selection conditions based on criteria
      const conditions = [...baseConditions];

      if (typeof selection === "object" && "ids" in selection) {
        conditions.push(inArray(productVariants.id, selection.ids));
      } else if (typeof selection === "object" && "filter" in selection) {
        const filter = selection.filter;

        // Apply variant-specific filters
        if (filter.productIds) {
          conditions.push(
            inArray(productVariants.productId, filter.productIds),
          );
        }
        if (filter.colorIds) {
          conditions.push(inArray(productVariants.colorId, filter.colorIds));
        }
        if (filter.sizeIds) {
          conditions.push(inArray(productVariants.sizeId, filter.sizeIds));
        }
        if (filter.skus) {
          conditions.push(inArray(productVariants.sku, filter.skus));
        }
        if (filter.upids) {
          conditions.push(inArray(productVariants.upid, filter.upids));
        }
        if (filter.hasProductImage !== undefined) {
          if (filter.hasProductImage) {
            conditions.push(isNotNull(productVariants.productImageUrl));
          } else {
            conditions.push(isNull(productVariants.productImageUrl));
          }
        }
      }
      // For "all" selection, use only base conditions

      // Safety: Count affected records
      const countQuery = await db
        .select({ count: count() })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(and(...conditions));

      const affectedCount = countQuery[0]?.count || 0;

      // Safety guards
      const MAX_BULK_UPDATE = 1000;
      const PREVIEW_THRESHOLD = 100;

      if (affectedCount > MAX_BULK_UPDATE) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Bulk operation affects ${affectedCount} records. Maximum allowed is ${MAX_BULK_UPDATE}. Use more specific filters.`,
        });
      }

      if (affectedCount > PREVIEW_THRESHOLD && !preview) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Bulk operation affects ${affectedCount} records. Use preview=true first to confirm.`,
        });
      }

      // Preview mode: return count without making changes
      if (preview) {
        return {
          data: [],
          affectedCount,
          preview: true,
        };
      }

      // Transform update data
      const transformedData = transformVariantData(updateData);

      // For bulk updates, we skip individual uniqueness validation for performance
      // This could be enhanced with a background validation job
      const finalUpdateData = {
        ...transformedData,
        updatedAt: new Date().toISOString(),
      };

      // Perform the bulk update
      const updatedVariants = await db
        .update(productVariants)
        .set(finalUpdateData)
        .where(and(...conditions))
        .returning();

      return {
        data: updatedVariants,
        affectedCount: updatedVariants.length,
      };
    }),

  /**
   * Compute metrics and aggregations for variants
   */
  aggregate: protectedProcedure
    .input(variantMetricsSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { filter = {}, metrics } = input;

      if (!brandId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Brand context required",
        });
      }

      const results: Record<string, any> = {};

      // Base conditions for all aggregations (brand isolation through products)
      const baseConditions = [
        eq(products.brandId, brandId),
        eq(productVariants.productId, products.id),
      ];

      // Apply filters to base conditions if provided
      if (filter.productIds) {
        baseConditions.push(
          inArray(productVariants.productId, filter.productIds),
        );
      }

      if (filter.colorIds) {
        baseConditions.push(inArray(productVariants.colorId, filter.colorIds));
      }

      if (filter.sizeIds) {
        baseConditions.push(inArray(productVariants.sizeId, filter.sizeIds));
      }

      if (filter.hasProductImage !== undefined) {
        if (filter.hasProductImage) {
          baseConditions.push(isNotNull(productVariants.productImageUrl));
        } else {
          baseConditions.push(isNull(productVariants.productImageUrl));
        }
      }

      // Process each requested metric
      for (const metric of metrics) {
        switch (metric) {
          case "colorDistribution": {
            const colorCounts = await db
              .select({
                colorId: productVariants.colorId,
                colorName: brandColors.name,
                count: count(),
              })
              .from(productVariants)
              .innerJoin(products, eq(productVariants.productId, products.id))
              .leftJoin(
                brandColors,
                eq(productVariants.colorId, brandColors.id),
              )
              .where(and(...baseConditions))
              .groupBy(productVariants.colorId, brandColors.name);
            results.colorDistribution = colorCounts;
            break;
          }

          case "sizeDistribution": {
            const sizeCounts = await db
              .select({
                sizeId: productVariants.sizeId,
                sizeName: brandSizes.name,
                count: count(),
              })
              .from(productVariants)
              .innerJoin(products, eq(productVariants.productId, products.id))
              .leftJoin(brandSizes, eq(productVariants.sizeId, brandSizes.id))
              .where(and(...baseConditions))
              .groupBy(productVariants.sizeId, brandSizes.name);
            results.sizeDistribution = sizeCounts;
            break;
          }

          case "productVariantCounts": {
            const productCounts = await db
              .select({
                productId: productVariants.productId,
                productName: products.name,
                variantCount: count(),
              })
              .from(productVariants)
              .innerJoin(products, eq(productVariants.productId, products.id))
              .where(and(...baseConditions))
              .groupBy(productVariants.productId, products.name)
              .orderBy(desc(count()));
            results.productVariantCounts = productCounts;
            break;
          }

          case "imageStatistics": {
            const imageStats = await db
              .select({
                totalVariants: count(),
                withImages: count(productVariants.productImageUrl),
                withoutImages: sql<number>`COUNT(*) - COUNT(${productVariants.productImageUrl})`,
              })
              .from(productVariants)
              .innerJoin(products, eq(productVariants.productId, products.id))
              .where(and(...baseConditions));
            results.imageStatistics = imageStats[0];
            break;
          }

          case "skuStatistics": {
            const skuStats = await db
              .select({
                totalVariants: count(),
                withSkus: count(productVariants.sku),
                withoutSkus: sql<number>`COUNT(*) - COUNT(${productVariants.sku})`,
              })
              .from(productVariants)
              .innerJoin(products, eq(productVariants.productId, products.id))
              .where(and(...baseConditions));
            results.skuStatistics = skuStats[0];
            break;
          }

          case "upidStatistics": {
            const upidStats = await db
              .select({
                totalVariants: count(),
                withUpids: count(productVariants.upid),
              })
              .from(productVariants)
              .innerJoin(products, eq(productVariants.productId, products.id))
              .where(and(...baseConditions));
            results.upidStatistics = upidStats[0];
            break;
          }

          case "identifierDuplication":
            // This is a complex query that would require additional logic
            // For now, return a placeholder
            results.identifierDuplication = {
              duplicateSkus: [],
              duplicateUpids: [],
            };
            break;

          case "attributeCombinations": {
            const combinations = await db
              .select({
                colorId: productVariants.colorId,
                sizeId: productVariants.sizeId,
                colorName: brandColors.name,
                sizeName: brandSizes.name,
                count: count(),
              })
              .from(productVariants)
              .innerJoin(products, eq(productVariants.productId, products.id))
              .leftJoin(
                brandColors,
                eq(productVariants.colorId, brandColors.id),
              )
              .leftJoin(brandSizes, eq(productVariants.sizeId, brandSizes.id))
              .where(and(...baseConditions))
              .groupBy(
                productVariants.colorId,
                productVariants.sizeId,
                brandColors.name,
                brandSizes.name,
              )
              .orderBy(desc(count()));
            results.attributeCombinations = combinations;
            break;
          }

          case "completenessStatistics": {
            // This would require calculating completeness scores for all variants
            // For performance, we'll return a simplified version
            const completenessStats = await db
              .select({
                totalVariants: count(),
                completeVariants: sql<number>`COUNT(CASE WHEN ${productVariants.sku} IS NOT NULL AND ${productVariants.colorId} IS NOT NULL AND ${productVariants.sizeId} IS NOT NULL AND ${productVariants.productImageUrl} IS NOT NULL THEN 1 END)`,
              })
              .from(productVariants)
              .innerJoin(products, eq(productVariants.productId, products.id))
              .where(and(...baseConditions));
            results.completenessStatistics = completenessStats[0];
            break;
          }

          case "passportLinkageStats": {
            const passportStats = await db
              .select({
                totalVariants: count(),
                withPassports: sql<number>`COUNT(CASE WHEN ${passports.id} IS NOT NULL THEN 1 END)`,
                withoutPassports: sql<number>`COUNT(CASE WHEN ${passports.id} IS NULL THEN 1 END)`,
                publishedPassports: sql<number>`COUNT(CASE WHEN ${passports.passportStatus} = 'published' THEN 1 END)`,
                draftPassports: sql<number>`COUNT(CASE WHEN ${passports.passportStatus} = 'draft' THEN 1 END)`,
                passportCoveragePercentage: sql<number>`ROUND((COUNT(CASE WHEN ${passports.id} IS NOT NULL THEN 1 END) * 100.0) / COUNT(*), 2)`,
              })
              .from(productVariants)
              .innerJoin(products, eq(productVariants.productId, products.id))
              .leftJoin(passports, eq(passports.variantId, productVariants.id))
              .where(and(...baseConditions));
            results.passportLinkageStats = passportStats[0];
            break;
          }

          case "categoryDistribution": {
            const categoryStats = await db
              .select({
                categoryId: products.categoryId,
                categoryName: sql<string>`COALESCE(${categories.name}, 'Uncategorized')`,
                variantCount: count(),
                passportCoverage: sql<number>`ROUND((COUNT(CASE WHEN ${passports.id} IS NOT NULL THEN 1 END) * 100.0) / COUNT(*), 2)`,
              })
              .from(productVariants)
              .innerJoin(products, eq(productVariants.productId, products.id))
              .leftJoin(categories, eq(products.categoryId, categories.id))
              .leftJoin(passports, eq(passports.variantId, productVariants.id))
              .where(and(...baseConditions))
              .groupBy(products.categoryId, categories.name)
              .orderBy(desc(count()));
            results.categoryDistribution = categoryStats;
            break;
          }

          default:
            // For any metrics not explicitly handled, return empty result
            results[metric] = [];
            break;
        }
      }

      return {
        metrics: results,
        meta: {
          asOf: new Date(),
          brandId,
          requestedMetrics: metrics,
          filtersApplied: Object.keys(filter).length > 0,
        },
      };
    }),

  /**
   * Soft delete variants (for future implementation)
   */
  delete: protectedProcedure
    .input(
      z.object({
        where: z.object({
          variantId: z.string().uuid().optional(),
          ids: z.array(z.string().uuid()).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;

      if (!brandId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "No active brand context",
        });
      }

      const { where } = input;

      // Build conditions with brand isolation
      const conditions = [
        eq(products.brandId, brandId),
        eq(productVariants.productId, products.id),
      ];

      if (where.variantId) {
        conditions.push(eq(productVariants.id, where.variantId));
      }
      if (where.ids) {
        conditions.push(inArray(productVariants.id, where.ids));
      }

      // For now, perform hard delete. In the future, implement soft delete with deletedAt field
      const deletedVariants = await db
        .delete(productVariants)
        .where(
          and(
            ...(where.variantId
              ? [eq(productVariants.id, where.variantId)]
              : []),
            ...(where.ids ? [inArray(productVariants.id, where.ids)] : []),
            // Brand isolation through EXISTS subquery
            sql`EXISTS (
              SELECT 1 FROM ${products}
              WHERE ${products}.id = ${productVariants.productId}
              AND ${products}.brand_id = ${brandId}
            )`,
          ),
        )
        .returning();

      return {
        data: deletedVariants,
        affectedCount: deletedVariants.length,
      };
    }),
});
