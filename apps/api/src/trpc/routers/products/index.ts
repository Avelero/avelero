/**
 * Products domain router implementation.
 *
 * Exposes product CRUD operations along with nested routers for variants and
 * attribute writers. Supports include flags that collapse N+1 queries into
 * batched lookups handled by the database layer.
 *
 * Phase 5 changes:
 * - Merged `get` and `getByUpid` into single `get` endpoint with discriminated union
 */
import {
  createProduct,
  deleteProduct,
  getProductWithIncludes,
  listProductsWithIncludes,
  updateProduct,
  setProductEcoClaims,
  setProductJourneySteps,
  upsertProductEnvironment,
  upsertProductMaterials,
  setProductTags,
  bulkDeleteProductsByFilter,
  bulkDeleteProductsByIds,
  bulkUpdateProductsByFilter,
  bulkUpdateProductsByIds,
} from "@v1/db/queries/products";
import { revalidateProduct } from "../../../lib/dpp-revalidation.js";
import { productVariants, products } from "@v1/db/schema";
import { and, eq, inArray } from "@v1/db/queries";
import { generateUniqueUpid, generateUniqueUpids } from "@v1/db/utils";
import {
  productsDomainCreateSchema,
  productsDomainListSchema,
  productUnifiedGetSchema,
  unifiedUpdateSchema,
  unifiedDeleteSchema,
} from "../../../schemas/products.js";
import { generateProductHandle } from "../../../schemas/_shared/primitives.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import {
  createEntityResponse,
  createPaginatedResponse,
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";
import { productVariantsRouter } from "./variants.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

function ensureBrandScope(
  ctx: BrandContext,
  requestedBrandId?: string | null,
): string {
  const activeBrandId = ctx.brandId;
  if (requestedBrandId && requestedBrandId !== activeBrandId) {
    throw badRequest("Active brand does not match the requested brand_id");
  }
  return activeBrandId;
}

