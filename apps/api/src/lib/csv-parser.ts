/**
 * CSV/XLSX Parser Library
 *
 * Comprehensive file parsing utilities for product import functionality.
 * Supports RFC 4180 compliant CSV parsing, Excel (XLSX/XLS) parsing,
 * encoding detection, header validation, and CSV generation.
 *
 * Features:
 * - RFC 4180 compliant CSV parsing
 * - Excel file support (XLSX, XLS)
 * - Automatic encoding detection (UTF-8, UTF-16, Latin-1)
 * - Header validation and normalization
 * - Duplicate detection
 * - Error handling for corrupted files
 * - CSV generation for exports
 */

import jschardet from "jschardet";
import Papa from "papaparse";
import * as XLSX from "xlsx";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type FileEncoding =
  | "UTF-8"
  | "UTF-16LE"
  | "UTF-16BE"
  | "ISO-8859-1"
  | "windows-1252"
  | "unknown";

export interface ParseResult<T = Record<string, string>> {
  data: T[];
  headers: string[];
  rowCount: number;
  encoding: FileEncoding;
  errors: ParseError[];
}

export interface ParseError {
  row: number;
  column?: string;
  message: string;
  type:
    | "PARSE_ERROR"
    | "VALIDATION_ERROR"
    | "ENCODING_ERROR"
    | "STRUCTURE_ERROR";
}

export interface ValidationResult {
  valid: boolean;
  errors: ParseError[];
  warnings: ValidationWarning[];
}

export interface ValidationWarning {
  type: "UNKNOWN_COLUMN" | "EMPTY_COLUMN" | "MISSING_OPTIONAL";
  column: string;
  message: string;
}

export interface HeaderValidationOptions {
  requiredHeaders: string[];
  optionalHeaders?: string[];
  allowUnknownHeaders?: boolean;
  caseSensitive?: boolean;
}

export interface CSVParseOptions {
  skipEmptyLines?: boolean;
  trimValues?: boolean;
  detectEncoding?: boolean;
  encoding?: FileEncoding;
}

export interface CSVGenerateOptions {
  headers?: string[];
  delimiter?: string;
  quotes?: boolean | "auto";
  newline?: "\n" | "\r\n";
}

// ============================================================================
// Constants
// ============================================================================

const MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
const BOM_UTF8 = "\uFEFF";
const BOM_UTF16LE = "\xFF\xFE";
const BOM_UTF16BE = "\xFE\xFF";

// Common header variations mapping
const HEADER_ALIASES: Record<string, string[]> = {
  product_name: ["productname", "name", "product", "title"],
  upid: ["upid", "product_id", "productid", "unique_id"],
  sku: ["sku", "stock_keeping_unit", "product_sku"],
  description: ["description", "desc", "product_description"],
  category_name: ["category", "categoryname", "product_category"],
  color_name: ["color", "colour", "colorname", "colourname"],
  size_name: ["size", "sizename", "product_size"],
};

// ============================================================================
// Subtask 4.3: Encoding Detection
// ============================================================================

/**
 * Detect the character encoding of a file buffer
 *
 * Uses byte order marks (BOM) detection first, then falls back to
 * statistical analysis using jschardet library.
 *
 * @param buffer - File buffer to analyze
 * @returns Detected encoding type
 *
 * @example
 * ```ts
 * const buffer = await file.arrayBuffer();
 * const encoding = detectEncoding(buffer);
 * console.log(`Detected encoding: ${encoding}`);
 * ```
 */
