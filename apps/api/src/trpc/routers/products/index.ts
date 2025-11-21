/**
 * Products domain router implementation.
 *
 * Exposes product CRUD operations along with nested routers for variants and
 * attribute writers. Supports include flags that collapse N+1 queries into
 * batched lookups handled by the database layer.
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
  getProductWithIncludesByUpid,
  setProductTags,
} from "@v1/db/queries";
import { productVariants, products } from "@v1/db/schema";
import { and, eq, inArray } from "@v1/db/queries";
import { generateUniqueUpid, generateUniqueUpids } from "@v1/db/utils";
import {
  productsDomainCreateSchema,
  productsDomainDeleteSchema,
  productsDomainGetSchema,
  productsDomainListSchema,
  productsDomainGetByUpidSchema,
  productsDomainUpdateSchema,
} from "../../../schemas/products.js";
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
    facility_ids: string[]; // Changed from facility_id to support multiple operators
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

      const result = await listProductsWithIncludes(
        brandCtx.db,
        brandId,
        ({
          categoryId: input.filters?.category_id,
          seasonId: input.filters?.season_id,
          search: input.filters?.search,
        } as unknown as Parameters<typeof listProductsWithIncludes>[2]),
        {
          cursor: input.cursor,
          limit: input.limit,
          includeVariants: input.includeVariants,
          includeAttributes: input.includeAttributes,
        },
      );

      return createPaginatedResponse([...result.data], {
        total: result.meta.total,
        cursor: result.meta.cursor,
        hasMore: result.meta.hasMore,
      });
    }),

  get: brandRequiredProcedure
    .input(productsDomainGetSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(brandCtx);
      return getProductWithIncludes(brandCtx.db, brandId, input.id, {
        includeVariants: input.includeVariants,
        includeAttributes: input.includeAttributes,
      });
    }),

  getByUpid: brandRequiredProcedure
    .input(productsDomainGetByUpidSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(brandCtx);
      return getProductWithIncludesByUpid(brandCtx.db, brandId, input.upid, {
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
              .where(and(eq(products.brandId, brandId), eq(products.upid, candidate)))
              .limit(1);
            return Boolean(existing[0]);
          },
        });

        const payload: Record<string, unknown> = {
          name: input.name,
          upid,
          productIdentifier: input.product_identifier,
          description: input.description ?? null,
          categoryId: input.category_id ?? null,
          seasonId: input.season_id ?? null,
          showcaseBrandId: input.showcase_brand_id ?? null,
          primaryImageUrl: input.primary_image_url ?? null,
          templateId: input.template_id ?? null,
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

  update: brandRequiredProcedure
    .input(productsDomainUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(
        brandCtx,
        normalizeBrandId(input.brand_id),
      );

      try {
        // Update basic product fields
        const payload: Record<string, unknown> = {
          id: input.id,
          productIdentifier: input.product_identifier,
          name: input.name,
          description: input.description ?? null,
          categoryId: input.category_id ?? null,
          seasonId: input.season_id ?? null,
          showcaseBrandId: input.showcase_brand_id ?? null,
          primaryImageUrl: input.primary_image_url ?? null,
          templateId: input.template_id ?? null,
          status: input.status ?? undefined,
        };

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

        return createEntityResponse(product);
      } catch (error) {
        throw wrapError(error, "Failed to update product");
      }
    }),

  delete: brandRequiredProcedure
    .input(productsDomainDeleteSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(
        brandCtx,
        normalizeBrandId(input.brand_id),
      );

      try {
        const deleted = await deleteProduct(brandCtx.db, brandId, input.id);
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
      input.journey_steps.map((step) => ({
        sortIndex: step.sort_index,
        stepType: step.step_type,
        facilityIds: step.facility_ids, // Changed from facilityId to support multiple operators
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

    const existingByKey = new Map<string, { id: string; upid: string | null }>();
    for (const row of existing) {
      existingByKey.set(makeKey(row.color_id, row.size_id), {
        id: row.id,
        upid: row.upid,
      });
    }

    const desiredKeys = new Set(desired.map((v) => makeKey(v.colorId, v.sizeId)));

    const idsToDelete = existing
      .filter((row) => !desiredKeys.has(makeKey(row.color_id, row.size_id)))
      .map((row) => row.id);

    if (idsToDelete.length) {
      await tx.delete(productVariants).where(inArray(productVariants.id, idsToDelete));
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
