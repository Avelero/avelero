import {
  createCertification,
  createColor,
  createEcoClaim,
  createFacility,
  createMaterial,
  createShowcaseBrand,
  createSize,
  deleteCertification,
  deleteColor,
  deleteEcoClaim,
  deleteFacility,
  deleteMaterial,
  deleteShowcaseBrand,
  deleteSize,
  listCertifications,
  listColors,
  listEcoClaims,
  listFacilities,
  listMaterials,
  listShowcaseBrands,
  listSizes,
  updateCertification,
  updateColor,
  updateEcoClaim,
  updateFacility,
  updateMaterial,
  updateShowcaseBrand,
  updateSize,
} from "@v1/db/queries";
import {
  createCertificationSchema,
  createColorSchema,
  createEcoClaimSchema,
  createFacilitySchema,
  createMaterialSchema,
  createShowcaseBrandSchema,
  createSizeSchema,
  deleteCertificationSchema,
  deleteColorSchema,
  deleteEcoClaimSchema,
  deleteFacilitySchema,
  deleteMaterialSchema,
  deleteShowcaseBrandSchema,
  deleteSizeSchema,
  listCertificationsSchema,
  listColorsSchema,
  listEcoClaimsSchema,
  listFacilitiesSchema,
  listMaterialsSchema,
  listShowcaseBrandsSchema,
  listSizesSchema,
  updateCertificationSchema,
  updateColorSchema,
  updateEcoClaimSchema,
  updateFacilitySchema,
  updateMaterialSchema,
  updateShowcaseBrandSchema,
  updateSizeSchema,
} from "../../schemas/brand-catalog.js";
import { createTRPCRouter, protectedProcedure } from "../init.js";

export const brandCatalogRouter = createTRPCRouter({
  colors: {
    list: protectedProcedure.input(listColorsSchema).query(async ({ ctx }) => {
      const { db, brandId } = ctx;
      if (!brandId) return { data: [] } as const;
      const data = await listColors(db, brandId);
      return { data } as const;
    }),
    create: protectedProcedure
      .input(createColorSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        if (!brandId) throw new Error("No active brand");
        return createColor(db, brandId, { name: input.name });
      }),
    update: protectedProcedure
      .input(updateColorSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return updateColor(db, input.id, { name: input.name });
      }),
    delete: protectedProcedure
      .input(deleteColorSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return deleteColor(db, input.id);
      }),
  },
  sizes: {
    list: protectedProcedure
      .input(listSizesSchema)
      .query(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        if (!brandId) return { data: [] } as const;
        const data = await listSizes(db, brandId, {
          categoryId: input.category_id,
        });
        return { data } as const;
      }),
    create: protectedProcedure
      .input(createSizeSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        if (!brandId) throw new Error("No active brand");
        return createSize(db, brandId, {
          name: input.name,
          categoryId: input.category_id,
          sortIndex: input.sort_index,
        });
      }),
    update: protectedProcedure
      .input(updateSizeSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return updateSize(db, input.id, {
          name: input.name,
          categoryId: input.category_id ?? null,
          sortIndex: input.sort_index ?? null,
        });
      }),
    delete: protectedProcedure
      .input(deleteSizeSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return deleteSize(db, input.id);
      }),
  },
  materials: {
    list: protectedProcedure
      .input(listMaterialsSchema)
      .query(async ({ ctx }) => {
        const { db, brandId } = ctx;
        if (!brandId) return { data: [] } as const;
        const data = await listMaterials(db, brandId);
        return { data } as const;
      }),
    create: protectedProcedure
      .input(createMaterialSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        if (!brandId) throw new Error("No active brand");
        return createMaterial(db, brandId, {
          name: input.name,
          certificationId: input.certification_id,
          recyclable: input.recyclable,
          countryOfOrigin: input.country_of_origin,
        });
      }),
    update: protectedProcedure
      .input(updateMaterialSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return updateMaterial(db, input.id, {
          name: input.name,
          certificationId: input.certification_id ?? null,
          recyclable: input.recyclable ?? null,
          countryOfOrigin: input.country_of_origin ?? null,
        });
      }),
    delete: protectedProcedure
      .input(deleteMaterialSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return deleteMaterial(db, input.id);
      }),
  },
  certifications: {
    list: protectedProcedure
      .input(listCertificationsSchema)
      .query(async ({ ctx }) => {
        const { db, brandId } = ctx;
        if (!brandId) return { data: [] } as const;
        const data = await listCertifications(db, brandId);
        return { data } as const;
      }),
    create: protectedProcedure
      .input(createCertificationSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        if (!brandId) throw new Error("No active brand");
        return createCertification(db, brandId, {
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
      }),
    update: protectedProcedure
      .input(updateCertificationSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return updateCertification(db, input.id, {
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
      }),
    delete: protectedProcedure
      .input(deleteCertificationSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return deleteCertification(db, input.id);
      }),
  },
  ecoClaims: {
    list: protectedProcedure
      .input(listEcoClaimsSchema)
      .query(async ({ ctx }) => {
        const { db, brandId } = ctx;
        if (!brandId) return { data: [] } as const;
        const data = await listEcoClaims(db, brandId);
        return { data } as const;
      }),
    create: protectedProcedure
      .input(createEcoClaimSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        if (!brandId) throw new Error("No active brand");
        return createEcoClaim(db, brandId, { claim: input.claim });
      }),
    update: protectedProcedure
      .input(updateEcoClaimSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return updateEcoClaim(db, input.id, { claim: input.claim });
      }),
    delete: protectedProcedure
      .input(deleteEcoClaimSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return deleteEcoClaim(db, input.id);
      }),
  },
  facilities: {
    list: protectedProcedure
      .input(listFacilitiesSchema)
      .query(async ({ ctx }) => {
        const { db, brandId } = ctx;
        if (!brandId) return { data: [] } as const;
        const data = await listFacilities(db, brandId);
        return { data } as const;
      }),
    create: protectedProcedure
      .input(createFacilitySchema)
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        if (!brandId) throw new Error("No active brand");
        return createFacility(db, brandId, {
          displayName: input.display_name,
          legalName: input.legal_name,
          address: input.address,
          city: input.city,
          countryCode: input.country_code,
          contact: input.contact,
          vatNumber: input.vat_number,
        });
      }),
    update: protectedProcedure
      .input(updateFacilitySchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return updateFacility(db, input.id, {
          displayName: input.display_name,
          legalName: input.legal_name ?? null,
          address: input.address ?? null,
          city: input.city ?? null,
          countryCode: input.country_code ?? null,
          contact: input.contact ?? null,
          vatNumber: input.vat_number ?? null,
        });
      }),
    delete: protectedProcedure
      .input(deleteFacilitySchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return deleteFacility(db, input.id);
      }),
  },
  showcaseBrands: {
    list: protectedProcedure
      .input(listShowcaseBrandsSchema)
      .query(async ({ ctx }) => {
        const { db, brandId } = ctx;
        if (!brandId) return { data: [] } as const;
        const data = await listShowcaseBrands(db, brandId);
        return { data } as const;
      }),
    create: protectedProcedure
      .input(createShowcaseBrandSchema)
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        if (!brandId) throw new Error("No active brand");
        return createShowcaseBrand(db, brandId, {
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
      }),
    update: protectedProcedure
      .input(updateShowcaseBrandSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return updateShowcaseBrand(db, input.id, {
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
      }),
    delete: protectedProcedure
      .input(deleteShowcaseBrandSchema)
      .mutation(async ({ ctx, input }) => {
        const { db } = ctx;
        return deleteShowcaseBrand(db, input.id);
      }),
  },
});
