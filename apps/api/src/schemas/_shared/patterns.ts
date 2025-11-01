/**
 * Shared schema patterns.
 *
 * Common schema patterns used across multiple domains. These eliminate
 * duplication of frequently-used structures like ID parameters, empty
 * payloads, and standard CRUD patterns.
 *
 * @module schemas/_shared/patterns
 */
import { z } from "zod";
import { uuidSchema } from "./primitives.js";

// ============================================================================
// Parameter Patterns
// ============================================================================

/**
 * Schema for endpoints that accept a single ID parameter.
 *
 * Use this for get/delete operations that operate on a specific resource.
 *
 * @example
 * ```typescript
 * // Instead of duplicating:
 * export const getBrandSchema = z.object({ id: uuidSchema });
 * export const deleteBrandSchema = z.object({ id: uuidSchema });
 *
 * // Use:
 * export const getBrandSchema = byIdSchema;
 * export const deleteBrandSchema = byIdSchema;
 * ```
 */
export const byIdSchema = z.object({ id: uuidSchema });

/**
 * Creates a schema for endpoints that accept a parent/foreign ID parameter.
 *
 * Use this for list/query operations scoped to a parent resource.
 *
 * @param key - The parameter name (e.g., "brand_id", "product_id", "user_id")
 * @returns Zod schema with single UUID field
 *
 * @example
 * ```typescript
 * // Instead of duplicating:
 * export const listVariantsSchema = z.object({ product_id: uuidSchema });
 * export const listInvitesSchema = z.object({ brand_id: uuidSchema });
 *
 * // Use:
 * export const listVariantsSchema = byParentId("product_id");
 * export const listInvitesSchema = byParentId("brand_id");
 * ```
 */
export function byParentId<const Key extends string>(
  key: Key,
): z.ZodObject<{ [K in Key]: z.ZodString }> {
  return z.object({ [key]: uuidSchema }) as z.ZodObject<{
    [K in Key]: z.ZodString;
  }>;
}

// ============================================================================
// Empty Payload Patterns
// ============================================================================

/**
 * Schema for endpoints that accept no input parameters.
 *
 * Use `z.void()` instead of `z.object({})` for clarity and correctness.
 * This explicitly indicates no input is expected or validated.
 *
 * @example
 * ```typescript
 * // Instead of:
 * export const listCategoriesSchema = z.object({});
 *
 * // Use:
 * export const listCategoriesSchema = voidSchema;
 * ```
 */
export const voidSchema = z.void();

// ============================================================================
// Update Patterns
// ============================================================================

/**
 * Creates an update schema that allows nullable fields.
 *
 * Transforms a create schema into an update schema by:
 * 1. Adding required `id` field
 * 2. Making all fields optional
 * 3. Allowing specified fields to be set to null (for unsetting values)
 *
 * This eliminates verbose boilerplate when defining update schemas and
 * ensures consistency across all update operations.
 *
 * @template T - Zod object shape type
 * @param createSchema - Base schema used for creation
 * @param nullableFields - Array of field names that should accept null values
 * @returns Update schema with id required and specified fields nullable
 *
 * @example
 * ```typescript
 * const createProductSchema = z.object({
 *   name: z.string(),
 *   description: z.string().optional(),
 *   category_id: z.string().uuid().optional(),
 * });
 *
 * // Instead of 12 lines of boilerplate:
 * const updateProductSchema = createProductSchema
 *   .extend({ id: uuidSchema })
 *   .partial()
 *   .required({ id: true })
 *   .extend({
 *     description: z.string().optional().nullable(),
 *     category_id: z.string().uuid().optional().nullable(),
 *   });
 *
 * // Use:
 * const updateProductSchema = updateWithNullable(
 *   createProductSchema,
 *   ['description', 'category_id']
 * );
 * ```
 */
export function updateWithNullable<
  T extends z.ZodRawShape,
  NullableKey extends keyof T & string,
>(createSchema: z.ZodObject<T>, nullableFields: ReadonlyArray<NullableKey>) {
  const baseSchema = createSchema
    .extend({ id: uuidSchema })
    .partial()
    .required({ id: true });

  if (nullableFields.length === 0) return baseSchema;

  const overridesEntries: Array<[NullableKey, z.ZodTypeAny]> = [];
  for (const key of nullableFields) {
    const field = createSchema.shape[key];
    if (field) {
      overridesEntries.push([key, field.optional().nullable()]);
    }
  }

  if (overridesEntries.length === 0) {
    return baseSchema;
  }

  const overrides = Object.fromEntries(overridesEntries) as z.ZodRawShape;

  return baseSchema.extend(overrides);
}

/**
 * Creates a simple update schema from a create schema.
 *
 * Transforms a create schema into an update schema by:
 * 1. Adding required `id` field
 * 2. Making all other fields optional
 *
 * Use this for simple updates where nullable fields aren't needed.
 * For updates that require explicit null values, use `updateWithNullable`.
 *
 * @template T - Zod object shape type
 * @param createSchema - Base schema used for creation
 * @returns Update schema with id required and all other fields optional
 *
 * @example
 * ```typescript
 * const createColorSchema = z.object({ name: shortStringSchema });
 *
 * // Instead of:
 * const updateColorSchema = createColorSchema.extend({ id: uuidSchema });
 *
 * // Use:
 * const updateColorSchema = updateFrom(createColorSchema);
 * // Result: { id: uuid (required), name: string (optional) }
 * ```
 */
export function updateFrom<T extends z.ZodRawShape>(
  createSchema: z.ZodObject<T>,
): z.ZodObject<z.ZodRawShape> {
  return createSchema
    .extend({ id: uuidSchema })
    .partial()
    .required({ id: true });
}

// ============================================================================
// Field Selection Patterns
// ============================================================================

/**
 * Creates a schema for field selection in queries.
 *
 * Allows clients to specify which fields they need, reducing over-fetching
 * and optimizing query performance. The resulting schema validates an array
 * of field names against a defined set of allowed fields.
 *
 * @template T - Union type of valid field names
 * @param allowedFields - Array of field names that can be selected
 * @returns Zod schema validating field selection array
 *
 * @example
 * ```typescript
 * // Define allowed fields for product selection
 * const productFields = ['id', 'name', 'description', 'created_at'] as const;
 * const productFieldsSchema = createFieldSelection(productFields);
 *
 * // Client can now specify: { fields: ['id', 'name'] }
 * // Result: Only id and name are queried and returned
 * ```
 */
export function createFieldSelection<T extends readonly string[]>(
  allowedFields: T,
): z.ZodOptional<z.ZodArray<z.ZodEnum<[T[number], ...T[number][]]>>> {
  if (allowedFields.length === 0) {
    throw new Error("Field selection requires at least one allowed field");
  }

  const [first, ...rest] = allowedFields;
  return z
    .array(z.enum([first, ...rest] as [string, ...string[]]))
    .min(1, "At least one field must be selected")
    .optional();
}

/**
 * Type helper to extract selected fields from a record based on field array.
 *
 * Utility type that creates a subset of a type containing only the specified fields.
 * Used in conjunction with field selection to ensure type safety when returning
 * partial records from queries.
 *
 * @template T - Source record type
 * @template K - Union of field names to select
 *
 * @example
 * ```typescript
 * type Product = {
 *   id: string;
 *   name: string;
 *   description: string;
 *   created_at: Date;
 * };
 *
 * type MinimalProduct = SelectFields<Product, 'id' | 'name'>;
 * // Result: { id: string; name: string }
 * ```
 */
export type SelectFields<T, K extends keyof T> = Pick<T, K>;
