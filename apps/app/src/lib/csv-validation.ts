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
    hasSku: boolean;
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
  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ALLOWED_EXTENSIONS.includes(fileExtension as typeof ALLOWED_EXTENSIONS[number])) {
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
  return new Promise((resolve) => {
    let rowCount = 0;
    let headers: string[] = [];
    let resolved = false;

    // Timeout after 10 seconds to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({
          headers: [],
          error: "CSV parsing timed out after 10 seconds"
        });
      }
    }, 10000);

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
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve({ headers });
        }
      },
      error: (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutId);
          resolve({
            headers: [],
            error: `Failed to parse CSV: ${error.message}`
          });
        }
      },
    });
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

  // Check for product_name (required)
  const hasProductName = normalizedHeaders.some(h =>
    h === "product_name" || h === "productname" || h === "name" || h === "product"
  );

  if (!hasProductName) {
    errors.push({
      type: "MISSING_COLUMNS",
      message: "Missing required column: 'product_name' (or 'name', 'product')",
    });
  }

  // Check for UPID or SKU (at least one required)
  const hasUpid = normalizedHeaders.some(h => h === "upid" || h === "product_id");
  const hasSku = normalizedHeaders.some(h => h === "sku");

  if (!hasUpid && !hasSku) {
    errors.push({
      type: "MISSING_COLUMNS",
      message: "Missing required column: either 'upid' or 'sku' must be present",
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
export async function validateImportFile(file: File): Promise<ValidationResult> {
  // Step 1: Validate file metadata (instant)
  const metadataErrors = validateFileMetadata(file);
  if (metadataErrors.length > 0) {
    return {
      valid: false,
      errors: metadataErrors,
    };
  }

  // Step 2: Check if file is Excel format
  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
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
        hasUpid: true, // Assume valid, backend will validate
        hasSku: true,
      },
    };
  }

  // Step 3: Parse CSV headers only (fast, <100ms even for large files)
  const { headers, error } = await parseCSVHeaders(file);

  if (error) {
    return {
      valid: false,
      errors: [{
        type: "PARSE_ERROR",
        message: error,
      }],
    };
  }

  // Step 4: Validate headers
  const headerErrors = validateHeaders(headers);

  const normalizedHeaders = headers.map(normalizeHeader);
  const hasUpid = normalizedHeaders.some(h => h === "upid" || h === "product_id");
  const hasSku = normalizedHeaders.some(h => h === "sku");

  return {
    valid: headerErrors.length === 0,
    errors: headerErrors,
    summary: {
      filename: file.name,
      fileSize: file.size,
      headers: headers,
      hasUpid,
      hasSku,
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
