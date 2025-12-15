/**
 * Common Transform Functions
 *
 * Shared transformation utilities used across multiple connectors.
 */

/**
 * Truncate string to max length.
 */
export function truncate(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

/**
 * Safely parse a price value to number.
 */
export function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Clean HTML tags from text (basic).
 */
export function stripHtml(html: unknown): string | null {
  if (!html || typeof html !== "string") return null;
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Normalize string to uppercase.
 */
export function toUpperCase(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value).toUpperCase();
}

/**
 * Normalize string to lowercase.
 */
export function toLowerCase(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value).toLowerCase();
}

/**
 * Parse a boolean value from various formats.
 */
export function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  const str = String(value).toLowerCase();
  if (str === "true" || str === "1" || str === "yes") return true;
  if (str === "false" || str === "0" || str === "no") return false;
  return null;
}

/**
 * Extract numeric value from string with optional unit suffix.
 * Example: "100g" -> 100, "50 kg" -> 50
 */
export function extractNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  const match = String(value).match(/[\d.]+/);
  if (!match) return null;
  const parsed = Number.parseFloat(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Normalize ISO date string to YYYY-MM-DD format.
 */
export function normalizeDate(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Normalize datetime to ISO 8601 format.
 */
export function normalizeDatetime(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

