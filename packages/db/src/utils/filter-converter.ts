/**
 * FilterState to SQL WHERE Clause Converter
 * 
 * Converts FilterState structure (groups with AND/OR logic) into SQL WHERE clauses
 * for use in database queries.
 * 
 * Logic Structure:
 * - Groups: AND logic between groups
 * - Conditions within a group: OR logic within each group
 * - Nested conditions: For materials/facilities, nested conditions are ANDed together
 */

import {
  and,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  ilike,
  inArray,
  isNull,
  isNotNull,
  or,
  sql,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Database } from "../client";
import {
  brandEcoClaims,
  brandFacilities,
  brandMaterials,
  brandSeasons,
  brandTags,
  categories,
  productEcoClaims,
  productEnvironment,
  productJourneyStepFacilities,
  productJourneySteps,
  productMaterials,
  productVariants,
  products,
  tagsOnProduct,
} from "../schema";

// ============================================================================
// Types
// ============================================================================

type FilterState = {
  groups: Array<{
    id: string;
    conditions: Array<{
      id: string;
      fieldId: string;
      operator: string;
      value: any;
      nestedConditions?: Array<{
        id: string;
        fieldId: string;
        operator: string;
        value: any;
      }>;
    }>;
    asGroup?: boolean;
  }>;
};

type FilterCondition = {
  id: string;
  fieldId: string;
  operator: string;
  value: any;
  nestedConditions?: Array<FilterCondition>;
};

type SchemaRefs = {
  products: typeof products;
  productVariants: typeof productVariants;
  productMaterials: typeof productMaterials;
  productJourneySteps: typeof productJourneySteps;
  productJourneyStepFacilities: typeof productJourneyStepFacilities;
  productEnvironment: typeof productEnvironment;
  productEcoClaims: typeof productEcoClaims;
  tagsOnProduct: typeof tagsOnProduct;
  categories: typeof categories;
  brandSeasons: typeof brandSeasons;
  brandMaterials: typeof brandMaterials;
  brandFacilities: typeof brandFacilities;
  brandEcoClaims: typeof brandEcoClaims;
  brandTags: typeof brandTags;
};

// ============================================================================
// Main Conversion Function
// ============================================================================

/**
 * Converts FilterState to SQL WHERE clauses
 * Groups are ANDed together, conditions within groups are ORed
 */
export function convertFilterStateToWhereClauses(
  filterState: FilterState,
  db: Database,
  brandId: string,
): SQL[] {
  if (!filterState.groups || filterState.groups.length === 0) {
    return [];
  }

  const schemaRefs: SchemaRefs = {
    products,
    productVariants,
    productMaterials,
    productJourneySteps,
    productJourneyStepFacilities,
    productEnvironment,
    productEcoClaims,
    tagsOnProduct,
    categories,
    brandSeasons,
    brandMaterials,
    brandFacilities,
    brandEcoClaims,
    brandTags,
  };

  const groupClauses: SQL[] = [];

  // Process each group (AND logic between groups)
  for (const group of filterState.groups) {
    const conditionClauses: SQL[] = [];

    // Process each condition in the group (OR logic within group)
    for (const condition of group.conditions) {
      const clause = buildConditionClause(
        condition,
        schemaRefs,
        db,
        brandId,
      );
      if (clause) {
        conditionClauses.push(clause);
      }
    }

    // OR logic within group
    if (conditionClauses.length > 0) {
      if (conditionClauses.length === 1) {
        groupClauses.push(conditionClauses[0]!);
      } else {
        groupClauses.push(or(...conditionClauses)!);
      }
    }
  }

  // AND logic between groups
  return groupClauses;
}

// ============================================================================
// Condition Builder
// ============================================================================

/**
 * Builds a SQL clause from a single filter condition
 */
