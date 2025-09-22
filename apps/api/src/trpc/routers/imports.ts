import { createProduct } from "@v1/db/queries";
import {
  createProductSchema,
  listProductsSchema,
} from "../../schemas/products.js";
import { createTRPCRouter, protectedProcedure } from "../init.js";

export const importsRouter = createTRPCRouter({
  bulk: {
    createProducts: protectedProcedure
      .input(
        listProductsSchema.extend({
          items: createProductSchema.array().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        if (!brandId) throw new Error("No active brand");
        const created: { id: string }[] = [];
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
      }),
  },
});
