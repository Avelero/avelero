/**
 * Shared types for import operations.
 */

/**
 * Import job creation parameters
 */
export interface CreateImportJobParams {
  brandId: string;
  filename: string;
  status?: string;
  /** Import mode: CREATE for new products (skips existing), CREATE_AND_ENRICH to also update existing */
  mode?: "CREATE" | "CREATE_AND_ENRICH";
  /** User ID who started the import (for email notifications) */
  userId?: string;
  /** Email address for notifications */
  userEmail?: string;
}

/**
 * Import job status update parameters
 */
export interface UpdateImportJobStatusParams {
  jobId: string;
  status: string;
  finishedAt?: string;
  commitStartedAt?: string;
  summary?: Record<string, unknown>;
}

/**
 * Import job progress update parameters
 */
export interface UpdateImportJobProgressParams {
  jobId: string;
  summary: Record<string, unknown>;
}

/**
 * Import job status response
 */
export interface ImportJobStatus {
  id: string;
  brandId: string;
  filename: string;
  startedAt: string;
  finishedAt: string | null;
  commitStartedAt: string | null;
  status: string;
  requiresValueApproval: boolean;
  summary: Record<string, unknown> | null;
  /** Import mode: CREATE for new products, ENRICH to update existing */
  mode: string;
  /** Whether the job has failed rows that can be exported for correction */
  hasExportableFailures: boolean;
  /** Path to the generated correction Excel file in storage */
  correctionFilePath: string | null;
  /** Signed download URL for the correction file */
  correctionDownloadUrl: string | null;
  /** When the correction download URL expires */
  correctionExpiresAt: string | null;
  /** User ID who started the import */
  userId: string | null;
  /** Email address for notifications */
  userEmail: string | null;
}

/**
 * Parameters for updating correction file info on an import job
 */
export interface UpdateImportJobCorrectionFileParams {
  jobId: string;
  correctionFilePath: string;
  correctionDownloadUrl: string;
  correctionExpiresAt: string;
}

/**
 * Import row creation parameters
 */
export interface CreateImportRowParams {
  jobId: string;
  rowNumber: number;
  raw: Record<string, unknown>;
  normalized?: Record<string, unknown> | null;
  status?: string;
}

/**
 * Import row status update parameters
 */
export interface UpdateImportRowStatusParams {
  id: string;
  status: string;
  normalized?: Record<string, unknown> | null;
  error?: string | null;
}

/**
 * Import error record
 */
export interface ImportError {
  id: string;
  jobId: string;
  rowNumber: number;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown> | null;
  error: string | null;
  status: string;
  createdAt: string;
}

/**
 * Failed row export data
 */
export interface FailedRowExport {
  rowNumber: number;
  raw: Record<string, unknown>;
  error: string | null;
}

/**
 * Unmapped value information
 */
export interface UnmappedValue {
  rawValue: string;
  sourceColumn: string;
  affectedRows: number;
  isDefined: boolean;
}

/**
 * Unmapped values grouped by entity type
 */
export interface UnmappedValuesResponse {
  entityType: string;
  values: UnmappedValue[];
}