function buildConditionClause(
  condition: FilterCondition,
  schema: SchemaRefs,
  db: Database,
  brandId: string,
): SQL | null {
  const { fieldId, operator, value, nestedConditions } = condition;

  // Handle nested conditions (for materials/facilities)
  // Directly call the appropriate nested builder instead of recursing
  if (nestedConditions && nestedConditions.length > 0) {
    // Nested conditions are only valid for materials and facilities
    // These are handled in their respective builders (buildMaterialsClause, buildFacilityClause)
    // which already process nestedConditions properly
    if (fieldId === "materials") {
      return buildMaterialsClause(schema, operator, value, nestedConditions, db, brandId);
    }
    if (fieldId === "operatorId") {
      return buildFacilityClause(schema, operator, value, nestedConditions, db, brandId);
    }
    // If we somehow have nested conditions for an unsupported field, ignore them
    // and fall through to normal processing
  }

  // Map fieldId to database column/table
  switch (fieldId) {
    // Product-level fields
    case "status":
      return buildOperatorClause(schema.products.status, operator, value);

    case "productName":
      return buildOperatorClause(schema.products.name, operator, value);

    case "description":
      return buildOperatorClause(schema.products.description, operator, value);

    case "hasImage":
      if (operator === "is true") {
        return and(
          isNotNull(schema.products.primaryImageUrl),
          ne(schema.products.primaryImageUrl, ""),
        )!;
      }
      if (operator === "is false") {
        return or(
          isNull(schema.products.primaryImageUrl),
          eq(schema.products.primaryImageUrl, ""),
        )!;
      }
      return null;

    case "showcaseBrandId":
      return buildOperatorClause(
        schema.products.showcaseBrandId,
        operator,
        value,
      );

    case "categoryId":
      return buildCategoryClause(schema, operator, value, db, brandId);

    case "season":
      return buildSeasonClause(schema, operator, value, db, brandId);

    case "createdAt":
    case "updatedAt":
      return buildDateClause(
        fieldId === "createdAt"
          ? schema.products.createdAt
          : schema.products.updatedAt,
        operator,
        value,
      );

    // Sustainability fields
    case "carbonKgCo2e":
      return buildEnvironmentClause(schema, "carbonKgCo2e", operator, value);

    case "waterLiters":
      return buildEnvironmentClause(schema, "waterLiters", operator, value);

    case "ecoClaimId":
      return buildEcoClaimClause(schema, operator, value, db, brandId);

    case "brandCertificationId":
      return buildCertificationClause(schema, operator, value, db, brandId);

    case "materialRecyclable":
      return buildMaterialRecyclableClause(
        schema,
        operator,
        value,
        db,
        brandId,
      );

    // Variant-level fields (require EXISTS subquery)
    case "colorId":
      return buildVariantClause(schema, "colorId", operator, value, db, brandId);

    case "sizeId":
      return buildVariantClause(schema, "sizeId", operator, value, db, brandId);

    // Manufacturing fields (nested)
    case "materials":
      return buildMaterialsClause(
        schema,
        operator,
        value,
        nestedConditions,
        db,
        brandId,
      );

    case "operatorId":
      return buildFacilityClause(
        schema,
        operator,
        value,
        nestedConditions,
        db,
        brandId,
      );

    case "facilityCountryCode":
      return buildFacilityCountryClause(schema, operator, value, db, brandId);

    case "stepType":
      return buildStepTypeClause(schema, operator, value, db, brandId);

    // Tags
    case "tagId":
      return buildTagClause(schema, operator, value, db, brandId);

    default:
      return null;
  }
}

// ============================================================================
// Operator Clause Builder
// ============================================================================

/**
 * Builds SQL clause based on operator type
 */
function buildOperatorClause(
  column: any,
  operator: string,
  value: any,
): SQL | null {
  // Prevent passing objects to operators that expect primitives
  // If value is an object (but not array/null), it's likely a range value
  // that should be handled by the caller, not here
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    ("min" in value || "max" in value)
  ) {
    // This is a range value - should be handled by caller
    // Don't try to use it with operators that expect primitives
    return null;
  }

  switch (operator) {
    case "is":
      return eq(column, value);
    case "is not":
      return ne(column, value);
    case "is any of":
      return inArray(column, Array.isArray(value) ? value : [value]);
    case "is none of":
      return sql`NOT ${inArray(column, Array.isArray(value) ? value : [value])}`;
    case "contains":
      return ilike(column, `%${value}%`);
    case "does not contain":
      return sql`NOT (${column} ILIKE ${`%${value}%`})`;
    case "starts with":
      return ilike(column, `${value}%`);
    case "ends with":
      return ilike(column, `%${value}`);
    case "is empty":
      return or(isNull(column), eq(column, ""))!;
    case "is not empty":
      return and(isNotNull(column), ne(column, ""))!;
    case "equals":
      return eq(column, value);
    case "does not equal":
      return ne(column, value);
    case "greater than":
      return gt(column, value);
    case "greater than or equal to":
      return gte(column, value);
    case "less than":
      return lt(column, value);
    case "less than or equal to":
      return lte(column, value);
    case "between":
      // This should not be reached if buildEnvironmentClause handles it correctly
      if (typeof value === "object" && "min" in value && "max" in value) {
        return and(gte(column, value.min), lte(column, value.max))!;
      }
      return null;
    case "is true":
      return eq(column, true);
    case "is false":
      return eq(column, false);
    default:
      return null;
  }
}