export function detectEncoding(buffer: ArrayBuffer): FileEncoding {
  const uint8Array = new Uint8Array(buffer);

  // Check for BOM (Byte Order Mark)
  if (uint8Array.length >= 3) {
    // UTF-8 BOM: EF BB BF
    if (
      uint8Array[0] === 0xef &&
      uint8Array[1] === 0xbb &&
      uint8Array[2] === 0xbf
    ) {
      return "UTF-8";
    }
  }

  if (uint8Array.length >= 2) {
    // UTF-16 LE BOM: FF FE
    if (uint8Array[0] === 0xff && uint8Array[1] === 0xfe) {
      return "UTF-16LE";
    }
    // UTF-16 BE BOM: FE FF
    if (uint8Array[0] === 0xfe && uint8Array[1] === 0xff) {
      return "UTF-16BE";
    }
  }

  // Use jschardet for statistical detection
  try {
    const sample = uint8Array.slice(0, Math.min(10000, uint8Array.length));
    const detected = jschardet.detect(Buffer.from(sample));

    if (!detected || !detected.encoding || detected.confidence < 0.5) {
      // Default to UTF-8 if confidence is low
      return "UTF-8";
    }

    const encoding = detected.encoding.toUpperCase();

    // Map jschardet encodings to our enum
    if (encoding.includes("UTF-8")) return "UTF-8";
    if (encoding.includes("UTF-16LE") || encoding === "UTF-16")
      return "UTF-16LE";
    if (encoding.includes("UTF-16BE")) return "UTF-16BE";
    if (encoding.includes("ISO-8859-1") || encoding.includes("LATIN1"))
      return "ISO-8859-1";
    if (encoding.includes("WINDOWS-1252")) return "windows-1252";

    return "UTF-8"; // Default fallback
  } catch (error) {
    console.error("Encoding detection failed:", error);
    return "UTF-8"; // Safe default
  }
}

/**
 * Convert buffer to string with specified encoding
 *
 * @param buffer - File buffer to decode
 * @param encoding - Character encoding to use
 * @returns Decoded string
 */
function decodeBuffer(buffer: ArrayBuffer, encoding: FileEncoding): string {
  const uint8Array = new Uint8Array(buffer);

  // Remove BOM if present
  let startIndex = 0;
  if (
    uint8Array.length >= 3 &&
    uint8Array[0] === 0xef &&
    uint8Array[1] === 0xbb &&
    uint8Array[2] === 0xbf
  ) {
    startIndex = 3; // Skip UTF-8 BOM
  } else if (
    uint8Array.length >= 2 &&
    ((uint8Array[0] === 0xff && uint8Array[1] === 0xfe) ||
      (uint8Array[0] === 0xfe && uint8Array[1] === 0xff))
  ) {
    startIndex = 2; // Skip UTF-16 BOM
  }

  const arrayWithoutBOM = uint8Array.slice(startIndex);

  try {
    // Map our encoding types to TextDecoder compatible names
    const encodingMap: Record<FileEncoding, string> = {
      "UTF-8": "utf-8",
      "UTF-16LE": "utf-16le",
      "UTF-16BE": "utf-16be",
      "ISO-8859-1": "iso-8859-1",
      "windows-1252": "windows-1252",
      unknown: "utf-8",
    };

    const decoderEncoding = encodingMap[encoding] || "utf-8";
    // TextDecoder accepts these encodings - eslint-disable-next-line @typescript-eslint/no-explicit-any
    const decoder = new TextDecoder(decoderEncoding as any);
    return decoder.decode(arrayWithoutBOM);
  } catch (error) {
    // Fallback to UTF-8 if encoding fails
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(arrayWithoutBOM);
  }
}

// ============================================================================
// Subtask 4.4: Header Validation and Normalization
// ============================================================================

/**
 * Normalize a header string to lowercase, trimmed, with underscores
 *
 * @param header - Raw header string
 * @returns Normalized header string
 *
 * @example
 * ```ts
 * normalizeHeader("Product Name") // "product_name"
 * normalizeHeader(" SKU  ") // "sku"
 * ```
 */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/[^\w_]/g, "") // Remove special characters
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_|_$/g, ""); // Remove leading/trailing underscores
}

/**
 * Map a normalized header to its canonical form using aliases
 *
 * @param normalizedHeader - Normalized header string
 * @returns Canonical header name or original if no match
 */
function mapHeaderAlias(normalizedHeader: string | undefined): string {
  if (!normalizedHeader) return "";

  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (normalizedHeader === canonical || aliases.includes(normalizedHeader)) {
      return canonical;
    }
  }
  return normalizedHeader;
}

