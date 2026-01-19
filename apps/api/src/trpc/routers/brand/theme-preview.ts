import type { Database } from "@v1/db/client";
/**
 * Theme preview router for the theme editor.
 *
 * Provides endpoints for fetching real product data as DppData format
 * for live preview in the theme editor. Unlike the public DPP endpoint,
 * this does not require products to be published.
 *
 * Endpoints:
 * - brand.themePreview.getProduct - Fetch DppData for a specific product
 * - brand.themePreview.list - List products sorted by updatedAt for navigation
 */
import { and, asc, desc, eq, sql } from "@v1/db/queries";
import {
  brandCertifications,
  brandManufacturers,
  brandMaterials,
  brandOperators,
  brands,
  productEnvironment,
  productJourneySteps,
  productMaterials,
  products,
  taxonomyCategories,
} from "@v1/db/schema";
import type { DppData } from "@v1/dpp-components";
import { type CountryCode, countries } from "@v1/selections";
import { getPublicUrl } from "@v1/supabase/storage";
import { z } from "zod";
import { wrapError } from "../../../utils/errors.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

// ─────────────────────────────────────────────────────────────────────────────
// Input Schemas
// ─────────────────────────────────────────────────────────────────────────────

const getProductSchema = z.object({
  productId: z.string().uuid(),
});