// ============================================================================
// Date Clause Builder
// ============================================================================

/**
 * Builds date clause with support for relative dates
 */
function buildDateClause(
  column: any,
  operator: string,
  value: any,
): SQL | null {
  // Handle relative dates (either as operator or value type)
  if (
    operator === "relative" ||
    (value != null && typeof value === "object" && "type" in value && value.type === "relative")
  ) {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = now;

    switch (value.option) {
      case "today":
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "yesterday":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "last 7 days":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "last 30 days":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "this month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "last month":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case "this quarter": {
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      }
      case "this year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      case "more than X days ago":
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - (value.customDays || 0));
        endDate = startDate;
        break;
      default:
        return null;
    }

    return and(
      sql`${column} >= ${startDate.toISOString()}::timestamptz`,
      sql`${column} <= ${endDate.toISOString()}::timestamptz`,
    )!;
  }

  // Handle date range (after/before) FIRST - similar to carbon/water min-max logic
  // This must be checked before single date to handle date range objects
  // Check if value has after/before properties (date range from date picker)
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !("date" in value) && // Exclude single date objects
    !("type" in value) && // Exclude relative date objects
    ("after" in value || "before" in value)
  ) {
    const conditions: SQL[] = [];

    // After filled = "is on or after" (gte)
    const afterValue = value.after;
    if (
      afterValue != null &&
      afterValue !== "" &&
      (typeof afterValue === "string" || afterValue instanceof Date)
    ) {
      try {
        const afterDate = typeof afterValue === "string"
          ? new Date(afterValue)
          : afterValue;
        if (!Number.isNaN(afterDate.getTime())) {
          // Extract UTC date components and set to start of day
          const year = afterDate.getUTCFullYear();
          const month = afterDate.getUTCMonth();
          const day = afterDate.getUTCDate();
          const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
          // Use sql template with explicit timestamptz cast for proper comparison
          conditions.push(sql`${column} >= ${startOfDay.toISOString()}::timestamptz`);
        }
      } catch {
        // Invalid date, skip
      }
    }

    // Before filled = "is on or before" (lte)
    const beforeValue = value.before;
    if (
      beforeValue != null &&
      beforeValue !== "" &&
      (typeof beforeValue === "string" || beforeValue instanceof Date)
    ) {
      try {
        const beforeDate = typeof beforeValue === "string"
          ? new Date(beforeValue)
          : beforeValue;
        if (!Number.isNaN(beforeDate.getTime())) {
          // Extract UTC date components and set to end of day
          const year = beforeDate.getUTCFullYear();
          const month = beforeDate.getUTCMonth();
          const day = beforeDate.getUTCDate();
          const endOfDay = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
          // Use sql template with explicit timestamptz cast for proper comparison
          conditions.push(sql`${column} <= ${endOfDay.toISOString()}::timestamptz`);
        }
      } catch {
        // Invalid date, skip
      }
    }

    // If neither after nor before is provided, return null
    if (conditions.length === 0) {
      return null;
    }

    // Combine conditions with AND
    return conditions.length === 1
      ? conditions[0]!
      : and(...conditions)!;
  }

  // Handle single date (check after date range to avoid conflicts)
  if (typeof value === "object" && "date" in value) {
    // Single date
    const date = new Date(value.date);
    switch (operator) {
      case "is": {
        const startOfDay = new Date(date.getTime());
        startOfDay.setUTCHours(0, 0, 0, 0);
        const endOfDay = new Date(date.getTime());
        endOfDay.setUTCHours(23, 59, 59, 999);
        return and(
          sql`${column} >= ${startOfDay.toISOString()}::timestamptz`,
          sql`${column} <= ${endOfDay.toISOString()}::timestamptz`,
        )!;
      }
      case "is before":
        return sql`${column} < ${date.toISOString()}::timestamptz`;
      case "is after":
        return sql`${column} > ${date.toISOString()}::timestamptz`;
      case "is on or before":
        return sql`${column} <= ${date.toISOString()}::timestamptz`;
      case "is on or after":
        return sql`${column} >= ${date.toISOString()}::timestamptz`;
      default:
        return null;
    }
  }

  return null;
}

