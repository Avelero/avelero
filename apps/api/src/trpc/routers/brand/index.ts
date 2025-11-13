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
  createSeason,
  createShowcaseBrand,
  createSize,
  deleteCertification,
  deleteColor,
  deleteEcoClaim,
  deleteFacility,
  deleteMaterial,
  deleteSeason,
  deleteShowcaseBrand,
  deleteSize,
  listCertifications,
  listColors,
  listEcoClaims,
  listFacilities,
  listMaterials,
  listSeasonsForBrand,
  listShowcaseBrands,
  listSizes,
  updateCertification,
  updateColor,
  updateEcoClaim,
  updateFacility,
  updateMaterial,
  updateSeason,
  updateShowcaseBrand,
  updateSize,
} from "@v1/db/queries";
import {
  createCertificationSchema,
  createColorSchema,
  createEcoClaimSchema,
  createFacilitySchema,
  createMaterialSchema,
  createSeasonSchema,
  createShowcaseBrandSchema,
  createSizeSchema,
  deleteCertificationSchema,
  deleteColorSchema,
  deleteEcoClaimSchema,
  deleteFacilitySchema,
  deleteMaterialSchema,
  deleteSeasonSchema,
  deleteShowcaseBrandSchema,
  deleteSizeSchema,
  listCertificationsSchema,
  listColorsSchema,
  listEcoClaimsSchema,
  listFacilitiesSchema,
  listMaterialsSchema,
  listSeasonsSchema,
  listShowcaseBrandsSchema,
  listSizesSchema,
  updateCertificationSchema,
  updateColorSchema,
  updateEcoClaimSchema,
  updateFacilitySchema,
  updateMaterialSchema,
  updateSeasonSchema,
  updateShowcaseBrandSchema,
  updateSizeSchema,
} from "../../../schemas/brand-catalog/index.js";
import { notFound, wrapError } from "../../../utils/errors.js";
import {
  createEntityResponse,
  createListResponse,
} from "../../../utils/response.js";
import {
  transformCertificationInput,
  transformFacilityInput,
  transformMaterialInput,
  transformSeasonInput,
  transformShowcaseBrandInput,
  transformSizeInput,
} from "../../../utils/catalog-transform.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

/** tRPC context with guaranteed brand ID from middleware */
type BrandContext = AuthenticatedTRPCContext & { brandId: string };

/**
 * Creates a standardized list procedure for brand catalog resources.
 *
 * Wraps query functions with consistent error handling and response formatting.
 * All list procedures enforce brand context and return the same response shape.
 *
 * @template TInput - Input schema type
 * @param schema - Zod validation schema for input
 * @param queryFn - Database query function returning array of resources
 * @param resourceName - Human-readable resource name for error messages (e.g., "color", "size")
 * @param transformInput - Optional function to transform snake_case schema to camelCase DB input
 * @returns tRPC query procedure with brand context
 */
function createListProcedure<TInput>(
  schema: any,
  queryFn: (db: Database, brandId: string, opts?: any) => Promise<any[]>,
  resourceName: string,
  transformInput?: (input: any) => any,
) {
  return brandRequiredProcedure.input(schema).query(async ({ ctx, input }) => {
    const brandCtx = ctx as BrandContext;
    try {
      const transformedInput = transformInput ? transformInput(input) : input;
      const results = await queryFn(
        brandCtx.db,
        brandCtx.brandId,
        transformedInput,
      );
      return createListResponse(results);
    } catch (error) {
      throw wrapError(error, `Failed to list ${resourceName}`);
    }
  });
}

/**
 * Creates a standardized create procedure for brand catalog resources.
 *
 * Wraps create functions with consistent validation, error handling, and
 * response formatting. All create procedures enforce brand context.
 *
 * @template TInput - Input schema type
 * @param schema - Zod validation schema for input
 * @param createFn - Database create function
 * @param resourceName - Human-readable resource name for error messages
 * @param transformInput - Optional function to transform snake_case schema to camelCase DB input
 * @returns tRPC mutation procedure with brand context
 */
function createCreateProcedure<TInput>(
  schema: any,
  createFn: (db: Database, brandId: string, input: any) => Promise<any>,
  resourceName: string,
  transformInput?: (input: any) => any,
) {
  return brandRequiredProcedure
    .input(schema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const transformedInput = transformInput ? transformInput(input) : input;
        const result = await createFn(
          brandCtx.db,
          brandCtx.brandId,
          transformedInput,
        );
        return createEntityResponse(result);
      } catch (error) {
        throw wrapError(error, `Failed to create ${resourceName}`);
      }
    });
}

