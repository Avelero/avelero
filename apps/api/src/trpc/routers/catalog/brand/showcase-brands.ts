/**
 * Brand showcase catalog router.
 *
 * Keeps the curated list of peer or partner brands shown in product passports.
 */
import {
  createShowcaseBrand,
  deleteShowcaseBrand,
  listShowcaseBrands,
  updateShowcaseBrand,
} from "@v1/db/queries";
import { brandCatalog } from "@api/schemas/index.ts";
import { createListResponse } from "@api/utils/response.ts";
import { brandRequiredProcedure, createTRPCRouter } from "@api/trpc/init.ts";
import { wrapError } from "@api/utils/errors.ts";

/**
 * Router exposing showcase brand catalog operations.
 */
export const showcaseBrandsRouter = createTRPCRouter({
  /**
   * Lists showcase brands configured for the brand.
   *
   * @returns Array of showcase brand records.
   */
  list: brandRequiredProcedure
    .input(brandCatalog.listShowcaseBrandsSchema)
    .query(async ({ ctx }) => {
      const { db, brandId } = ctx;
      const data = await listShowcaseBrands(db, brandId);
      return createListResponse(data);
    }),

  /**
   * Creates a new showcase brand entry.
   *
   * @param input - Display metadata for the partner brand.
   * @returns Created showcase brand record.
   */
  create: brandRequiredProcedure
    .input(brandCatalog.createShowcaseBrandSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await createShowcaseBrand(db, brandId, {
          name: input.name,
          legalName: input.legal_name,
          email: input.email,
          phone: input.phone,
          website: input.website,
          addressLine1: input.address_line_1,
          addressLine2: input.address_line_2,
          city: input.city,
          state: input.state,
          zip: input.zip,
          countryCode: input.country_code,
        });
      } catch (error) {
        throw wrapError(error, "Failed to create showcase brand");
      }
    }),

  /**
   * Updates an existing showcase brand definition.
   *
   * @param input - Showcase brand identifier and updated fields.
   * @returns Updated showcase brand record.
   */
  update: brandRequiredProcedure
    .input(brandCatalog.updateShowcaseBrandSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await updateShowcaseBrand(db, brandId, input.id, {
          name: input.name,
          legalName: input.legal_name ?? null,
          email: input.email ?? null,
          phone: input.phone ?? null,
          website: input.website ?? null,
          addressLine1: input.address_line_1 ?? null,
          addressLine2: input.address_line_2 ?? null,
          city: input.city ?? null,
          state: input.state ?? null,
          zip: input.zip ?? null,
          countryCode: input.country_code ?? null,
        });
      } catch (error) {
        throw wrapError(error, "Failed to update showcase brand");
      }
    }),

  /**
   * Deletes a showcase brand entry.
   *
   * @param input - Identifier of the showcase brand to remove.
   * @returns Identifier of the deleted showcase brand.
   */
  delete: brandRequiredProcedure
    .input(brandCatalog.deleteShowcaseBrandSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await deleteShowcaseBrand(db, brandId, input.id);
      } catch (error) {
        throw wrapError(error, "Failed to delete showcase brand");
      }
    }),
});
