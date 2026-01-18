import { eq, sql } from "@v1/db/queries";
import { products } from "@v1/db/schema";
import { summaryProductStatusSchema } from "../../../schemas/summary.js";
import { createEntityResponse } from "../../../utils/response.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

export const summaryRouter = createTRPCRouter({
  productStatus: brandRequiredProcedure
    .input(summaryProductStatusSchema)
    .query(async ({ ctx }) => {
      const { db, brandId } = ctx;

      // Single query with conditional counts for consistency and efficiency
      const [result] = await db
        .select({
          total: sql<number>`COUNT(*)::int`,
          published: sql<number>`COUNT(*) FILTER (WHERE ${products.status} = 'published')::int`,
          unpublished: sql<number>`COUNT(*) FILTER (WHERE ${products.status} = 'unpublished')::int`,
          scheduled: sql<number>`COUNT(*) FILTER (WHERE ${products.status} = 'scheduled')::int`,
        })
        .from(products)
        .where(eq(products.brandId, brandId));

      const summary = {
        total: result?.total ?? 0,
        published: result?.published ?? 0,
        unpublished: result?.unpublished ?? 0,
        scheduled: result?.scheduled ?? 0,
      };

      return createEntityResponse(summary);
    }),
});

type SummaryRouter = typeof summaryRouter;