/**
 * Creates a standardized update procedure for brand catalog resources.
 *
 * Wraps update functions with validation, error handling, and automatic 404
 * handling when the resource doesn't exist. All update procedures enforce
 * brand context and require an ID in the input.
 *
 * @template TInput - Input schema type (must include id field)
 * @param schema - Zod validation schema for input
 * @param updateFn - Database update function
 * @param resourceName - Human-readable resource name for error messages
 * @param transformInput - Optional function to transform snake_case schema to camelCase DB input
 * @returns tRPC mutation procedure with brand context and not-found handling
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
  transformInput?: (input: any) => any,
) {
  return brandRequiredProcedure
    .input(schema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const typedInput = input as TInput;
      try {
        const transformedInput = transformInput
          ? transformInput(typedInput)
          : typedInput;
        const result = await updateFn(
          brandCtx.db,
          brandCtx.brandId,
          typedInput.id,
          transformedInput,
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
 * Creates a standardized delete procedure for brand catalog resources.
 *
 * Wraps delete functions with validation, error handling, and automatic 404
 * handling when the resource doesn't exist. All delete procedures enforce
 * brand context.
 *
 * @template TInput - Input schema type (must include id field)
 * @param schema - Zod validation schema for input
 * @param deleteFn - Database delete function
 * @param resourceName - Human-readable resource name for error messages
 * @returns tRPC mutation procedure with brand context and not-found handling
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
 * Factory function creating a complete CRUD router for catalog resources.
 *
 * Eliminates boilerplate by generating four standard endpoints (list, create,
 * update, delete) with consistent validation, error handling, and response
 * formatting. All endpoints enforce brand-level permissions.
 *
 * This pattern is used for colors, sizes, materials, facilities, certifications,
 * eco claims, and showcase brands - eliminating ~200 lines of duplication.
 *
 * @template T - Resource entity type
 * @param resourceName - Human-readable name for error messages (e.g., "color", "size")
 * @param schemas - Zod schemas for each operation
 * @param operations - Database query functions for each operation
 * @param transformInput - Optional function to transform snake_case schema to camelCase DB input
 * @returns tRPC router with list/create/update/delete endpoints
 *
 * @example
 * ```typescript
 * const colorsRouter = createCatalogResourceRouter(
 *   "color",
 *   { list: listColorsSchema, create: createColorSchema, ... },
 *   { list: listColors, create: createColor, ... },
 *   transformColorInput // optional
 * );
 * // Exposes: colors.list, colors.create, colors.update, colors.delete
 * ```
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
  transformInput?: (input: any) => any,
) {
  return createTRPCRouter({
    list: createListProcedure(
      schemas.list,
      operations.list,
      resourceName,
      transformInput,
    ),
    create: createCreateProcedure(
      schemas.create,
      operations.create,
      resourceName,
      transformInput,
    ),
    update: createUpdateProcedure(
      schemas.update,
      operations.update,
      resourceName,
      transformInput,
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
 * - brand.seasons.* (list/create/update/delete)
 * - brand.facilities.* (list/create/update/delete)
 * - brand.showcaseBrands.* (list/create/update/delete)
 * - brand.ecoClaims.* (list/create/update/delete)
 * - brand.certifications.* (list/create/update/delete)
 *
 * Total: 32 endpoints (8 resources × 4 operations)
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
    transformSizeInput,
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
    transformMaterialInput,
  ),

  /**
   * Seasons catalog endpoints.
   *
   * Manages seasonal collections with optional start/end dates or ongoing flag.
   */
  seasons: createCatalogResourceRouter(
    "season",
    {
      list: listSeasonsSchema,
      create: createSeasonSchema,
      update: updateSeasonSchema,
      delete: deleteSeasonSchema,
    },
    {
      list: listSeasonsForBrand,
      create: createSeason,
      update: updateSeason,
      delete: deleteSeason,
    },
    transformSeasonInput,
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
    transformFacilityInput,
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
    transformShowcaseBrandInput,
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
    transformCertificationInput,
  ),
});

export type BrandRouter = typeof brandRouter;
