import { and, eq, inArray } from "@v1/db/queries";
import {
  batchCreatePassportsForVariants,
  batchOrphanPassportsByVariantIds,
  clearAllVariantOverrides,
  createPassportForVariant,
  getPassportByVariantId,
  getProductVariantsWithAttributes,
  getVariantOverridesOnly,
  listVariantsForProduct,
  orphanPassport,
} from "@v1/db/queries/products";
import {
  productPassports,
  productVariantAttributes,
  productVariants,
  products,
  variantCommercial,
  variantEnvironment,
  variantJourneySteps,
  variantMaterials,
  variantWeight,
} from "@v1/db/schema";
import { generateGloballyUniqueUpids } from "@v1/db/queries/products";
/**
 * Unified Product Variants Router
 *
 * Provides CRUD operations for product variants using public identifiers
 * (productHandle + variantUpid) instead of internal UUIDs.
 *
 * Includes:
 * - Core variant operations (list, get, create, update, delete)
 * - Override data management (environment, materials, journey, etc.)
 * - Batch operations (batchCreate, batchUpdate, batchDelete)
 * - Sync operation for product form saves
 */
import { z } from "zod";
import { revalidateProduct } from "../../../lib/dpp-revalidation.js";
import {
  paginationLimitSchema,
  shortStringSchema,
  uuidSchema,
} from "../../../schemas/_shared/primitives.js";
import { upidSchema } from "../../../schemas/products.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import {
  createEntityResponse,
  createListResponse,
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };
type BrandDb = BrandContext["db"];

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

const variantIdentifierSchema = z.object({
  productHandle: shortStringSchema,
  variantUpid: z.string().min(1),
});

