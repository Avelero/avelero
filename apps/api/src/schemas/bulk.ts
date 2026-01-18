/**
 * Validation schemas for centralized bulk operations.
 *
 * These schemas back the `bulk.*` domain in the v2 router, ensuring each
 * mutation performs strict input validation before touching the database.
 * Only domain-specific fields are permitted to flow through to the handlers.
 */
import { z } from "zod";
import { uuidArraySchema, uuidSchema } from "./_shared/primitives.js";
import { productsDomainCreateSchema } from "./products.js";

/**
 * Common selection strategies supported by bulk mutations.
 *
 * - `mode: "all"`: operate on the full set within the active brand, optionally
 *   excluding a subset of IDs.
 * - `mode: "explicit"`: operate on an explicit list of identifiers.
 */
export const bulkSelectionSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("all"),
    excludeIds: uuidArraySchema.optional(),
  }),
  z.object({
    mode: z.literal("explicit"),
    includeIds: uuidArraySchema.min(1),
  }),
]);

/**
 * Payload structure for importing products in bulk.
 *
 * `domain` is intentionally restricted to `"products"` so the router can
 * dispatch to the appropriate handler without additional guards.
 */
export const bulkImportSchema = z.object({
  brand_id: uuidSchema,
  domain: z.literal("products"),
  items: productsDomainCreateSchema.omit({ brand_id: true }).array().min(1),
});

/**
 * Placeholder schema for future product bulk updates.
 *
 * The router currently only supports passport updates, but accepting a typed
 * payload keeps the contract forward-compatible.
 */
export const bulkUpdateProductsChangesSchema = z
  .object({})
  .catchall(z.unknown())
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one product field to update.",
        path: [],
      });
    }
  });

/**
 * Placeholder schema for future brand catalog bulk updates.
 *
 * Accepts arbitrary keys for now while requiring a non-empty object.
 */
export const bulkUpdateBrandChangesSchema = z
  .object({})
  .catchall(z.unknown())
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one brand field to update.",
        path: [],
      });
    }
  });

/**
 * Bulk update payload discriminated by domain.
 *
 * Each domain reuses the common selection schema but constrains its `changes`
 * payload to domain-appropriate fields.
 */
export const bulkUpdateSchema = z.discriminatedUnion("domain", [
  z.object({
    domain: z.literal("products"),
    selection: bulkSelectionSchema,
    changes: bulkUpdateProductsChangesSchema,
  }),
  z.object({
    domain: z.literal("brand"),
    selection: bulkSelectionSchema,
    changes: bulkUpdateBrandChangesSchema,
  }),
]);

/**
 * Import mode enum
 *
 * - CREATE: Create new products where handle doesn't exist. Products with matching handles are SKIPPED.
 * - CREATE_AND_ENRICH: Create new products AND update/enrich existing products with matching handles.
 *   Products are matched by product_handle, variants are matched by UPID for enrichment.
 *   Enrichment uses one-way merge: Excel values fill empty fields, Excel wins on conflicts.
 */
export const importModeSchema = z.enum(["CREATE", "CREATE_AND_ENRICH"]);

/**
 * Schema for starting an import job
 *
 * Used in bulk.startImport mutation to trigger background validation
 * and auto-commit job. Now includes mode selection for CREATE vs ENRICH.
 */
export const startImportSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  filename: z
    .string()
    .min(1, "Filename is required")
    .regex(/\.(xlsx|xls)$/i, "File must be Excel format (.xlsx or .xls)"),
  mode: importModeSchema,
});

/**
 * Schema for previewing import file contents
 *
 * Used in bulk.import.preview query to parse the uploaded Excel file
 * and return summary statistics and first product preview before import.
 */
export const previewImportSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  filename: z
    .string()
    .min(1, "Filename is required")
    .regex(/\.(xlsx|xls)$/i, "File must be Excel format (.xlsx or .xls)"),
});

/**
 * Schema for retrieving import job status
 *
 * Used in bulk.getImportStatus query to fetch current job progress
 * and status information.
 */
export const getImportStatusSchema = z.object({
  jobId: uuidSchema,
});

/**
 * Schema for retrieving import errors with pagination
 *
 * Used in bulk.getImportErrors query to fetch detailed error
 * information for failed rows in an import job.
 */
export const getImportErrorsSchema = z.object({
  jobId: uuidSchema,
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
});

/**
 * Import job status enum values
 *
 * Updated for fire-and-forget flow:
 * - PENDING: Job created, awaiting background processing
 * - PROCESSING: Background job actively running (replaces VALIDATING/COMMITTING)
 * - COMPLETED: All rows imported successfully
 * - COMPLETED_WITH_FAILURES: Some rows imported, some failed
 * - FAILED: Job itself failed (system error)
 *
 * @deprecated statuses: VALIDATING, VALIDATED, COMMITTING, CANCELLED
 * These are kept for backward compatibility with existing jobs but
 * new imports will use the simplified status flow.
 */