// ============================================================================
// Variant-Level Clause Builders
// ============================================================================

/**
 * Builds variant-level clause (requires EXISTS subquery)
 */
function buildVariantClause(
  schema: SchemaRefs,
  field: "colorId" | "sizeId",
  operator: string,
  value: any,
  db: Database,
  brandId: string,
): SQL | null {
  const column =
    field === "colorId"
      ? schema.productVariants.colorId
      : schema.productVariants.sizeId;

  switch (operator) {
    case "is any of": {
      const ids = Array.isArray(value) ? value : [value];
      return sql`EXISTS (
        SELECT 1 FROM ${schema.productVariants}
        WHERE ${schema.productVariants.productId} = ${schema.products.id}
        AND ${inArray(column, ids)}
      )`;
    }
    case "is none of": {
      const excludeIds = Array.isArray(value) ? value : [value];
      return sql`NOT EXISTS (
        SELECT 1 FROM ${schema.productVariants}
        WHERE ${schema.productVariants.productId} = ${schema.products.id}
        AND ${inArray(column, excludeIds)}
      )`;
    }
    case "is empty":
      return sql`NOT EXISTS (
        SELECT 1 FROM ${schema.productVariants}
        WHERE ${schema.productVariants.productId} = ${schema.products.id}
        AND ${column} IS NOT NULL
      )`;
    case "is not empty":
      return sql`EXISTS (
        SELECT 1 FROM ${schema.productVariants}
        WHERE ${schema.productVariants.productId} = ${schema.products.id}
        AND ${column} IS NOT NULL
      )`;
    default:
      return null;
  }
}

// ============================================================================
// Environment Clause Builder
// ============================================================================

/**
 * Builds environment clause (carbon/water)
 */
function buildEnvironmentClause(
  schema: SchemaRefs,
  field: "carbonKgCo2e" | "waterLiters",
  operator: string,
  value: any,
): SQL | null {
  const column =
    field === "carbonKgCo2e"
      ? schema.productEnvironment.carbonKgCo2e
      : schema.productEnvironment.waterLiters;

  // Handle "between" operator directly to avoid SQL interpolation issues
  // Supports partial ranges: min only, max only, or both
  if (operator === "between") {
    // Check if value is an object with min/max properties
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      ("min" in value || "max" in value)
    ) {
      const conditions: SQL[] = [];

      // min filled = "is greater than or equal to"
      if (
        value.min != null &&
        value.min !== "" &&
        typeof value.min === "number"
      ) {
        conditions.push(gte(column, value.min));
      }

      // max filled = "is less than or equal to"
      if (
        value.max != null &&
        value.max !== "" &&
        typeof value.max === "number"
      ) {
        conditions.push(lte(column, value.max));
      }

      // If neither min nor max is provided, return null
      if (conditions.length === 0) {
        return null;
      }

      // Combine conditions with AND
      const whereClause = conditions.length === 1
        ? conditions[0]!
        : and(...conditions)!;

      return sql`EXISTS (
        SELECT 1 FROM ${schema.productEnvironment}
        WHERE ${schema.productEnvironment.productId} = ${schema.products.id}
        AND ${whereClause}
      )`;
    }
    return null;
  }

  // For other operators, use buildOperatorClause
  const operatorClause = buildOperatorClause(column, operator, value);
  if (!operatorClause) return null;

  return sql`EXISTS (
    SELECT 1 FROM ${schema.productEnvironment}
    WHERE ${schema.productEnvironment.productId} = ${schema.products.id}
    AND ${operatorClause}
  )`;
}

// ============================================================================
// Eco Claim Clause Builder
// ============================================================================

/**
 * Builds eco claim clause
 */
function buildEcoClaimClause(
  schema: SchemaRefs,
  operator: string,
  value: any,
  db: Database,
  brandId: string,
): SQL | null {
  const ids = Array.isArray(value) ? value : [value];

  switch (operator) {
    case "is any of":
      return sql`EXISTS (
        SELECT 1 FROM ${schema.productEcoClaims}
        WHERE ${schema.productEcoClaims.productId} = ${schema.products.id}
        AND ${inArray(schema.productEcoClaims.ecoClaimId, ids)}
      )`;
    case "is none of":
      return sql`NOT EXISTS (
        SELECT 1 FROM ${schema.productEcoClaims}
        WHERE ${schema.productEcoClaims.productId} = ${schema.products.id}
        AND ${inArray(schema.productEcoClaims.ecoClaimId, ids)}
      )`;
    case "is empty":
      return sql`NOT EXISTS (
        SELECT 1 FROM ${schema.productEcoClaims}
        WHERE ${schema.productEcoClaims.productId} = ${schema.products.id}
      )`;
    case "is not empty":
      return sql`EXISTS (
        SELECT 1 FROM ${schema.productEcoClaims}
        WHERE ${schema.productEcoClaims.productId} = ${schema.products.id}
      )`;
    default:
      return null;
  }
}

