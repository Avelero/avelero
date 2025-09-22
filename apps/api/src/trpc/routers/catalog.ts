import { listCareCodes, listCategories } from "@v1/db/queries";
import {
  listCareCodesSchema,
  listCategoriesSchema,
} from "../../schemas/catalog.js";
import { createTRPCRouter, protectedProcedure } from "../init.js";

export const catalogRouter = createTRPCRouter({
  categories: {
    list: protectedProcedure
      .input(listCategoriesSchema)
      .query(async ({ ctx }) => {
        const { db } = ctx;
        const data = await listCategories(db);
        return { data } as const;
      }),
  },
  careCodes: {
    list: protectedProcedure
      .input(listCareCodesSchema)
      .query(async ({ ctx }) => {
        const { db } = ctx;
        const data = await listCareCodes(db);
        return { data } as const;
      }),
  },
});
