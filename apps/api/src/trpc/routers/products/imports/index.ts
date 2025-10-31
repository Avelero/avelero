/**
 * Bulk import helper router.
 *
 * Supports uploading spreadsheets or other batch product feeds by wrapping
 * repetitive operations in a single mutation.
 */
import { createProduct } from "@v1/db/queries";
import {
  createProductSchema,
  listProductsSchema,
} from "@api/schemas/index.ts";
import { brandRequiredProcedure, createTRPCRouter } from "@api/trpc/init.ts";
import { wrapError } from "@api/utils/errors.ts";

/**
 * Routers for creating large numbers of records in one request.
 */
export const importsRouter = createTRPCRouter({
  bulk: {
    /**
     * Creates multiple products within the active brand.
     *
     * @param input - Pagination defaults plus the array of product drafts.
     * @returns Totals plus the identifiers of created products.
     */
    createProducts: brandRequiredProcedure
      .input(
        listProductsSchema.extend({
          items: createProductSchema.array().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        try {
          const created: Array<{ id: string }> = [];
          for (const item of input.items) {
            const row = await createProduct(db, brandId, {
              name: item.name,
              description: item.description,
              categoryId: item.category_id,
              season: item.season,
              brandCertificationId: item.brand_certification_id,
              showcaseBrandId: item.showcase_brand_id,
              primaryImageUrl: item.primary_image_url,
            });
            if (row?.id) created.push({ id: row.id });
          }
          return { created: created.length, products: created } as const;
        } catch (error) {
          throw wrapError(error, "Failed to import products");
        }
      }),
  },
});
