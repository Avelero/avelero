import { TRPCError } from "@trpc/server";
import { and, eq, isNull, desc, inArray, count } from "drizzle-orm";
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
import {
  executeTransaction,
  executeTransactionWithRollback,
  createOperation,
  createValidationOperation,
  createDataOperation,
  type TransactionOperation,
  type TransactionConfig,
  type TransactionContext,
} from "./transactions.js";
import {
  validatePassportProductVariantConsistency,
  validateBrandIsolation,
  validateTemplateModuleConsistency,
  validateCrossModuleReferences,
  validateBulkOperation,
  validateRequiredRelationships,
  createValidationError,
  type ValidationResult,
} from "./relationship-validation.js";
import {
  validateEntityForeignKeys,
  validateBulkForeignKeys,
  checkCircularDependencies,
  validateBeforeDeletion,
  createForeignKeyValidationError,
  type ForeignKeyValidationResult,
} from "./foreign-key-validation.js";
import {
  executeCascadingDeletion,
  executeCascadingUpdate,
  previewCascadeEffects,
  type CascadeOperationResult,
} from "./cascading-operations.js";
import {
  runComprehensiveIntegrityCheck,
  checkEntityIntegrity,
  type IntegrityCheckResult,
} from "./integrity-checks.js";

/**
 * Cross-Module Transaction Patterns
 *
 * Implements specific transaction patterns for operations that span multiple modules,
 * ensuring data consistency and proper rollback mechanisms.
 */

// Input types for cross-module operations
export interface CreatePassportTransactionInput {
  brandId: string;
  productId?: string;
  variantId?: string;
  templateId?: string;
  passportData: {
    passportStatus?: "draft" | "published" | "archived" | "blocked";
    visibility?: "private" | "public" | "shared";
    customData?: Record<string, any>;
    moduleData?: Record<string, any>;
    versionNotes?: string;
    changeReason?: string;
    dataCompleteness?: number;
    complianceScore?: number;
    validationScore?: number;
    // Include any other passport fields that might be passed
    [key: string]: any;
  };
  // Additional validation requirements
  validateProductVariantRelation?: boolean;
  validateTemplateAccess?: boolean;
  enforceUniquePassport?: boolean;
}

export interface CreateProductWithVariantsInput {
  brandId: string;
  productData: {
    name: string;
    description?: string;
    categoryId?: string;
    showcaseBrandId?: string;
    season?: string;
    customData?: Record<string, any>;
  };
  variants?: Array<{
    name: string;
    description?: string;
    customData?: Record<string, any>;
  }>;
  createDefaultPassports?: boolean;
  templateId?: string;
}

export interface BulkStatusUpdateTransactionInput {
  brandId: string;
  module: "passports" | "products" | "variants" | "templates";
  selection: {
    ids?: string[];
    filter?: Record<string, any>;
  };
  statusUpdate: {
    status?: string;
    visibility?: string;
    publishedAt?: string;
  };
  cascadeToRelated?: boolean;
}

/**
 * Transaction: Create Passport with Cross-Module Validation
 *
 * Ensures that passport creation maintains consistency across:
 * - Product/Variant relationship validation
 * - Template access permissions
 * - Brand isolation
 * - Uniqueness constraints
 */
