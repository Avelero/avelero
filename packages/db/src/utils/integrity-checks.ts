import { TRPCError } from "@trpc/server";
import { and, eq, isNull, isNotNull, inArray, or, count, exists, not } from "drizzle-orm";
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
 * Integrity Check Utilities for Cross-Module Operations
 *
 * Provides comprehensive integrity validation across modules to ensure
 * data consistency and detect/prevent integrity violations.
 */

// ================================
// TYPES AND INTERFACES
// ================================

export interface IntegrityCheckResult {
  isValid: boolean;
  violations: IntegrityViolation[];
  warnings: IntegrityWarning[];
  summary: IntegritySummary;
}

export interface IntegrityViolation {
  type: IntegrityViolationType;
  severity: 'critical' | 'warning' | 'info';
  table: string;
  recordId: string;
  field?: string;
  message: string;
  suggestedAction?: string;
  details?: Record<string, any>;
}

export interface IntegrityWarning {
  type: string;
  message: string;
  affectedRecords: number;
  details?: Record<string, any>;
}

export interface IntegritySummary {
  totalViolations: number;
  criticalViolations: number;
  warningViolations: number;
  affectedTables: string[];
  recommendedActions: string[];
}

export type IntegrityViolationType =
  | 'orphaned_record'
  | 'invalid_reference'
  | 'brand_isolation_breach'
  | 'circular_dependency'
  | 'data_inconsistency'
  | 'missing_required_relation'
  | 'duplicate_unique_constraint'
  | 'cascade_integrity_violation';

// ================================
// COMPREHENSIVE INTEGRITY CHECKS
// ================================

/**
 * Run comprehensive integrity checks across all modules
 */
export async function runComprehensiveIntegrityCheck(
  db: Database | TransactionContext,
  brandId?: string,
  options: {
    skipWarnings?: boolean;
    includePerformanceChecks?: boolean;
    maxViolationsPerType?: number;
  } = {}
): Promise<IntegrityCheckResult> {
  const violations: IntegrityViolation[] = [];
  const warnings: IntegrityWarning[] = [];

  const { skipWarnings = false, maxViolationsPerType = 100 } = options;

  try {
    // 1. Check for orphaned records
    const orphanedChecks = await checkForOrphanedRecords(db, brandId, maxViolationsPerType);
    violations.push(...orphanedChecks);

    // 2. Check invalid references
    const invalidRefChecks = await checkInvalidReferences(db, brandId, maxViolationsPerType);
    violations.push(...invalidRefChecks);

    // 3. Check brand isolation
    if (brandId) {
      const brandIsolationChecks = await checkBrandIsolationViolations(db, brandId, maxViolationsPerType);
      violations.push(...brandIsolationChecks);
    }

    // 4. Check data consistency
    const consistencyChecks = await checkCrossModuleDataConsistency(db, brandId, maxViolationsPerType);
    violations.push(...consistencyChecks);

    // 5. Check circular dependencies
    const circularDepChecks = await checkCircularDependencies(db, brandId, maxViolationsPerType);
    violations.push(...circularDepChecks);

    // 6. Check unique constraints
    const uniqueConstraintChecks = await checkUniqueConstraintViolations(db, brandId, maxViolationsPerType);
    violations.push(...uniqueConstraintChecks);

    // Add warnings if not skipped
    if (!skipWarnings) {
      const warningChecks = await generateIntegrityWarnings(db, brandId);
      warnings.push(...warningChecks);
    }

    const summary = generateIntegritySummary(violations, warnings);

    return {
      isValid: violations.filter(v => v.severity === 'critical').length === 0,
      violations,
      warnings,
      summary,
    };
  } catch (error: any) {
    return {
      isValid: false,
      violations: [{
        type: 'data_inconsistency',
        severity: 'critical',
        table: 'system',
        recordId: 'unknown',
        message: `Integrity check failed: ${error.message}`,
        suggestedAction: 'Review system logs and database state',
      }],
      warnings: [],
      summary: {
        totalViolations: 1,
        criticalViolations: 1,
        warningViolations: 0,
        affectedTables: ['system'],
        recommendedActions: ['Check system logs'],
      },
    };
  }
}