function normalizeBrandId(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

type CreateProductInput = Parameters<typeof createProduct>[2];
type UpdateProductInput = Parameters<typeof updateProduct>[2];
type AttributeInput = {
  materials?: { brand_material_id: string; percentage?: string | number }[];
  eco_claim_ids?: string[];
  journey_steps?: {
    sort_index: number;
    step_type: string;
    facility_id: string; // 1:1 relationship with facility
  }[];
  environment?: {
    carbon_kg_co2e?: string | number;
    water_liters?: string | number;
  };
  tag_ids?: string[];
};

export const productsRouter = createTRPCRouter({
  list: brandRequiredProcedure
    .input(productsDomainListSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(
        brandCtx,
        normalizeBrandId(input.brand_id),
      );

      // Pass FilterState and search separately to database layer
      // FilterState is converted to SQL WHERE clauses in the database query layer
      const result = await listProductsWithIncludes(
        brandCtx.db,
        brandId,
        {
          search: input.search, // Search is top-level (separate from FilterState)
          filterState: input.filters, // FilterState structure (converted to SQL WHERE clauses)
        } as unknown as Parameters<typeof listProductsWithIncludes>[2],
        {
          cursor: input.cursor,
          limit: input.limit,
          includeVariants: input.includeVariants,
          includeAttributes: input.includeAttributes,
          sort: input.sort,
        },
      );

      return createPaginatedResponse([...result.data], {
        total: result.meta.total,
        cursor: result.meta.cursor,
        hasMore: result.meta.hasMore,
      });
    }),

  /**
   * Get a single product by ID or handle.
   * Unified endpoint that accepts discriminated union: { id } | { handle }
   */
  get: brandRequiredProcedure
    .input(productUnifiedGetSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(brandCtx);
      
      // Handle discriminated union: { id } or { handle }
      const identifier = 'id' in input 
        ? { id: input.id } 
        : { handle: input.handle };
      
      return getProductWithIncludes(brandCtx.db, brandId, identifier, {
        includeVariants: input.includeVariants,
        includeAttributes: input.includeAttributes,
      });
    }),

  create: brandRequiredProcedure
    .input(productsDomainCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(brandCtx, input.brand_id);

      try {
        const upid = await generateUniqueUpid({
          isTaken: async (candidate: string) => {
            const existing = await brandCtx.db
              .select({ id: products.id })
              .from(products)
              .where(
                and(
                  eq(products.brandId, brandId),
                  eq(products.productHandle, candidate),
                ),
              )
              .limit(1);
            return Boolean(existing[0]);
          },
        });

        // Auto-generate product handle from name if not provided
        const productHandle = input.product_handle || generateProductHandle(input.name);

        const payload: Record<string, unknown> = {
          name: input.name,
          upid,
          productHandle,
          description: input.description ?? null,
          categoryId: input.category_id ?? null,
          seasonId: input.season_id ?? null,
          manufacturerId: input.manufacturer_id ?? null,
          primaryImagePath: input.primary_image_path ?? null,
          status: input.status ?? undefined,
        };

        const product = await createProduct(
          brandCtx.db,
          brandId,
          payload as CreateProductInput,
        );

        if (!product?.id) {
          throw badRequest("Product was not created");
        }

        await applyProductAttributes(brandCtx, product.id, {
          materials: input.materials,
          eco_claim_ids: input.eco_claim_ids,
          journey_steps: input.journey_steps,
          environment: input.environment,
          tag_ids: input.tag_ids,
        });
        if (input.color_ids && input.size_ids) {
          await replaceVariantsForProduct(
            brandCtx,
            product.id,
            input.color_ids,
            input.size_ids,
          );
        }

        return createEntityResponse(product);
      } catch (error) {
        throw wrapError(error, "Failed to create product");
      }
    }),

  /**
   * Update products - supports both single and bulk operations.
   * 
   * Single mode: { id: string, ...updateFields }
   * Bulk mode: { selection: BulkSelection, ...bulkUpdateFields }
   * 
   * For bulk operations, only certain fields are supported (status, category_id, season_id).
   */
  update: brandRequiredProcedure
    .input(unifiedUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(
        brandCtx,
        normalizeBrandId(input.brand_id),
      );

      try {
        // Check if this is a bulk operation (has selection property)
        if ("selection" in input) {
          const selection = input.selection;
          const bulkUpdates = {
            status: input.status ?? undefined,
            categoryId: input.category_id ?? undefined,
            seasonId: input.season_id ?? undefined,
          };

          // Bulk update based on selection mode
          let result: { updated: number };
          if (selection.mode === "all") {
            result = await bulkUpdateProductsByFilter(brandCtx.db, brandId, bulkUpdates, {
              filterState: selection.filters,
              search: selection.search,
              excludeIds: selection.excludeIds,
            });
          } else {
            result = await bulkUpdateProductsByIds(
              brandCtx.db,
              brandId,
              selection.ids,
              bulkUpdates,
            );
          }

          // Invalidate DPP cache for bulk updates (fire-and-forget)
          // Note: For large bulk updates, we don't revalidate individual products
          // The cache will naturally expire or can be manually refreshed

          return {
            success: true,
            updated: result.updated,
          };
        }

        // Single product update
        const payload: Record<string, unknown> = { id: input.id };
        
        // Only add fields to payload if they were explicitly provided in input
        if (input.product_handle !== undefined) payload.productHandle = input.product_handle;
        if (input.name !== undefined) payload.name = input.name;
        if (input.description !== undefined) payload.description = input.description;
        if (input.category_id !== undefined) payload.categoryId = input.category_id;
        if (input.season_id !== undefined) payload.seasonId = input.season_id;
        if (input.manufacturer_id !== undefined) payload.manufacturerId = input.manufacturer_id;
        if (input.primary_image_path !== undefined) payload.primaryImagePath = input.primary_image_path;
        if (input.status !== undefined) payload.status = input.status;

        const product = await updateProduct(
          brandCtx.db,
          brandId,
          payload as UpdateProductInput,
        );

        await applyProductAttributes(brandCtx, input.id, {
          materials: input.materials,
          eco_claim_ids: input.eco_claim_ids,
          journey_steps: input.journey_steps,
          environment: input.environment,
          tag_ids: input.tag_ids,
        });
        if (input.color_ids && input.size_ids) {
          await replaceVariantsForProduct(
            brandCtx,
            input.id,
            input.color_ids,
            input.size_ids,
          );
        }

        // Revalidate DPP cache for this product (fire-and-forget)
        if (product?.id) {
          const [productWithHandle] = await brandCtx.db
            .select({ productHandle: products.productHandle })
            .from(products)
            .where(and(eq(products.id, product.id), eq(products.brandId, brandId)))
            .limit(1);
          if (productWithHandle?.productHandle) {
            revalidateProduct(productWithHandle.productHandle).catch(() => {});
          }
        }

        return createEntityResponse(product);
      } catch (error) {
        throw wrapError(error, "Failed to update product");
      }
    }),

  /**
   * Delete products - supports both single and bulk operations.
   * 
   * Single mode: { id: string }
   * Bulk mode: { selection: BulkSelection }
   * 
   * Bulk selection supports:
   * - 'explicit': Delete specific products by ID
   * - 'all': Delete all products matching filters, optionally excluding some IDs
   */
  delete: brandRequiredProcedure
    .input(unifiedDeleteSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(
        brandCtx,
        normalizeBrandId(input.brand_id),
      );

      try {
        // Check if this is a bulk operation (has selection property)
        if ("selection" in input) {
          const selection = input.selection;

          let result: { deleted: number; imagePaths: string[] };
          if (selection.mode === "all") {
            // Bulk delete by filter
            result = await bulkDeleteProductsByFilter(brandCtx.db, brandId, {
              filterState: selection.filters,
              search: selection.search,
              excludeIds: selection.excludeIds,
            });
          } else {
            // Bulk delete by explicit IDs
            result = await bulkDeleteProductsByIds(brandCtx.db, brandId, selection.ids);
          }

          // Clean up product images from storage after deletion
          if (result.imagePaths.length > 0 && ctx.supabase) {
            try {
              await ctx.supabase.storage.from("products").remove(result.imagePaths);
            } catch {
              // Silently ignore storage cleanup errors - products are already deleted
            }
          }

          return {
            success: true,
            deleted: result.deleted,
            failed: 0,
          };
        }

        // Single product delete
        const [productRow] = await brandCtx.db
          .select({ primaryImagePath: products.primaryImagePath })
          .from(products)
          .where(and(eq(products.id, input.id), eq(products.brandId, brandId)))
          .limit(1);

        const deleted = await deleteProduct(brandCtx.db, brandId, input.id);

        // Clean up product image from storage after successful deletion
        if (deleted && productRow?.primaryImagePath && ctx.supabase) {
          try {
            await ctx.supabase.storage
              .from("products")
              .remove([productRow.primaryImagePath]);
          } catch {
            // Silently ignore storage cleanup errors - product is already deleted
          }
        }

        return createEntityResponse(deleted);
      } catch (error) {
        throw wrapError(error, "Failed to delete product");
      }
    }),

  variants: productVariantsRouter,
});