export const importJobStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "COMPLETED_WITH_FAILURES",
  "FAILED",
  // Legacy statuses (kept for backward compatibility)
  "VALIDATING",
  "VALIDATED",
  "COMMITTING",
  "CANCELLED",
]);

/**
 * Staging row status enum for filtering
 *
 * Used to filter staging preview by row status:
 * - PENDING: Row awaiting commit
 * - COMMITTED: Row successfully committed to production
 * - FAILED: Row failed validation/commit
 */
export const stagingRowStatusSchema = z.enum([
  "PENDING",
  "COMMITTED",
  "FAILED",
]);

/**
 * Schema for retrieving staging preview with pagination
 *
 * Used in bulk.getStagingPreview query to preview validated
 * staging data. Now includes optional status filter.
 */
export const getStagingPreviewSchema = z.object({
  jobId: uuidSchema,
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
  /** Optional filter by row status (PENDING, COMMITTED, FAILED) */
  status: stagingRowStatusSchema.optional(),
});

/**
 * Schema for retrieving unmapped values needing definition
 *
 * Used in bulk.getUnmappedValues query to get list of CSV values
 * that don't have corresponding database entities.
 */
export const getUnmappedValuesSchema = z.object({
  jobId: uuidSchema,
});

/**
 * Schema for exporting failed rows as CSV
 *
 * Used in bulk.exportFailedRows query to generate downloadable
 * CSV file with error details.
 */
export const exportFailedRowsSchema = z.object({
  jobId: uuidSchema,
});

/**
 * Schema for dismissing a failed import
 *
 * Used in bulk.dismiss mutation to cleanup staging data
 * for a failed import and remove it from the recent imports list.
 */
export const dismissFailedImportSchema = z.object({
  jobId: uuidSchema,
});

/**
 * Schema for exporting correction Excel file
 *
 * Used in bulk.exportCorrections mutation to generate an Excel file
 * with failed rows highlighted in red for user correction.
 */
export const exportCorrectionsSchema = z.object({
  jobId: uuidSchema,
});

/**
 * Schema for retrieving recent import jobs
 *
 * Used in bulk.getRecentImports query to fetch the last N import jobs
 * for display in the import modal.
 */
export const getRecentImportsSchema = z.object({
  limit: z.number().int().min(1).max(10).default(5),
});

// stagingRowStatusSchema is now defined earlier in this file (before getStagingPreviewSchema)

// ============================================================================
// Export Schemas
// ============================================================================

/**
 * Schema for starting a product export
 *
 * Uses the same selection schema as bulk operations.
 * Preserves filter state and search query to ensure
 * export matches what user sees on screen.
 */
export const startExportSchema = z.object({
  selection: bulkSelectionSchema,
  filterState: z.any().optional(), // preserve current filter state (JSON)
  search: z.string().optional(), // preserve current search query
});

/**
 * Schema for getting export job status
 */
export const getExportStatusSchema = z.object({
  jobId: uuidSchema,
});

/**
 * Export job status enum
 */
export const exportJobStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
]);

// Export types
type StartExportInput = z.infer<typeof startExportSchema>;
type GetExportStatusInput = z.infer<typeof getExportStatusSchema>;
type ExportJobStatus = z.infer<typeof exportJobStatusSchema>;

type BulkSelectionInput = z.infer<typeof bulkSelectionSchema>;
type BulkImportInput = z.infer<typeof bulkImportSchema>;
type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
type StartImportInput = z.infer<typeof startImportSchema>;
type PreviewImportInput = z.infer<typeof previewImportSchema>;
type GetImportStatusInput = z.infer<typeof getImportStatusSchema>;
type GetImportErrorsInput = z.infer<typeof getImportErrorsSchema>;
type GetStagingPreviewInput = z.infer<typeof getStagingPreviewSchema>;
type GetUnmappedValuesInput = z.infer<typeof getUnmappedValuesSchema>;
type ExportFailedRowsInput = z.infer<typeof exportFailedRowsSchema>;
type ImportJobStatus = z.infer<typeof importJobStatusSchema>;

// New types for fire-and-forget flow
type ImportMode = z.infer<typeof importModeSchema>;
type DismissFailedImportInput = z.infer<
  typeof dismissFailedImportSchema
>;
type ExportCorrectionsInput = z.infer<typeof exportCorrectionsSchema>;
type GetRecentImportsInput = z.infer<typeof getRecentImportsSchema>;
type StagingRowStatus = z.infer<typeof stagingRowStatusSchema>;
