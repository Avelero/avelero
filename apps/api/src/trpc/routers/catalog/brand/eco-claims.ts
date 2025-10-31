/**
 * Brand eco-claims catalog router.
 *
 * Manages eco claim statements available to the brand.
 */
import {
  createEcoClaim,
  deleteEcoClaim,
  listEcoClaims,
  updateEcoClaim,
} from "@v1/db/queries";
import { brandCatalog } from "@api/schemas/index.ts";
import { createListResponse } from "@api/utils/response.ts";
import { brandRequiredProcedure, createTRPCRouter } from "@api/trpc/init.ts";
import { wrapError } from "@api/utils/errors.ts";

/**
 * Router exposing eco-claims catalog operations.
 */
export const ecoClaimsRouter = createTRPCRouter({
  /**
   * Lists eco claims configured for the brand.
   *
   * @returns Array of eco claim records.
   */
  list: brandRequiredProcedure
    .input(brandCatalog.listEcoClaimsSchema)
    .query(async ({ ctx }) => {
      const { db, brandId } = ctx;
      const data = await listEcoClaims(db, brandId);
      return createListResponse(data);
    }),

  /**
   * Creates a new eco claim statement.
   *
   * @param input - Claim text.
   * @returns Created eco claim record.
   */
  create: brandRequiredProcedure
    .input(brandCatalog.createEcoClaimSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await createEcoClaim(db, brandId, { claim: input.claim });
      } catch (error) {
        throw wrapError(error, "Failed to create eco claim");
      }
    }),

  /**
   * Updates an existing eco claim.
   *
   * @param input - Claim identifier and optional new text.
   * @returns Updated eco claim record.
   */
  update: brandRequiredProcedure
    .input(brandCatalog.updateEcoClaimSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await updateEcoClaim(db, brandId, input.id, {
          claim: input.claim,
        });
      } catch (error) {
        throw wrapError(error, "Failed to update eco claim");
      }
    }),

  /**
   * Deletes an eco claim from the catalog.
   *
   * @param input - Identifier of the eco claim to remove.
   * @returns Identifier of the deleted claim.
   */
  delete: brandRequiredProcedure
    .input(brandCatalog.deleteEcoClaimSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await deleteEcoClaim(db, brandId, input.id);
      } catch (error) {
        throw wrapError(error, "Failed to delete eco claim");
      }
    }),
});
