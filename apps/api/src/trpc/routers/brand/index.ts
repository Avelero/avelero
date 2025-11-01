import type { Database } from "@v1/db/client";
/**
 * Brand catalog router implementation.
 *
 * Implements the reorganized `brand.*` namespace covering all brand-owned
 * catalog resources (colors, sizes, materials, facilities, showcaseBrands,
 * ecoClaims, certifications).
 *
 * All 28 endpoints follow a consistent CRUD pattern using shared helper
 * functions to minimize code duplication and ensure uniform error handling.
 */
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
} from "../../../schemas/brand-catalog/index.js";
import { notFound, wrapError } from "../../../utils/errors.js";
import {
  createEntityResponse,
  createListResponse,
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

/**
 * Shared helper: Wraps a list query for a brand catalog resource.
 */
function createListProcedure<TInput>(
  schema: any,
  queryFn: (db: Database, brandId: string, opts?: any) => Promise<any[]>,
  resourceName: string,
) {
  return brandRequiredProcedure.input(schema).query(async ({ ctx, input }) => {
    const brandCtx = ctx as BrandContext;
    try {
      const results = await queryFn(brandCtx.db, brandCtx.brandId, input);
      return createListResponse(results);
    } catch (error) {
      throw wrapError(error, `Failed to list ${resourceName}`);
    }
  });
}

/**
 * Shared helper: Wraps a create mutation for a brand catalog resource.
 */
function createCreateProcedure<TInput>(
  schema: any,
  createFn: (db: Database, brandId: string, input: any) => Promise<any>,
  resourceName: string,
) {
  return brandRequiredProcedure
    .input(schema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const result = await createFn(brandCtx.db, brandCtx.brandId, input);
        return createEntityResponse(result);
      } catch (error) {
        throw wrapError(error, `Failed to create ${resourceName}`);
      }
    });
}

/**
 * Shared helper: Wraps an update mutation for a brand catalog resource.
 */
function createUpdateProcedure<TInput extends { id: string }>(
  schema: any,
  updateFn: (
    db: Database,
    brandId: string,
    id: string,
    input: any,
  ) => Promise<any>,
  resourceName: string,
) {
  return brandRequiredProcedure
    .input(schema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const typedInput = input as TInput;
      try {
        const result = await updateFn(
          brandCtx.db,
          brandCtx.brandId,
          typedInput.id,
          typedInput,
        );
        if (!result) {
          throw notFound(resourceName, typedInput.id);
        }
        return createEntityResponse(result);
      } catch (error) {
        throw wrapError(error, `Failed to update ${resourceName}`);
      }
    });
}

/**
 * Shared helper: Wraps a delete mutation for a brand catalog resource.
 */
function createDeleteProcedure<TInput extends { id: string }>(
  schema: any,
  deleteFn: (db: Database, brandId: string, id: string) => Promise<any>,
  resourceName: string,
) {
  return brandRequiredProcedure
    .input(schema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const typedInput = input as TInput;
      try {
        const result = await deleteFn(
          brandCtx.db,
          brandCtx.brandId,
          typedInput.id,
        );
        if (!result) {
          throw notFound(resourceName, typedInput.id);
        }
        return createEntityResponse(result);
      } catch (error) {
        throw wrapError(error, `Failed to delete ${resourceName}`);
      }
    });
}

/**
 * Factory function: Creates a complete CRUD router for a catalog resource.
 */
function createCatalogResourceRouter<T>(
  resourceName: string,
  schemas: {
    list: any;
    create: any;
    update: any;
    delete: any;
  },
  operations: {
    list: (db: Database, brandId: string, opts?: any) => Promise<T[]>;
    create: (db: Database, brandId: string, input: any) => Promise<T>;
    update: (
      db: Database,
      brandId: string,
      id: string,
      input: any,
    ) => Promise<T>;
    delete: (db: Database, brandId: string, id: string) => Promise<T>;
  },
) {
  return createTRPCRouter({
    list: createListProcedure(schemas.list, operations.list, resourceName),
    create: createCreateProcedure(
      schemas.create,
      operations.create,
      resourceName,
    ),
    update: createUpdateProcedure(
      schemas.update,
      operations.update,
      resourceName,
    ),
    delete: createDeleteProcedure(
      schemas.delete,
      operations.delete,
      resourceName,
    ),
  });
}

