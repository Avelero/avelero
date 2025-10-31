/**
 * Brand certification catalog router.
 *
 * Manages third-party certifications linked to brand products.
 */
import {
  createCertification,
  deleteCertification,
  listCertifications,
  updateCertification,
} from "@v1/db/queries";
import { brandCatalog } from "@api/schemas/index.ts";
import { createListResponse } from "@api/utils/response.ts";
import { brandRequiredProcedure, createTRPCRouter } from "@api/trpc/init.ts";
import { wrapError } from "@api/utils/errors.ts";

/**
 * Router exposing certification catalog operations.
 */
export const certificationsRouter = createTRPCRouter({
  /**
   * Lists certifications configured for the brand.
   *
   * @returns Array of certification records.
   */
  list: brandRequiredProcedure
    .input(brandCatalog.listCertificationsSchema)
    .query(async ({ ctx }) => {
      const { db, brandId } = ctx;
      const data = await listCertifications(db, brandId);
      return createListResponse(data);
    }),

  /**
   * Creates a new certification reference.
   *
   * @param input - Certification metadata.
   * @returns Created certification record.
   */
  create: brandRequiredProcedure
    .input(brandCatalog.createCertificationSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await createCertification(db, brandId, {
          title: input.title,
          certificationCode: input.certification_code,
          instituteName: input.institute_name,
          instituteAddress: input.institute_address,
          instituteContact: input.institute_contact,
          issueDate: input.issue_date,
          expiryDate: input.expiry_date,
          fileAssetId: input.file_asset_id,
          externalUrl: input.external_url,
          notes: input.notes,
        });
      } catch (error) {
        throw wrapError(error, "Failed to create certification");
      }
    }),

  /**
   * Updates an existing certification definition.
   *
   * @param input - Certification identifier and updated fields.
   * @returns Updated certification record.
   */
  update: brandRequiredProcedure
    .input(brandCatalog.updateCertificationSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await updateCertification(db, brandId, input.id, {
          title: input.title,
          certificationCode: input.certification_code ?? null,
          instituteName: input.institute_name ?? null,
          instituteAddress: input.institute_address ?? null,
          instituteContact: input.institute_contact ?? null,
          issueDate: input.issue_date ?? null,
          expiryDate: input.expiry_date ?? null,
          fileAssetId: input.file_asset_id ?? null,
          externalUrl: input.external_url ?? null,
          notes: input.notes ?? null,
        });
      } catch (error) {
        throw wrapError(error, "Failed to update certification");
      }
    }),

  /**
   * Deletes a certification from the catalog.
   *
   * @param input - Identifier of the certification to remove.
   * @returns Identifier of the deleted certification.
   */
  delete: brandRequiredProcedure
    .input(brandCatalog.deleteCertificationSchema)
    .mutation(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      try {
        return await deleteCertification(db, brandId, input.id);
      } catch (error) {
        throw wrapError(error, "Failed to delete certification");
      }
    }),
});
