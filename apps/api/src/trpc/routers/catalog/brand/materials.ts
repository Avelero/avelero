/**
 * Brand material catalog router.
 *
 * Manages material definitions that feed product compositions.
 */
import {
  createMaterial,
  deleteMaterial,
  listMaterials,
  updateMaterial,
} from "@v1/db/queries";
import { brandCatalog } from "@api/schemas/index.ts";
import { createListResponse } from "@api/utils/response.ts";
import { brandRequiredProcedure, createTRPCRouter } from "@api/trpc/init.ts";
import { wrapError } from "@api/utils/errors.ts";

/**
 * Router exposing material catalog operations.
 */
export const materialsRouter = createTRPCRouter({
  /**
   * Lists materials configured for the brand.
   *
   * @returns Array of materials or an empty list for unaffiliated users.
   */
  list: brandRequiredProcedure
    .input(brandCatalog.listMaterialsSchema)
    .query(async ({ ctx }) => {
      const { db, brandId } = ctx;
      const data = await listMaterials(db, brandId);
      return createListResponse(data);
    }),

  /**
   * Creates a new material option.
   *
   * @param input - Material attributes including optional certification.
   * @returns Created material record.
   */
  create: brandRequiredProcedure
    .input(brandCatalog.createMaterialSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await createMaterial(db, brandId, {
          name: input.name,
          certificationId: input.certification_id,
          recyclable: input.recyclable,
          countryOfOrigin: input.country_of_origin,
        });
      } catch (error) {
        throw wrapError(error, "Failed to create material");
      }
    }),

  /**
   * Updates an existing material definition.
   *
   * @param input - Material identifier and updated fields.
   * @returns Updated material record.
   */
  update: brandRequiredProcedure
    .input(brandCatalog.updateMaterialSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await updateMaterial(db, brandId, input.id, {
          name: input.name,
          certificationId: input.certification_id ?? null,
          recyclable: input.recyclable ?? null,
          countryOfOrigin: input.country_of_origin ?? null,
        });
      } catch (error) {
        throw wrapError(error, "Failed to update material");
      }
    }),

  /**
   * Deletes a material from the catalog.
   *
   * @param input - Identifier of the material to remove.
   * @returns Identifier of the deleted material.
   */
  delete: brandRequiredProcedure
    .input(brandCatalog.deleteMaterialSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await deleteMaterial(db, brandId, input.id);
      } catch (error) {
        throw wrapError(error, "Failed to delete material");
      }
    }),
});
