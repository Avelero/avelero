import { TRPCError } from "@trpc/server";
import { and, eq, isNull, isNotNull, inArray, exists, not } from "drizzle-orm";
import {
  passports,
  products,
  productVariants,
  templates,
  modules,
  brands,
  categories,
  brandColors,
  brandSizes,
  showcaseBrands,
  brandCertifications,
} from "../schema/index.js";
import type { Database } from "../client.js";
import type { TransactionContext } from "./transactions.js";

/**
 * Foreign Key Constraint Validation
 *
 * Provides validation for foreign key constraints with enhanced business logic,
 * better error messages, and validation before database operations.
 */

// ================================
// TYPES AND INTERFACES
// ================================

export interface ForeignKeyValidationResult {
  isValid: boolean;
  error?: string;
  invalidReferences?: ForeignKeyViolation[];
}

export interface ForeignKeyViolation {
  field: string;
  value: string | null;
  targetTable: string;
  message: string;
}

export interface ForeignKeyConstraint {
  sourceField: string;
  targetTable: string;
  targetField: string;
  nullable: boolean;
  cascadeDelete: boolean;
  brandScoped?: boolean; // Whether the reference must be within the same brand
}

// ================================
// FOREIGN KEY CONSTRAINT DEFINITIONS
// ================================

/**
 * Define all foreign key constraints with their validation rules
 */
export const FOREIGN_KEY_CONSTRAINTS = {
  passports: [
    {
      sourceField: 'brandId',
      targetTable: 'brands',
      targetField: 'id',
      nullable: false,
      cascadeDelete: true,
      brandScoped: false, // This is the brand reference itself
    },
    {
      sourceField: 'productId',
      targetTable: 'products',
      targetField: 'id',
      nullable: true,
      cascadeDelete: true,
      brandScoped: true,
    },
    {
      sourceField: 'variantId',
      targetTable: 'product_variants',
      targetField: 'id',
      nullable: true,
      cascadeDelete: true,
      brandScoped: true,
    },
    {
      sourceField: 'templateId',
      targetTable: 'templates',
      targetField: 'id',
      nullable: true,
      cascadeDelete: false, // SET NULL on template deletion
      brandScoped: true,
    },
  ] as ForeignKeyConstraint[],

  products: [
    {
      sourceField: 'brandId',
      targetTable: 'brands',
      targetField: 'id',
      nullable: false,
      cascadeDelete: true,
      brandScoped: false,
    },
    {
      sourceField: 'categoryId',
      targetTable: 'categories',
      targetField: 'id',
      nullable: true,
      cascadeDelete: false, // SET NULL on category deletion
      brandScoped: true,
    },
    {
      sourceField: 'showcaseBrandId',
      targetTable: 'showcase_brands',
      targetField: 'id',
      nullable: true,
      cascadeDelete: false, // SET NULL on showcase brand deletion
      brandScoped: false, // Showcase brands might be cross-brand
    },
    {
      sourceField: 'brandCertificationId',
      targetTable: 'brand_certifications',
      targetField: 'id',
      nullable: true,
      cascadeDelete: false, // SET NULL on certification deletion
      brandScoped: true,
    },
  ] as ForeignKeyConstraint[],

  productVariants: [
    {
      sourceField: 'productId',
      targetTable: 'products',
      targetField: 'id',
      nullable: false,
      cascadeDelete: true,
      brandScoped: true, // Variants must belong to products in same brand
    },
    {
      sourceField: 'colorId',
      targetTable: 'brand_colors',
      targetField: 'id',
      nullable: true,
      cascadeDelete: false, // SET NULL on color deletion
      brandScoped: true,
    },
    {
      sourceField: 'sizeId',
      targetTable: 'brand_sizes',
      targetField: 'id',
      nullable: true,
      cascadeDelete: false, // SET NULL on size deletion
      brandScoped: true,
    },
  ] as ForeignKeyConstraint[],

  templates: [
    {
      sourceField: 'brandId',
      targetTable: 'brands',
      targetField: 'id',
      nullable: false,
      cascadeDelete: true,
      brandScoped: false,
    },
  ] as ForeignKeyConstraint[],

  modules: [
    {
      sourceField: 'templateId',
      targetTable: 'templates',
      targetField: 'id',
      nullable: false,
      cascadeDelete: true,
      brandScoped: true,
    },
  ] as ForeignKeyConstraint[],

  categories: [
    {
      sourceField: 'brandId',
      targetTable: 'brands',
      targetField: 'id',
      nullable: false,
      cascadeDelete: true,
      brandScoped: false,
    },
    {
      sourceField: 'parentId',
      targetTable: 'categories',
      targetField: 'id',
      nullable: true,
      cascadeDelete: false, // SET NULL on parent deletion
      brandScoped: true,
    },
  ] as ForeignKeyConstraint[],
} as const;