/**
 * Check for orphaned records across all relationships
 */
async function checkForOrphanedRecords(
  db: Database | TransactionContext,
  brandId?: string,
  maxViolations = 100
): Promise<IntegrityViolation[]> {
  const violations: IntegrityViolation[] = [];

  try {
    // Check orphaned variants (product doesn't exist)
    const orphanedVariants = await db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
      })
      .from(productVariants)
      .leftJoin(products, eq(productVariants.productId, products.id))
      .where(
        and(
          isNull(products.id),
          brandId ? exists(
            db.select().from(products).where(
              and(eq(products.id, productVariants.productId), eq(products.brandId, brandId))
            )
          ) : undefined
        )
      )
      .limit(maxViolations);

    for (const variant of orphanedVariants) {
      violations.push({
        type: 'orphaned_record',
        severity: 'critical',
        table: 'product_variants',
        recordId: variant.id,
        field: 'productId',
        message: `Variant references non-existent product: ${variant.productId}`,
        suggestedAction: 'Delete orphaned variant or restore missing product',
        details: { productId: variant.productId },
      });
    }

    // Check orphaned passports (product doesn't exist)
    const orphanedPassportsByProduct = await db
      .select({
        id: passports.id,
        productId: passports.productId,
      })
      .from(passports)
      .leftJoin(products, eq(passports.productId, products.id))
      .where(
        and(
          isNotNull(passports.productId),
          isNull(products.id),
          brandId ? eq(passports.brandId, brandId) : undefined
        )
      )
      .limit(maxViolations);

    for (const passport of orphanedPassportsByProduct) {
      violations.push({
        type: 'orphaned_record',
        severity: 'critical',
        table: 'passports',
        recordId: passport.id,
        field: 'productId',
        message: `Passport references non-existent product: ${passport.productId}`,
        suggestedAction: 'Update passport to remove invalid product reference',
        details: { productId: passport.productId },
      });
    }

    // Check orphaned passports (variant doesn't exist)
    const orphanedPassportsByVariant = await db
      .select({
        id: passports.id,
        variantId: passports.variantId,
      })
      .from(passports)
      .leftJoin(productVariants, eq(passports.variantId, productVariants.id))
      .where(
        and(
          isNotNull(passports.variantId),
          isNull(productVariants.id),
          brandId ? eq(passports.brandId, brandId) : undefined
        )
      )
      .limit(maxViolations);

    for (const passport of orphanedPassportsByVariant) {
      violations.push({
        type: 'orphaned_record',
        severity: 'critical',
        table: 'passports',
        recordId: passport.id,
        field: 'variantId',
        message: `Passport references non-existent variant: ${passport.variantId}`,
        suggestedAction: 'Update passport to remove invalid variant reference',
        details: { variantId: passport.variantId },
      });
    }

    // Check orphaned modules (template doesn't exist)
    const orphanedModules = await db
      .select({
        id: modules.id,
        templateId: modules.templateId,
      })
      .from(modules)
      .leftJoin(templates, eq(modules.templateId, templates.id))
      .where(
        and(
          isNull(templates.id),
          brandId ? exists(
            db.select().from(templates).where(
              and(eq(templates.id, modules.templateId), eq(templates.brandId, brandId))
            )
          ) : undefined
        )
      )
      .limit(maxViolations);

    for (const module of orphanedModules) {
      violations.push({
        type: 'orphaned_record',
        severity: 'critical',
        table: 'modules',
        recordId: module.id,
        field: 'templateId',
        message: `Module references non-existent template: ${module.templateId}`,
        suggestedAction: 'Delete orphaned module or restore missing template',
        details: { templateId: module.templateId },
      });
    }
  } catch (error: any) {
    violations.push({
      type: 'data_inconsistency',
      severity: 'critical',
      table: 'system',
      recordId: 'unknown',
      message: `Failed to check for orphaned records: ${error.message}`,
      suggestedAction: 'Review database constraints and data integrity',
    });
  }

  return violations;
}

