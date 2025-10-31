/**
 * Brand colors catalog router.
 *
 * Maintains the palette of colors available to the brand.
 */
import {
  createColor,
  deleteColor,
  listColors,
  updateColor,
} from "@v1/db/queries";
import { brandCatalog } from "@api/schemas/index.ts";
import { createListResponse } from "@api/utils/response.ts";
import { brandRequiredProcedure, createTRPCRouter } from "@api/trpc/init.ts";
import { wrapError } from "@api/utils/errors.ts";

/**
 * Router exposing color catalog operations.
 */
export const colorsRouter = createTRPCRouter({
  /**
   * Lists colors configured for the brand.
   *
   * @returns Array of color records.
   */
  list: brandRequiredProcedure
    .input(brandCatalog.listColorsSchema)
    .query(async ({ ctx }) => {
      const { db, brandId } = ctx;
      const data = await listColors(db, brandId);
      return createListResponse(data);
    }),

  /**
   * Creates a new color option.
   *
   * @param input - Hex value and label for the color.
   * @returns Created color record.
   */
  create: brandRequiredProcedure
    .input(brandCatalog.createColorSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await createColor(db, brandId, {
          name: input.name,
        });
      } catch (error) {
        throw wrapError(error, "Failed to create color");
      }
    }),

  /**
   * Updates an existing color definition.
   *
   * @param input - Color identifier and updated fields.
   * @returns Updated color record.
   */
  update: brandRequiredProcedure
    .input(brandCatalog.updateColorSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await updateColor(db, brandId, input.id, {
          name: input.name,
        });
      } catch (error) {
        throw wrapError(error, "Failed to update color");
      }
    }),

  /**
   * Deletes a color from the catalog.
   *
   * @param input - Identifier of the color to remove.
   * @returns Identifier of the deleted color.
   */
  delete: brandRequiredProcedure
    .input(brandCatalog.deleteColorSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await deleteColor(db, brandId, input.id);
      } catch (error) {
        throw wrapError(error, "Failed to delete color");
      }
    }),
});
