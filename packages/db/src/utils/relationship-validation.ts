import { TRPCError } from "@trpc/server";
import { and, eq, isNull, isNotNull, inArray, count, exists } from "drizzle-orm";
import {
  passports,
  products,
  productVariants,
  templates,
  modules,
  brands,
  categories,
} from "../schema/index.js";
import type { Database } from "../client.js";
import type { TransactionContext } from "./transactions.js";

/**
 * Relationship Validation and Integrity Constraints
 *
 * Provides validation for cross-module relationships ensuring data integrity
 * when modules reference each other beyond basic foreign key constraints.
 */

// ================================
// VALIDATION RESULT TYPES
// ================================

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  details?: Record<string, any>;
}

export interface IntegrityCheckResult {
  hasViolations: boolean;
  violations: IntegrityViolation[];
  affectedRecords: number;
}

export interface IntegrityViolation {
  type: 'orphaned_record' | 'invalid_reference' | 'brand_isolation_breach' | 'circular_dependency' | 'cascade_conflict';
  table: string;
  recordId: string;
  message: string;
  details?: Record<string, any>;
}

// ================================
// CORE VALIDATION FUNCTIONS
// ================================

/**
 * Validate passport-product-variant relationship consistency
 * Ensures that when a passport references both a product and variant,
 * the variant actually belongs to that product
 */
export async function validatePassportProductVariantConsistency(
  db: Database | TransactionContext,
  passportId: string,
  brandId: string
): Promise<ValidationResult> {
  try {
    const passport = await db.query.passports.findFirst({
      where: and(
        eq(passports.id, passportId),
        eq(passports.brandId, brandId)
      ),
    });

    if (!passport) {
      return {
        isValid: false,
        error: "Passport not found or access denied",
      };
    }

    // If passport has both product and variant, validate they're related
    if (passport.productId && passport.variantId) {
      const variant = await db.query.productVariants.findFirst({
        where: and(
          eq(productVariants.id, passport.variantId),
          eq(productVariants.productId, passport.productId)
        ),
      });

      if (!variant) {
        return {
          isValid: false,
          error: "Variant does not belong to the specified product",
          details: {
            passportId,
            productId: passport.productId,
            variantId: passport.variantId,
          },
        };
      }
    }

    return { isValid: true };
  } catch (error: any) {
    return {
      isValid: false,
      error: `Validation failed: ${error.message}`,
    };
  }
}

/**
 * Validate brand isolation across relationships
 * Ensures all referenced entities belong to the same brand
 */
export async function validateBrandIsolation(
  db: Database | TransactionContext,
  entityType: 'passport' | 'product' | 'variant',
  entityId: string,
  expectedBrandId: string
): Promise<ValidationResult> {
  try {
    let actualBrandId: string | null = null;

    switch (entityType) {
      case 'passport':
        const passport = await db.query.passports.findFirst({
          where: eq(passports.id, entityId),
          columns: { brandId: true },
        });
        actualBrandId = passport?.brandId || null;
        break;

      case 'product':
        const product = await db.query.products.findFirst({
          where: eq(products.id, entityId),
          columns: { brandId: true },
        });
        actualBrandId = product?.brandId || null;
        break;

      case 'variant':
        const variant = await db.query.productVariants.findFirst({
          where: eq(productVariants.id, entityId),
          with: {
            product: {
              columns: { brandId: true },
            },
          },
        });
        actualBrandId = variant?.product?.brandId || null;
        break;
    }

    if (!actualBrandId) {
      return {
        isValid: false,
        error: `${entityType} not found`,
        details: { entityType, entityId, expectedBrandId },
      };
    }

    if (actualBrandId !== expectedBrandId) {
      return {
        isValid: false,
        error: `Brand isolation violation: ${entityType} belongs to different brand`,
        details: {
          entityType,
          entityId,
          expectedBrandId,
          actualBrandId,
        },
      };
    }

    return { isValid: true };
  } catch (error: any) {
    return {
      isValid: false,
      error: `Brand isolation validation failed: ${error.message}`,
    };
  }
}

/**
 * Validate template-module relationships
 * Ensures modules belong to their referenced template
 */
