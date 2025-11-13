/**
 * Validation schemas for centralized bulk operations.
 *
 * These schemas back the `bulk.*` domain in the v2 router, ensuring each
 * mutation performs strict input validation before touching the database.
 * Only domain-specific fields are permitted to flow through to the handlers.
 */
import { z } from "zod";
import { uuidArraySchema, uuidSchema } from "./_shared/primitives.js";
import { passportStatusSchema } from "./passports.js";
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
 * Permitted passport mutations for bulk updates.
 *
 * The schema ensures at least one change is supplied.
 */
export const bulkUpdatePassportsChangesSchema = z
  .object({
    status: passportStatusSchema.optional(),
  })
  .refine((value) => value.status !== undefined, {
    message: "Provide at least one passport field to update.",
    path: ["status"],
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
    domain: z.literal("passports"),
    selection: bulkSelectionSchema,
    changes: bulkUpdatePassportsChangesSchema,
  }),
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
 * Schema for validating import files before processing
 *
 * Used in bulk.validateImport mutation to perform quick pre-validation
 * checks on uploaded CSV/XLSX files.
 */
export const validateImportSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  filename: z
    .string()
    .min(1, "Filename is required")
    .regex(/\.(csv|xlsx|xls)$/i, "File must be CSV or Excel format"),
});

/**
 * Schema for starting an import job
 *
 * Used in bulk.startImport mutation to trigger Phase 1 validation
 * and staging background job.
 */
