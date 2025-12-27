/**
 * Product Handle Generation Utilities
 *
 * Provides functions for generating URL-friendly, unique product handles
 * from product names. Used during integration syncs and product creation.
 *
 * Product handles are used in DPP URLs: /[brandSlug]/[productHandle]/
 *
 * @example
 * "The Archived Snowboard" → "the-archived-snowboard"
 * "The Archived Snowboard" (if taken) → "the-archived-snowboard-4829"
 */

import { randomInt } from "node:crypto";

/**
 * Convert a product name to a URL-friendly slug.
 *
 * @param name - The product name to slugify
 * @returns A lowercase, hyphenated slug with only alphanumeric characters
 *
 * @example
 * slugifyProductName("The Archived Snowboard") → "the-archived-snowboard"
 * slugifyProductName("Organic Cotton T-Shirt (2024)") → "organic-cotton-t-shirt-2024"
 * slugifyProductName("  Extra   Spaces  Here  ") → "extra-spaces-here"
 */
export function slugifyProductName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // Remove special characters except spaces and dashes
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/-+/g, "-") // Replace multiple dashes with single dash
    .replace(/^-|-$/g, ""); // Remove leading/trailing dashes
}

/**
 * Generate a random numeric suffix for handle uniqueness.
 * Returns a 4-digit number as a string.
 */
function generateRandomSuffix(): string {
  // Generate a random number between 1000 and 9999
  return String(randomInt(1000, 10000));
}

type IsTakenFn = (candidate: string) => Promise<boolean>;

export interface GenerateUniqueProductHandleOptions {
  /** The product name to generate a handle from */
  name: string;
  /** Maximum number of attempts before giving up */
  maxAttempts?: number;
  /** Function to check if a handle is already taken */
  isTaken: IsTakenFn;
}

/**
 * Generate a unique product handle from a product name.
 *
 * First tries the slugified name directly. If taken, appends a random
 * 4-digit suffix until a unique handle is found.
 *
 * @param options - Generation options
 * @returns A unique product handle
 * @throws Error if unable to generate a unique handle within maxAttempts
 *
 * @example
 * // First product with this name
 * await generateUniqueProductHandle({
 *   name: "The Archived Snowboard",
 *   isTaken: async (h) => checkDb(h),
 * });
 * // Returns: "the-archived-snowboard"
 *
 * // Second product with same name
 * await generateUniqueProductHandle({
 *   name: "The Archived Snowboard",
 *   isTaken: async (h) => checkDb(h),
 * });
 * // Returns: "the-archived-snowboard-4829"
 */
export async function generateUniqueProductHandle({
  name,
  maxAttempts = 10,
  isTaken,
}: GenerateUniqueProductHandleOptions): Promise<string> {
  // Generate base slug from name
  const baseSlug = slugifyProductName(name);

  // Handle edge case of empty slug
  if (!baseSlug) {
    throw new Error("Cannot generate handle from empty or invalid name");
  }

  // First, try the base slug without any suffix
  if (!(await isTaken(baseSlug))) {
    return baseSlug;
  }

  // If taken, try with random suffixes
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const suffix = generateRandomSuffix();
    const candidate = `${baseSlug}-${suffix}`;

    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }

  throw new Error(
    `Failed to generate unique product handle for "${name}" after ${maxAttempts} attempts`,
  );
}

/**
 * Batch generation options for generating multiple unique handles.
 */
export interface GenerateUniqueProductHandlesOptions {
  /** Array of product names to generate handles for */
  names: string[];
  /** Maximum attempts per handle */
  maxAttempts?: number;
  /** Function to check if a handle is already taken in the database */
  isTaken: IsTakenFn;
  /** Function to fetch which handles are taken from a batch of candidates */
  fetchTakenSet: (candidates: readonly string[]) => Promise<Set<string>>;
}

/**
 * Generate multiple unique product handles efficiently.
 *
 * More efficient than calling generateUniqueProductHandle multiple times
 * as it batches database lookups.
 *
 * @param options - Batch generation options
 * @returns Array of unique handles in the same order as input names
 */
export async function generateUniqueProductHandles({
  names,
  maxAttempts = 10,
  isTaken,
  fetchTakenSet,
}: GenerateUniqueProductHandlesOptions): Promise<string[]> {
  if (names.length === 0) {
    return [];
  }

  // For single handle, use the simple function
  if (names.length === 1) {
    const handle = await generateUniqueProductHandle({
      name: names[0]!,
      maxAttempts,
      isTaken,
    });
    return [handle];
  }

  const results: string[] = [];
  const usedHandles = new Set<string>();

  for (const name of names) {
    const baseSlug = slugifyProductName(name);

    if (!baseSlug) {
      throw new Error(`Cannot generate handle from empty or invalid name: "${name}"`);
    }

    // Try base slug first
    let candidate = baseSlug;
    let found = false;

    // Check if taken (either in DB or already used in this batch)
    if (!usedHandles.has(candidate) && !(await isTaken(candidate))) {
      results.push(candidate);
      usedHandles.add(candidate);
      found = true;
    }

    if (!found) {
      // Try with suffixes
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const suffix = generateRandomSuffix();
        candidate = `${baseSlug}-${suffix}`;

        if (!usedHandles.has(candidate) && !(await isTaken(candidate))) {
          results.push(candidate);
          usedHandles.add(candidate);
          found = true;
          break;
        }
      }

      if (!found) {
        throw new Error(
          `Failed to generate unique product handle for "${name}" after ${maxAttempts} attempts`,
        );
      }
    }
  }

  return results;
}

