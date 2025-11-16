import { customAlphabet } from "nanoid";

/**
 * Generates a unique product identifier (UPID).
 *
 * Format: 16-character lowercase alphanumeric string
 * Character set: a-z, 0-9 (36 characters)
 * Example: "8n8o8l6h6o7yl60i"
 *
 * This is used for:
 * - Product-level identification in passport edit URLs (/passport/edit/{upid})
 * - Variant-level identification for tracking
 *
 * @returns A 16-character lowercase alphanumeric UPID
 *
 * @example
 * ```typescript
 * const upid = generateUpid();
 * console.log(upid); // "8n8o8l6h6o7yl60i"
 * ```
 */
export function generateUpid(): string {
  // Use lowercase letters and numbers only (36 chars total)
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";

  // Create a nanoid generator with custom alphabet
  const nanoid = customAlphabet(alphabet, 16);

  return nanoid();
}

/**
 * Validates a UPID format.
 *
 * @param upid - The UPID to validate
 * @returns True if the UPID matches the expected format
 *
 * @example
 * ```typescript
 * isValidUpid("8n8o8l6h6o7yl60i"); // true
 * isValidUpid("INVALID"); // false
 * isValidUpid("too-short"); // false
 * ```
 */
export function isValidUpid(upid: string): boolean {
  // Must be exactly 16 characters, lowercase alphanumeric only
  const upidRegex = /^[a-z0-9]{16}$/;
  return upidRegex.test(upid);
}