const variantOverridesSchema = z
  .object({
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    imagePath: z.string().nullable().optional(),
    environment: z
      .object({
        carbonKgCo2e: z.string().nullable().optional(),
        waterLiters: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    commercial: z
      .object({
        webshopUrl: z.string().url().nullable().optional(),
        price: z.string().nullable().optional(),
        currency: z.string().nullable().optional(),
        salesStatus: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    weight: z
      .object({
        weight: z.string().nullable().optional(),
        weightUnit: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    materials: z
      .array(
        z.object({
          brandMaterialId: z.string().uuid(),
          percentage: z.string().nullable().optional(),
        }),
      )
      .optional(),
    journey: z
      .array(
        z.object({
          sortIndex: z.number().int().min(0),
          stepType: z.string().min(1),
          operatorId: z.string().uuid(),
        }),
      )
      .optional(),
  })
  .optional();

const createVariantInputSchema = z.object({
  attributeValueIds: z.array(z.string().uuid()).optional().default([]),
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  overrides: variantOverridesSchema,
});

const updateVariantInputSchema = z.object({
  variantUpid: z.string().min(1),
  attributeValueIds: z.array(z.string().uuid()).optional(),
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  overrides: variantOverridesSchema,
});

const syncVariantInputSchema = z.object({
  upid: z.string().optional(),
  attributeValueIds: z.array(z.string().uuid()).optional().default([]),
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Find product by handle, ensuring it belongs to the active brand.
 */
async function findProductByHandle(
  db: BrandDb,
  brandId: string,
  productHandle: string,
): Promise<{ id: string }> {
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.productHandle, productHandle),
        eq(products.brandId, brandId),
      ),
    )
    .limit(1);

  if (!product) {
    throw badRequest("Product not found for the active brand");
  }

  return product;
}

/**
 * Find variant by UPID and product handle, ensuring it belongs to the active brand.
 */
async function findVariantByUpid(
  db: BrandDb,
  brandId: string,
  productHandle: string,
  variantUpid: string,
): Promise<{ variantId: string; productId: string }> {
  const [row] = await db
    .select({
      variantId: productVariants.id,
      productId: products.id,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(products.brandId, brandId),
        eq(products.productHandle, productHandle),
        eq(productVariants.upid, variantUpid),
      ),
    )
    .limit(1);

  if (!row) {
    throw badRequest(
      "Variant not found for the active brand and product handle",
    );
  }

  return row;
}

/**
 * Apply override data to a variant.
 */
async function applyVariantOverrides(
  db: BrandDb,
  variantId: string,
  overrides: z.infer<typeof variantOverridesSchema>,
): Promise<void> {
  if (!overrides) return;

  const now = new Date().toISOString();

  // Core fields (name, description, imagePath)
  if (
    overrides.name !== undefined ||
    overrides.description !== undefined ||
    overrides.imagePath !== undefined
  ) {
    const updatePayload: Record<string, unknown> = { updatedAt: now };
    if (overrides.name !== undefined) updatePayload.name = overrides.name;
    if (overrides.description !== undefined)
      updatePayload.description = overrides.description;
    if (overrides.imagePath !== undefined)
      updatePayload.imagePath = overrides.imagePath;

    await db
      .update(productVariants)
      .set(updatePayload)
      .where(eq(productVariants.id, variantId));
  }

  // Environment
  if (overrides.environment !== undefined) {
    const [existing] = await db
      .select({ variantId: variantEnvironment.variantId })
      .from(variantEnvironment)
      .where(eq(variantEnvironment.variantId, variantId))
      .limit(1);

    if (overrides.environment === null) {
      // Clear environment
      if (existing) {
        await db
          .delete(variantEnvironment)
          .where(eq(variantEnvironment.variantId, variantId));
      }
    } else if (existing) {
      await db
        .update(variantEnvironment)
        .set({
          carbonKgCo2e: overrides.environment.carbonKgCo2e ?? null,
          waterLiters: overrides.environment.waterLiters ?? null,
          updatedAt: now,
        })
        .where(eq(variantEnvironment.variantId, variantId));
    } else {
      await db.insert(variantEnvironment).values({
        variantId,
        carbonKgCo2e: overrides.environment.carbonKgCo2e ?? null,
        waterLiters: overrides.environment.waterLiters ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Commercial
  if (overrides.commercial !== undefined) {
    const [existing] = await db
      .select({ variantId: variantCommercial.variantId })
      .from(variantCommercial)
      .where(eq(variantCommercial.variantId, variantId))
      .limit(1);

    if (overrides.commercial === null) {
      if (existing) {
        await db
          .delete(variantCommercial)
          .where(eq(variantCommercial.variantId, variantId));
      }
    } else if (existing) {
      await db
        .update(variantCommercial)
        .set({
          webshopUrl: overrides.commercial.webshopUrl ?? null,
          price: overrides.commercial.price ?? null,
          currency: overrides.commercial.currency ?? null,
          salesStatus: overrides.commercial.salesStatus ?? null,
          updatedAt: now,
        })
        .where(eq(variantCommercial.variantId, variantId));
    } else {
      await db.insert(variantCommercial).values({
        variantId,
        webshopUrl: overrides.commercial.webshopUrl ?? null,
        price: overrides.commercial.price ?? null,
        currency: overrides.commercial.currency ?? null,
        salesStatus: overrides.commercial.salesStatus ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Weight
  if (overrides.weight !== undefined) {
    const [existing] = await db
      .select({ variantId: variantWeight.variantId })
      .from(variantWeight)
      .where(eq(variantWeight.variantId, variantId))
      .limit(1);

    if (overrides.weight === null) {
      if (existing) {
        await db
          .delete(variantWeight)
          .where(eq(variantWeight.variantId, variantId));
      }
    } else if (existing) {
      await db
        .update(variantWeight)
        .set({
          weight: overrides.weight.weight ?? null,
          weightUnit: overrides.weight.weightUnit ?? null,
          updatedAt: now,
        })
        .where(eq(variantWeight.variantId, variantId));
    } else {
      await db.insert(variantWeight).values({
        variantId,
        weight: overrides.weight.weight ?? null,
        weightUnit: overrides.weight.weightUnit ?? null,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Materials (replace)
  if (overrides.materials !== undefined) {
    await db
      .delete(variantMaterials)
      .where(eq(variantMaterials.variantId, variantId));

    if (overrides.materials.length > 0) {
      await db.insert(variantMaterials).values(
        overrides.materials.map((m) => ({
          variantId,
          brandMaterialId: m.brandMaterialId,
          percentage: m.percentage ?? null,
          createdAt: now,
        })),
      );
    }
  }

  // Journey steps (replace)
  if (overrides.journey !== undefined) {
    await db
      .delete(variantJourneySteps)
      .where(eq(variantJourneySteps.variantId, variantId));

    if (overrides.journey.length > 0) {
      await db.insert(variantJourneySteps).values(
        overrides.journey.map((s) => ({
          variantId,
          sortIndex: s.sortIndex,
          stepType: s.stepType,
          operatorId: s.operatorId,
          createdAt: now,
        })),
      );
    }
  }
}

// NOTE: UPID generation now uses the centralized generateGloballyUniqueUpids
// function from @v1/db/queries/products which ensures uniqueness across both
// product_variants AND product_passports tables.

// =============================================================================
// ROUTER
// =============================================================================

export const productVariantsRouter = createTRPCRouter({
  /**
   * List all variants for a product.
   */
  list: brandRequiredProcedure
    .input(
      z.object({
        productHandle: shortStringSchema,
        includeOverrides: z.boolean().optional().default(false),
        cursor: z.string().optional(),
        limit: paginationLimitSchema.optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      const variants = await listVariantsForProduct(
        db,
        brandId,
        { product_handle: input.productHandle },
        { cursor: input.cursor, limit: input.limit },
      );

      // TODO: If includeOverrides, fetch override data for each variant

      return createListResponse(variants);
    }),

  /**
   * Get a single variant by UPID.
   * Returns passport UPID if the variant has been published.
   */
  get: brandRequiredProcedure
    .input(
      variantIdentifierSchema.extend({
        includeOverrides: z.boolean().optional().default(false),
        includePassport: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      // Verify variant exists and belongs to brand
      const { variantId } = await findVariantByUpid(
        db,
        brandId,
        input.productHandle,
        input.variantUpid,
      );

      // Get variant with attributes
      const product = await findProductByHandle(
        db,
        brandId,
        input.productHandle,
      );
      const variants = await getProductVariantsWithAttributes(
        db,
        brandId,
        product.id,
      );

      const variant = variants.find((v) => v.upid === input.variantUpid);
      if (!variant) {
        throw badRequest("Variant not found");
      }

      // TODO: If includeOverrides, fetch override data

      // Fetch passport info if requested or always include basic passport UPID
      let passportInfo = null;
      if (input.includePassport) {
        const passport = await getPassportByVariantId(db, variantId);
        if (passport) {
          passportInfo = {
            passportUpid: passport.upid,
            isPublished: passport.currentVersionId !== null,
            firstPublishedAt: passport.firstPublishedAt,
          };
        }
      }

      return {
        ...variant,
        passport: passportInfo,
      };
    }),

  /**
   * Get variant overrides only (for variant form).
   */
  getOverrides: brandRequiredProcedure
    .input(variantIdentifierSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      // Verify variant exists and belongs to brand
      await findVariantByUpid(
        db,
        brandId,
        input.productHandle,
        input.variantUpid,
      );

      const overrides = await getVariantOverridesOnly(
        db,
        input.productHandle,
        input.variantUpid,
      );

      if (!overrides) {
        throw badRequest("Variant not found");
      }

      return overrides;
    }),

  /**
   * Create a single variant.
   */
  create: brandRequiredProcedure
    .input(
      z.object({
        productHandle: shortStringSchema,
        attributeValueIds: z.array(z.string().uuid()).optional().default([]),
        sku: z.string().max(100).optional(),
        barcode: z.string().max(100).optional(),
        overrides: variantOverridesSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const product = await findProductByHandle(
          db,
          brandId,
          input.productHandle,
        );

        // Check for duplicate attribute combination
        if (input.attributeValueIds.length > 0) {
          const existingVariants = await db
            .select({ id: productVariants.id })
            .from(productVariants)
            .where(eq(productVariants.productId, product.id));

          if (existingVariants.length > 0) {
            const existingAttributes = await db
              .select({
                variantId: productVariantAttributes.variantId,
                attributeValueId: productVariantAttributes.attributeValueId,
              })
              .from(productVariantAttributes)
              .where(
                inArray(
                  productVariantAttributes.variantId,
                  existingVariants.map((v) => v.id),
                ),
              );

            const variantAttrMap = new Map<string, Set<string>>();
            for (const attr of existingAttributes) {
              if (!variantAttrMap.has(attr.variantId)) {
                variantAttrMap.set(attr.variantId, new Set());
              }
              variantAttrMap.get(attr.variantId)!.add(attr.attributeValueId);
            }

            const inputValueSet = new Set(input.attributeValueIds);
            for (const [, attrSet] of variantAttrMap) {
              if (
                attrSet.size === inputValueSet.size &&
                [...attrSet].every((v) => inputValueSet.has(v))
              ) {
                throw badRequest(
                  "A variant with this attribute combination already exists",
                );
              }
            }
          }
        }

        // Generate UPID
        const [upid] = await generateGloballyUniqueUpids(db, 1);

        // Use transaction to ensure atomicity - if any step fails, rollback
        const variant = await db.transaction(async (tx) => {
          // Create variant
          const [newVariant] = await tx
            .insert(productVariants)
            .values({
              productId: product.id,
              upid,
              sku: input.sku ?? null,
              barcode: input.barcode ?? null,
            })
            .returning({
              id: productVariants.id,
              upid: productVariants.upid,
            });

          if (!newVariant) {
            throw badRequest("Failed to create variant");
          }

          // Create attribute assignments
          if (input.attributeValueIds.length > 0) {
            await tx.insert(productVariantAttributes).values(
              input.attributeValueIds.map((valueId, index) => ({
                variantId: newVariant.id,
                attributeValueId: valueId,
                sortOrder: index,
              })),
            );
          }

          // Apply overrides (note: applyVariantOverrides uses db, not tx)
          // For full transactionality, we'd need to refactor applyVariantOverrides
          // to accept a transaction context. For now, core variant + attributes are atomic.

          return newVariant;
        });

        // Create passport for the new variant
        await createPassportForVariant(db, variant.id, brandId, {
          upid: variant.upid!,
          sku: input.sku,
          barcode: input.barcode,
        });

        // Apply overrides outside transaction (existing pattern)
        if (input.overrides) {
          await applyVariantOverrides(db, variant.id, input.overrides);
        }

        // Revalidate product cache
        revalidateProduct(input.productHandle).catch(() => {});

        return createEntityResponse({
          id: variant.id,
          upid: variant.upid,
        });
      } catch (error) {
        throw wrapError(error, "Failed to create variant");
      }
    }),

  /**
   * Update a single variant.
   */
  update: brandRequiredProcedure
    .input(
      variantIdentifierSchema.extend({
        attributeValueIds: z.array(z.string().uuid()).optional(),
        sku: z.string().max(100).optional(),
        barcode: z.string().max(100).optional(),
        overrides: variantOverridesSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const { variantId } = await findVariantByUpid(
          db,
          brandId,
          input.productHandle,
          input.variantUpid,
        );

        // Update core variant fields
        const updatePayload: Record<string, unknown> = {
          updatedAt: new Date().toISOString(),
        };
        if (input.sku !== undefined) updatePayload.sku = input.sku;
        if (input.barcode !== undefined) updatePayload.barcode = input.barcode;

        if (Object.keys(updatePayload).length > 1) {
          await db
            .update(productVariants)
            .set(updatePayload)
            .where(eq(productVariants.id, variantId));
        }

        // Update attribute assignments if provided
        if (input.attributeValueIds !== undefined) {
          await db
            .delete(productVariantAttributes)
            .where(eq(productVariantAttributes.variantId, variantId));

          if (input.attributeValueIds.length > 0) {
            await db.insert(productVariantAttributes).values(
              input.attributeValueIds.map((valueId, index) => ({
                variantId,
                attributeValueId: valueId,
                sortOrder: index,
              })),
            );
          }
        }

        // Apply overrides
        if (input.overrides) {
          await applyVariantOverrides(db, variantId, input.overrides);
        }

        // Revalidate product cache
        revalidateProduct(input.productHandle).catch(() => {});

        return createEntityResponse({ success: true, variantId });
      } catch (error) {
        throw wrapError(error, "Failed to update variant");
      }
    }),

  /**
   * Delete a single variant.
   */
  delete: brandRequiredProcedure
    .input(variantIdentifierSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const { variantId } = await findVariantByUpid(
          db,
          brandId,
          input.productHandle,
          input.variantUpid,
        );

        // Orphan the passport before deleting the variant
        // This preserves the passport record for QR code resolution
        const passport = await getPassportByVariantId(db, variantId);
        if (passport) {
          await orphanPassport(db, passport.id);
        }

        // Delete variant (cascades will handle related data)
        await db
          .delete(productVariants)
          .where(eq(productVariants.id, variantId));

        // Revalidate product cache
        revalidateProduct(input.productHandle).catch(() => {});

        return createEntityResponse({ deleted: true });
      } catch (error) {
        throw wrapError(error, "Failed to delete variant");
      }
    }),

  // ─── Batch Operations ─────────────────────────────────────────────────────

  /**
   * Batch create variants.
   */
  batchCreate: brandRequiredProcedure
    .input(
      z.object({
        productHandle: shortStringSchema,
        variants: z.array(createVariantInputSchema).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const product = await findProductByHandle(
          db,
          brandId,
          input.productHandle,
        );

        // Generate UPIDs for all variants
        const upids = await generateGloballyUniqueUpids(
          db,
          input.variants.length,
        );

        const createdVariants: Array<{ id: string; upid: string }> = [];

        // Track variant overrides to apply after transaction
        const variantOverridesToApply: Array<{
          variantId: string;
          overrides: NonNullable<(typeof input.variants)[number]["overrides"]>;
        }> = [];

        await db.transaction(async (tx) => {
          for (let i = 0; i < input.variants.length; i++) {
            const variantInput = input.variants[i]!;
            const upid = upids[i]!;

            const [variant] = await tx
              .insert(productVariants)
              .values({
                productId: product.id,
                upid,
                sku: variantInput.sku ?? null,
                barcode: variantInput.barcode ?? null,
              })
              .returning({
                id: productVariants.id,
                upid: productVariants.upid,
              });

            if (!variant) continue;

            createdVariants.push({ id: variant.id, upid: variant.upid! });

            // Create attribute assignments
            if (variantInput.attributeValueIds.length > 0) {
              await tx.insert(productVariantAttributes).values(
                variantInput.attributeValueIds.map((valueId, index) => ({
                  variantId: variant.id,
                  attributeValueId: valueId,
                  sortOrder: index,
                })),
              );
            }

            // Track overrides to apply after transaction
            if (variantInput.overrides) {
              variantOverridesToApply.push({
                variantId: variant.id,
                overrides: variantInput.overrides,
              });
            }
          }
        });

        // Create passports for all newly created variants
        if (createdVariants.length > 0) {
          await batchCreatePassportsForVariants(
            db,
            brandId,
            createdVariants.map((v, i) => ({
              variantId: v.id,
              upid: v.upid,
              sku: input.variants[i]?.sku,
              barcode: input.variants[i]?.barcode,
            })),
          );
        }

        // Apply overrides outside transaction (existing pattern from single create)
        for (const { variantId, overrides } of variantOverridesToApply) {
          await applyVariantOverrides(db, variantId, overrides);
        }

        // Revalidate product cache
        revalidateProduct(input.productHandle).catch(() => {});

        return createEntityResponse({
          created: createdVariants.length,
          variants: createdVariants,
        });
      } catch (error) {
        throw wrapError(error, "Failed to batch create variants");
      }
    }),

  /**
   * Batch update variants.
   */
  batchUpdate: brandRequiredProcedure
    .input(
      z.object({
        productHandle: shortStringSchema,
        variants: z.array(updateVariantInputSchema).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const product = await findProductByHandle(
          db,
          brandId,
          input.productHandle,
        );

        let updated = 0;

        // Track variant overrides to apply after transaction
        const variantOverridesToApply: Array<{
          variantId: string;
          overrides: NonNullable<(typeof input.variants)[number]["overrides"]>;
        }> = [];

        await db.transaction(async (tx) => {
          for (const variantInput of input.variants) {
            // Find variant by UPID
            const [variant] = await tx
              .select({ id: productVariants.id })
              .from(productVariants)
              .where(
                and(
                  eq(productVariants.productId, product.id),
                  eq(productVariants.upid, variantInput.variantUpid),
                ),
              )
              .limit(1);

            if (!variant) continue;

            // Update core fields
            const updatePayload: Record<string, unknown> = {
              updatedAt: new Date().toISOString(),
            };
            if (variantInput.sku !== undefined)
              updatePayload.sku = variantInput.sku;
            if (variantInput.barcode !== undefined)
              updatePayload.barcode = variantInput.barcode;

            if (Object.keys(updatePayload).length > 1) {
              await tx
                .update(productVariants)
                .set(updatePayload)
                .where(eq(productVariants.id, variant.id));
            }

            // Update attribute assignments if provided
            if (variantInput.attributeValueIds !== undefined) {
              await tx
                .delete(productVariantAttributes)
                .where(eq(productVariantAttributes.variantId, variant.id));

              if (variantInput.attributeValueIds.length > 0) {
                await tx.insert(productVariantAttributes).values(
                  variantInput.attributeValueIds.map((valueId, index) => ({
                    variantId: variant.id,
                    attributeValueId: valueId,
                    sortOrder: index,
                  })),
                );
              }
            }

            // Track overrides to apply after transaction
            if (variantInput.overrides) {
              variantOverridesToApply.push({
                variantId: variant.id,
                overrides: variantInput.overrides,
              });
            }

            updated++;
          }
        });

        // Apply overrides outside transaction (existing pattern from single update)
        for (const { variantId, overrides } of variantOverridesToApply) {
          await applyVariantOverrides(db, variantId, overrides);
        }

        // Revalidate product cache
        revalidateProduct(input.productHandle).catch(() => {});

        return createEntityResponse({ updated });
      } catch (error) {
        throw wrapError(error, "Failed to batch update variants");
      }
    }),

  /**
   * Batch delete variants.
   */
  batchDelete: brandRequiredProcedure
    .input(
      z.object({
        productHandle: shortStringSchema,
        variantUpids: z.array(z.string()).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const product = await findProductByHandle(
          db,
          brandId,
          input.productHandle,
        );

        // Find all variants by UPID
        const variants = await db
          .select({ id: productVariants.id })
          .from(productVariants)
          .where(
            and(
              eq(productVariants.productId, product.id),
              inArray(productVariants.upid, input.variantUpids),
            ),
          );

        if (variants.length > 0) {
          const variantIds = variants.map((v) => v.id);

          // Orphan passports before deleting variants
          await batchOrphanPassportsByVariantIds(db, variantIds);

          // Delete variants
          await db
            .delete(productVariants)
            .where(inArray(productVariants.id, variantIds));
        }

        // Revalidate product cache
        revalidateProduct(input.productHandle).catch(() => {});

        return createEntityResponse({ deleted: variants.length });
      } catch (error) {
        throw wrapError(error, "Failed to batch delete variants");
      }
    }),

  // ─── Sync Operation ───────────────────────────────────────────────────────

  /**
   * Sync variants for a product form save.
   *
   * Compares incoming variants against existing variants by UPID:
   * - Variants with UPID → update existing
   * - Variants without UPID → create new (generates UPID)
   * - Existing variants not in input → delete
   */
  sync: brandRequiredProcedure
    .input(
      z.object({
        productHandle: shortStringSchema,
        variants: z.array(syncVariantInputSchema).max(500),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const product = await findProductByHandle(
          db,
          brandId,
          input.productHandle,
        );

        // Get existing variants
        const existingVariants = await db
          .select({
            id: productVariants.id,
            upid: productVariants.upid,
          })
          .from(productVariants)
          .where(eq(productVariants.productId, product.id));

        const existingByUpid = new Map(
          existingVariants.filter((v) => v.upid).map((v) => [v.upid!, v.id]),
        );

        // Categorize input variants
        const toCreate: Array<(typeof input.variants)[number]> = [];
        const toUpdate: Array<{
          variantId: string;
          input: (typeof input.variants)[number];
        }> = [];
        const inputUpids = new Set<string>();

        for (const variantInput of input.variants) {
          if (variantInput.upid && existingByUpid.has(variantInput.upid)) {
            toUpdate.push({
              variantId: existingByUpid.get(variantInput.upid)!,
              input: variantInput,
            });
            inputUpids.add(variantInput.upid);
          } else {
            toCreate.push(variantInput);
          }
        }

        // Find variants to delete (existing but not in input)
        const toDelete = existingVariants.filter(
          (v) => v.upid && !inputUpids.has(v.upid),
        );

        // Generate UPIDs for new variants
        const newUpids = await generateGloballyUniqueUpids(db, toCreate.length);

        const createdVariants: Array<{ id: string; upid: string }> = [];
        let updatedCount = 0;
        let deletedCount = 0;

        // Orphan passports for variants being deleted (before the transaction)
        if (toDelete.length > 0) {
          await batchOrphanPassportsByVariantIds(
            db,
            toDelete.map((v) => v.id),
          );
        }

        await db.transaction(async (tx) => {
          // Delete variants
          if (toDelete.length > 0) {
            await tx.delete(productVariants).where(
              inArray(
                productVariants.id,
                toDelete.map((v) => v.id),
              ),
            );
            deletedCount = toDelete.length;
          }

          // Create new variants
          for (let i = 0; i < toCreate.length; i++) {
            const variantInput = toCreate[i]!;
            const upid = newUpids[i]!;

            const [variant] = await tx
              .insert(productVariants)
              .values({
                productId: product.id,
                upid,
                sku: variantInput.sku ?? null,
                barcode: variantInput.barcode ?? null,
              })
              .returning({
                id: productVariants.id,
                upid: productVariants.upid,
              });

            if (!variant) continue;

            createdVariants.push({ id: variant.id, upid: variant.upid! });

            // Create attribute assignments
            if (variantInput.attributeValueIds.length > 0) {
              await tx.insert(productVariantAttributes).values(
                variantInput.attributeValueIds.map((valueId, index) => ({
                  variantId: variant.id,
                  attributeValueId: valueId,
                  sortOrder: index,
                })),
              );
            }
          }

          // Update existing variants
          for (const { variantId, input: variantInput } of toUpdate) {
            const updatePayload: Record<string, unknown> = {
              updatedAt: new Date().toISOString(),
            };
            if (variantInput.sku !== undefined)
              updatePayload.sku = variantInput.sku;
            if (variantInput.barcode !== undefined)
              updatePayload.barcode = variantInput.barcode;

            if (Object.keys(updatePayload).length > 1) {
              await tx
                .update(productVariants)
                .set(updatePayload)
                .where(eq(productVariants.id, variantId));
            }

            // Update attribute assignments
            await tx
              .delete(productVariantAttributes)
              .where(eq(productVariantAttributes.variantId, variantId));

            if (variantInput.attributeValueIds.length > 0) {
              await tx.insert(productVariantAttributes).values(
                variantInput.attributeValueIds.map((valueId, index) => ({
                  variantId,
                  attributeValueId: valueId,
                  sortOrder: index,
                })),
              );
            }

            updatedCount++;
          }
        });

        // Create passports for newly created variants
        if (createdVariants.length > 0) {
          await batchCreatePassportsForVariants(
            db,
            brandId,
            createdVariants.map((v, i) => ({
              variantId: v.id,
              upid: v.upid,
              sku: toCreate[i]?.sku,
              barcode: toCreate[i]?.barcode,
            })),
          );
        }

        // Revalidate product cache
        revalidateProduct(input.productHandle).catch(() => {});

        return createEntityResponse({
          created: createdVariants.length,
          updated: updatedCount,
          deleted: deletedCount,
          variants: [
            ...createdVariants,
            ...toUpdate.map((u) => ({
              id: u.variantId,
              upid: u.input.upid!,
            })),
          ],
        });
      } catch (error) {
        throw wrapError(error, "Failed to sync variants");
      }
    }),

  // ─── Override Operations ──────────────────────────────────────────────────

  /**
   * Clear all overrides for a variant.
   */
  clearOverrides: brandRequiredProcedure
    .input(variantIdentifierSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx as BrandContext;

      try {
        const { variantId } = await findVariantByUpid(
          db,
          brandId,
          input.productHandle,
          input.variantUpid,
        );

        await clearAllVariantOverrides(db, variantId);

        // Revalidate product cache
        revalidateProduct(input.productHandle).catch(() => {});

        return createEntityResponse({ success: true, variantId });
      } catch (error) {
        throw wrapError(error, "Failed to clear variant overrides");
      }
    }),
});

export type ProductVariantsRouter = typeof productVariantsRouter;
