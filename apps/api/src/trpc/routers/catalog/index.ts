import type { Database } from "@v1/db/client";
/**
 * Catalog router implementation.
 *
 * Implements the reorganized `catalog.*` namespace covering all brand-owned
 * catalog resources (attributes, attribute values, materials, operators,
 * manufacturers, certifications).
 *
 * Renamed from `brand.*` to `catalog.*` in Phase 4 to clarify that this
 * router handles catalog entities, not brand lifecycle operations.
 *
 * Note: Legacy color/size routers removed in Phase 5 of variant attribute migration.
 * Colors and sizes are now managed via generic brand attributes.
 *
 * All endpoints follow a consistent CRUD pattern using shared helper
 * functions to minimize code duplication and ensure uniform error handling.
 */
import {
  batchCreateBrandAttributeValues,
  createBrandAttribute,
  createBrandAttributeValue,
  createBrandManufacturer,
  createBrandTag,
  createCertification,
  createMaterial,
  createOperator,
  createSeason,
  deleteBrandAttribute,
  deleteBrandAttributeValue,
  deleteBrandManufacturer,
  deleteBrandTag,
  deleteCertification,
  deleteMaterial,
  deleteOperator,
  deleteSeason,
  listBrandAttributeValues,
  listBrandAttributesWithMetrics,
  listBrandManufacturersWithMetrics,
  listBrandTagsWithMetrics,
  listCertificationsWithMetrics,
  listMaterialsWithMetrics,
  listOperatorsWithMetrics,
  listSeasonsForBrandWithMetrics,
  listAttributesGroupedWithMetrics,
  updateBrandAttribute,
  updateBrandAttributeValue,
  updateBrandManufacturer,
  updateBrandTag,
  updateCertification,
  updateMaterial,
  updateOperator,
  updateSeason,
} from "@v1/db/queries/catalog";
import {
  batchCreateBrandAttributeValuesSchema,
  createBrandAttributeSchema,
  createBrandAttributeValueSchema,
  createBrandTagSchema,
  createCertificationSchema,
  createManufacturerSchema,
  createMaterialSchema,
  createOperatorSchema,
  createSeasonSchema,
  deleteBrandAttributeSchema,
  deleteBrandAttributeValueSchema,
  deleteBrandTagSchema,
  deleteCertificationSchema,
  deleteManufacturerSchema,
  deleteMaterialSchema,
  deleteOperatorSchema,
  deleteSeasonSchema,
  listBrandAttributeValuesSchema,
  listBrandAttributesSchema,
  listGroupedBrandAttributesSchema,
  listBrandTagsSchema,
  listCertificationsSchema,
  listManufacturersSchema,
  listMaterialsSchema,
  listOperatorsSchema,
  listSeasonsSchema,
  updateBrandAttributeSchema,
  updateBrandAttributeValueSchema,
  updateBrandTagSchema,
  updateCertificationSchema,
  updateManufacturerSchema,
  updateMaterialSchema,
  updateOperatorSchema,
  updateSeasonSchema,
} from "../../../schemas/catalog/index.js";
import {
  transformBrandAttributeInput,
  transformBrandAttributeValueInput,
  transformCertificationInput,
  transformManufacturerInput,
  transformMaterialInput,
  transformOperatorInput,
  transformSeasonInput,
} from "../../../utils/catalog-transform.js";
import { notFound, wrapError } from "../../../utils/errors.js";
import {
  createEntityResponse,
  createListResponse,
} from "../../../utils/response.js";
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
      const transformedInput =
        transformInput && input != null ? transformInput(input) : input;
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
 * and manufacturers - eliminating ~200 lines of duplication.
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
 * Catalog router exposing all nested catalog collections.
 *
 * Structure:
 * - catalog.attributes.* (list/create/update/delete) - variant dimensions
 * - catalog.attributeValues.* (list/create/update/delete) - dimension options
 * - catalog.materials.* (list/create/update/delete)
 * - catalog.seasons.* (list/create/update/delete)
 * - catalog.operators.* (list/create/update/delete)
 * - catalog.manufacturers.* (list/create/update/delete)
 * - catalog.certifications.* (list/create/update/delete)
 * - catalog.tags.* (list/create/update/delete)
 *
 * Note: Legacy colors/sizes routers removed in Phase 5.
 * Colors and sizes are now managed via catalog.attributes and catalog.attributeValues.
 *
 * Total: 32 endpoints (8 resources × 4 operations)
 */