const listProductsSchema = z.object({
  cursor: z.string().optional(),
  direction: z.enum(["next", "prev"]).optional(),
  limit: z.number().min(1).max(50).default(1),
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal Types
// ─────────────────────────────────────────────────────────────────────────────

interface DppMaterial {
  percentage: number;
  materialName: string;
  countryOfOrigin: string | null;
  recyclable: boolean | null;
  certificationTitle: string | null;
  certificationUrl: string | null;
}

interface DppFacility {
  displayName: string;
  city: string | null;
  countryCode: string | null;
}

interface DppJourneyStep {
  sortIndex: number;
  stepType: string;
  facilities: DppFacility[];
}

interface DppEnvironment {
  carbonKgCo2e: string | null;
  waterLiters: string | null;
}

/**
 * Converts country code to country name.
 * Returns the code if no match is found.
 */
function getCountryName(code: string | null): string {
  if (!code) return "";
  const upperCode = code.toUpperCase() as CountryCode;
  const country = countries[upperCode];
  return country?.name ?? code;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch journey steps with their associated facilities for a product.
 */
async function fetchJourneyWithOperators(
  db: Database,
  productId: string,
): Promise<DppJourneyStep[]> {
  const steps = await db
    .select({
      id: productJourneySteps.id,
      sortIndex: productJourneySteps.sortIndex,
      stepType: productJourneySteps.stepType,
      operatorId: productJourneySteps.operatorId,
    })
    .from(productJourneySteps)
    .where(eq(productJourneySteps.productId, productId))
    .orderBy(asc(productJourneySteps.sortIndex));

  if (steps.length === 0) return [];

  // Get operators for all steps
  const operatorIds = steps
    .map((s) => s.operatorId)
    .filter((id): id is string => id !== null);
  if (operatorIds.length === 0) {
    return steps.map((s) => ({
      sortIndex: s.sortIndex,
      stepType: s.stepType,
      facilities: [],
    }));
  }

  // Fetch all operators in one query
  const operators = await db
    .select({
      id: brandOperators.id,
      displayName: brandOperators.displayName,
      city: brandOperators.city,
      countryCode: brandOperators.countryCode,
    })
    .from(brandOperators)
    .where(
      sql`${brandOperators.id} = ANY(${sql.raw(`ARRAY[${operatorIds.map((id) => `'${id}'`).join(",")}]::uuid[]`)})`,
    );

  const operatorMap = new Map(operators.map((o) => [o.id, o]));

  return steps.map((step) => ({
    sortIndex: step.sortIndex,
    stepType: step.stepType,
    facilities:
      step.operatorId && operatorMap.has(step.operatorId)
        ? [
            {
              displayName: operatorMap.get(step.operatorId)!.displayName,
              city: operatorMap.get(step.operatorId)!.city,
              countryCode: operatorMap.get(step.operatorId)!.countryCode,
            },
          ]
        : [],
  }));
}

/**
 * Fetch product attributes (materials, journey, environment).
 */
async function fetchProductAttributes(
  db: Database,
  productId: string,
): Promise<{
  materials: DppMaterial[];
  journey: DppJourneyStep[];
  environment: DppEnvironment | null;
}> {
  const [materials, journey, environmentRows] = await Promise.all([
    // Materials with certification info
    db
      .select({
        percentage: productMaterials.percentage,
        materialName: brandMaterials.name,
        countryOfOrigin: brandMaterials.countryOfOrigin,
        recyclable: brandMaterials.recyclable,
        certificationTitle: brandCertifications.title,
        certificationUrl: brandCertifications.instituteWebsite,
      })
      .from(productMaterials)
      .innerJoin(
        brandMaterials,
        eq(brandMaterials.id, productMaterials.brandMaterialId),
      )
      .leftJoin(
        brandCertifications,
        eq(brandCertifications.id, brandMaterials.certificationId),
      )
      .where(eq(productMaterials.productId, productId))
      .orderBy(asc(productMaterials.createdAt)),

    // Journey steps with facilities
    fetchJourneyWithOperators(db, productId),

    // Environment metrics
    db
      .select({
        value: productEnvironment.value,
        unit: productEnvironment.unit,
        metric: productEnvironment.metric,
      })
      .from(productEnvironment)
      .where(eq(productEnvironment.productId, productId)),
  ]);

  return {
    materials: materials.map((m) => ({
      percentage: m.percentage ? Number(m.percentage) : 0,
      materialName: m.materialName,
      countryOfOrigin: m.countryOfOrigin,
      recyclable: m.recyclable,
      certificationTitle: m.certificationTitle,
      certificationUrl: m.certificationUrl,
    })),
    journey,
    environment:
      environmentRows.length > 0
        ? {
            carbonKgCo2e: environmentRows.find(
              (e) => e.metric === "carbon_kg_co2e",
            )?.value
              ? String(
                  environmentRows.find((e) => e.metric === "carbon_kg_co2e")!
                    .value,
                )
              : null,
            waterLiters: environmentRows.find(
              (e) => e.metric === "water_liters",
            )?.value
              ? String(
                  environmentRows.find((e) => e.metric === "water_liters")!
                    .value,
                )
              : null,
          }
        : null,
  };
}

/**
 * Build DppData directly from product core data and attributes.
 * This is the format expected by @v1/dpp-components.
 */
function buildDppData(
  core: {
    productId: string;
    productName: string;
    productDescription: string | null;
    productImage: string | null;
    brandName: string;
    categoryId: string | null;
    categoryName: string | null;
    manufacturerName: string | null;
    manufacturerCountryCode: string | null;
  },
  attributes: {
    materials: DppMaterial[];
    journey: DppJourneyStep[];
    environment: DppEnvironment | null;
  },
): DppData {
  return {
    productIdentifiers: {
      // Preview uses placeholder numeric IDs since DppData expects numbers
      // but our data uses UUIDs. The numeric IDs are only used for component keys.
      productId: 0,
      productName: core.productName,
      productImage: core.productImage ?? "",
      articleNumber: "", // Not shown for product-level preview
    },
    productAttributes: {
      description: core.productDescription ?? undefined,
      brand: core.brandName,
      category: core.categoryId
        ? {
            // Preview uses placeholder numeric ID for category
            categoryId: 0,
            category: core.categoryName ?? "",
          }
        : undefined,
    },
    environmental: {
      carbonEmissions: attributes.environment?.carbonKgCo2e
        ? {
            value: Number(attributes.environment.carbonKgCo2e),
            unit: "kgCO2e",
          }
        : undefined,
      waterUsage: attributes.environment?.waterLiters
        ? { value: Number(attributes.environment.waterLiters), unit: "liters" }
        : undefined,
    },
    materials: {
      composition: attributes.materials.map((m, index) => ({
        materialId: index,
        material: m.materialName,
        percentage: m.percentage,
        recyclable: m.recyclable ?? undefined,
        countryOfOrigin: getCountryName(m.countryOfOrigin),
        certification: m.certificationTitle
          ? { type: m.certificationTitle, code: "" }
          : undefined,
      })),
    },
    manufacturing: {
      manufacturer: core.manufacturerName
        ? {
            manufacturerId: 0,
            name: core.manufacturerName,
            countryCode: core.manufacturerCountryCode ?? undefined,
          }
        : undefined,
      supplyChain: attributes.journey.flatMap((step) =>
        step.facilities.map((f, index) => ({
          processStep: step.stepType
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" "),
          operator: {
            operatorId: index,
            legalName: f.displayName,
            city: f.city ?? undefined,
            countryCode: f.countryCode ?? undefined,
          },
        })),
      ),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Router Definition
// ─────────────────────────────────────────────────────────────────────────────

export const themePreviewRouter = createTRPCRouter({
  /**
   * Get DppData for a specific product (for theme editor preview).
   * Does NOT require the product to be published.
   */
  getProduct: brandRequiredProcedure
    .input(getProductSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId, supabase } = ctx;
      const { productId } = input;

      try {
        // Fetch product core data
        const productRows = await db
          .select({
            productId: products.id,
            productName: products.name,
            productDescription: products.description,
            productImage: products.imagePath,
            productHandle: products.productHandle,
            productStatus: products.status,
            brandId: brands.id,
            brandName: brands.name,
            categoryId: products.categoryId,
            categoryName: taxonomyCategories.name,
            manufacturerName: brandManufacturers.name,
            manufacturerCountryCode: brandManufacturers.countryCode,
          })
          .from(products)
          .innerJoin(brands, eq(brands.id, products.brandId))
          .leftJoin(
            taxonomyCategories,
            eq(taxonomyCategories.id, products.categoryId),
          )
          .leftJoin(
            brandManufacturers,
            eq(brandManufacturers.id, products.manufacturerId),
          )
          .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
          .limit(1);

        const productRow = productRows[0];
        if (!productRow) {
          return null;
        }

        // Fetch product attributes
        const attributes = await fetchProductAttributes(db, productId);

        // Resolve product image URL
        const productImageUrl = productRow.productImage
          ? getPublicUrl(supabase, "products", productRow.productImage)
          : null;

        // Build DppData directly with resolved image URL
        const dppData = buildDppData(
          {
            ...productRow,
            productImage: productImageUrl,
          },
          attributes,
        );

        return dppData;
      } catch (error) {
        throw wrapError(error, "Failed to fetch product for preview");
      }
    }),

  /**
   * List products sorted by updatedAt for navigation.
   * Returns minimal data needed for navigation (id + cursor info).
   */
  list: brandRequiredProcedure
    .input(listProductsSchema)
    .query(async ({ ctx, input }) => {
      const { db, brandId } = ctx;
      const { cursor, direction, limit } = input;

      try {
        // Parse cursor if provided
        let cursorUpdatedAt: string | undefined;
        let cursorId: string | undefined;
        if (cursor) {
          const parts = cursor.split("|");
          cursorUpdatedAt = parts[0];
          cursorId = parts[1];
        }

        // Build query based on direction
        let rows: {
          id: string;
          name: string;
          imagePath: string | null;
          updatedAt: string;
        }[];
        if (cursorUpdatedAt && cursorId && direction) {
          if (direction === "next") {
            // Get older products (updatedAt < cursor)
            rows = await db
              .select({
                id: products.id,
                name: products.name,
                imagePath: products.imagePath,
                updatedAt: products.updatedAt,
              })
              .from(products)
              .where(
                and(
                  eq(products.brandId, brandId),
                  sql`${products.updatedAt} < ${cursorUpdatedAt}`,
                ),
              )
              .orderBy(desc(products.updatedAt), desc(products.id))
              .limit(limit + 1);
          } else {
            // Get newer products (updatedAt > cursor)
            rows = await db
              .select({
                id: products.id,
                name: products.name,
                imagePath: products.imagePath,
                updatedAt: products.updatedAt,
              })
              .from(products)
              .where(
                and(
                  eq(products.brandId, brandId),
                  sql`${products.updatedAt} > ${cursorUpdatedAt}`,
                ),
              )
              .orderBy(asc(products.updatedAt), asc(products.id))
              .limit(limit + 1);
          }
        } else {
          // Initial fetch - get most recent products
          rows = await db
            .select({
              id: products.id,
              name: products.name,
              imagePath: products.imagePath,
              updatedAt: products.updatedAt,
            })
            .from(products)
            .where(eq(products.brandId, brandId))
            .orderBy(desc(products.updatedAt), desc(products.id))
            .limit(limit + 1);
        }

        // If going backwards, reverse the results to maintain consistent order
        const orderedRows = direction === "prev" ? [...rows].reverse() : rows;

        // Check if there are more results
        const hasMore = orderedRows.length > limit;
        const items = hasMore ? orderedRows.slice(0, limit) : orderedRows;

        // Get total count for display
        const countResult = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(products)
          .where(eq(products.brandId, brandId));

        const totalCount = countResult[0]?.count ?? 0;

        // Build response with cursor info
        return {
          items: items.map((p) => ({
            id: p.id,
            name: p.name,
            cursor: `${p.updatedAt}|${p.id}`,
          })),
          totalCount,
          hasMore,
        };
      } catch (error) {
        throw wrapError(error, "Failed to list products for preview");
      }
    }),
});

type ThemePreviewRouter = typeof themePreviewRouter;