/**
 * Check for invalid cross-module references
 */
async function checkInvalidReferences(
  db: Database | TransactionContext,
  brandId?: string,
  maxViolations = 100
): Promise<IntegrityViolation[]> {
  const violations: IntegrityViolation[] = [];

  try {
    // Check passport-variant-product consistency
    const inconsistentPassports = await db
      .select({
        id: passports.id,
        productId: passports.productId,
        variantId: passports.variantId,
        variantProductId: productVariants.productId,
      })
      .from(passports)
      .innerJoin(productVariants, eq(passports.variantId, productVariants.id))
      .where(
        and(
          isNotNull(passports.productId),
          isNotNull(passports.variantId),
          not(eq(passports.productId, productVariants.productId)),
          brandId ? eq(passports.brandId, brandId) : undefined
        )
      )
      .limit(maxViolations);

    for (const passport of inconsistentPassports) {
      violations.push({
        type: 'invalid_reference',
        severity: 'critical',
        table: 'passports',
        recordId: passport.id,
        message: `Passport product-variant inconsistency: variant ${passport.variantId} belongs to product ${passport.variantProductId}, not ${passport.productId}`,
        suggestedAction: 'Update passport to use correct product-variant relationship',
        details: {
          passportProductId: passport.productId,
          variantId: passport.variantId,
          variantActualProductId: passport.variantProductId,
        },
      });
    }
  } catch (error: any) {
    violations.push({
      type: 'data_inconsistency',
      severity: 'critical',
      table: 'system',
      recordId: 'unknown',
      message: `Failed to check invalid references: ${error.message}`,
      suggestedAction: 'Review reference validation logic',
    });
  }

  return violations;
}

/**
 * Check for brand isolation violations
 */
async function checkBrandIsolationViolations(
  db: Database | TransactionContext,
  brandId: string,
  maxViolations = 100
): Promise<IntegrityViolation[]> {
  const violations: IntegrityViolation[] = [];

  try {
    // Check products in wrong brand
    const wrongBrandProducts = await db
      .select({
        id: products.id,
        brandId: products.brandId,
      })
      .from(products)
      .where(not(eq(products.brandId, brandId)))
      .limit(maxViolations);

    for (const product of wrongBrandProducts) {
      violations.push({
        type: 'brand_isolation_breach',
        severity: 'critical',
        table: 'products',
        recordId: product.id,
        message: `Product belongs to different brand: ${product.brandId} instead of ${brandId}`,
        suggestedAction: 'Verify brand access permissions and data integrity',
        details: { expectedBrandId: brandId, actualBrandId: product.brandId },
      });
    }

    // Check passports referencing products from different brands
    const crossBrandPassports = await db
      .select({
        id: passports.id,
        brandId: passports.brandId,
        productId: passports.productId,
        productBrandId: products.brandId,
      })
      .from(passports)
      .innerJoin(products, eq(passports.productId, products.id))
      .where(
        and(
          eq(passports.brandId, brandId),
          not(eq(products.brandId, brandId))
        )
      )
      .limit(maxViolations);

    for (const passport of crossBrandPassports) {
      violations.push({
        type: 'brand_isolation_breach',
        severity: 'critical',
        table: 'passports',
        recordId: passport.id,
        message: `Passport references product from different brand: passport brand ${passport.brandId}, product brand ${passport.productBrandId}`,
        suggestedAction: 'Remove cross-brand reference or update brand assignment',
        details: {
          passportBrandId: passport.brandId,
          productId: passport.productId,
          productBrandId: passport.productBrandId,
        },
      });
    }
  } catch (error: any) {
    violations.push({
      type: 'data_inconsistency',
      severity: 'critical',
      table: 'system',
      recordId: 'unknown',
      message: `Failed to check brand isolation: ${error.message}`,
      suggestedAction: 'Review brand isolation logic',
    });
  }

  return violations;
}

/**
 * Check cross-module data consistency
 */