/**
 * Validate CSV/XLSX headers against expected schema
 *
 * @param headers - Array of header strings from file
 * @param options - Validation options including required headers
 * @returns Validation result with errors and warnings
 *
 * @example
 * ```ts
 * const result = validateHeaders(
 *   ["Product Name", "UPID", "SKU"],
 *   { requiredHeaders: ["product_name", "upid"] }
 * );
 *
 * if (!result.valid) {
 *   console.error("Missing headers:", result.errors);
 * }
 * ```
 */
export function validateHeaders(
  headers: string[],
  options: HeaderValidationOptions,
): ValidationResult {
  const errors: ParseError[] = [];
  const warnings: ValidationWarning[] = [];

  // Normalize headers
  const normalizedHeaders = headers.map(normalizeHeader);
  const mappedHeaders = normalizedHeaders.map(mapHeaderAlias);

  // Check for duplicate headers
  const headerCounts = new Map<string, number>();
  mappedHeaders.forEach((header, index) => {
    const count = headerCounts.get(header) || 0;
    headerCounts.set(header, count + 1);

    if (count > 0) {
      errors.push({
        row: 0,
        column: header,
        message: `Duplicate header: "${headers[index]}" (normalized to "${header}")`,
        type: "VALIDATION_ERROR",
      });
    }
  });

  // Check for required headers
  const missingHeaders: string[] = [];
  for (const required of options.requiredHeaders) {
    if (!mappedHeaders.includes(required)) {
      missingHeaders.push(required);
    }
  }

  if (missingHeaders.length > 0) {
    errors.push({
      row: 0,
      message: `Missing required headers: ${missingHeaders.join(", ")}`,
      type: "VALIDATION_ERROR",
    });
  }

  // Check for unknown headers (if not allowed)
  if (!options.allowUnknownHeaders && options.optionalHeaders) {
    const knownHeaders = new Set([
      ...options.requiredHeaders,
      ...options.optionalHeaders,
    ]);

    mappedHeaders.forEach((header, index) => {
      const originalHeader = headers[index] ?? "";
      if (!knownHeaders.has(header)) {
        warnings.push({
          type: "UNKNOWN_COLUMN",
          column: originalHeader,
          message: `Unknown header: "${originalHeader}" will be ignored`,
        });
      }
    });
  }

  // Check for empty headers
  headers.forEach((header, index) => {
    if (!header.trim()) {
      warnings.push({
        type: "EMPTY_COLUMN",
        column: `Column ${index + 1}`,
        message: `Empty header at column ${index + 1}`,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Normalize all headers in an array and return mapping
 *
 * @param headers - Array of raw header strings
 * @returns Object with normalized headers and original-to-normalized mapping
 */
export function normalizeHeaders(headers: string[]): {
  normalized: string[];
  mapping: Record<string, string>;
} {
  const normalized: string[] = [];
  const mapping: Record<string, string> = {};

  headers.forEach((header) => {
    const safeHeader = header ?? "";
    if (!safeHeader) {
      normalized.push("");
      mapping[safeHeader] = "";
      return;
    }

    const norm = normalizeHeader(safeHeader);
    const mapped = mapHeaderAlias(norm);
    normalized.push(mapped);
    mapping[safeHeader] = mapped;
  });

  return { normalized, mapping };
}

// ============================================================================
// Subtask 4.1: CSV Parsing (RFC 4180 Compliant)
// ============================================================================

/**
 * Parse CSV file with RFC 4180 compliance
 *
 * Handles quoted fields, escaped quotes, newlines within fields,
 * and various delimiters. Uses PapaParse library which fully
 * implements RFC 4180 specification.
 *
 * @param file - File object or Buffer to parse
 * @param options - Parsing options
 * @returns Promise resolving to parsed data with headers and metadata
 *
 * @example
 * ```ts
 * const file = new File([csvData], "products.csv");
 * const result = await parseCSV(file, { trimValues: true });
 *
 * console.log(`Parsed ${result.rowCount} rows`);
 * console.log(`Headers: ${result.headers.join(", ")}`);
 * ```
 */
export async function parseCSV(
  file: File | Buffer,
  options: CSVParseOptions = {},
): Promise<ParseResult> {
  const errors: ParseError[] = [];

  try {
    // Read file content
    let buffer: ArrayBuffer;
    if (file instanceof File) {
      buffer = await file.arrayBuffer();
    } else {
      const slice = file.buffer.slice(
        file.byteOffset,
        file.byteOffset + file.byteLength,
      );
      // Handle SharedArrayBuffer case
      buffer =
        slice instanceof SharedArrayBuffer
          ? new ArrayBuffer(slice.byteLength)
          : (slice as ArrayBuffer);
      if (slice instanceof SharedArrayBuffer) {
        new Uint8Array(buffer).set(new Uint8Array(slice));
      }
    }

    // Detect or use specified encoding
    const encoding =
      options.detectEncoding !== false
        ? detectEncoding(buffer)
        : options.encoding || "UTF-8";

    // Decode to string
    const csvString = decodeBuffer(buffer, encoding);

    // Parse with PapaParse (RFC 4180 compliant) - using callback style for proper typing
    return new Promise<ParseResult>((resolve) => {
      Papa.parse<Record<string, string>>(csvString, {
        header: true,
        skipEmptyLines: options.skipEmptyLines !== false,
        transform: options.trimValues
          ? (value: string) => value.trim()
          : undefined,
        dynamicTyping: false, // Keep all values as strings for validation
        complete: (results: Papa.ParseResult<Record<string, string>>) => {
          // Collect parsing errors
          if (results.errors && results.errors.length > 0) {
            results.errors.forEach((err) => {
              if (err.type === "Quotes") {
                errors.push({
                  row: err.row || 0,
                  message: `Quote mismatch: ${err.message}`,
                  type: "PARSE_ERROR",
                });
              } else if (err.type === "FieldMismatch") {
                errors.push({
                  row: err.row || 0,
                  message: `Field count mismatch: ${err.message}`,
                  type: "STRUCTURE_ERROR",
                });
              } else {
                errors.push({
                  row: err.row || 0,
                  message: err.message,
                  type: "PARSE_ERROR",
                });
              }
            });
          }

          resolve({
            data: results.data || [],
            headers: results.meta.fields || [],
            rowCount: (results.data || []).length,
            encoding,
            errors,
          });
        },
      });
    });
  } catch (error) {
    errors.push({
      row: 0,
      message: error instanceof Error ? error.message : "Unknown parsing error",
      type: "PARSE_ERROR",
    });

    return {
      data: [],
      headers: [],
      rowCount: 0,
      encoding: "UTF-8",
      errors,
    };
  }
}

// ============================================================================
// Subtask 4.2: XLSX Parsing
// ============================================================================

/**
 * Parse Excel file (XLSX/XLS format)
 *
 * Supports both .xlsx and .xls formats, handles multiple worksheets,
 * and converts data to CSV-compatible format.
 *
 * @param file - File object or Buffer to parse
 * @param sheetIndex - Index of worksheet to parse (default: 0)
 * @returns Promise resolving to parsed data
 *
 * @example
 * ```ts
 * const file = new File([xlsxData], "products.xlsx");
 * const result = await parseXLSX(file);
 *
 * console.log(`Parsed ${result.rowCount} rows from Excel`);
 * ```
 */
export async function parseXLSX(
  file: File | Buffer,
  sheetIndex = 0,
): Promise<ParseResult> {
  const errors: ParseError[] = [];

  try {
    // Read file content
    let buffer: ArrayBuffer;
    if (file instanceof File) {
      buffer = await file.arrayBuffer();
    } else {
      const slice = file.buffer.slice(
        file.byteOffset,
        file.byteOffset + file.byteLength,
      );
      // Handle SharedArrayBuffer case
      buffer =
        slice instanceof SharedArrayBuffer
          ? new ArrayBuffer(slice.byteLength)
          : (slice as ArrayBuffer);
      if (slice instanceof SharedArrayBuffer) {
        new Uint8Array(buffer).set(new Uint8Array(slice));
      }
    }

    // Parse workbook
    const workbook = XLSX.read(buffer, { type: "array" });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      errors.push({
        row: 0,
        message: "No worksheets found in Excel file",
        type: "STRUCTURE_ERROR",
      });

      return {
        data: [],
        headers: [],
        rowCount: 0,
        encoding: "UTF-8",
        errors,
      };
    }

    // Get specified sheet (default to first sheet)
    const sheetName = workbook.SheetNames[sheetIndex] ?? workbook.SheetNames[0];
    if (!sheetName) {
      errors.push({
        row: 0,
        message: "No valid worksheet found in Excel file",
        type: "STRUCTURE_ERROR",
      });

      return {
        data: [],
        headers: [],
        rowCount: 0,
        encoding: "UTF-8",
        errors,
      };
    }

    const worksheet = workbook.Sheets[sheetName];

    if (!worksheet) {
      errors.push({
        row: 0,
        message: `Worksheet at index ${sheetIndex} not found`,
        type: "STRUCTURE_ERROR",
      });

      return {
        data: [],
        headers: [],
        rowCount: 0,
        encoding: "UTF-8",
        errors,
      };
    }

    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(
      worksheet,
      {
        raw: false, // Format values as strings
        defval: "", // Default value for empty cells
        blankrows: false, // Skip blank rows
      },
    );

    // Extract headers from first row
    const headers =
      jsonData.length > 0 && jsonData[0] ? Object.keys(jsonData[0]) : [];

    return {
      data: jsonData,
      headers,
      rowCount: jsonData.length,
      encoding: "UTF-8", // Excel files are binary, so encoding doesn't apply
      errors,
    };
  } catch (error) {
    errors.push({
      row: 0,
      message:
        error instanceof Error ? error.message : "Failed to parse Excel file",
      type: "PARSE_ERROR",
    });

    return {
      data: [],
      headers: [],
      rowCount: 0,
      encoding: "UTF-8",
      errors,
    };
  }
}

// ============================================================================
// Subtask 4.6: CSV Generation
// ============================================================================

/**
 * Generate RFC 4180 compliant CSV string from data
 *
 * Handles proper quoting, escaping, and newline normalization.
 *
 * @param data - Array of objects to convert to CSV
 * @param options - Generation options including headers and delimiter
 * @returns CSV string
 *
 * @example
 * ```ts
 * const data = [
 *   { name: "Product 1", price: "10.00" },
 *   { name: "Product 2", price: "20.00" }
 * ];
 *
 * const csv = generateCSV(data, {
 *   headers: ["name", "price"],
 *   quotes: true
 * });
 * ```
 */
export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  options: CSVGenerateOptions = {},
): string {
  const headers =
    options.headers || (data.length > 0 && data[0] ? Object.keys(data[0]) : []);
  const delimiter = options.delimiter || ",";
  const newline = options.newline || "\n";
  const quotes = options.quotes !== false; // Default to true

  if (data.length === 0) {
    return headers.join(delimiter) + newline;
  }

  // Generate CSV using PapaParse (ensures RFC 4180 compliance)
  const shouldQuote = typeof quotes === "boolean" ? quotes : false;
  const csv = Papa.unparse(data, {
    columns: headers,
    delimiter,
    newline,
    quotes: shouldQuote,
    quoteChar: '"',
    escapeChar: '"',
    header: true,
  });

  return csv;
}

/**
 * Generate CSV file download for failed rows with error messages
 *
 * @param data - Array of failed row data
 * @param errors - Array of error messages (one per row)
 * @param originalHeaders - Original CSV headers
 * @returns CSV string with error_message column appended
 *
 * @example
 * ```ts
 * const failedData = [
 *   { product_name: "Test", upid: "123" },
 *   { product_name: "Test2", upid: "456" }
 * ];
 *
 * const errors = [
 *   "Invalid UPID format",
 *   "Duplicate product name"
 * ];
 *
 * const csv = generateFailedRowsCSV(failedData, errors, ["product_name", "upid"]);
 * ```
 */
export function generateFailedRowsCSV<T extends Record<string, unknown>>(
  data: T[],
  errors: string[],
  originalHeaders: string[],
): string {
  // Add error_message column to each row
  const dataWithErrors = data.map((row, index) => ({
    ...row,
    error_message: errors[index] || "Unknown error",
  }));

  const headers = [...originalHeaders, "error_message"];

  return generateCSV(dataWithErrors, { headers, quotes: true });
}

// ============================================================================
// Subtask 4.5: Comprehensive Error Handling
// ============================================================================

/**
 * Validate file before parsing
 *
 * @param file - File to validate
 * @returns Validation result with specific error types
 */
export function validateFileBeforeParse(file: File): ValidationResult {
  const errors: ParseError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check file size
  if (file.size === 0) {
    errors.push({
      row: 0,
      message: "File is empty",
      type: "STRUCTURE_ERROR",
    });
  }

  if (file.size > MAX_FILE_SIZE) {
    errors.push({
      row: 0,
      message: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      type: "STRUCTURE_ERROR",
    });
  }

  // Check file type by extension
  const fileName = file.name.toLowerCase();
  const validExtensions = [".csv", ".xlsx", ".xls"];
  const hasValidExtension = validExtensions.some((ext) =>
    fileName.endsWith(ext),
  );

  if (!hasValidExtension) {
    errors.push({
      row: 0,
      message: `Invalid file type. Allowed: ${validExtensions.join(", ")}`,
      type: "VALIDATION_ERROR",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Parse file with automatic format detection
 *
 * Detects whether file is CSV or Excel and uses appropriate parser.
 *
 * @param file - File to parse
 * @param options - Parsing options
 * @returns Promise resolving to parsed data
 *
 * @example
 * ```ts
 * const file = uploadedFile; // Can be CSV or XLSX
 * const result = await parseFile(file);
 *
 * if (result.errors.length > 0) {
 *   console.error("Parsing errors:", result.errors);
 * }
 * ```
 */
export async function parseFile(
  file: File,
  options: CSVParseOptions = {},
): Promise<ParseResult> {
  // Pre-validation
  const validation = validateFileBeforeParse(file);
  if (!validation.valid) {
    return {
      data: [],
      headers: [],
      rowCount: 0,
      encoding: "UTF-8",
      errors: validation.errors,
    };
  }

  // Determine file type and parse accordingly
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    return parseXLSX(file);
  } else {
    return parseCSV(file, options);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a row has duplicate values in specified columns
 *
 * @param data - Array of parsed rows
 * @param columns - Columns to check for duplicates
 * @returns Array of duplicate row indices with values
 */
export function findDuplicates<T extends Record<string, unknown>>(
  data: T[],
  columns: string[],
): Array<{ rows: number[]; value: string; column: string }> {
  const duplicates: Array<{ rows: number[]; value: string; column: string }> =
    [];

  for (const column of columns) {
    const valueMap = new Map<string, number[]>();

    data.forEach((row, index) => {
      const value = String(row[column] || "").trim();
      if (value) {
        const existing = valueMap.get(value) || [];
        existing.push(index + 1); // 1-indexed for user display
        valueMap.set(value, existing);
      }
    });

    // Find values that appear more than once
    valueMap.forEach((rows, value) => {
      if (rows.length > 1) {
        duplicates.push({ rows, value, column });
      }
    });
  }

  return duplicates;
}

/**
 * Extract unique values from a column
 *
 * @param data - Array of parsed rows
 * @param column - Column name to extract values from
 * @returns Array of unique non-empty values
 */
export function extractUniqueValues<T extends Record<string, unknown>>(
  data: T[],
  column: string,
): string[] {
  const values = new Set<string>();

  data.forEach((row) => {
    const value = String(row[column] || "").trim();
    if (value) {
      values.add(value);
    }
  });

  return Array.from(values);
}
