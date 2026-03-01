import { createHash } from "node:crypto";
import { and, eq, inArray } from "@v1/db/queries";
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
  bulkDeleteProductsByFilter,
  bulkDeleteProductsByIds,
  bulkPublishProducts,
  bulkUpdateProductsByFilter,
  bulkUpdateProductsByIds,
  createProduct,
  deleteProduct,
  getProductWithIncludes,
  getProductSelectionCounts,
  listProductsWithIncludes,
  resolveSelectedProductIds,
  publishProduct,
  setProductJourneySteps,
  setProductTags,
  updateProduct,
  upsertProductEnvironment,
  upsertProductMaterials,
  upsertProductWeight,
} from "@v1/db/queries/products";
import {
  brandCustomDomains,
  productVariants,
  products,
  qrExportJobs,
} from "@v1/db/schema";
import { revalidateProduct } from "../../../lib/dpp-revalidation.js";
import { generateProductHandle } from "../../../schemas/_shared/primitives.js";
import {
  productUnifiedGetSchema,
  productsCountSchema,
  productsDomainCreateSchema,
  productsDomainListSchema,
  unifiedDeleteSchema,
  unifiedUpdateSchema,
} from "../../../schemas/products.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import {
  createEntityResponse,
  createPaginatedResponse,
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import {
  brandReadProcedure,
  brandWriteProcedure,
  createTRPCRouter,
} from "../../init.js";
import { publishRouter } from "./publish.js";
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
  journey_steps?: {
    sort_index: number;
    step_type: string;
    operator_ids: string[]; // Multiple operators per step
  }[];
  environment?: {
    carbon_kg_co2e?: string | number;
    water_liters?: string | number;
  };
  weight?: {
    weight?: string | number;
    weight_unit?: string;
  };
  tag_ids?: string[];
};

const PRODUCT_IMAGES_BUCKET = "products";
const PRODUCT_QR_CODES_BUCKET = "product-qr-codes";
const STORAGE_REMOVE_BATCH_SIZE = 1000;
const QR_CACHE_NAMESPACE = "00000000-0000-0000-0000-000000000000";

// Keep in sync with packages/jobs/src/lib/qr-export.ts.
const QR_CACHE_KEY_VERSION = "v2";
const DEFAULT_QR_WIDTH = 1024;
const PRINT_QR_WIDTH = 2048;
const DEFAULT_QR_MARGIN = 1;
const DEFAULT_QR_ERROR_CORRECTION_LEVEL = "H";

function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

function buildQrPngCacheFilename(
  domain: string,
  barcode: string,
  width: number,
): string {
  const key = [
    QR_CACHE_KEY_VERSION,
    normalizeDomain(domain),
    barcode.trim(),
    String(width),
    String(DEFAULT_QR_MARGIN),
    DEFAULT_QR_ERROR_CORRECTION_LEVEL,
  ].join("|");

  const digest = createHash("sha256").update(key).digest("hex");
  return `${digest}.png`;
}

function buildQrCachePath(brandId: string, domain: string, barcode: string): string[] {
  const normalizedDomain = normalizeDomain(domain);
  const normalizedBarcode = barcode.trim();

  return [DEFAULT_QR_WIDTH, PRINT_QR_WIDTH].map((width) => {
    const filename = buildQrPngCacheFilename(
      normalizedDomain,
      normalizedBarcode,
      width,
    );
    return `${brandId}/${QR_CACHE_NAMESPACE}/${filename}`;
  });
}

async function removeStoragePathsInBatches(
  supabase: BrandContext["supabase"],
  bucket: string,
  paths: string[],
): Promise<void> {
  for (let i = 0; i < paths.length; i += STORAGE_REMOVE_BATCH_SIZE) {
    const chunk = paths.slice(i, i + STORAGE_REMOVE_BATCH_SIZE);
    if (chunk.length === 0) {
      continue;
    }

    const { error } = await supabase.storage.from(bucket).remove(chunk);
    if (error) {
      throw new Error(error.message);
    }
  }
}

