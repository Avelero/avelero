import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, not } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { TRPCContext } from "../init";

// ================================
// Bulk Operation Safety Types
// ================================

/**
 * Bulk operation types with different safety requirements
 */
export type BulkOperationType =
  | "update"
  | "delete"
  | "archive"
  | "restore"
  | "status_change"
  | "assignment"
  | "custom";

/**
 * Safety configuration for bulk operations
 */
export interface BulkSafetyConfig {
  /**
   * Maximum records allowed without preview (default: 1000)
   */
  maxWithoutPreview: number;

  /**
   * Maximum records allowed even with preview (default: 10000)
   */
  absoluteMax: number;

  /**
   * Warning threshold for showing warnings (default: 100)
   */
  warningThreshold: number;

  /**
   * Require confirmation for destructive operations (default: true for delete)
   */
  requireConfirmation: boolean;

  /**
   * Custom safety message for this operation
   */
  safetyMessage?: string;
}

/**
 * Default safety configurations for different operation types
 */
export const defaultBulkSafetyConfigs: Record<
  BulkOperationType,
  BulkSafetyConfig
> = {
  update: {
    maxWithoutPreview: 1000,
    absoluteMax: 10000,
    warningThreshold: 100,
    requireConfirmation: false,
  },
  delete: {
    maxWithoutPreview: 100, // More restrictive for destructive operations
    absoluteMax: 1000,
    warningThreshold: 50,
    requireConfirmation: true,
    safetyMessage: "This operation will permanently delete records",
  },
  archive: {
    maxWithoutPreview: 500,
    absoluteMax: 5000,
    warningThreshold: 100,
    requireConfirmation: false,
  },
  restore: {
    maxWithoutPreview: 500,
    absoluteMax: 5000,
    warningThreshold: 100,
    requireConfirmation: false,
  },
  status_change: {
    maxWithoutPreview: 1000,
    absoluteMax: 10000,
    warningThreshold: 200,
    requireConfirmation: false,
  },
  assignment: {
    maxWithoutPreview: 1000,
    absoluteMax: 10000,
    warningThreshold: 200,
    requireConfirmation: false,
  },
  custom: {
    maxWithoutPreview: 500,
    absoluteMax: 5000,
    warningThreshold: 100,
    requireConfirmation: true,
  },
};

/**
 * Bulk operation selection criteria
 */
export interface BulkSelectionCriteria {
  /**
   * Specific IDs to target
   */
  ids?: string[];

  /**
   * Filter conditions for selection
   */
  filter?: Record<string, any>;

  /**
   * Select all records matching base conditions
   */
  all?: boolean;

  /**
   * Exclude specific IDs from selection
   */
  excludeIds?: string[];
}

/**
 * Bulk operation preview result
 */
export interface BulkPreviewResult {
  /**
   * Number of records that would be affected
   */
  affectedCount: number;

  /**
   * Sample of records that would be affected (max 10)
   */
  sampleRecords: any[];

  /**
   * Warnings about the operation
   */
  warnings: string[];

  /**
   * Whether the operation requires confirmation
   */
  requiresConfirmation: boolean;

  /**
   * Safety status of the operation
   */
  safetyStatus: "safe" | "warning" | "dangerous" | "blocked";

  /**
   * Detailed safety information
   */
  safetyInfo: {
    withinSafeLimit: boolean;
    withinAbsoluteLimit: boolean;
    warningTriggered: boolean;
    safetyMessage?: string;
  };

  /**
   * Estimated operation time
   */
  estimatedDuration?: {
    seconds: number;
    message: string;
  };
}

// ================================
// Enhanced Bulk Safety Validation
// ================================

/**
 * Enhanced bulk operation validator with granular safety controls
 */
export class BulkSafetyValidator {
  public config: BulkSafetyConfig;
  private operationType: BulkOperationType;
  private resourceName: string;

  constructor(
    operationType: BulkOperationType,
    resourceName: string,
    customConfig?: Partial<BulkSafetyConfig>,
  ) {
    this.operationType = operationType;
    this.resourceName = resourceName;
    this.config = {
      ...defaultBulkSafetyConfigs[operationType],
      ...customConfig,
    };
  }