export type ProductsRouter = typeof productsRouter;

async function applyProductAttributes(
  ctx: BrandContext,
  productId: string,
  input: AttributeInput,
) {
  // Materials
  if (input.materials) {
    await upsertProductMaterials(
      ctx.db,
      productId,
      input.materials.map((material) => ({
        brandMaterialId: material.brand_material_id,
        percentage:
          material.percentage !== undefined
            ? String(material.percentage)
            : undefined,
      })),
    );
  }

  // Eco-claims
  if (input.eco_claim_ids) {
    await setProductEcoClaims(ctx.db, productId, input.eco_claim_ids);
  }

  // Environment
  if (input.environment) {
    await upsertProductEnvironment(ctx.db, productId, {
      carbonKgCo2e:
        input.environment.carbon_kg_co2e !== undefined
          ? String(input.environment.carbon_kg_co2e)
          : undefined,
      waterLiters:
        input.environment.water_liters !== undefined
          ? String(input.environment.water_liters)
          : undefined,
    });
  }

  // Journey steps
  if (input.journey_steps) {
    await setProductJourneySteps(
      ctx.db,
      productId,
      input.journey_steps
        .filter((step) => step.facility_id) // Filter out steps without a facility
        .map((step) => ({
          sortIndex: step.sort_index,
          stepType: step.step_type,
          facilityId: step.facility_id,
        })),
    );
  }

  if (input.tag_ids) {
    await setProductTags(ctx.db, productId, input.tag_ids);
  }
}

