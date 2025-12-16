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