export async function validateTemplateModuleConsistency(
  db: Database | TransactionContext,
  moduleId: string,
  expectedTemplateId: string,
  brandId: string
): Promise<ValidationResult> {
  try {
    const module = await db.query.modules.findFirst({
      where: eq(modules.id, moduleId),
      with: {
        template: {
          columns: { id: true, brandId: true },
        },
      },
    });

    if (!module) {
      return {
        isValid: false,
        error: "Module not found",
        details: { moduleId, expectedTemplateId, brandId },
      };
    }

    if (!module.template) {
      return {
        isValid: false,
        error: "Module has no associated template",
        details: { moduleId, expectedTemplateId, brandId },
      };
    }

    if (module.template.id !== expectedTemplateId) {
      return {
        isValid: false,
        error: "Module does not belong to the specified template",
        details: {
          moduleId,
          expectedTemplateId,
          actualTemplateId: module.template.id,
          brandId,
        },
      };
    }

    if (module.template.brandId !== brandId) {
      return {
        isValid: false,
        error: "Template brand isolation violation",
        details: {
          moduleId,
          templateId: module.template.id,
          expectedBrandId: brandId,
          actualBrandId: module.template.brandId,
        },
      };
    }

    return { isValid: true };
  } catch (error: any) {
    return {
      isValid: false,
      error: `Template-module validation failed: ${error.message}`,
    };
  }
}

// ================================
// CASCADING OPERATION VALIDATION
// ================================

/**
 * Check for orphaned records that would be created by deletion
 */
export async function checkForOrphanedRecords(
  db: Database | TransactionContext,
  entityType: 'product' | 'template' | 'category',
  entityIds: string[]
): Promise<IntegrityCheckResult> {
  const violations: IntegrityViolation[] = [];
  let affectedRecords = 0;

  try {
    switch (entityType) {
      case 'product':
        // Check for orphaned variants
        const orphanedVariants = await db
          .select({
            id: productVariants.id,
            productId: productVariants.productId,
          })
          .from(productVariants)
          .where(inArray(productVariants.productId, entityIds));

        affectedRecords += orphanedVariants.length;

        for (const variant of orphanedVariants) {
          violations.push({
            type: 'orphaned_record',
            table: 'product_variants',
            recordId: variant.id,
            message: `Variant would be orphaned by product deletion`,
            details: { productId: variant.productId },
          });
        }

        // Check for orphaned passports
        const orphanedPassports = await db
          .select({
            id: passports.id,
            productId: passports.productId,
          })
          .from(passports)
          .where(inArray(passports.productId, entityIds));

        affectedRecords += orphanedPassports.length;

        for (const passport of orphanedPassports) {
          violations.push({
            type: 'orphaned_record',
            table: 'passports',
            recordId: passport.id,
            message: `Passport would be orphaned by product deletion`,
            details: { productId: passport.productId },
          });
        }
        break;

      case 'template':
        // Check for orphaned modules
        const orphanedModules = await db
          .select({
            id: modules.id,
            templateId: modules.templateId,
          })
          .from(modules)
          .where(inArray(modules.templateId, entityIds));

        affectedRecords += orphanedModules.length;

        for (const module of orphanedModules) {
          violations.push({
            type: 'orphaned_record',
            table: 'modules',
            recordId: module.id,
            message: `Module would be orphaned by template deletion`,
            details: { templateId: module.templateId },
          });
        }

        // Check for passports referencing templates
        const orphanedPassportsByTemplate = await db
          .select({
            id: passports.id,
            templateId: passports.templateId,
          })
          .from(passports)
          .where(inArray(passports.templateId, entityIds));

        affectedRecords += orphanedPassportsByTemplate.length;

        for (const passport of orphanedPassportsByTemplate) {
          violations.push({
            type: 'orphaned_record',
            table: 'passports',
            recordId: passport.id,
            message: `Passport would lose template reference`,
            details: { templateId: passport.templateId },
          });
        }
        break;

      case 'category':
        // Check for products referencing categories
        const orphanedProductsByCategory = await db
          .select({
            id: products.id,
            categoryId: products.categoryId,
          })
          .from(products)
          .where(inArray(products.categoryId, entityIds));

        affectedRecords += orphanedProductsByCategory.length;

        for (const product of orphanedProductsByCategory) {
          violations.push({
            type: 'orphaned_record',
            table: 'products',
            recordId: product.id,
            message: `Product would lose category reference`,
            details: { categoryId: product.categoryId },
          });
        }
        break;
    }

    return {
      hasViolations: violations.length > 0,
      violations,
      affectedRecords,
    };
  } catch (error: any) {
    return {
      hasViolations: true,
      violations: [{
        type: 'cascade_conflict',
        table: 'unknown',
        recordId: 'unknown',
        message: `Failed to check for orphaned records: ${error.message}`,
      }],
      affectedRecords: 0,
    };
  }
}

/**
 * Validate cross-module reference integrity
 * Checks that all references to other modules are valid
 */