async function checkCrossModuleDataConsistency(
  db: Database | TransactionContext,
  brandId?: string,
  maxViolations = 100
): Promise<IntegrityViolation[]> {
  const violations: IntegrityViolation[] = [];

  try {
    // Check for passports with both product and variant but from different products
    const inconsistentPassportRelations = await db
      .select({
        id: passports.id,
        productId: passports.productId,
        variantId: passports.variantId,
      })
      .from(passports)
      .where(
        and(
          isNotNull(passports.productId),
          isNotNull(passports.variantId),
          brandId ? eq(passports.brandId, brandId) : undefined
        )
      )
      .limit(maxViolations);

    for (const passport of inconsistentPassportRelations) {
      // Verify the variant belongs to the product
      const variant = await db.query.productVariants.findFirst({
        where: and(
          eq(productVariants.id, passport.variantId!),
          eq(productVariants.productId, passport.productId!)
        ),
      });

      if (!variant) {
        violations.push({
          type: 'data_inconsistency',
          severity: 'critical',
          table: 'passports',
          recordId: passport.id,
          message: `Passport has mismatched product-variant relationship`,
          suggestedAction: 'Correct product-variant relationship or remove invalid references',
          details: {
            productId: passport.productId,
            variantId: passport.variantId,
          },
        });
      }
    }
  } catch (error: any) {
    violations.push({
      type: 'data_inconsistency',
      severity: 'critical',
      table: 'system',
      recordId: 'unknown',
      message: `Failed to check data consistency: ${error.message}`,
      suggestedAction: 'Review consistency validation logic',
    });
  }

  return violations;
}

/**
 * Check for circular dependencies
 */
async function checkCircularDependencies(
  db: Database | TransactionContext,
  brandId?: string,
  maxViolations = 100
): Promise<IntegrityViolation[]> {
  const violations: IntegrityViolation[] = [];

  try {
    // Check circular dependencies in categories
    const categoryHierarchy = await db
      .select({
        id: categories.id,
        parentId: categories.parentId,
      })
      .from(categories)
      .where(
        and(
          isNotNull(categories.parentId),
          brandId ? eq(categories.brandId, brandId) : undefined
        )
      );

    const visited = new Set<string>();
    const visiting = new Set<string>();

    const detectCycle = (categoryId: string, path: string[]): boolean => {
      if (visiting.has(categoryId)) {
        // Found a cycle
        const cycleStart = path.indexOf(categoryId);
        const cycle = path.slice(cycleStart).concat(categoryId);

        violations.push({
          type: 'circular_dependency',
          severity: 'critical',
          table: 'categories',
          recordId: categoryId,
          message: `Circular dependency detected in category hierarchy: ${cycle.join(' -> ')}`,
          suggestedAction: 'Break the circular dependency by updating parent relationships',
          details: { cycle },
        });

        return true;
      }

      if (visited.has(categoryId)) {
        return false;
      }

      visiting.add(categoryId);
      const category = categoryHierarchy.find(c => c.id === categoryId);

      if (category?.parentId) {
        const hasCycle = detectCycle(category.parentId, [...path, categoryId]);
        if (hasCycle) return true;
      }

      visiting.delete(categoryId);
      visited.add(categoryId);
      return false;
    };

    // Check each category for cycles
    for (const category of categoryHierarchy) {
      if (!visited.has(category.id) && violations.length < maxViolations) {
        detectCycle(category.id, []);
      }
    }
  } catch (error: any) {
    violations.push({
      type: 'data_inconsistency',
      severity: 'critical',
      table: 'system',
      recordId: 'unknown',
      message: `Failed to check circular dependencies: ${error.message}`,
      suggestedAction: 'Review dependency checking logic',
    });
  }

  return violations;
}

/**
 * Check for unique constraint violations
 */