  /**
   * Validates bulk operation safety and throws errors if unsafe
   */
  validateSafety(
    affectedCount: number,
    isPreview = false,
    hasConfirmation = false,
  ): void {
    const {
      maxWithoutPreview,
      absoluteMax,
      requireConfirmation,
      safetyMessage,
    } = this.config;

    // Check absolute maximum
    if (affectedCount > absoluteMax) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Operation affects ${affectedCount} records, which exceeds the absolute maximum of ${absoluteMax} for ${this.operationType} operations on ${this.resourceName}.`,
        cause: {
          affectedCount,
          absoluteMax,
          operationType: this.operationType,
          resourceName: this.resourceName,
        },
      });
    }

    // Check if preview is required
    if (affectedCount > maxWithoutPreview && !isPreview) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Operation affects ${affectedCount} records, which exceeds the safe limit of ${maxWithoutPreview}. Use preview mode first to review the operation.`,
        cause: {
          affectedCount,
          maxWithoutPreview,
          requirePreview: true,
          operationType: this.operationType,
          resourceName: this.resourceName,
        },
      });
    }

    // Check if confirmation is required for destructive operations
    if (requireConfirmation && !hasConfirmation && !isPreview) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${safetyMessage || `This ${this.operationType} operation`} requires explicit confirmation due to its destructive nature.`,
        cause: {
          affectedCount,
          requireConfirmation: true,
          operationType: this.operationType,
          resourceName: this.resourceName,
        },
      });
    }
  }

  /**
   * Gets safety status for an operation
   */
  getSafetyStatus(affectedCount: number): BulkPreviewResult["safetyStatus"] {
    const { maxWithoutPreview, absoluteMax, warningThreshold } = this.config;

    if (affectedCount > absoluteMax) {
      return "blocked";
    }
    if (affectedCount > maxWithoutPreview) {
      return "dangerous";
    }
    if (affectedCount > warningThreshold) {
      return "warning";
    }
    return "safe";
  }

  /**
   * Generates warnings for bulk operations
   */
  generateWarnings(affectedCount: number): string[] {
    const warnings: string[] = [];
    const {
      maxWithoutPreview,
      warningThreshold,
      requireConfirmation,
      safetyMessage,
    } = this.config;

    if (affectedCount > maxWithoutPreview) {
      warnings.push(
        `High impact operation: ${affectedCount} records will be affected`,
      );
    }

    if (affectedCount > warningThreshold) {
      warnings.push(
        `This operation will modify a significant number of ${this.resourceName} records`,
      );
    }

    if (requireConfirmation) {
      warnings.push(
        safetyMessage ||
          `This ${this.operationType} operation has permanent effects`,
      );
    }

    if (this.operationType === "delete") {
      warnings.push("Deleted records cannot be recovered");
    }

    if (affectedCount > 500) {
      warnings.push("Large operations may take several minutes to complete");
    }

    return warnings;
  }

  /**
   * Estimates operation duration
   */
  estimateDuration(
    affectedCount: number,
  ): BulkPreviewResult["estimatedDuration"] {
    // Rough estimates based on operation type and count
    const baseTimePerRecord = {
      update: 0.01, // 10ms per record
      delete: 0.005, // 5ms per record (soft delete)
      archive: 0.008,
      restore: 0.008,
      status_change: 0.005,
      assignment: 0.01,
      custom: 0.015,
    };

    const timePerRecord = baseTimePerRecord[this.operationType];
    const totalSeconds = Math.ceil(affectedCount * timePerRecord);

    let message: string;
    if (totalSeconds < 10) {
      message = "Less than 10 seconds";
    } else if (totalSeconds < 60) {
      message = `Approximately ${totalSeconds} seconds`;
    } else {
      const minutes = Math.ceil(totalSeconds / 60);
      message = `Approximately ${minutes} minute${minutes > 1 ? "s" : ""}`;
    }

    return { seconds: totalSeconds, message };
  }
}

// ================================
// Bulk Operation Utilities
// ================================

/**
 * Counts records that would be affected by bulk selection criteria
 */
export async function countAffectedRecords<TTable extends PgTable>(
  db: TRPCContext["db"],
  table: TTable,
  selection: BulkSelectionCriteria,
  baseConditions: any[] = [],
): Promise<number> {
  const conditions = [...baseConditions];

  // Apply selection criteria
  if (selection.ids && selection.ids.length > 0) {
    conditions.push(inArray((table as any).id, selection.ids));
  } else if (selection.filter) {
    // Apply filter conditions
    for (const [key, value] of Object.entries(selection.filter)) {
      if (value !== undefined && (table as any)[key]) {
        if (Array.isArray(value)) {
          conditions.push(inArray((table as any)[key], value));
        } else {
          conditions.push(eq((table as any)[key], value));
        }
      }
    }
  }
  // For "all" selection, use only base conditions

  // Exclude specific IDs if provided
  if (selection.excludeIds && selection.excludeIds.length > 0) {
    conditions.push(not(inArray((table as any).id, selection.excludeIds)));
  }

  try {
    const result = await db
      .select({ count: count() })
      .from(table as any)
      .where(and(...conditions));

    return result[0].count;
  } catch (error) {
    console.error("Error counting affected records:", error);
    return 0;
  }
}

/**
 * Gets sample records for preview
 */
export async function getSampleRecords<TTable extends PgTable>(
  db: TRPCContext["db"],
  table: TTable,
  selection: BulkSelectionCriteria,
  baseConditions: any[] = [],
  sampleSize = 10,
): Promise<any[]> {
  const conditions = [...baseConditions];

  // Apply same selection criteria as count
  if (selection.ids && selection.ids.length > 0) {
    conditions.push(inArray((table as any).id, selection.ids));
  } else if (selection.filter) {
    for (const [key, value] of Object.entries(selection.filter)) {
      if (value !== undefined && (table as any)[key]) {
        if (Array.isArray(value)) {
          conditions.push(inArray((table as any)[key], value));
        } else {
          conditions.push(eq((table as any)[key], value));
        }
      }
    }
  }

  if (selection.excludeIds && selection.excludeIds.length > 0) {
    conditions.push(not(inArray((table as any).id, selection.excludeIds)));
  }

  try {
    const results = await db
      .select()
      .from(table as any)
      .where(and(...conditions))
      .limit(sampleSize);

    return results;
  } catch (error) {
    console.error("Error getting sample records:", error);
    return [];
  }
}

/**
 * Creates a comprehensive bulk operation preview
 */
export async function createBulkPreview<TTable extends PgTable>(
  db: TRPCContext["db"],
  table: TTable,
  selection: BulkSelectionCriteria,
  operationType: BulkOperationType,
  resourceName: string,
  baseConditions: any[] = [],
  customSafetyConfig?: Partial<BulkSafetyConfig>,
): Promise<BulkPreviewResult> {
  const validator = new BulkSafetyValidator(
    operationType,
    resourceName,
    customSafetyConfig,
  );

  // Count affected records
  const affectedCount = await countAffectedRecords(
    db,
    table,
    selection,
    baseConditions,
  );

  // Get sample records
  const sampleRecords = await getSampleRecords(
    db,
    table,
    selection,
    baseConditions,
    10,
  );

  // Generate safety information
  const safetyStatus = validator.getSafetyStatus(affectedCount);
  const warnings = validator.generateWarnings(affectedCount);
  const estimatedDuration = validator.estimateDuration(affectedCount);

  const safetyInfo = {
    withinSafeLimit: affectedCount <= validator.config.maxWithoutPreview,
    withinAbsoluteLimit: affectedCount <= validator.config.absoluteMax,
    warningTriggered: affectedCount > validator.config.warningThreshold,
    safetyMessage: validator.config.safetyMessage,
  };

  return {
    affectedCount,
    sampleRecords,
    warnings,
    requiresConfirmation: validator.config.requireConfirmation,
    safetyStatus,
    safetyInfo,
    estimatedDuration,
  };
}

// ================================
// Input Validation Schemas
// ================================

/**
 * Schema for bulk selection criteria
 */
export const bulkSelectionSchema = z
  .object({
    ids: z.array(z.string().uuid()).optional(),
    filter: z.record(z.any()).optional(),
    all: z.boolean().optional(),
    excludeIds: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) => {
      // Ensure at least one selection method is provided
      return data.ids || data.filter || data.all;
    },
    {
      message:
        "Must provide either 'ids', 'filter', or 'all' for bulk selection",
    },
  );

/**
 * Schema for bulk operation safety options
 */
export const bulkSafetyOptionsSchema = z.object({
  preview: z.boolean().default(false),
  confirmed: z.boolean().default(false),
  skipSafetyChecks: z.boolean().default(false), // Admin override
});

/**
 * Creates a complete bulk operation input schema
 */
export function createBulkOperationSchema<TDataSchema extends z.ZodTypeAny>(
  dataSchema: TDataSchema,
) {
  return z.object({
    selection: bulkSelectionSchema,
    data: dataSchema,
    options: bulkSafetyOptionsSchema.optional(),
  });
}

// ================================
// Export utilities for backwards compatibility
// ================================

/**
 * Legacy bulk validation function (backwards compatible)
 */
export function validateBulkOperation(
  affectedCount: number,
  preview = false,
  operationType: BulkOperationType = "update",
  resourceName = "records",
): void {
  const validator = new BulkSafetyValidator(operationType, resourceName);
  validator.validateSafety(affectedCount, preview);
}

/**
 * Quick safety check function
 */
export function checkBulkSafety(
  affectedCount: number,
  operationType: BulkOperationType = "update",
): { safe: boolean; requiresPreview: boolean; message?: string } {
  const config = defaultBulkSafetyConfigs[operationType];

  if (affectedCount > config.absoluteMax) {
    return {
      safe: false,
      requiresPreview: false,
      message: `Operation affects ${affectedCount} records, exceeding the absolute limit of ${config.absoluteMax}`,
    };
  }

  if (affectedCount > config.maxWithoutPreview) {
    return {
      safe: false,
      requiresPreview: true,
      message: `Operation affects ${affectedCount} records, requires preview mode`,
    };
  }

  return { safe: true, requiresPreview: false };
}
