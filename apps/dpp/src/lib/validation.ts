/**
 * Input validation utilities for DPP route parameters.
 *
 * These functions validate URL parameters before querying the database,
 * preventing unnecessary queries for malformed inputs.
 *
 * URL structures:
 * - /{upid} - Universal Product Identifier
 * - /01/{barcode} - GS1 Digital Link GTIN barcode (custom domains only)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Regex Patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates UPIDs (Universal Product Identifiers).
 * - 16 alphanumeric characters
 * - Case insensitive (stored lowercase)
 */
const UPID_PATTERN = /^[a-zA-Z0-9]{16}$/;

/**
 * Validates GTINs (Global Trade Item Numbers) / Barcodes.
 * Supports:
 * - GTIN-8 (8 digits) - small items
 * - GTIN-12 (12 digits) - UPC (North America)
 * - GTIN-13 (13 digits) - EAN (International)
 * - GTIN-14 (14 digits) - cases/pallets
 */
const BARCODE_PATTERN = /^(\d{8}|\d{12}|\d{13}|\d{14})$/;

// ─────────────────────────────────────────────────────────────────────────────
// UPID Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a UPID format.
 *
 * @param upid - The UPID to validate
 * @returns true if valid UPID format (16 alphanumeric chars)
 */
export function isValidUpid(upid: string): boolean {
  return UPID_PATTERN.test(upid);
}

// ─────────────────────────────────────────────────────────────────────────────
// Barcode Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates a barcode/GTIN format.
 *
 * @param barcode - The barcode to validate
 * @returns true if valid GTIN format (8, 12, 13, or 14 digits)
 */
export function isValidBarcode(barcode: string): boolean {
  return BARCODE_PATTERN.test(barcode);
}

/**
 * Normalizes a barcode to GTIN-14 format.
 * Pads shorter GTINs with leading zeros.
 *
 * @param barcode - The barcode to normalize (must be valid)
 * @returns 14-digit normalized barcode
 */
export function normalizeBarcode(barcode: string): string {
  return barcode.padStart(14, "0");
}
