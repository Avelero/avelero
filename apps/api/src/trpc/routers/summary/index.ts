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
      const rows = await db
        .select({
          status: products.status,
          count: sql<number>`COUNT(*)::int`,
        })
        .from(products)
        .where(eq(products.brandId, brandId))
        .groupBy(products.status);

      const summary = rows.reduce<Record<string, number>>((acc, row) => {
        const key = row.status ?? "unknown";
        acc[key] = (acc[key] ?? 0) + (row.count ?? 0);
        return acc;
      }, {});

      return createEntityResponse(summary);
    }),
});

export type SummaryRouter = typeof summaryRouter;