export async function createPassportTransaction(
  db: Database,
  input: CreatePassportTransactionInput,
  config?: TransactionConfig
) {
  const operations: TransactionOperation[] = [];

  // Enhanced Validation: Comprehensive relationship and foreign key validation
  operations.push(
    createValidationOperation("validate-comprehensive-requirements", async (tx) => {
      // 1. Validate required relationships
      const passportData = {
        brandId: input.brandId,
        productId: input.productId,
        variantId: input.variantId,
        templateId: input.templateId,
        ...input.passportData,
      };

      const requirementValidation = validateRequiredRelationships('passport', passportData);
      if (!requirementValidation.isValid) {
        throw createValidationError('BAD_REQUEST', requirementValidation.error!);
      }

      // 2. Validate foreign key constraints
      const foreignKeyValidation = await validateEntityForeignKeys(
        tx,
        'passports',
        passportData,
        input.brandId
      );

      if (!foreignKeyValidation.isValid) {
        throw createForeignKeyValidationError(foreignKeyValidation);
      }

      // 3. Validate cross-module references
      const crossModuleValidation = await validateCrossModuleReferences(
        tx,
        'passport',
        passportData,
        input.brandId
      );

      if (!crossModuleValidation.isValid) {
        throw createValidationError('BAD_REQUEST', crossModuleValidation.error!);
      }

      return { validated: true };
    })
  );

  // Enhanced Validation: Brand isolation and access control
  operations.push(
    createValidationOperation("validate-brand-access", async (tx) => {
      const brand = await tx.query.brands.findFirst({
        where: eq(brands.id, input.brandId),
      });

      if (!brand) {
        throw createValidationError('NOT_FOUND', 'Brand not found');
      }

      // Validate brand isolation for all referenced entities
      if (input.productId) {
        const brandIsolationResult = await validateBrandIsolation(
          tx,
          'product',
          input.productId,
          input.brandId
        );

        if (!brandIsolationResult.isValid) {
          throw createValidationError('FORBIDDEN', brandIsolationResult.error!);
        }
      }

      if (input.variantId) {
        const variantBrandResult = await validateBrandIsolation(
          tx,
          'variant',
          input.variantId,
          input.brandId
        );

        if (!variantBrandResult.isValid) {
          throw createValidationError('FORBIDDEN', variantBrandResult.error!);
        }
      }

      return brand;
    })
  );

  // Enhanced Validation: Product-Variant consistency
  if (input.productId && input.variantId) {
    operations.push(
      createValidationOperation("validate-product-variant-consistency", async (tx) => {
        // Create a temporary passport ID for validation
        const tempPassportId = 'temp-validation-id';

        const consistencyResult = await validatePassportProductVariantConsistency(
          tx,
          tempPassportId,
          input.brandId
        );

        if (!consistencyResult.isValid) {
          throw createValidationError('BAD_REQUEST', consistencyResult.error!);
        }

        return { consistent: true };
      })
    );
  }

  // Enhanced Validation: Template-Module consistency (if template is provided)
  if (input.templateId && input.validateTemplateAccess) {
    operations.push(
      createValidationOperation("validate-template-access", async (tx) => {
        const template = await tx.query.templates.findFirst({
          where: and(
            eq(templates.id, input.templateId!),
            eq(templates.brandId, input.brandId)
          ),
        });

        if (!template) {
          throw createValidationError('NOT_FOUND', 'Template not found or not accessible');
        }

        return template;
      })
    );
  }

  // Enhanced Validation: Uniqueness constraint with comprehensive checking
  if (input.enforceUniquePassport) {
    operations.push(
      createValidationOperation("validate-passport-uniqueness", async (tx) => {
        const conditions = [eq(passports.brandId, input.brandId)];

        if (input.productId) {
          conditions.push(eq(passports.productId, input.productId));
        } else {
          conditions.push(isNull(passports.productId));
        }

        if (input.variantId) {
          conditions.push(eq(passports.variantId, input.variantId));
        } else {
          conditions.push(isNull(passports.variantId));
        }

        const existingPassport = await tx.query.passports.findFirst({
          where: and(...conditions),
        });

        if (existingPassport) {
          throw createValidationError(
            'CONFLICT',
            'A passport already exists for this brand+product+variant combination'
          );
        }

        return null;
      })
    );
  }

  // Data Operation: Create the passport
  operations.push(
    createDataOperation("create-passport", async (tx) => {
      const passportData = {
        ...input.passportData,
        brandId: input.brandId,
        productId: input.productId || null,
        variantId: input.variantId || null,
        templateId: input.templateId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Use provided calculated fields or defaults
        dataCompleteness: input.passportData.dataCompleteness || 0,
        complianceScore: input.passportData.complianceScore || 0,
        validationScore: input.passportData.validationScore || 75,
      };

      const [newPassport] = await tx
        .insert(passports)
        .values(passportData as any) // Type assertion needed due to complex schema
        .returning();

      return newPassport;
    })
  );

  return executeTransaction(db, operations, config);
}

/**
 * Transaction: Create Product with Variants and Optional Passports
 *
 * Creates a product with its variants and optionally creates passports for each variant
 */
