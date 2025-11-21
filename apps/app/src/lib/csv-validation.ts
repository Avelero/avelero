/**
 * Client-Side CSV Validation Utilities
 *
 * Fast, lightweight validation that runs in the browser before uploading.
 * Only parses the first few rows to check structure - no full file loading.
 */

import Papa from "papaparse";

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"] as const;
const SAMPLE_ROWS = 2; // Only read header + 1 data row for validation

export interface ValidationError {
  type: "FILE_SIZE" | "FILE_FORMAT" | "MISSING_COLUMNS" | "PARSE_ERROR";
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  summary?: {
    filename: string;
    fileSize: number;
    headers: string[];
    hasUpid: boolean;
    hasProductIdentifier: boolean;
  };
}

/**
 * Validate file metadata (size, format)
 */
function validateFileMetadata(file: File): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    errors.push({
      type: "FILE_SIZE",
      message: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    });
  }

  // Check file extension
  const fileExtension = file.name
    .toLowerCase()
    .slice(file.name.lastIndexOf("."));
  if (
    !ALLOWED_EXTENSIONS.includes(
      fileExtension as (typeof ALLOWED_EXTENSIONS)[number],
    )
  ) {
    errors.push({
      type: "FILE_FORMAT",
      message: `Invalid file extension: ${fileExtension}. Allowed extensions: .csv, .xlsx, .xls`,
    });
  }

  return errors;
}

/**
 * Parse only the first few rows of a CSV file to validate structure
 * This is much faster than parsing the entire file
 */
async function parseCSVHeaders(file: File): Promise<{
  headers: string[];
  error?: string;
}> {
  return new Promise((resolve, reject) => {
    let rowCount = 0;
    let headers: string[] = [];
    let resolved = false;

    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          headers: [],
          error: "CSV parsing timed out after 10 seconds",
        });
      }
    }, 10000);

    try {
      Papa.parse(file, {
        header: true,
        preview: SAMPLE_ROWS, // Only parse first N rows
        skipEmptyLines: true,
        step: (results) => {
          // Get headers from first row
          if (rowCount === 0 && results.meta.fields) {
            headers = results.meta.fields;
          }
          rowCount++;
        },
        complete: () => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve({ headers });
          }
        },
        error: (error) => {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve({
              headers: [],
              error: `Failed to parse CSV: ${error.message}`,
            });
          }
        },
      });
    } catch (error) {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        resolve({
          headers: [],
          error:
            error instanceof Error ? error.message : "Unknown parsing error",
        });
      }
    }
  });
}

/**
 * Normalize header names to lowercase and remove special characters
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Check if required headers are present
 */
function validateHeaders(headers: string[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const normalizedHeaders = headers.map(normalizeHeader);

  const hasProductName = normalizedHeaders.includes("product_name");
  const hasProductIdentifier = normalizedHeaders.includes("product_identifier");

  if (!hasProductName) {
    errors.push({
      type: "MISSING_COLUMNS",
      message: "Missing required column: 'product_name'",
    });
  }

  if (!hasProductIdentifier) {
    errors.push({
      type: "MISSING_COLUMNS",
      message: "Missing required column: 'product_identifier'",
    });
  }

  return errors;
}

/**
 * Fast client-side validation of import files
 * Only checks structure, doesn't validate data content
 *
 * @param file - File to validate
 * @returns ValidationResult with errors (if any)
 */
export async function validateImportFile(
  file: File,
): Promise<ValidationResult> {
  // Step 1: Validate file metadata (instant)
  const metadataErrors = validateFileMetadata(file);
  if (metadataErrors.length > 0) {
    return {
      valid: false,
      errors: metadataErrors,
    };
  }

  // Step 2: Check if file is Excel format
  const fileExtension = file.name
    .toLowerCase()
    .slice(file.name.lastIndexOf("."));
  const isExcel = fileExtension === ".xlsx" || fileExtension === ".xls";

  if (isExcel) {
    // For Excel files, skip client-side header parsing
    // Full parsing will happen on the backend
    return {
      valid: true,
      errors: [],
      summary: {
        filename: file.name,
        fileSize: file.size,
        headers: [],
        hasUpid: true, // Assume valid (product_identifier or upid), backend will validate
        hasProductIdentifier: true,
      },
    };
  }

  // For large CSV files (>1MB), skip client validation to avoid hanging
  // The backend will do comprehensive validation anyway
  const isLargeFile = file.size > 1024 * 1024; // 1MB threshold

  if (isLargeFile) {
    console.log(
      "[CSV Validation] Skipping client-side validation for large file (>1MB)",
    );
    return {
      valid: true,
      errors: [],
      summary: {
        filename: file.name,
        fileSize: file.size,
        headers: [],
        hasUpid: true, // Backend will validate
        hasProductIdentifier: true,
      },
    };
  }

  // Step 3: Parse CSV headers only (fast, <100ms even for large files)
  console.log("[CSV Validation] Parsing headers for small CSV file");
  const { headers, error } = await parseCSVHeaders(file);

  if (error) {
    console.error("[CSV Validation] Parse error:", error);
    return {
      valid: false,
      errors: [
        {
          type: "PARSE_ERROR",
          message: error,
        },
      ],
    };
  }

  // Step 4: Validate headers
  const headerErrors = validateHeaders(headers);

  const normalizedHeaders = headers.map(normalizeHeader);
  const hasProductIdentifier = normalizedHeaders.includes("product_identifier");

  return {
    valid: headerErrors.length === 0,
    errors: headerErrors,
    summary: {
      filename: file.name,
      fileSize: file.size,
      headers: headers,
      hasUpid: normalizedHeaders.includes("upid"),
      hasProductIdentifier,
    },
  };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
