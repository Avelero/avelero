/**
 * Input validation utilities for DPP route parameters.
 *
 * These functions validate URL parameters before querying the database,
 * preventing unnecessary queries for malformed inputs.
 *
 * URL structure: /{upid}
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

// ─────────────────────────────────────────────────────────────────────────────
// Validation Functions
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