async function checkUniqueConstraintViolations(
  db: Database | TransactionContext,
  brandId?: string,
  maxViolations = 100
): Promise<IntegrityViolation[]> {
  const violations: IntegrityViolation[] = [];

  try {
    // Check for duplicate passport brand+product combinations (business rule)
    const duplicatePassports = await db
      .select({
        brandId: passports.brandId,
        productId: passports.productId,
        count: count(),
      })
      .from(passports)
      .where(
        and(
          isNotNull(passports.productId),
          brandId ? eq(passports.brandId, brandId) : undefined
        )
      )
      .groupBy(passports.brandId, passports.productId)
      .having(count().gt(1))
      .limit(maxViolations);

    for (const duplicate of duplicatePassports) {
      violations.push({
        type: 'duplicate_unique_constraint',
        severity: 'warning',
        table: 'passports',
        recordId: `${duplicate.brandId}-${duplicate.productId}`,
        message: `Multiple passports exist for same brand+product combination: ${duplicate.count} passports`,
        suggestedAction: 'Consolidate duplicate passports or implement unique constraint',
        details: {
          brandId: duplicate.brandId,
          productId: duplicate.productId,
          count: duplicate.count,
        },
      });
    }
  } catch (error: any) {
    violations.push({
      type: 'data_inconsistency',
      severity: 'critical',
      table: 'system',
      recordId: 'unknown',
      message: `Failed to check unique constraints: ${error.message}`,
      suggestedAction: 'Review unique constraint logic',
    });
  }

  return violations;
}

/**
 * Generate integrity warnings
 */
async function generateIntegrityWarnings(
  db: Database | TransactionContext,
  brandId?: string
): Promise<IntegrityWarning[]> {
  const warnings: IntegrityWarning[] = [];

  try {
    // Warning: High number of orphaned references
    const orphanedCount = await db
      .select({ count: count() })
      .from(passports)
      .where(
        and(
          or(
            isNotNull(passports.productId),
            isNotNull(passports.variantId),
            isNotNull(passports.templateId)
          ),
          brandId ? eq(passports.brandId, brandId) : undefined
        )
      );

    if (orphanedCount[0].count > 1000) {
      warnings.push({
        type: 'high_reference_count',
        message: `High number of cross-module references detected: ${orphanedCount[0].count} passports with references`,
        affectedRecords: orphanedCount[0].count,
        details: { brandId },
      });
    }

    // Warning: Unbalanced relationship distribution
    const productWithoutVariants = await db
      .select({ count: count() })
      .from(products)
      .leftJoin(productVariants, eq(products.id, productVariants.productId))
      .where(
        and(
          isNull(productVariants.id),
          brandId ? eq(products.brandId, brandId) : undefined
        )
      );

    if (productWithoutVariants[0].count > 50) {
      warnings.push({
        type: 'unbalanced_relationships',
        message: `Many products without variants: ${productWithoutVariants[0].count} products have no variants`,
        affectedRecords: productWithoutVariants[0].count,
        details: { brandId },
      });
    }
  } catch (error) {
    // Silently ignore warning generation errors
  }

  return warnings;
}

/**
 * Generate integrity summary
 */
function generateIntegritySummary(
  violations: IntegrityViolation[],
  warnings: IntegrityWarning[]
): IntegritySummary {
  const criticalViolations = violations.filter(v => v.severity === 'critical').length;
  const warningViolations = violations.filter(v => v.severity === 'warning').length;
  const affectedTables = [...new Set(violations.map(v => v.table))];

  const recommendedActions = [
    ...new Set(violations.filter(v => v.suggestedAction).map(v => v.suggestedAction!))
  ].slice(0, 10); // Top 10 unique actions

  return {
    totalViolations: violations.length,
    criticalViolations,
    warningViolations,
    affectedTables,
    recommendedActions,
  };
}

// ================================
// SPECIFIC INTEGRITY CHECKS
// ================================

/**
 * Check integrity for a specific entity before operations
 */