export const startImportSchema = z.object({
  fileId: z.string().min(1, "File ID is required"),
  filename: z
    .string()
    .min(1, "Filename is required")
    .regex(/\.(csv|xlsx|xls)$/i, "File must be CSV or Excel format"),
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
 */
export const importJobStatusSchema = z.enum([
  "PENDING",
  "VALIDATING",
  "VALIDATED",
  "COMMITTING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

/**
 * Schema for retrieving staging preview with pagination
 *
 * Used in bulk.getStagingPreview query to preview validated
 * staging data before final approval.
 */
export const getStagingPreviewSchema = z.object({
  jobId: uuidSchema,
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
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
 * Entity data schemas for value definition
 */
const defineColorDataSchema = z.object({
  name: z.string().min(1).max(100),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be valid hex color").optional(),
});

const defineSizeDataSchema = z.object({
  name: z.string().min(1).max(100),
  categoryId: uuidSchema.optional(),
  sortIndex: z.number().int().nonnegative().optional(),
});

const defineMaterialDataSchema = z.object({
  name: z.string().min(1).max(100),
  countryOfOrigin: z
    .string()
    .regex(/^[A-Z]{2}$/, "Must be 2-letter ISO country code")
    .optional(),
  recyclable: z.boolean().optional(),
  certificationId: uuidSchema.optional(),
  // Inline certification details (when creating material with certification)
  certificationTitle: z.string().max(200).optional(),
  certificationCode: z.string().optional(),
  certificationNumber: z.string().optional(),
  certificationExpiryDate: z.string().datetime().optional(),
});

const defineEcoClaimDataSchema = z.object({
  claim: z.string().min(1).max(500),
});

const defineFacilityDataSchema = z.object({
  displayName: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/, "Must be 2-letter ISO country code")
    .optional(),
  contact: z.string().optional(),
  vatNumber: z.string().optional(),
});

const defineShowcaseBrandDataSchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  website: z.string().url().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/, "Must be 2-letter ISO country code")
    .optional(),
});

const defineCertificationDataSchema = z.object({
  title: z.string().min(1).max(200),
  certificationCode: z.string().optional(),
  instituteName: z.string().optional(),
  instituteAddress: z.string().optional(),
  instituteContact: z.string().optional(),
  issueDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  externalUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

const defineSeasonDataSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isOngoing: z.boolean().optional(),
});

const defineCategoryDataSchema = z.object({
  // Categories are read-only hardcoded, no creation schema needed
  // This exists for type completeness
  id: uuidSchema,
});

const defineTagDataSchema = z.object({
  name: z.string().min(1).max(100),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be valid hex color").optional(),
});

const defineOperatorDataSchema = z.object({
  name: z.string().min(1).max(200),
  legalName: z.string().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/, "Must be 2-letter ISO country code")
    .optional(),
});

/**
 * Entity type enum for value definition
 */
export const entityTypeSchema = z.enum([
  "MATERIAL",
  "COLOR",
  "SIZE",
  "ECO_CLAIM",
  "FACILITY",
  "OPERATOR",
  "SHOWCASE_BRAND",
  "CERTIFICATION",
  "SEASON",
  "CATEGORY",
  "TAG",
]);

/**
 * Schema for defining a single value inline
 *
 * Used in bulk.defineValue mutation to create new catalog entities
 * during the import review process.
 */
export const defineValueSchema = z.object({
  jobId: uuidSchema,
  entityType: entityTypeSchema,
  rawValue: z.string().min(1),
  sourceColumn: z.string().min(1),
  entityData: z.union([
    defineColorDataSchema,
    defineSizeDataSchema,
    defineMaterialDataSchema,
    defineEcoClaimDataSchema,
    defineFacilityDataSchema,
    defineOperatorDataSchema,
    defineShowcaseBrandDataSchema,
    defineCertificationDataSchema,
    defineSeasonDataSchema,
    defineCategoryDataSchema,
    defineTagDataSchema,
  ]),
});

/**
 * Schema for batch defining multiple values
 *
 * Used in bulk.batchDefineValues mutation to create multiple
 * catalog entities at once.
 */
export const batchDefineValuesSchema = z.object({
  jobId: uuidSchema,
  values: z
    .array(
      z.object({
        entityType: entityTypeSchema,
        rawValue: z.string().min(1),
        sourceColumn: z.string().min(1),
        entityData: z.union([
          defineColorDataSchema,
          defineSizeDataSchema,
          defineMaterialDataSchema,
          defineEcoClaimDataSchema,
          defineFacilityDataSchema,
          defineOperatorDataSchema,
          defineShowcaseBrandDataSchema,
          defineCertificationDataSchema,
          defineSeasonDataSchema,
          defineCategoryDataSchema,
          defineTagDataSchema,
        ]),
      }),
    )
    .min(1),
});

/**
 * Schema for mapping CSV value to existing entity
 *
 * Used in bulk.values.mapToExisting mutation to map unmapped CSV values
 * to existing catalog entities instead of creating new ones.
 */
export const mapToExistingEntitySchema = z.object({
  jobId: uuidSchema,
  entityType: entityTypeSchema,
  rawValue: z.string().min(1),
  sourceColumn: z.string().min(1),
  entityId: uuidSchema,
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
 * Schema for approving an import job
 *
 * Used in bulk.approveImport mutation to trigger Phase 2 (production commit)
 * after user has reviewed and approved the staging data.
 */
export const approveImportSchema = z.object({
  jobId: uuidSchema,
});

/**
 * Schema for cancelling an import job
 *
 * Used in bulk.cancelImport mutation to discard staging data
 * and mark the job as CANCELLED.
 */
export const cancelImportSchema = z.object({
  jobId: uuidSchema,
});

export type BulkSelectionInput = z.infer<typeof bulkSelectionSchema>;
export type BulkImportInput = z.infer<typeof bulkImportSchema>;
export type BulkUpdateInput = z.infer<typeof bulkUpdateSchema>;
export type ValidateImportInput = z.infer<typeof validateImportSchema>;
export type StartImportInput = z.infer<typeof startImportSchema>;
export type GetImportStatusInput = z.infer<typeof getImportStatusSchema>;
export type GetImportErrorsInput = z.infer<typeof getImportErrorsSchema>;
export type GetStagingPreviewInput = z.infer<typeof getStagingPreviewSchema>;
export type GetUnmappedValuesInput = z.infer<typeof getUnmappedValuesSchema>;
export type DefineValueInput = z.infer<typeof defineValueSchema>;
export type BatchDefineValuesInput = z.infer<typeof batchDefineValuesSchema>;
export type ExportFailedRowsInput = z.infer<typeof exportFailedRowsSchema>;
export type ApproveImportInput = z.infer<typeof approveImportSchema>;
export type CancelImportInput = z.infer<typeof cancelImportSchema>;
export type ImportJobStatus = z.infer<typeof importJobStatusSchema>;
export type EntityType = z.infer<typeof entityTypeSchema>;