export const catalogRouter = createTRPCRouter({
  /**
   * Brand attributes catalog endpoints.
   *
   * Variant dimensions (e.g., Color, Size, Material) that can optionally
   * link to taxonomy attributes for semantic meaning.
   */
  attributes: createTRPCRouter({
    list: createListProcedure(
      listBrandAttributesSchema,
      listBrandAttributesWithMetrics,
      "attribute",
    ),
    listGrouped: createListProcedure(
      listGroupedBrandAttributesSchema,
      listAttributesGroupedWithMetrics,
      "attribute groups",
    ),
    create: createCreateProcedure(
      createBrandAttributeSchema,
      createBrandAttribute,
      "attribute",
      transformBrandAttributeInput,
    ),
    update: createUpdateProcedure(
      updateBrandAttributeSchema,
      updateBrandAttribute,
      "attribute",
      transformBrandAttributeInput,
    ),
    delete: createDeleteProcedure(
      deleteBrandAttributeSchema,
      deleteBrandAttribute,
      "attribute",
    ),
  }),

  /**
   * Brand attribute values catalog endpoints.
   *
   * The selectable options within a dimension (e.g., "Red", "Blue" for Color).
   * Values belong to a specific attribute and can optionally link to taxonomy.
   *
   * Note: list requires attribute_id, so we use a custom implementation.
   */
  attributeValues: createTRPCRouter({
    list: brandRequiredProcedure
      .input(listBrandAttributeValuesSchema)
      .query(async ({ ctx, input }) => {
        const brandCtx = ctx as BrandContext;
        try {
          const results = await listBrandAttributeValues(
            brandCtx.db,
            brandCtx.brandId,
            input.attribute_id,
          );
          return createListResponse(results);
        } catch (error) {
          throw wrapError(error, "Failed to list attribute values");
        }
      }),
    create: createCreateProcedure(
      createBrandAttributeValueSchema,
      createBrandAttributeValue,
      "attribute value",
      transformBrandAttributeValueInput,
    ),
    update: createUpdateProcedure(
      updateBrandAttributeValueSchema,
      updateBrandAttributeValue,
      "attribute value",
      transformBrandAttributeValueInput,
    ),
    delete: createDeleteProcedure(
      deleteBrandAttributeValueSchema,
      deleteBrandAttributeValue,
      "attribute value",
    ),
    batchCreate: brandRequiredProcedure
      .input(batchCreateBrandAttributeValuesSchema)
      .mutation(async ({ ctx, input }) => {
        const brandCtx = ctx as BrandContext;
        try {
          const valuesWithTransform = input.values.map((v) => ({
            attributeId: v.attribute_id,
            name: v.name,
            taxonomyValueId: v.taxonomy_value_id ?? null,
          }));
          const resultMap = await batchCreateBrandAttributeValues(
            brandCtx.db,
            brandCtx.brandId,
            valuesWithTransform,
          );
          // Convert map to array of results
          const results: Array<{ key: string; id: string }> = [];
          for (const [key, id] of resultMap) {
            results.push({ key, id });
          }
          return createEntityResponse({
            created: results.length,
            values: results,
          });
        } catch (error) {
          throw wrapError(error, "Failed to batch create attribute values");
        }
      }),
  }),

  /**
   * Brand tags catalog endpoints.
   *
   * Powers tag selection + creation workflows in passport forms.
   */
  tags: createCatalogResourceRouter(
    "tag",
    {
      list: listBrandTagsSchema,
      create: createBrandTagSchema,
      update: updateBrandTagSchema,
      delete: deleteBrandTagSchema,
    },
    {
      list: listBrandTagsWithMetrics,
      create: createBrandTag,
      update: updateBrandTag,
      delete: deleteBrandTag,
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
      list: listMaterialsWithMetrics,
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
      list: listSeasonsForBrandWithMetrics,
      create: createSeason,
      update: updateSeason,
      delete: deleteSeason,
    },
    transformSeasonInput,
  ),

  /**
   * Operators catalog endpoints.
   *
   * Used for journey step tracking in product manufacturing.
   */
  operators: createCatalogResourceRouter(
    "operator",
    {
      list: listOperatorsSchema,
      create: createOperatorSchema,
      update: updateOperatorSchema,
      delete: deleteOperatorSchema,
    },
    {
      list: listOperatorsWithMetrics,
      create: createOperator,
      update: updateOperator,
      delete: deleteOperator,
    },
    transformOperatorInput,
  ),

  /**
   * Manufacturers catalog endpoints.
   *
   * Enables multi-brand products (e.g., Nike product manufactured by Avelero).
   * Products link via products.manufacturer_id → manufacturers.id.
   */
  manufacturers: createCatalogResourceRouter(
    "manufacturer",
    {
      list: listManufacturersSchema,
      create: createManufacturerSchema,
      update: updateManufacturerSchema,
      delete: deleteManufacturerSchema,
    },
    {
      list: listBrandManufacturersWithMetrics,
      create: createBrandManufacturer,
      update: updateBrandManufacturer,
      delete: deleteBrandManufacturer,
    },
    transformManufacturerInput,
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
      list: listCertificationsWithMetrics,
      create: createCertification,
      update: updateCertification,
      delete: deleteCertification,
    },
    transformCertificationInput,
  ),
});

type CatalogRouter = typeof catalogRouter;