// ============================================================================
// Certification Clause Builder
// ============================================================================

/**
 * Builds certification clause (via materials)
 */
function buildCertificationClause(
  schema: SchemaRefs,
  operator: string,
  value: any,
  db: Database,
  brandId: string,
): SQL | null {
  const certificationIds = Array.isArray(value) ? value : [value];

  switch (operator) {
    case "is any of":
      return sql`EXISTS (
        SELECT 1 FROM ${schema.productMaterials}
        INNER JOIN ${schema.brandMaterials}
          ON ${schema.productMaterials.brandMaterialId} = ${schema.brandMaterials.id}
        WHERE ${schema.productMaterials.productId} = ${schema.products.id}
          AND ${inArray(schema.brandMaterials.certificationId, certificationIds)}
      )`;
    case "is none of":
      return sql`NOT EXISTS (
        SELECT 1 FROM ${schema.productMaterials}
        INNER JOIN ${schema.brandMaterials}
          ON ${schema.productMaterials.brandMaterialId} = ${schema.brandMaterials.id}
        WHERE ${schema.productMaterials.productId} = ${schema.products.id}
          AND ${inArray(schema.brandMaterials.certificationId, certificationIds)}
      )`;
    case "is empty":
      return sql`NOT EXISTS (
        SELECT 1 FROM ${schema.productMaterials}
        INNER JOIN ${schema.brandMaterials}
          ON ${schema.productMaterials.brandMaterialId} = ${schema.brandMaterials.id}
        WHERE ${schema.productMaterials.productId} = ${schema.products.id}
          AND ${schema.brandMaterials.certificationId} IS NOT NULL
      )`;
    case "is not empty":
      return sql`EXISTS (
        SELECT 1 FROM ${schema.productMaterials}
        INNER JOIN ${schema.brandMaterials}
          ON ${schema.productMaterials.brandMaterialId} = ${schema.brandMaterials.id}
        WHERE ${schema.productMaterials.productId} = ${schema.products.id}
          AND ${schema.brandMaterials.certificationId} IS NOT NULL
      )`;
    default:
      return null;
  }
}

// ============================================================================
// Material Recyclable Clause Builder
// ============================================================================

/**
 * Builds material recyclable clause
 */
function buildMaterialRecyclableClause(
  schema: SchemaRefs,
  operator: string,
  value: any,
  db: Database,
  brandId: string,
): SQL | null {
  const boolValue = operator === "is true";

  return sql`EXISTS (
    SELECT 1 FROM ${schema.productMaterials}
    INNER JOIN ${schema.brandMaterials}
      ON ${schema.productMaterials.brandMaterialId} = ${schema.brandMaterials.id}
    WHERE ${schema.productMaterials.productId} = ${schema.products.id}
      AND ${schema.brandMaterials.recyclable} = ${boolValue}
  )`;
}

// ============================================================================
// Materials Clause Builder (with nested conditions)
// ============================================================================

/**
 * Builds materials clause (nested conditions supported)
 */
function buildMaterialsClause(
  schema: SchemaRefs,
  operator: string,
  value: any,
  nestedConditions: FilterCondition[] | undefined,
  db: Database,
  brandId: string,
): SQL | null {
  // Build base material filter
  const materialIds = Array.isArray(value) ? value : value ? [value] : [];

  let baseClause: SQL | null = null;
  if (materialIds.length > 0) {
    baseClause = inArray(schema.productMaterials.brandMaterialId, materialIds);
  }

  // Add nested conditions (percentage, recyclable, countryOfOrigin, certificationId)
  const nestedClauses: SQL[] = [];
  if (nestedConditions) {
    for (const nested of nestedConditions) {
      const clause = buildNestedMaterialCondition(nested, schema);
      if (clause) nestedClauses.push(clause);
    }
  }

  const allClauses = [baseClause, ...nestedClauses].filter(
    Boolean,
  ) as SQL[];

  if (allClauses.length === 0) return null;

  return sql`EXISTS (
    SELECT 1 FROM ${schema.productMaterials}
    INNER JOIN ${schema.brandMaterials}
      ON ${schema.productMaterials.brandMaterialId} = ${schema.brandMaterials.id}
    WHERE ${schema.productMaterials.productId} = ${schema.products.id}
      ${allClauses.length > 0 ? sql`AND ${and(...allClauses)}` : sql``}
  )`;
}