// ================================
// VALIDATION FUNCTIONS
// ================================

/**
 * Validate all foreign key constraints for an entity
 */
export async function validateEntityForeignKeys(
  db: Database | TransactionContext,
  tableName: keyof typeof FOREIGN_KEY_CONSTRAINTS,
  entityData: Record<string, any>,
  brandId?: string
): Promise<ForeignKeyValidationResult> {
  const constraints = FOREIGN_KEY_CONSTRAINTS[tableName];
  if (!constraints) {
    return {
      isValid: false,
      error: `No foreign key constraints defined for table: ${tableName}`,
    };
  }

  const violations: ForeignKeyViolation[] = [];

  for (const constraint of constraints) {
    const fieldValue = entityData[constraint.sourceField];

    // Skip validation if field is null and nullable
    if (fieldValue === null || fieldValue === undefined) {
      if (!constraint.nullable) {
        violations.push({
          field: constraint.sourceField,
          value: null,
          targetTable: constraint.targetTable,
          message: `${constraint.sourceField} is required but was null`,
        });
      }
      continue;
    }

    // Validate the foreign key reference
    const referenceValid = await validateForeignKeyReference(
      db,
      constraint,
      fieldValue,
      brandId
    );

    if (!referenceValid.isValid) {
      violations.push({
        field: constraint.sourceField,
        value: fieldValue,
        targetTable: constraint.targetTable,
        message: referenceValid.error || `Invalid reference to ${constraint.targetTable}`,
      });
    }
  }

  if (violations.length > 0) {
    return {
      isValid: false,
      error: `Foreign key validation failed: ${violations.length} constraint(s) violated`,
      invalidReferences: violations,
    };
  }

  return { isValid: true };
}

/**
 * Validate a single foreign key reference
 */
async function validateForeignKeyReference(
  db: Database | TransactionContext,
  constraint: ForeignKeyConstraint,
  value: string,
  brandId?: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    let targetExists = false;
    let brandMatch = true;

    // Check if the referenced record exists
    switch (constraint.targetTable) {
      case 'brands':
        const brand = await db.query.brands.findFirst({
          where: eq(brands.id, value),
        });
        targetExists = !!brand;
        break;

      case 'products':
        const productWhere = constraint.brandScoped && brandId
          ? and(eq(products.id, value), eq(products.brandId, brandId))
          : eq(products.id, value);

        const product = await db.query.products.findFirst({
          where: productWhere,
        });
        targetExists = !!product;

        // Check brand match if brand scoped but no brandId provided
        if (constraint.brandScoped && !brandId && product) {
          brandMatch = false; // Cannot validate brand scope without brandId
        }
        break;

      case 'product_variants':
        let variantQuery;
        if (constraint.brandScoped && brandId) {
          // Need to join with products to check brand
          variantQuery = db.query.productVariants.findFirst({
            where: eq(productVariants.id, value),
            with: {
              product: {
                columns: { brandId: true },
              },
            },
          });
        } else {
          variantQuery = db.query.productVariants.findFirst({
            where: eq(productVariants.id, value),
          });
        }

        const variant = await variantQuery;
        targetExists = !!variant;

        if (constraint.brandScoped && brandId && variant) {
          brandMatch = variant.product?.brandId === brandId;
        }
        break;

      case 'templates':
        const templateWhere = constraint.brandScoped && brandId
          ? and(eq(templates.id, value), eq(templates.brandId, brandId))
          : eq(templates.id, value);

        const template = await db.query.templates.findFirst({
          where: templateWhere,
        });
        targetExists = !!template;
        break;

      case 'categories':
        const categoryWhere = constraint.brandScoped && brandId
          ? and(eq(categories.id, value), eq(categories.brandId, brandId))
          : eq(categories.id, value);

        const category = await db.query.categories.findFirst({
          where: categoryWhere,
        });
        targetExists = !!category;
        break;

      case 'brand_colors':
        const colorWhere = constraint.brandScoped && brandId
          ? and(eq(brandColors.id, value), eq(brandColors.brandId, brandId))
          : eq(brandColors.id, value);

        const color = await db.query.brandColors.findFirst({
          where: colorWhere,
        });
        targetExists = !!color;
        break;

      case 'brand_sizes':
        const sizeWhere = constraint.brandScoped && brandId
          ? and(eq(brandSizes.id, value), eq(brandSizes.brandId, brandId))
          : eq(brandSizes.id, value);

        const size = await db.query.brandSizes.findFirst({
          where: sizeWhere,
        });
        targetExists = !!size;
        break;

      case 'showcase_brands':
        const showcaseBrand = await db.query.showcaseBrands.findFirst({
          where: eq(showcaseBrands.id, value),
        });
        targetExists = !!showcaseBrand;
        break;

      case 'brand_certifications':
        const certWhere = constraint.brandScoped && brandId
          ? and(eq(brandCertifications.id, value), eq(brandCertifications.brandId, brandId))
          : eq(brandCertifications.id, value);

        const certification = await db.query.brandCertifications.findFirst({
          where: certWhere,
        });
        targetExists = !!certification;
        break;

      default:
        return {
          isValid: false,
          error: `Unsupported target table: ${constraint.targetTable}`,
        };
    }

    if (!targetExists) {
      return {
        isValid: false,
        error: `Referenced ${constraint.targetTable} with id '${value}' does not exist`,
      };
    }

    if (!brandMatch) {
      return {
        isValid: false,
        error: `Referenced ${constraint.targetTable} with id '${value}' does not belong to the current brand`,
      };
    }

    return { isValid: true };
  } catch (error: any) {
    return {
      isValid: false,
      error: `Foreign key validation error: ${error.message}`,
    };
  }
}