async function getQrCachePathsForDeletedProducts(
  ctx: BrandContext,
  brandId: string,
  productIds: string[],
): Promise<string[]> {
  if (productIds.length === 0) {
    return [];
  }

  const variantRows = await ctx.db
    .select({
      barcode: productVariants.barcode,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(
      and(eq(products.brandId, brandId), inArray(productVariants.productId, productIds)),
    );

  const barcodes = Array.from(
    new Set(
      variantRows
        .map((row) => row.barcode?.trim() ?? null)
        .filter((barcode): barcode is string => !!barcode),
    ),
  );

  if (barcodes.length === 0) {
    return [];
  }

  const [currentDomainRows, historicalDomainRows] = await Promise.all([
    ctx.db
      .select({ domain: brandCustomDomains.domain })
      .from(brandCustomDomains)
      .where(eq(brandCustomDomains.brandId, brandId)),
    ctx.db
      .selectDistinct({ domain: qrExportJobs.customDomain })
      .from(qrExportJobs)
      .where(eq(qrExportJobs.brandId, brandId)),
  ]);

  const domains = Array.from(
    new Set(
      [...currentDomainRows, ...historicalDomainRows]
        .map((row) => normalizeDomain(row.domain))
        .filter((domain) => domain.length > 0),
    ),
  );

  if (domains.length === 0) {
    return [];
  }

  const paths = new Set<string>();
  for (const domain of domains) {
    for (const barcode of barcodes) {
      for (const path of buildQrCachePath(brandId, domain, barcode)) {
        paths.add(path);
      }
    }
  }

  return Array.from(paths);
}

export const productsRouter = createTRPCRouter({
  list: brandReadProcedure
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
          includePassports: true, // Always include passport data for list views
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
   * Count selected products and variants for export workflows.
   */
  count: brandReadProcedure
    .input(productsCountSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(
        brandCtx,
        normalizeBrandId(input.brand_id),
      );

      const selectionMode = input.selection.mode;
      const includeIds =
        selectionMode === "explicit" ? input.selection.includeIds : [];
      const excludeIds =
        selectionMode === "all" ? input.selection.excludeIds ?? [] : [];

      const productIds = await resolveSelectedProductIds(brandCtx.db, brandId, {
        selectionMode,
        includeIds,
        excludeIds,
        filterState: input.filterState ?? null,
        searchQuery: input.search ?? null,
      });

      return createEntityResponse(
        await getProductSelectionCounts(brandCtx.db, brandId, productIds),
      );
    }),

  /**
   * Get a single product by ID or handle.
   * Unified endpoint that accepts discriminated union: { id } | { handle }
   */
  get: brandReadProcedure
    .input(productUnifiedGetSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(brandCtx);

      // Handle discriminated union: { id } or { handle }
      const identifier =
        "id" in input ? { id: input.id } : { handle: input.handle };

      return getProductWithIncludes(brandCtx.db, brandId, identifier, {
        includeVariants: input.includeVariants,
        includeAttributes: input.includeAttributes,
      });
    }),

  create: brandWriteProcedure
    .input(productsDomainCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(brandCtx, input.brand_id);

      try {
        // Auto-generate product handle from name if not provided
        const productHandle =
          input.product_handle || generateProductHandle(input.name);

        const payload: Record<string, unknown> = {
          name: input.name,
          productHandle,
          description: input.description ?? null,
          categoryId: input.category_id ?? null,
          seasonId: input.season_id ?? null,
          manufacturerId: input.manufacturer_id ?? null,
          imagePath: input.image_path ?? null,
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
          journey_steps: input.journey_steps,
          environment: input.environment,
          weight: input.weight,
          tag_ids: input.tag_ids,
        });

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
  update: brandWriteProcedure
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
          let result: { updated: number; productIds?: string[] };
          if (selection.mode === "all") {
            result = await bulkUpdateProductsByFilter(
              brandCtx.db,
              brandId,
              bulkUpdates,
              {
                filterState: selection.filters,
                search: selection.search,
                excludeIds: selection.excludeIds,
              },
            );
          } else {
            result = await bulkUpdateProductsByIds(
              brandCtx.db,
              brandId,
              selection.ids,
              bulkUpdates,
            );
          }

          // If status changed to "published", trigger publish flow to create passport versions
          // This ensures QR codes become resolvable when status is set to published
          if (
            input.status === "published" &&
            result.productIds &&
            result.productIds.length > 0
          ) {
            // Trigger bulk publish (fire-and-forget, errors logged but not thrown)
            bulkPublishProducts(brandCtx.db, result.productIds, brandId).catch(
              (err) => {
                console.error("Bulk publish failed after status change:", err);
              },
            );
          }

          return {
            success: true,
            updated: result.updated,
          };
        }

        // Single product update
        const payload: Record<string, unknown> = { id: input.id };

        // Only add fields to payload if they were explicitly provided in input
        if (input.product_handle !== undefined)
          payload.productHandle = input.product_handle;
        if (input.name !== undefined) payload.name = input.name;
        if (input.description !== undefined)
          payload.description = input.description;
        if (input.category_id !== undefined)
          payload.categoryId = input.category_id;
        if (input.season_id !== undefined) payload.seasonId = input.season_id;
        if (input.manufacturer_id !== undefined)
          payload.manufacturerId = input.manufacturer_id;
        if (input.image_path !== undefined)
          payload.imagePath = input.image_path;
        if (input.status !== undefined) payload.status = input.status;

        const product = await updateProduct(
          brandCtx.db,
          brandId,
          payload as UpdateProductInput,
        );

        await applyProductAttributes(brandCtx, input.id, {
          materials: input.materials,
          journey_steps: input.journey_steps,
          environment: input.environment,
          weight: input.weight,
          tag_ids: input.tag_ids,
        });

        // Trigger publish when status is explicitly changed to "published"
        // This handles the case when user toggles status from the passports table
        // (The form handles publish explicitly after all mutations complete)
        if (input.status === "published" && product?.id) {
          try {
            const publishResult = await publishProduct(
              brandCtx.db,
              product.id,
              brandId,
            );
            if (!publishResult.success) {
              console.error(
                "Publish failed after status change:",
                publishResult.error,
              );
            }
          } catch (err) {
            console.error(
              "Publish threw an exception after status change:",
              err,
            );
          }
        }

        // Revalidate DPP cache for this product (fire-and-forget)
        if (product?.id) {
          const [productWithHandle] = await brandCtx.db
            .select({ productHandle: products.productHandle })
            .from(products)
            .where(
              and(eq(products.id, product.id), eq(products.brandId, brandId)),
            )
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
  delete: brandWriteProcedure
    .input(unifiedDeleteSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = ensureBrandScope(
        brandCtx,
        normalizeBrandId(input.brand_id),
      );

      try {
        const productIdsForCacheCleanup = Array.from(
          new Set(
            "selection" in input
              ? input.selection.mode === "all"
                ? await resolveSelectedProductIds(brandCtx.db, brandId, {
                    selectionMode: "all",
                    includeIds: [],
                    excludeIds: input.selection.excludeIds ?? [],
                    filterState: input.selection.filters ?? null,
                    searchQuery: input.selection.search ?? null,
                  })
                : input.selection.ids
              : [input.id],
          ),
        );
        const qrCachePaths = await getQrCachePathsForDeletedProducts(
          brandCtx,
          brandId,
          productIdsForCacheCleanup,
        );
        const storageClient = ctx.supabaseAdmin ?? ctx.supabase;

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
            result = await bulkDeleteProductsByIds(
              brandCtx.db,
              brandId,
              selection.ids,
            );
          }

          // Clean up product images from storage after deletion
          if (result.imagePaths.length > 0) {
            try {
              await removeStoragePathsInBatches(
                storageClient,
                PRODUCT_IMAGES_BUCKET,
                result.imagePaths,
              );
            } catch {
              // Silently ignore storage cleanup errors - products are already deleted
            }
          }

          // Invalidate QR PNG cache for deleted product barcodes
          if (qrCachePaths.length > 0) {
            try {
              await removeStoragePathsInBatches(
                storageClient,
                PRODUCT_QR_CODES_BUCKET,
                qrCachePaths,
              );
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
          .select({ imagePath: products.imagePath })
          .from(products)
          .where(and(eq(products.id, input.id), eq(products.brandId, brandId)))
          .limit(1);

        const deleted = await deleteProduct(brandCtx.db, brandId, input.id);

        // Clean up product image from storage after successful deletion
        if (deleted && productRow?.imagePath) {
          try {
            await removeStoragePathsInBatches(
              storageClient,
              PRODUCT_IMAGES_BUCKET,
              [productRow.imagePath],
            );
          } catch {
            // Silently ignore storage cleanup errors - product is already deleted
          }
        }

        // Invalidate QR PNG cache for deleted product barcodes
        if (deleted && qrCachePaths.length > 0) {
          try {
            await removeStoragePathsInBatches(
              storageClient,
              PRODUCT_QR_CODES_BUCKET,
              qrCachePaths,
            );
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
  publish: publishRouter,
});

type ProductsRouter = typeof productsRouter;

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

  // Weight
  if (input.weight) {
    await upsertProductWeight(ctx.db, productId, {
      weight:
        input.weight.weight !== undefined
          ? String(input.weight.weight)
          : undefined,
      weightUnit: input.weight.weight_unit ?? "g",
    });
  }

  // Journey steps
  if (input.journey_steps) {
    await setProductJourneySteps(
      ctx.db,
      productId,
      input.journey_steps
        .filter((step) => step.operator_ids && step.operator_ids.length > 0)
        .map((step) => ({
          sortIndex: step.sort_index,
          stepType: step.step_type,
          operatorIds: step.operator_ids,
        })),
    );
  }

  if (input.tag_ids) {
    await setProductTags(ctx.db, productId, input.tag_ids);
  }
}
