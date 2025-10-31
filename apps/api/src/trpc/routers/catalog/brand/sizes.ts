/**
 * Brand sizes catalog router.
 *
 * Manages the size options available to the brand.
 */
import {
  createSize,
  deleteSize,
  listSizes,
  updateSize,
} from "@v1/db/queries";
import { brandCatalog } from "@api/schemas/index.ts";
import { createListResponse } from "@api/utils/response.ts";
import { brandRequiredProcedure, createTRPCRouter } from "@api/trpc/init.ts";
import { wrapError } from "@api/utils/errors.ts";

/**
 * Router exposing size catalog operations.
 */
export const sizesRouter = createTRPCRouter({
  /**
   * Lists sizes configured for the brand.
   *
   * @returns Array of size records.
   */
  list: brandRequiredProcedure
    .input(brandCatalog.listSizesSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const data = await listSizes(db, brandId, {
        categoryId: input.category_id,
      });
      return createListResponse(data);
    }),

  /**
   * Creates a new size option.
   *
   * @param input - Size label and optional ordering metadata.
   * @returns Created size record.
   */
  create: brandRequiredProcedure
    .input(brandCatalog.createSizeSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await createSize(db, brandId, {
          name: input.name,
          categoryId: input.category_id,
          sortIndex: input.sort_index,
        });
      } catch (error) {
        throw wrapError(error, "Failed to create size");
      }
    }),

  /**
   * Updates an existing size definition.
   *
   * @param input - Size identifier and updated fields.
   * @returns Updated size record.
   */
  update: brandRequiredProcedure
    .input(brandCatalog.updateSizeSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await updateSize(db, brandId, input.id, {
          name: input.name,
          categoryId: input.category_id ?? null,
          sortIndex: input.sort_index ?? null,
        });
      } catch (error) {
        throw wrapError(error, "Failed to update size");
      }
    }),

  /**
   * Deletes a size from the catalog.
   *
   * @param input - Identifier of the size to remove.
   * @returns Identifier of the deleted size.
   */
  delete: brandRequiredProcedure
    .input(brandCatalog.deleteSizeSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await deleteSize(db, brandId, input.id);
      } catch (error) {
        throw wrapError(error, "Failed to delete size");
      }
    }),
});