/**
 * Builds nested material condition clause
 */
function buildNestedMaterialCondition(
  nested: FilterCondition,
  schema: SchemaRefs,
): SQL | null {
  const { fieldId, operator, value } = nested;

  switch (fieldId) {
    case "percentage":
      return buildOperatorClause(
        schema.productMaterials.percentage,
        operator,
        value,
      );
    case "recyclable":
      return buildOperatorClause(
        schema.brandMaterials.recyclable,
        operator,
        value,
      );
    case "countryOfOrigin":
      return buildOperatorClause(
        schema.brandMaterials.countryOfOrigin,
        operator,
        value,
      );
    case "certificationId":
      return buildOperatorClause(
        schema.brandMaterials.certificationId,
        operator,
        value,
      );
    default:
      return null;
  }
}

// ============================================================================
// Facility Clause Builder (with nested conditions)
// ============================================================================

/**
 * Builds facility clause (nested conditions supported)
 */
function buildFacilityClause(
  schema: SchemaRefs,
  operator: string,
  value: any,
  nestedConditions: FilterCondition[] | undefined,
  db: Database,
  brandId: string,
): SQL | null {
  const facilityIds = Array.isArray(value) ? value : value ? [value] : [];

  // Build nested conditions (countryCode, city, stepType)
  const nestedClauses: SQL[] = [];
  if (nestedConditions) {
    for (const nested of nestedConditions) {
      const clause = buildNestedFacilityCondition(nested, schema);
      if (clause) nestedClauses.push(clause);
    }
  }

  // Handle multi-select operators
  switch (operator) {
    case "is any of": {
      if (facilityIds.length === 0) return null;
      const anyClauses: SQL[] = [
        inArray(schema.productJourneyStepFacilities.facilityId, facilityIds),
      ];
      anyClauses.push(...nestedClauses);
      return sql`EXISTS (
        SELECT 1 FROM ${schema.productJourneySteps}
        INNER JOIN ${schema.productJourneyStepFacilities}
          ON ${schema.productJourneySteps.id} = ${schema.productJourneyStepFacilities.journeyStepId}
        INNER JOIN ${schema.brandFacilities}
          ON ${schema.productJourneyStepFacilities.facilityId} = ${schema.brandFacilities.id}
        WHERE ${schema.productJourneySteps.productId} = ${schema.products.id}
          ${anyClauses.length > 0 ? sql`AND ${and(...anyClauses)}` : sql``}
      )`;
    }

    case "is none of": {
      if (facilityIds.length === 0) return null;
      const noneClauses: SQL[] = [
        inArray(schema.productJourneyStepFacilities.facilityId, facilityIds),
      ];
      noneClauses.push(...nestedClauses);
      return sql`NOT EXISTS (
        SELECT 1 FROM ${schema.productJourneySteps}
        INNER JOIN ${schema.productJourneyStepFacilities}
          ON ${schema.productJourneySteps.id} = ${schema.productJourneyStepFacilities.journeyStepId}
        INNER JOIN ${schema.brandFacilities}
          ON ${schema.productJourneyStepFacilities.facilityId} = ${schema.brandFacilities.id}
        WHERE ${schema.productJourneySteps.productId} = ${schema.products.id}
          ${noneClauses.length > 0 ? sql`AND ${and(...noneClauses)}` : sql``}
      )`;
    }

    case "is empty":
      return sql`NOT EXISTS (
        SELECT 1 FROM ${schema.productJourneySteps}
        INNER JOIN ${schema.productJourneyStepFacilities}
          ON ${schema.productJourneySteps.id} = ${schema.productJourneyStepFacilities.journeyStepId}
        WHERE ${schema.productJourneySteps.productId} = ${schema.products.id}
      )`;

    case "is not empty":
      return sql`EXISTS (
        SELECT 1 FROM ${schema.productJourneySteps}
        INNER JOIN ${schema.productJourneyStepFacilities}
          ON ${schema.productJourneySteps.id} = ${schema.productJourneyStepFacilities.journeyStepId}
        WHERE ${schema.productJourneySteps.productId} = ${schema.products.id}
      )`;

    default:
      return null;
  }
}

