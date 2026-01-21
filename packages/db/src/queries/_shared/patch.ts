/**
 * Shared helpers for building partial update objects.
 *
 * Prevents accidentally clearing fields by only including
 * explicitly provided values in update operations.
 */

/**
 * Builds a partial update object, only including fields that are explicitly provided.
 * Useful for preventing accidental field clearing when updating records.
 *
 * @param input - Input object with optional fields
 * @param defaults - Optional default values to apply
 * @returns Partial object with only defined fields
 *
 * @example
 * ```typescript
 * const updateData = buildPartialUpdate({
 *   name: "New Name",
 *   description: undefined, // Won't be included
 * }, {
 *   updatedAt: new Date().toISOString()
 * });
 * // Result: { name: "New Name", updatedAt: "..." }
 * ```
 */
export function buildPartialUpdate<T extends Record<string, unknown>>(
  input: Partial<T>,
  defaults?: Partial<T>,
): Partial<T> {
  const result: Partial<T> = defaults ? { ...defaults } : {};

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && key in input) {
      (result as Record<string, unknown>)[key] = value;
    }
  }

  return result;
}