export async function createProductWithVariantsTransaction(
  db: Database,
  input: CreateProductWithVariantsInput,
  config?: TransactionConfig
) {
  const operations: TransactionOperation[] = [];

  // Validation: Brand exists
  operations.push(
    createValidationOperation("validate-brand", async (tx) => {
      const brand = await tx.query.brands.findFirst({
        where: eq(brands.id, input.brandId),
      });

      if (!brand) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Brand not found",
        });
      }

      return brand;
    })
  );

  // Validation: Category exists (if provided)
  if (input.productData.categoryId) {
    operations.push(
      createValidationOperation("validate-category", async (tx) => {
        const category = await tx.query.categories.findFirst({
          where: eq(categories.id, input.productData.categoryId!),
        });

        if (!category) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Category not found",
          });
        }

        return category;
      })
    );
  }

  // Validation: Template exists (if provided for passports)
  if (input.createDefaultPassports && input.templateId) {
    operations.push(
      createValidationOperation("validate-template", async (tx) => {
        const template = await tx.query.templates.findFirst({
          where: and(
            eq(templates.id, input.templateId!),
            eq(templates.brandId, input.brandId)
          ),
        });

        if (!template) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Template not found or not accessible",
          });
        }

        return template;
      })
    );
  }

  // Data Operation: Create the product
  operations.push(
    createDataOperation("create-product", async (tx) => {
      const productData = {
        ...input.productData,
        brandId: input.brandId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const [newProduct] = await tx
        .insert(products)
        .values(productData)
        .returning();

      return newProduct;
    })
  );

  // Data Operation: Create variants (if provided)
  if (input.variants && input.variants.length > 0) {
    operations.push(
      createDataOperation("create-variants", async (tx) => {
        // Since we can't easily pass data between operations in the current system,
        // we'll query for the most recently created product for this brand
        const recentProduct = await tx.query.products.findFirst({
          where: eq(products.brandId, input.brandId),
          orderBy: [desc(products.createdAt)],
        });

        if (!recentProduct) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Product creation failed - cannot create variants",
          });
        }

        const variantsData = input.variants!.map((variant) => ({
          ...variant,
          brandId: input.brandId,
          productId: recentProduct.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        const newVariants = await tx
          .insert(productVariants)
          .values(variantsData as any)
          .returning();

        return newVariants;
      })
    );
  }

  // Data Operation: Create default passports (if requested)
  if (input.createDefaultPassports) {
    operations.push(
      createDataOperation("create-default-passports", async (tx) => {
        // Get the recently created product and variants
        const recentProduct = await tx.query.products.findFirst({
          where: eq(products.brandId, input.brandId),
          orderBy: [desc(products.createdAt)],
        });

        if (!recentProduct) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Product not found for passport creation",
          });
        }

        const createdPassports = [];

        // Create passport for the product
        const productPassportData = {
          brandId: input.brandId,
          productId: recentProduct.id,
          variantId: null,
          templateId: input.templateId || null,
          passportStatus: "draft" as const,
          visibility: "private" as const,
          dataCompleteness: 0,
          complianceScore: 0,
          validationScore: 75,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const [productPassport] = await tx
          .insert(passports)
          .values(productPassportData as any)
          .returning();
        createdPassports.push(productPassport);

        // Create passports for variants if they exist
        if (input.variants && input.variants.length > 0) {
          const productVariantsCreated = await tx.query.productVariants.findMany({
            where: eq(productVariants.productId, recentProduct.id),
          });

          for (const variant of productVariantsCreated) {
            const variantPassportData = {
              brandId: input.brandId,
              productId: recentProduct.id,
              variantId: variant.id,
              templateId: input.templateId || null,
              passportStatus: "draft" as const,
              visibility: "private" as const,
              dataCompleteness: 0,
              complianceScore: 0,
              validationScore: 75,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

            const [variantPassport] = await tx
              .insert(passports)
              .values(variantPassportData as any)
              .returning();
            createdPassports.push(variantPassport);
          }
        }

        return createdPassports;
      })
    );
  }

  return executeTransaction(db, operations, config);
}

/**
 * Transaction: Bulk Status Update with Cascade
 *
 * Updates status across multiple modules with optional cascading to related entities
 */