/**
 * Builds nested facility condition clause
 */
function buildNestedFacilityCondition(
  nested: FilterCondition,
  schema: SchemaRefs,
): SQL | null {
  const { fieldId, operator, value } = nested;

  switch (fieldId) {
    case "countryCode":
      return buildOperatorClause(
        schema.brandFacilities.countryCode,
        operator,
        value,
      );
    case "city":
      return buildOperatorClause(schema.brandFacilities.city, operator, value);
    case "stepType":
      return buildOperatorClause(
        schema.productJourneySteps.stepType,
        operator,
        value,
      );
    default:
      return null;
  }
}

// ============================================================================
// Facility Country Clause Builder
// ============================================================================

/**
 * Builds facility country clause (nested in facilities)
 */
function buildFacilityCountryClause(
  schema: SchemaRefs,
  operator: string,
  value: any,
  db: Database,
  brandId: string,
): SQL | null {
  const countryCodes = Array.isArray(value) ? value : [value];

  return sql`EXISTS (
    SELECT 1 FROM ${schema.productJourneySteps}
    INNER JOIN ${schema.productJourneyStepFacilities}
      ON ${schema.productJourneySteps.id} = ${schema.productJourneyStepFacilities.journeyStepId}
    INNER JOIN ${schema.brandFacilities}
      ON ${schema.productJourneyStepFacilities.facilityId} = ${schema.brandFacilities.id}
    WHERE ${schema.productJourneySteps.productId} = ${schema.products.id}
      AND ${inArray(schema.brandFacilities.countryCode, countryCodes)}
  )`;
}

// ============================================================================
// Step Type Clause Builder
// ============================================================================

/**
 * Builds step type clause
 */
function buildStepTypeClause(
  schema: SchemaRefs,
  operator: string,
  value: any,
  db: Database,
  brandId: string,
): SQL | null {
  // Normalize values: ensure they're strings and filter out empty values
  let stepTypes: string[] = [];

  if (Array.isArray(value)) {
    stepTypes = value
      .filter((v) => v != null && v !== "")
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0);
  } else if (value != null && value !== "") {
    const strValue = String(value).trim();
    if (strValue.length > 0) {
      stepTypes = [strValue];
    }
  }

  // If no valid stepTypes after normalization, return null
  if (stepTypes.length === 0) {
    return null;
  }

  switch (operator) {
    case "contains any of":
      return sql`EXISTS (
        SELECT 1 FROM ${schema.productJourneySteps}
        WHERE ${schema.productJourneySteps.productId} = ${schema.products.id}
        AND ${inArray(schema.productJourneySteps.stepType, stepTypes)}
      )`;
    case "contains all of":
      return sql`(
        SELECT COUNT(DISTINCT ${schema.productJourneySteps.stepType})
        FROM ${schema.productJourneySteps}
        WHERE ${schema.productJourneySteps.productId} = ${schema.products.id}
        AND ${inArray(schema.productJourneySteps.stepType, stepTypes)}
      ) = ${stepTypes.length}`;
    case "does not contain":
      return sql`NOT EXISTS (
        SELECT 1 FROM ${schema.productJourneySteps}
        WHERE ${schema.productJourneySteps.productId} = ${schema.products.id}
        AND ${inArray(schema.productJourneySteps.stepType, stepTypes)}
      )`;
    case "is empty":
      return sql`NOT EXISTS (
        SELECT 1 FROM ${schema.productJourneySteps}
        WHERE ${schema.productJourneySteps.productId} = ${schema.products.id}
      )`;
    case "is not empty":
      return sql`EXISTS (
        SELECT 1 FROM ${schema.productJourneySteps}
        WHERE ${schema.productJourneySteps.productId} = ${schema.products.id}
      )`;
    default:
      return null;
  }
}

// ============================================================================
// Tag Clause Builder
// ============================================================================

/**
 * Builds tag clause
 */