async function replaceVariantsForProduct(
  ctx: BrandContext,
  productId: string,
  colorIds: string[],
  sizeIds: string[],
) {
  const uniqueColors = Array.from(new Set(colorIds));
  const uniqueSizes = Array.from(new Set(sizeIds));

  const desired: Array<{ colorId: string | null; sizeId: string | null }> = [];
  if (uniqueColors.length === 0 && uniqueSizes.length === 0) return;
  if (uniqueColors.length === 0) {
    for (const sizeId of uniqueSizes) desired.push({ colorId: null, sizeId });
  } else if (uniqueSizes.length === 0) {
    for (const colorId of uniqueColors) desired.push({ colorId, sizeId: null });
  } else {
    for (const colorId of uniqueColors) {
      for (const sizeId of uniqueSizes) desired.push({ colorId, sizeId });
    }
  }

  await ctx.db.transaction(async (tx) => {
    const existing = await tx
      .select({
        id: productVariants.id,
        color_id: productVariants.colorId,
        size_id: productVariants.sizeId,
        upid: productVariants.upid,
      })
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    const makeKey = (c: string | null, s: string | null) =>
      `${c ?? "null"}:${s ?? "null"}`;

    const existingByKey = new Map<
      string,
      { id: string; upid: string | null }
    >();
    for (const row of existing) {
      existingByKey.set(makeKey(row.color_id, row.size_id), {
        id: row.id,
        upid: row.upid,
      });
    }

    const desiredKeys = new Set(
      desired.map((v) => makeKey(v.colorId, v.sizeId)),
    );

    const idsToDelete = existing
      .filter((row) => !desiredKeys.has(makeKey(row.color_id, row.size_id)))
      .map((row) => row.id);

    if (idsToDelete.length) {
      await tx
        .delete(productVariants)
        .where(inArray(productVariants.id, idsToDelete));
    }

    const toInsert = desired.filter(
      (v) => !existingByKey.has(makeKey(v.colorId, v.sizeId)),
    );

    if (toInsert.length) {
      const needed = toInsert.length;
      const upids = await generateUniqueUpids({
        count: needed,
        isTaken: async (candidate: string) => {
          const [row] = await tx
            .select({ id: productVariants.id })
            .from(productVariants)
            .where(eq(productVariants.upid, candidate))
            .limit(1);
          return Boolean(row);
        },
        fetchTakenSet: async (candidates: readonly string[]) => {
          const rows = await tx
            .select({ upid: productVariants.upid })
            .from(productVariants)
            .where(inArray(productVariants.upid, candidates));
          return new Set(rows.map((r) => r.upid!).filter(Boolean));
        },
      });

      await tx.insert(productVariants).values(
        toInsert.map((variant, idx) => ({
          productId,
          colorId: variant.colorId,
          sizeId: variant.sizeId,
          upid: upids[idx] ?? null,
        })),
      );
    }
  });
}