export async function bulkStatusUpdateTransaction(
  db: Database,
  input: BulkStatusUpdateTransactionInput,
  config?: TransactionConfig
) {
  const operations: TransactionOperation[] = [];

  // Get the table reference based on module type
  const getTable = () => {
    switch (input.module) {
      case "passports": return passports;
      case "products": return products;
      case "variants": return productVariants;
      case "templates": return templates;
      default:
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unsupported module: ${input.module}`,
        });
    }
  };

  // Validation: Count affected records for safety
  operations.push(
    createValidationOperation("validate-bulk-operation-size", async (tx) => {
      const table = getTable();
      const conditions = [eq(table.brandId, input.brandId)];

      // Add selection filters
      if (input.selection.ids) {
        conditions.push(inArray(table.id, input.selection.ids));
      } else if (input.selection.filter) {
        // Add filter conditions based on module type and filter
        if (input.selection.filter.status && table === passports) {
          conditions.push(inArray(passports.passportStatus, input.selection.filter.status));
        }
        // Add more filter conditions as needed
      }

      const countResult = await tx
        .select({ count: count() })
        .from(table)
        .where(and(...conditions));

      const affectedCount = countResult[0]?.count || 0;

      // Safety limits
      if (affectedCount > 1000) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Bulk operation would affect ${affectedCount} records. Maximum allowed is 1000.`,
        });
      }

      return { affectedCount };
    })
  );

  // Data Operation: Update primary entities
  operations.push(
    createDataOperation("update-primary-entities", async (tx) => {
      const table = getTable();
      const conditions = [eq(table.brandId, input.brandId)];

      // Add selection filters
      if (input.selection.ids) {
        conditions.push(inArray(table.id, input.selection.ids));
      } else if (input.selection.filter) {
        if (input.selection.filter.status && table === passports) {
          conditions.push(inArray(passports.passportStatus, input.selection.filter.status));
        }
      }

      // Prepare update data
      const updateData: any = {
        updatedAt: new Date().toISOString(),
      };

      if (input.statusUpdate.status) {
        if (table === passports) {
          updateData.passportStatus = input.statusUpdate.status;
        } else if (table === products || table === templates) {
          updateData.status = input.statusUpdate.status;
        }
      }

      if (input.statusUpdate.visibility && table === passports) {
        updateData.visibility = input.statusUpdate.visibility;
      }

      if (input.statusUpdate.publishedAt) {
        updateData.publishedAt = input.statusUpdate.publishedAt;
      }

      const updatedRecords = await tx
        .update(table)
        .set(updateData)
        .where(and(...conditions))
        .returning();

      return updatedRecords;
    })
  );

  // Data Operation: Cascade updates to related entities (if requested)
  if (input.cascadeToRelated) {
    operations.push(
      createDataOperation("cascade-to-related", async (tx) => {
        // Example: If updating products, also update related passports
        if (input.module === "products" && input.statusUpdate.status) {
          const relatedPassports = await tx
            .update(passports)
            .set({
              passportStatus: input.statusUpdate.status as any,
              updatedAt: new Date().toISOString(),
            })
            .where(
              and(
                eq(passports.brandId, input.brandId),
                input.selection.ids
                  ? inArray(passports.productId, input.selection.ids)
                  : eq(passports.brandId, input.brandId) // For filter-based selection
              )
            )
            .returning();

          return relatedPassports;
        }

        return [];
      })
    );
  }

  return executeTransaction(db, operations, config);
}

/**
 * Transaction: Delete with Cascade Management
 *
 * Safely deletes entities while managing cascading effects across modules
 */
