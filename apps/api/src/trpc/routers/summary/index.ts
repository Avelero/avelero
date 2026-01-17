import { and, eq, sql } from "@v1/db/queries";
import { products } from "@v1/db/schema";
import { summaryProductStatusSchema } from "../../../schemas/summary.js";
import { createEntityResponse } from "../../../utils/response.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

export const summaryRouter = createTRPCRouter({
  productStatus: brandRequiredProcedure
    .input(summaryProductStatusSchema)
    .query(async ({ ctx }) => {
      const { db, brandId } = ctx;

      // Get total count
      const [totalResult] = await db
        .select({
          count: sql<number>`COUNT(*)::int`,
        })
        .from(products)
        .where(eq(products.brandId, brandId));

      // Get published count
      const [publishedResult] = await db
        .select({
          count: sql<number>`COUNT(*)::int`,
        })
        .from(products)
        .where(
          and(eq(products.brandId, brandId), eq(products.status, "published")),
        );

      // Get unpublished count
      const [unpublishedResult] = await db
        .select({
          count: sql<number>`COUNT(*)::int`,
        })
        .from(products)
        .where(
          and(
            eq(products.brandId, brandId),
            eq(products.status, "unpublished"),
          ),
        );

      // Get scheduled count
      const [scheduledResult] = await db
        .select({
          count: sql<number>`COUNT(*)::int`,
        })
        .from(products)
        .where(
          and(eq(products.brandId, brandId), eq(products.status, "scheduled")),
        );

      const summary = {
        total: totalResult?.count ?? 0,
        published: publishedResult?.count ?? 0,
        unpublished: unpublishedResult?.count ?? 0,
        scheduled: scheduledResult?.count ?? 0,
      };

      return createEntityResponse(summary);
    }),
});

export type SummaryRouter = typeof summaryRouter;
