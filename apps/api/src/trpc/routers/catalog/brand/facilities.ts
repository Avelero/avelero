/**
 * Brand facilities catalog router.
 *
 * Manages facility directory for supplier and manufacturer records.
 */
import {
  createFacility,
  deleteFacility,
  listFacilities,
  updateFacility,
} from "@v1/db/queries";
import { brandCatalog } from "@api/schemas/index.ts";
import { createListResponse } from "@api/utils/response.ts";
import { brandRequiredProcedure, createTRPCRouter } from "@api/trpc/init.ts";
import { wrapError } from "@api/utils/errors.ts";

/**
 * Router exposing facilities catalog operations.
 */
export const facilitiesRouter = createTRPCRouter({
  /**
   * Lists facilities registered under the brand.
   *
   * @returns Array of facility records.
   */
  list: brandRequiredProcedure
    .input(brandCatalog.listFacilitiesSchema)
    .query(async ({ ctx }) => {
      const { db, brandId } = ctx;
      const data = await listFacilities(db, brandId);
      return createListResponse(data);
    }),

  /**
   * Creates a facility entry.
   *
   * @param input - Facility contact and address information.
   * @returns Created facility record.
   */
  create: brandRequiredProcedure
    .input(brandCatalog.createFacilitySchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await createFacility(db, brandId, {
          displayName: input.display_name,
          legalName: input.legal_name,
          address: input.address,
          city: input.city,
          countryCode: input.country_code,
          contact: input.contact,
          vatNumber: input.vat_number,
        });
      } catch (error) {
        throw wrapError(error, "Failed to create facility");
      }
    }),

  /**
   * Updates facility details.
   *
   * @param input - Facility identifier and partial updates.
   * @returns Updated facility record.
   */
  update: brandRequiredProcedure
    .input(brandCatalog.updateFacilitySchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await updateFacility(db, brandId, input.id, {
          displayName: input.display_name,
          legalName: input.legal_name ?? null,
          address: input.address ?? null,
          city: input.city ?? null,
          countryCode: input.country_code ?? null,
          contact: input.contact ?? null,
          vatNumber: input.vat_number ?? null,
        });
      } catch (error) {
        throw wrapError(error, "Failed to update facility");
      }
    }),

  /**
   * Removes a facility from the directory.
   *
   * @param input - Identifier of the facility to delete.
   * @returns Identifier of the deleted facility.
   */
  delete: brandRequiredProcedure
    .input(brandCatalog.deleteFacilitySchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await deleteFacility(db, brandId, input.id);
      } catch (error) {
        throw wrapError(error, "Failed to delete facility");
      }
    }),
});