export async function deleteWithCascadeTransaction(
  db: Database,
  input: {
    brandId: string;
    module: "products" | "variants" | "templates";
    entityId: string;
    cascadeStrategy: "soft-delete" | "hard-delete" | "block-if-referenced";
  },
  config?: TransactionConfig
) {
  const operations: TransactionOperation[] = [];

  // Validation: Check for references before deletion
  operations.push(
    createValidationOperation("check-references", async (tx) => {
      const references: Array<{ table: string; count: number }> = [];

      if (input.module === "products") {
        // Check for variants
        const variantCount = await tx
          .select({ count: count() })
          .from(productVariants)
          .where(eq(productVariants.productId, input.entityId));

        if (variantCount[0]?.count > 0) {
          references.push({ table: "variants", count: variantCount[0].count });
        }

        // Check for passports
        const passportCount = await tx
          .select({ count: count() })
          .from(passports)
          .where(eq(passports.productId, input.entityId));

        if (passportCount[0]?.count > 0) {
          references.push({ table: "passports", count: passportCount[0].count });
        }
      } else if (input.module === "variants") {
        // Check for passports
        const passportCount = await tx
          .select({ count: count() })
          .from(passports)
          .where(eq(passports.variantId, input.entityId));

        if (passportCount[0]?.count > 0) {
          references.push({ table: "passports", count: passportCount[0].count });
        }
      } else if (input.module === "templates") {
        // Check for passports using this template
        const passportCount = await tx
          .select({ count: count() })
          .from(passports)
          .where(eq(passports.templateId, input.entityId));

        if (passportCount[0]?.count > 0) {
          references.push({ table: "passports", count: passportCount[0].count });
        }
      }

      const hasReferences = references.length > 0;

      // Handle block-if-referenced strategy
      if (hasReferences && input.cascadeStrategy === "block-if-referenced") {
        const referenceSummary = references
          .map(ref => `${ref.count} ${ref.table}`)
          .join(", ");
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete ${input.module} as it is referenced by: ${referenceSummary}`,
        });
      }

      return { hasReferences, references };
    })
  );

  // Data Operation: Perform deletion/update
  operations.push(
    createDataOperation("execute-deletion", async (tx) => {
      let deletedEntity;

      if (input.module === "products") {
        if (input.cascadeStrategy === "soft-delete") {
          // Soft delete the product
          const [updated] = await tx
            .update(products)
            .set({ deletedAt: new Date().toISOString() })
            .where(and(
              eq(products.id, input.entityId),
              eq(products.brandId, input.brandId)
            ))
            .returning();
          deletedEntity = updated;

          // Soft delete related variants and passports
          await tx
            .update(productVariants)
            .set({ deletedAt: new Date().toISOString() })
            .where(eq(productVariants.productId, input.entityId));

          await tx
            .update(passports)
            .set({ deletedAt: new Date().toISOString() })
            .where(eq(passports.productId, input.entityId));
        } else {
          // Hard delete: Delete passports first, then variants, then product
          await tx.delete(passports).where(eq(passports.productId, input.entityId));
          await tx.delete(productVariants).where(eq(productVariants.productId, input.entityId));
          const [deleted] = await tx
            .delete(products)
            .where(and(
              eq(products.id, input.entityId),
              eq(products.brandId, input.brandId)
            ))
            .returning();
          deletedEntity = deleted;
        }
      } else if (input.module === "variants") {
        if (input.cascadeStrategy === "soft-delete") {
          // Soft delete the variant
          const [updated] = await tx
            .update(productVariants)
            .set({ deletedAt: new Date().toISOString() })
            .where(and(
              eq(productVariants.id, input.entityId),
              eq(productVariants.brandId, input.brandId)
            ))
            .returning();
          deletedEntity = updated;

          // Soft delete related passports
          await tx
            .update(passports)
            .set({ deletedAt: new Date().toISOString() })
            .where(eq(passports.variantId, input.entityId));
        } else {
          // Hard delete: Delete passports first, then variant
          await tx.delete(passports).where(eq(passports.variantId, input.entityId));
          const [deleted] = await tx
            .delete(productVariants)
            .where(and(
              eq(productVariants.id, input.entityId),
              eq(productVariants.brandId, input.brandId)
            ))
            .returning();
          deletedEntity = deleted;
        }
      } else if (input.module === "templates") {
        if (input.cascadeStrategy === "soft-delete") {
          // Soft delete the template
          const [updated] = await tx
            .update(templates)
            .set({ deletedAt: new Date().toISOString() })
            .where(and(
              eq(templates.id, input.entityId),
              eq(templates.brandId, input.brandId)
            ))
            .returning();
          deletedEntity = updated;

          // Note: We don't delete passports when templates are deleted,
          // but we could clear the templateId reference if needed
        } else {
          // Hard delete: Clear template references first, then delete template
          await tx
            .update(passports)
            .set({ templateId: null })
            .where(eq(passports.templateId, input.entityId));

          const [deleted] = await tx
            .delete(templates)
            .where(and(
              eq(templates.id, input.entityId),
              eq(templates.brandId, input.brandId)
            ))
            .returning();
          deletedEntity = deleted;
        }
      }

      return {
        deleted: !!deletedEntity,
        entity: deletedEntity,
        strategy: input.cascadeStrategy,
      };
    })
  );

  return executeTransaction(db, operations, config);
}

// ================================
// ENHANCED VALIDATION TRANSACTIONS
// ================================

/**
 * Enhanced Bulk Operation Transaction with Comprehensive Validation
 *
 * Provides safe bulk operations with full integrity checking, foreign key validation,
 * and cascading operation support.
 */
export async function enhancedBulkOperationTransaction(
  db: Database,
  input: {
    brandId: string;
    operation: 'delete' | 'update';
    entityType: 'passport' | 'product' | 'variant' | 'template';
    entityIds: string[];
    updateData?: Record<string, any>;
    previewOnly?: boolean;
    forceIgnoreWarnings?: boolean;
    cascadeStrategy?: 'cascade' | 'set_null' | 'prevent';
  },
  config?: TransactionConfig
) {
  const operations: TransactionOperation[] = [];

  // Validation: Comprehensive bulk operation validation
  operations.push(
    createValidationOperation("validate-bulk-operation", async (tx) => {
      const bulkValidation = await validateBulkOperation(
        tx,
        input.operation,
        input.entityType,
        input.entityIds,
        input.brandId,
        input.updateData
      );

      if (!bulkValidation.isValid) {
        throw createValidationError('BAD_REQUEST', bulkValidation.error!);
      }

      return { validated: true };
    })
  );

  // Validation: Foreign key validation for bulk operations
  if (input.operation === 'update' && input.updateData) {
    operations.push(
      createValidationOperation("validate-bulk-foreign-keys", async (tx) => {
        // Create mock entities with updated data for validation
        const mockEntities = input.entityIds.slice(0, 10).map(id => ({
          id,
          ...input.updateData,
          brandId: input.brandId,
        }));

        const foreignKeyValidation = await validateBulkForeignKeys(
          tx,
          `${input.entityType}s` as keyof typeof import('./foreign-key-validation.js').FOREIGN_KEY_CONSTRAINTS,
          mockEntities,
          input.brandId
        );

        if (!foreignKeyValidation.isValid) {
          throw createForeignKeyValidationError(foreignKeyValidation);
        }

        return { validated: true };
      })
    );
  }

  // Preview cascade effects if deletion
  if (input.operation === 'delete') {
    operations.push(
      createValidationOperation("preview-cascade-effects", async (tx) => {
        const cascadePreview = await previewCascadeEffects(
          tx,
          `${input.entityType}s`,
          input.entityIds,
          input.brandId
        );

        const highImpactCascades = cascadePreview.cascades.filter(
          c => c.estimatedAffectedRecords > 100
        );

        if (highImpactCascades.length > 0 && !input.forceIgnoreWarnings) {
          throw createValidationError(
            'PRECONDITION_FAILED',
            `High impact cascade detected: ${highImpactCascades.length} cascades would affect >100 records each. Use forceIgnoreWarnings=true to proceed.`
          );
        }

        return cascadePreview;
      })
    );
  }

  // Execute operation if not preview only
  if (!input.previewOnly) {
    if (input.operation === 'delete') {
      operations.push(
        createDataOperation("execute-cascading-deletion", async (tx) => {
          const cascadeResult = await executeCascadingDeletion(
            tx,
            `${input.entityType}s`,
            input.entityIds,
            input.brandId
          );

          if (!cascadeResult.success) {
            throw createValidationError('CONFLICT', cascadeResult.error!);
          }

          return cascadeResult;
        })
      );
    } else if (input.operation === 'update') {
      operations.push(
        createDataOperation("execute-bulk-update", async (tx) => {
          // Perform the bulk update with proper validation
          const table = getTableByEntityType(input.entityType);
          const idColumn = table.id;

          const updatedRecords = await tx
            .update(table)
            .set({
              ...input.updateData,
              updatedAt: new Date().toISOString(),
            })
            .where(inArray(idColumn, input.entityIds))
            .returning();

          return {
            updatedCount: updatedRecords.length,
            updatedRecords,
          };
        })
      );
    }
  }

  return executeTransaction(db, operations, config);
}

/**
 * Integrity Check Transaction
 *
 * Runs comprehensive integrity checks and optionally repairs violations
 */
export async function integrityCheckTransaction(
  db: Database,
  input: {
    brandId?: string;
    repairViolations?: boolean;
    dryRun?: boolean;
    maxViolationsPerType?: number;
  },
  config?: TransactionConfig
) {
  const operations: TransactionOperation[] = [];

  // Run comprehensive integrity check
  operations.push(
    createValidationOperation("run-integrity-check", async (tx) => {
      const integrityResult = await runComprehensiveIntegrityCheck(
        tx,
        input.brandId,
        {
          skipWarnings: false,
          includePerformanceChecks: true,
          maxViolationsPerType: input.maxViolationsPerType || 100,
        }
      );

      if (!integrityResult.isValid && !input.repairViolations) {
        throw createValidationError(
          'CONFLICT',
          `Integrity violations detected: ${integrityResult.summary.criticalViolations} critical violations found`
        );
      }

      return integrityResult;
    })
  );

  // Repair violations if requested
  if (input.repairViolations && !input.dryRun) {
    operations.push(
      createDataOperation("repair-violations", async (tx) => {
        // Note: This is a simplified implementation
        // In practice, you'd need to implement more sophisticated repair logic
        return {
          message: "Automatic repair not fully implemented",
          needsManualIntervention: true,
        };
      })
    );
  }

  return executeTransaction(db, operations, config);
}

/**
 * Cross-Module Relationship Validation Transaction
 *
 * Validates specific cross-module relationships for consistency
 */
export async function validateCrossModuleRelationshipsTransaction(
  db: Database,
  input: {
    brandId: string;
    entityType: 'passport' | 'product' | 'variant';
    entityId: string;
    validateReferences?: boolean;
    repairInconsistencies?: boolean;
  },
  config?: TransactionConfig
) {
  const operations: TransactionOperation[] = [];

  // Validate entity integrity
  operations.push(
    createValidationOperation("validate-entity-integrity", async (tx) => {
      const entityIntegrity = await checkEntityIntegrity(
        tx,
        input.entityType,
        input.entityId,
        input.brandId
      );

      if (!entityIntegrity.isValid) {
        const criticalViolations = entityIntegrity.violations.filter(v => v.severity === 'critical');
        if (criticalViolations.length > 0) {
          throw createValidationError(
            'CONFLICT',
            `Entity integrity check failed: ${criticalViolations.length} critical violations`
          );
        }
      }

      return entityIntegrity;
    })
  );

  // Validate specific relationships based on entity type
  if (input.entityType === 'passport') {
    operations.push(
      createValidationOperation("validate-passport-relationships", async (tx) => {
        const consistencyResult = await validatePassportProductVariantConsistency(
          tx,
          input.entityId,
          input.brandId
        );

        if (!consistencyResult.isValid) {
          throw createValidationError('CONFLICT', consistencyResult.error!);
        }

        return consistencyResult;
      })
    );
  }

  // Validate brand isolation
  operations.push(
    createValidationOperation("validate-brand-isolation", async (tx) => {
      const brandIsolationResult = await validateBrandIsolation(
        tx,
        input.entityType,
        input.entityId,
        input.brandId
      );

      if (!brandIsolationResult.isValid) {
        throw createValidationError('FORBIDDEN', brandIsolationResult.error!);
      }

      return brandIsolationResult;
    })
  );

  return executeTransaction(db, operations, config);
}

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Get table schema by entity type
 */
function getTableByEntityType(entityType: string): any {
  switch (entityType) {
    case 'passport': return passports;
    case 'product': return products;
    case 'variant': return productVariants;
    case 'template': return templates;
    case 'module': return modules;
    case 'category': return categories;
    default: throw new Error(`Unknown entity type: ${entityType}`);
  }
}

/**
 * Helper: Create operation from tRPC context
 */
export function createTransactionFromTRPCContext(
  ctx: { db: Database; brandId: string | null }
) {
  if (!ctx.brandId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "No active brand context for transaction",
    });
  }

  return {
    db: ctx.db,
    brandId: ctx.brandId,
    executeTransaction: (operations: TransactionOperation[], config?: TransactionConfig) =>
      executeTransaction(ctx.db, operations, config),
    executeTransactionWithRollback: (operations: TransactionOperation[], config?: TransactionConfig) =>
      executeTransactionWithRollback(ctx.db, operations, config),
    enhancedBulkOperation: (input: Parameters<typeof enhancedBulkOperationTransaction>[1]) =>
      enhancedBulkOperationTransaction(ctx.db, { ...input, brandId: ctx.brandId }, {}),
    integrityCheck: (input: Parameters<typeof integrityCheckTransaction>[1]) =>
      integrityCheckTransaction(ctx.db, { ...input, brandId: ctx.brandId || undefined }, {}),
    validateCrossModuleRelationships: (input: Omit<Parameters<typeof validateCrossModuleRelationshipsTransaction>[1], 'brandId'>) =>
      validateCrossModuleRelationshipsTransaction(ctx.db, { ...input, brandId: ctx.brandId }, {}),
  };
}