/**
 * Validate foreign keys for bulk operations
 */
export async function validateBulkForeignKeys(
  db: Database | TransactionContext,
  tableName: keyof typeof FOREIGN_KEY_CONSTRAINTS,
  entities: Record<string, any>[],
  brandId?: string
): Promise<ForeignKeyValidationResult> {
  const allViolations: ForeignKeyViolation[] = [];
  let entityIndex = 0;

  for (const entity of entities) {
    const result = await validateEntityForeignKeys(db, tableName, entity, brandId);

    if (!result.isValid && result.invalidReferences) {
      // Add entity index to violations for better error reporting
      const indexedViolations = result.invalidReferences.map(violation => ({
        ...violation,
        message: `Entity ${entityIndex}: ${violation.message}`,
      }));
      allViolations.push(...indexedViolations);
    }

    entityIndex++;

    // Limit validation to prevent performance issues
    if (entityIndex >= 100) {
      allViolations.push({
        field: 'bulk_limit',
        value: null,
        targetTable: 'system',
        message: `Bulk validation limited to first 100 entities`,
      });
      break;
    }
  }

  if (allViolations.length > 0) {
    return {
      isValid: false,
      error: `Bulk foreign key validation failed: ${allViolations.length} violation(s) found`,
      invalidReferences: allViolations,
    };
  }

  return { isValid: true };
}

/**
 * Check for circular dependencies in hierarchical relationships
 */
export async function checkCircularDependencies(
  db: Database | TransactionContext,
  tableName: 'categories',
  entityId: string,
  parentId: string,
  brandId?: string
): Promise<{ hasCircularDependency: boolean; path?: string[] }> {
  const visited = new Set<string>();
  const path: string[] = [];

  let currentId: string | null = parentId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    path.push(currentId);

    // If we've reached the original entity, we have a circular dependency
    if (currentId === entityId) {
      return {
        hasCircularDependency: true,
        path,
      };
    }

    // Get the parent of the current entity
    switch (tableName) {
      case 'categories':
        const categoryWhere = brandId
          ? and(eq(categories.id, currentId), eq(categories.brandId, brandId))
          : eq(categories.id, currentId);

        const category = await db.query.categories.findFirst({
          where: categoryWhere,
          columns: { parentId: true },
        });

        currentId = category?.parentId || null;
        break;

      default:
        return { hasCircularDependency: false };
    }

    // Prevent infinite loops
    if (path.length > 50) {
      return {
        hasCircularDependency: true,
        path: [...path, '...depth_limit_reached'],
      };
    }
  }

  return { hasCircularDependency: false };
}

/**
 * Validate references before deletion to prevent constraint violations
 */