export async function validateCrossModuleReferences(
  db: Database | TransactionContext,
  entityType: 'passport' | 'product' | 'variant',
  entityData: Record<string, any>,
  brandId: string
): Promise<ValidationResult> {
  try {
    const validationErrors: string[] = [];

    switch (entityType) {
      case 'passport':
        // Validate product reference
        if (entityData.productId) {
          const product = await db.query.products.findFirst({
            where: and(
              eq(products.id, entityData.productId),
              eq(products.brandId, brandId)
            ),
          });

          if (!product) {
            validationErrors.push(`Referenced product ${entityData.productId} not found or access denied`);
          }
        }

        // Validate variant reference
        if (entityData.variantId) {
          let variantValid = false;

          if (entityData.productId) {
            // If product is specified, variant must belong to that product
            const variant = await db.query.productVariants.findFirst({
              where: and(
                eq(productVariants.id, entityData.variantId),
                eq(productVariants.productId, entityData.productId)
              ),
            });
            variantValid = !!variant;
          } else {
            // If no product specified, just check variant exists and get its product's brand
            const variant = await db.query.productVariants.findFirst({
              where: eq(productVariants.id, entityData.variantId),
              with: {
                product: {
                  columns: { brandId: true },
                },
              },
            });
            variantValid = !!variant && variant.product?.brandId === brandId;
          }

          if (!variantValid) {
            validationErrors.push(`Referenced variant ${entityData.variantId} not found or invalid`);
          }
        }

        // Validate template reference
        if (entityData.templateId) {
          const template = await db.query.templates.findFirst({
            where: and(
              eq(templates.id, entityData.templateId),
              eq(templates.brandId, brandId)
            ),
          });

          if (!template) {
            validationErrors.push(`Referenced template ${entityData.templateId} not found or access denied`);
          }
        }
        break;

      case 'product':
        // Validate category reference
        if (entityData.categoryId) {
          const category = await db.query.categories.findFirst({
            where: and(
              eq(categories.id, entityData.categoryId),
              eq(categories.brandId, brandId)
            ),
          });

          if (!category) {
            validationErrors.push(`Referenced category ${entityData.categoryId} not found or access denied`);
          }
        }
        break;

      case 'variant':
        // Validate product reference
        if (entityData.productId) {
          const product = await db.query.products.findFirst({
            where: and(
              eq(products.id, entityData.productId),
              eq(products.brandId, brandId)
            ),
          });

          if (!product) {
            validationErrors.push(`Referenced product ${entityData.productId} not found or access denied`);
          }
        }
        break;
    }

    if (validationErrors.length > 0) {
      return {
        isValid: false,
        error: validationErrors.join('; '),
        details: { entityType, brandId, validationErrors },
      };
    }

    return { isValid: true };
  } catch (error: any) {
    return {
      isValid: false,
      error: `Cross-module reference validation failed: ${error.message}`,
    };
  }
}

// ================================
// BULK OPERATION VALIDATION
// ================================

/**
 * Validate bulk operations for integrity constraints
 */
export async function validateBulkOperation(
  db: Database | TransactionContext,
  operation: 'delete' | 'update',
  entityType: 'passport' | 'product' | 'variant' | 'template',
  entityIds: string[],
  brandId: string,
  updateData?: Record<string, any>
): Promise<ValidationResult> {
  try {
    // Handle empty entity list as valid (no-op)
    if (entityIds.length === 0) {
      return { isValid: true };
    }

    // Validate all entities belong to the brand
    const brandValidation = await validateBulkBrandIsolation(
      db,
      entityType,
      entityIds,
      brandId
    );

    if (!brandValidation.isValid) {
      return brandValidation;
    }

    // For delete operations, check for cascading effects
    if (operation === 'delete') {
      let cascadeType: 'product' | 'template' | 'category' | null = null;

      switch (entityType) {
        case 'product':
          cascadeType = 'product';
          break;
        case 'template':
          cascadeType = 'template';
          break;
      }

      if (cascadeType) {
        const orphanCheck = await checkForOrphanedRecords(db, cascadeType, entityIds);

        if (orphanCheck.hasViolations) {
          return {
            isValid: false,
            error: `Bulk delete would create ${orphanCheck.violations.length} integrity violations`,
            details: {
              operation,
              entityType,
              entityCount: entityIds.length,
              violations: orphanCheck.violations,
              affectedRecords: orphanCheck.affectedRecords,
            },
          };
        }
      }
    }

    // For update operations, validate the new data
    if (operation === 'update' && updateData) {
      // Check each entity would be valid with the new data
      for (const entityId of entityIds.slice(0, 10)) { // Sample first 10 for performance
        const currentEntity = await getCurrentEntityData(db, entityType, entityId);
        if (currentEntity) {
          const mergedData = { ...currentEntity, ...updateData };
          const refValidation = await validateCrossModuleReferences(
            db,
            entityType as 'passport' | 'product' | 'variant',
            mergedData,
            brandId
          );

          if (!refValidation.isValid) {
            return {
              isValid: false,
              error: `Bulk update would create invalid references for ${entityType} ${entityId}: ${refValidation.error}`,
              details: {
                operation,
                entityType,
                entityId,
                updateData,
                validationError: refValidation,
              },
            };
          }
        }
      }
    }

    return { isValid: true };
  } catch (error: any) {
    return {
      isValid: false,
      error: `Bulk operation validation failed: ${error.message}`,
    };
  }
}