function buildTagClause(
  schema: SchemaRefs,
  operator: string,
  value: any,
  db: Database,
  brandId: string,
): SQL | null {
  const tagIds = Array.isArray(value) ? value : [value];

  switch (operator) {
    case "is any of":
      return sql`EXISTS (
        SELECT 1 FROM ${schema.tagsOnProduct}
        WHERE ${schema.tagsOnProduct.productId} = ${schema.products.id}
        AND ${inArray(schema.tagsOnProduct.tagId, tagIds)}
      )`;
    case "is none of":
      return sql`NOT EXISTS (
        SELECT 1 FROM ${schema.tagsOnProduct}
        WHERE ${schema.tagsOnProduct.productId} = ${schema.products.id}
        AND ${inArray(schema.tagsOnProduct.tagId, tagIds)}
      )`;
    case "is empty":
      return sql`NOT EXISTS (
        SELECT 1 FROM ${schema.tagsOnProduct}
        WHERE ${schema.tagsOnProduct.productId} = ${schema.products.id}
      )`;
    case "is not empty":
      return sql`EXISTS (
        SELECT 1 FROM ${schema.tagsOnProduct}
        WHERE ${schema.tagsOnProduct.productId} = ${schema.products.id}
      )`;
    default:
      return null;
  }
}

// ============================================================================
// Category Clause Builder (hierarchical)
// ============================================================================

/**
 * Builds category clause with hierarchical support
 */
function buildCategoryClause(
  schema: SchemaRefs,
  operator: string,
  value: any,
  db: Database,
  brandId: string,
): SQL | null {
  const categoryIds = Array.isArray(value) ? value : [value];

  switch (operator) {
    case "is":
      return inArray(schema.products.categoryId, categoryIds);
    case "is not":
      return sql`NOT ${inArray(schema.products.categoryId, categoryIds)}`;
    case "is any of":
      return inArray(schema.products.categoryId, categoryIds);
    case "is descendant of":
      // For now, use recursive CTE or path-based lookup
      // This is a simplified version - may need enhancement
      // Note: Using array parameter binding for the initial WHERE clause
      return sql`EXISTS (
        WITH RECURSIVE category_tree AS (
          SELECT id, parent_id FROM ${schema.categories} 
          WHERE ${inArray(schema.categories.id, categoryIds)}
          UNION ALL
          SELECT c.id, c.parent_id
          FROM ${schema.categories} c
          INNER JOIN category_tree ct ON c.parent_id = ct.id
        )
        SELECT 1 FROM category_tree
        WHERE category_tree.id = ${schema.products.categoryId}
      )`;
    case "is ancestor of":
      // Traverse parent chain upward
      // For the final WHERE clause, we need to check if any of the categoryIds match
      // Since we can't use inArray with a CTE column, we'll use a different approach
      if (categoryIds.length === 1) {
        return sql`EXISTS (
          WITH RECURSIVE category_tree AS (
            SELECT id, parent_id FROM ${schema.categories} WHERE id = ${schema.products.categoryId}
            UNION ALL
            SELECT c.id, c.parent_id
            FROM ${schema.categories} c
            INNER JOIN category_tree ct ON c.id = ct.parent_id
          )
          SELECT 1 FROM category_tree
          WHERE category_tree.id = ${categoryIds[0]}
        )`;
      }
      // For multiple IDs, use OR conditions
      return sql`EXISTS (
        WITH RECURSIVE category_tree AS (
          SELECT id, parent_id FROM ${schema.categories} WHERE id = ${schema.products.categoryId}
          UNION ALL
          SELECT c.id, c.parent_id
          FROM ${schema.categories} c
          INNER JOIN category_tree ct ON c.id = ct.parent_id
        )
        SELECT 1 FROM category_tree
        WHERE ${or(...categoryIds.map(id => sql`category_tree.id = ${id}`))!}
      )`;
    case "is empty":
      return isNull(schema.products.categoryId);
    case "is not empty":
      return isNotNull(schema.products.categoryId);
    default:
      return null;
  }
}

// ============================================================================
// Season Clause Builder
// ============================================================================

/**
 * Builds season clause (filter by season dates, not names)
 */
function buildSeasonClause(
  schema: SchemaRefs,
  operator: string,
  value: any,
  db: Database,
  brandId: string,
): SQL | null {
  const seasonIds = Array.isArray(value) ? value : [value];

  switch (operator) {
    case "is any of":
      return inArray(schema.products.seasonId, seasonIds);
    case "is none of":
      return sql`NOT ${inArray(schema.products.seasonId, seasonIds)}`;
    case "is empty":
      return isNull(schema.products.seasonId);
    case "is not empty":
      return isNotNull(schema.products.seasonId);
    default:
      return null;
  }
}