export async function checkEntityIntegrity(
  db: Database | TransactionContext,
  entityType: 'passport' | 'product' | 'variant' | 'template',
  entityId: string,
  brandId?: string
): Promise<{
  isValid: boolean;
  violations: IntegrityViolation[];
  canProceed: boolean;
}> {
  const violations: IntegrityViolation[] = [];

  try {
    switch (entityType) {
      case 'passport':
        const passport = await db.query.passports.findFirst({
          where: and(
            eq(passports.id, entityId),
            brandId ? eq(passports.brandId, brandId) : undefined
          ),
        });

        if (!passport) {
          violations.push({
            type: 'invalid_reference',
            severity: 'critical',
            table: 'passports',
            recordId: entityId,
            message: 'Passport not found',
            suggestedAction: 'Verify passport exists and access permissions',
          });
          break;
        }

        // Check product-variant consistency if both are present
        if (passport.productId && passport.variantId) {
          const variant = await db.query.productVariants.findFirst({
            where: and(
              eq(productVariants.id, passport.variantId),
              eq(productVariants.productId, passport.productId)
            ),
          });

          if (!variant) {
            violations.push({
              type: 'data_inconsistency',
              severity: 'critical',
              table: 'passports',
              recordId: entityId,
              message: 'Product-variant relationship is inconsistent',
              suggestedAction: 'Fix product-variant relationship or remove invalid references',
            });
          }
        }
        break;

      case 'product':
        const product = await db.query.products.findFirst({
          where: and(
            eq(products.id, entityId),
            brandId ? eq(products.brandId, brandId) : undefined
          ),
        });

        if (!product) {
          violations.push({
            type: 'invalid_reference',
            severity: 'critical',
            table: 'products',
            recordId: entityId,
            message: 'Product not found',
            suggestedAction: 'Verify product exists and access permissions',
          });
        }
        break;

      // Add other entity types as needed
    }

    return {
      isValid: violations.filter(v => v.severity === 'critical').length === 0,
      violations,
      canProceed: violations.length === 0,
    };
  } catch (error: any) {
    return {
      isValid: false,
      violations: [{
        type: 'data_inconsistency',
        severity: 'critical',
        table: entityType + 's',
        recordId: entityId,
        message: `Entity integrity check failed: ${error.message}`,
        suggestedAction: 'Review entity data and database state',
      }],
      canProceed: false,
    };
  }
}

/**
 * Repair specific integrity violations (where possible)
 */
export async function repairIntegrityViolations(
  db: Database,
  violations: IntegrityViolation[],
  dryRun: boolean = true
): Promise<{
  repairable: IntegrityViolation[];
  repaired: IntegrityViolation[];
  failed: IntegrityViolation[];
}> {
  const repairable = violations.filter(v =>
    v.type === 'orphaned_record' ||
    v.type === 'invalid_reference' ||
    v.type === 'duplicate_unique_constraint'
  );

  const repaired: IntegrityViolation[] = [];
  const failed: IntegrityViolation[] = [];

  if (dryRun) {
    return { repairable, repaired: [], failed: [] };
  }

  for (const violation of repairable) {
    try {
      switch (violation.type) {
        case 'orphaned_record':
          // For orphaned records, set the foreign key to null
          if (violation.field && violation.table) {
            await db
              .update(getTableByName(violation.table))
              .set({ [violation.field]: null })
              .where(eq(getTableByName(violation.table).id, violation.recordId));
            repaired.push(violation);
          }
          break;

        case 'invalid_reference':
          // For invalid references, set to null or provide default
          if (violation.field && violation.table) {
            await db
              .update(getTableByName(violation.table))
              .set({ [violation.field]: null })
              .where(eq(getTableByName(violation.table).id, violation.recordId));
            repaired.push(violation);
          }
          break;

        default:
          failed.push(violation);
      }
    } catch (error) {
      failed.push(violation);
    }
  }

  return { repairable, repaired, failed };
}

/**
 * Helper to get table schema by name
 */
function getTableByName(tableName: string): any {
  switch (tableName) {
    case 'passports': return passports;
    case 'products': return products;
    case 'product_variants': return productVariants;
    case 'templates': return templates;
    case 'modules': return modules;
    case 'categories': return categories;
    default: throw new Error(`Unknown table: ${tableName}`);
  }
}