/**
 * Validate brand isolation for bulk operations
 */
async function validateBulkBrandIsolation(
  db: Database | TransactionContext,
  entityType: 'passport' | 'product' | 'variant' | 'template',
  entityIds: string[],
  expectedBrandId: string
): Promise<ValidationResult> {
  try {
    let query: any;
    let brandField: string;

    switch (entityType) {
      case 'passport':
        query = db
          .select({ id: passports.id, brandId: passports.brandId })
          .from(passports)
          .where(inArray(passports.id, entityIds));
        brandField = 'brandId';
        break;

      case 'product':
        query = db
          .select({ id: products.id, brandId: products.brandId })
          .from(products)
          .where(inArray(products.id, entityIds));
        brandField = 'brandId';
        break;

      case 'variant':
        query = db
          .select({
            id: productVariants.id,
            productId: productVariants.productId,
            brandId: products.brandId,
          })
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(inArray(productVariants.id, entityIds));
        brandField = 'brandId';
        break;

      case 'template':
        query = db
          .select({ id: templates.id, brandId: templates.brandId })
          .from(templates)
          .where(inArray(templates.id, entityIds));
        brandField = 'brandId';
        break;

      default:
        return {
          isValid: false,
          error: `Unsupported entity type: ${entityType}`,
        };
    }

    const results = await query;
    const violations = results.filter((r: any) => r[brandField] !== expectedBrandId);

    if (violations.length > 0) {
      return {
        isValid: false,
        error: `Brand isolation violation: ${violations.length} entities belong to different brands`,
        details: {
          entityType,
          expectedBrandId,
          violations: violations.map((v: any) => ({
            entityId: v.id,
            actualBrandId: v[brandField],
          })),
        },
      };
    }

    if (results.length !== entityIds.length) {
      return {
        isValid: false,
        error: `Some entities not found: expected ${entityIds.length}, found ${results.length}`,
        details: {
          entityType,
          expectedCount: entityIds.length,
          foundCount: results.length,
        },
      };
    }

    return { isValid: true };
  } catch (error: any) {
    return {
      isValid: false,
      error: `Bulk brand isolation validation failed: ${error.message}`,
    };
  }
}

/**
 * Get current entity data for validation
 */
async function getCurrentEntityData(
  db: Database | TransactionContext,
  entityType: 'passport' | 'product' | 'variant' | 'template',
  entityId: string
): Promise<Record<string, any> | null> {
  try {
    switch (entityType) {
      case 'passport':
        return await db.query.passports.findFirst({
          where: eq(passports.id, entityId),
        });

      case 'product':
        return await db.query.products.findFirst({
          where: eq(products.id, entityId),
        });

      case 'variant':
        return await db.query.productVariants.findFirst({
          where: eq(productVariants.id, entityId),
        });

      case 'template':
        return await db.query.templates.findFirst({
          where: eq(templates.id, entityId),
        });

      default:
        return null;
    }
  } catch (error) {
    return null;
  }
}

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Create a validation error with consistent format
 */
export function createValidationError(
  code: 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'BAD_REQUEST',
  message: string,
  details?: Record<string, any>
): TRPCError {
  return new TRPCError({
    code,
    message,
    cause: details,
  });
}

/**
 * Validate that all required relationships are provided
 */
export function validateRequiredRelationships(
  entityType: 'passport' | 'product' | 'variant',
  entityData: Record<string, any>
): ValidationResult {
  const errors: string[] = [];

  switch (entityType) {
    case 'passport':
      if (!entityData.brandId) {
        errors.push('brandId is required');
      }
      // Either productId or variantId should be provided, but not both without validation
      if (!entityData.productId && !entityData.variantId) {
        errors.push('Either productId or variantId must be provided');
      }
      break;

    case 'product':
      if (!entityData.brandId) {
        errors.push('brandId is required');
      }
      if (!entityData.name) {
        errors.push('name is required');
      }
      break;

    case 'variant':
      if (!entityData.productId) {
        errors.push('productId is required');
      }
      if (!entityData.upid) {
        errors.push('upid is required');
      }
      break;
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      error: errors.join('; '),
      details: { entityType, errors },
    };
  }

  return { isValid: true };
}