export async function validateBeforeDeletion(
  db: Database | TransactionContext,
  tableName: string,
  entityIds: string[],
  brandId?: string
): Promise<{
  canDelete: boolean;
  blockingReferences: Array<{
    table: string;
    field: string;
    count: number;
    constraint: string;
  }>;
}> {
  const blockingReferences: Array<{
    table: string;
    field: string;
    count: number;
    constraint: string;
  }> = [];

  try {
    // Check for references that would prevent deletion
    switch (tableName) {
      case 'brands':
        // Check products
        const productCount = await db
          .select({ count: count() })
          .from(products)
          .where(inArray(products.brandId, entityIds));

        if (productCount[0].count > 0) {
          blockingReferences.push({
            table: 'products',
            field: 'brandId',
            count: productCount[0].count,
            constraint: 'CASCADE - will delete dependent records',
          });
        }

        // Check passports
        const passportCount = await db
          .select({ count: count() })
          .from(passports)
          .where(inArray(passports.brandId, entityIds));

        if (passportCount[0].count > 0) {
          blockingReferences.push({
            table: 'passports',
            field: 'brandId',
            count: passportCount[0].count,
            constraint: 'CASCADE - will delete dependent records',
          });
        }

        // Check templates
        const templateCount = await db
          .select({ count: count() })
          .from(templates)
          .where(inArray(templates.brandId, entityIds));

        if (templateCount[0].count > 0) {
          blockingReferences.push({
            table: 'templates',
            field: 'brandId',
            count: templateCount[0].count,
            constraint: 'CASCADE - will delete dependent records',
          });
        }
        break;

      case 'products':
        // Check variants
        const variantCount = await db
          .select({ count: count() })
          .from(productVariants)
          .where(inArray(productVariants.productId, entityIds));

        if (variantCount[0].count > 0) {
          blockingReferences.push({
            table: 'product_variants',
            field: 'productId',
            count: variantCount[0].count,
            constraint: 'CASCADE - will delete dependent records',
          });
        }

        // Check passports by product
        const passportByProductCount = await db
          .select({ count: count() })
          .from(passports)
          .where(inArray(passports.productId, entityIds));

        if (passportByProductCount[0].count > 0) {
          blockingReferences.push({
            table: 'passports',
            field: 'productId',
            count: passportByProductCount[0].count,
            constraint: 'CASCADE - will delete dependent records',
          });
        }
        break;

      case 'templates':
        // Check modules
        const moduleCount = await db
          .select({ count: count() })
          .from(modules)
          .where(inArray(modules.templateId, entityIds));

        if (moduleCount[0].count > 0) {
          blockingReferences.push({
            table: 'modules',
            field: 'templateId',
            count: moduleCount[0].count,
            constraint: 'CASCADE - will delete dependent records',
          });
        }

        // Check passports by template
        const passportByTemplateCount = await db
          .select({ count: count() })
          .from(passports)
          .where(inArray(passports.templateId, entityIds));

        if (passportByTemplateCount[0].count > 0) {
          blockingReferences.push({
            table: 'passports',
            field: 'templateId',
            count: passportByTemplateCount[0].count,
            constraint: 'SET NULL - will remove template references',
          });
        }
        break;

      case 'categories':
        // Check products by category
        const productByCategoryCount = await db
          .select({ count: count() })
          .from(products)
          .where(inArray(products.categoryId, entityIds));

        if (productByCategoryCount[0].count > 0) {
          blockingReferences.push({
            table: 'products',
            field: 'categoryId',
            count: productByCategoryCount[0].count,
            constraint: 'SET NULL - will remove category references',
          });
        }

        // Check child categories
        const childCategoryCount = await db
          .select({ count: count() })
          .from(categories)
          .where(inArray(categories.parentId, entityIds));

        if (childCategoryCount[0].count > 0) {
          blockingReferences.push({
            table: 'categories',
            field: 'parentId',
            count: childCategoryCount[0].count,
            constraint: 'SET NULL - will orphan child categories',
          });
        }
        break;
    }

    return {
      canDelete: true, // In this system, we show warnings but allow deletion
      blockingReferences,
    };
  } catch (error: any) {
    return {
      canDelete: false,
      blockingReferences: [{
        table: 'system',
        field: 'error',
        count: 0,
        constraint: `Validation error: ${error.message}`,
      }],
    };
  }
}

/**
 * Create a foreign key validation error with details
 */
export function createForeignKeyValidationError(
  result: ForeignKeyValidationResult
): TRPCError {
  const details = {
    violations: result.invalidReferences || [],
    violationCount: result.invalidReferences?.length || 0,
  };

  return new TRPCError({
    code: 'BAD_REQUEST',
    message: result.error || 'Foreign key validation failed',
    cause: details,
  });
}