/**
 * Brand catalog router exposing all nested catalog collections.
 *
 * Structure:
 * - brand.colors.* (list/create/update/delete)
 * - brand.sizes.* (list/create/update/delete)
 * - brand.materials.* (list/create/update/delete)
 * - brand.facilities.* (list/create/update/delete)
 * - brand.showcaseBrands.* (list/create/update/delete)
 * - brand.ecoClaims.* (list/create/update/delete)
 * - brand.certifications.* (list/create/update/delete)
 *
 * Total: 28 endpoints (7 resources × 4 operations)
 */
export const brandRouter = createTRPCRouter({
  /**
   * Colors catalog endpoints.
   *
   * Note: Hex values are provided by @v1/selections/colors static package
   * (intentional performance optimization). Database stores only color names.
   */
  colors: createCatalogResourceRouter(
    "color",
    {
      list: listColorsSchema,
      create: createColorSchema,
      update: updateColorSchema,
      delete: deleteColorSchema,
    },
    {
      list: listColors,
      create: createColor,
      update: updateColor,
      delete: deleteColor,
    },
  ),

  /**
   * Sizes catalog endpoints.
   *
   * Supports optional category_id filtering and drag-and-drop sort ordering.
   */
  sizes: createCatalogResourceRouter(
    "size",
    {
      list: listSizesSchema,
      create: createSizeSchema,
      update: updateSizeSchema,
      delete: deleteSizeSchema,
    },
    {
      list: listSizes,
      create: createSize,
      update: updateSize,
      delete: deleteSize,
    },
  ),

  /**
   * Materials catalog endpoints.
   *
   * Includes certification references, recyclability, and country of origin.
   */
  materials: createCatalogResourceRouter(
    "material",
    {
      list: listMaterialsSchema,
      create: createMaterialSchema,
      update: updateMaterialSchema,
      delete: deleteMaterialSchema,
    },
    {
      list: listMaterials,
      create: createMaterial,
      update: updateMaterial,
      delete: deleteMaterial,
    },
  ),

  /**
   * Facilities catalog endpoints.
   *
   * Used for journey step tracking in product manufacturing.
   */
  facilities: createCatalogResourceRouter(
    "facility",
    {
      list: listFacilitiesSchema,
      create: createFacilitySchema,
      update: updateFacilitySchema,
      delete: deleteFacilitySchema,
    },
    {
      list: listFacilities,
      create: createFacility,
      update: updateFacility,
      delete: deleteFacility,
    },
  ),

  /**
   * Showcase brands catalog endpoints.
   *
   * Enables multi-brand products (e.g., Nike product manufactured by Avelero).
   * Products link via products.showcase_brand_id → showcase_brands.id.
   */
  showcaseBrands: createCatalogResourceRouter(
    "showcase brand",
    {
      list: listShowcaseBrandsSchema,
      create: createShowcaseBrandSchema,
      update: updateShowcaseBrandSchema,
      delete: deleteShowcaseBrandSchema,
    },
    {
      list: listShowcaseBrands,
      create: createShowcaseBrand,
      update: updateShowcaseBrand,
      delete: deleteShowcaseBrand,
    },
  ),

  /**
   * Eco claims catalog endpoints.
   *
   * Simple 50-character sustainability claims for products.
   */
  ecoClaims: createCatalogResourceRouter(
    "eco claim",
    {
      list: listEcoClaimsSchema,
      create: createEcoClaimSchema,
      update: updateEcoClaimSchema,
      delete: deleteEcoClaimSchema,
    },
    {
      list: listEcoClaims,
      create: createEcoClaim,
      update: updateEcoClaim,
      delete: deleteEcoClaim,
    },
  ),

  /**
   * Certifications catalog endpoints.
   *
   * Comprehensive certification system with file attachments and metadata.
   */
  certifications: createCatalogResourceRouter(
    "certification",
    {
      list: listCertificationsSchema,
      create: createCertificationSchema,
      update: updateCertificationSchema,
      delete: deleteCertificationSchema,
    },
    {
      list: listCertifications,
      create: createCertification,
      update: updateCertification,
      delete: deleteCertification,
    },
  ),
});

export type BrandRouter = typeof brandRouter;
