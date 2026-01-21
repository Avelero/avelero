/**
 * Standardized API response wrappers for consistent tRPC responses.
 *
 * This module provides type-safe response builders that enforce a consistent
 * API contract across all endpoints. All responses include proper typing for
 * client-side inference.
 */

/**
 * Standard list response wrapping an array of items.
 *
 * @template T - The type of items in the data array
 */
export interface ListResponse<T> {
  data: T[];
}

/**
 * Paginated response including both data and pagination metadata.
 *
 * @template T - The type of items in the data array
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    readonly total: number;
    readonly cursor?: string | null;
    readonly hasMore?: boolean;
  };
}

/**
 * Mutation success response for operations that don't return data.
 */
export interface SuccessResponse {
  readonly success: true;
}

/**
 * Mutation response including the created or updated entity.
 *
 * @template T - The type of the entity
 */
export interface EntityResponse<T> {
  readonly data: T;
}

/**
 * Batch operation response with affected count.
 */
interface BatchResponse {
  readonly affected: number;
}

/**
 * Empty response for brand-scoped queries when no brand is active.
 *
 * @template T - The type of items that would be returned
 */
interface EmptyListResponse<T> {
  data: T[];
}

/**
 * Creates a standardized list response.
 *
 * @template T - The type of items in the array
 * @param data - Array of items to wrap
 * @returns Immutable list response object
 *
 * @example
 * ```ts
 * const colors = await listColors(db, brandId);
 * return createListResponse(colors);
 * // Returns: { data: readonly Color[] }
 * ```
 */
export function createListResponse<T>(data: T[]): ListResponse<T> {
  return { data };
}

/**
 * Creates a paginated response with metadata.
 *
 * @template T - The type of items in the array
 * @param data - Array of items for current page
 * @param meta - Pagination metadata
 * @returns Immutable paginated response object
 *
 * @example
 * ```ts
 * const products = await listProducts(db, brandId, filters, pagination);
 * return createPaginatedResponse(products.items, {
 *   total: products.total,
 *   cursor: products.nextCursor,
 *   hasMore: products.hasMore,
 * });
 * ```
 */
export function createPaginatedResponse<T>(
  data: T[],
  meta: { total: number; cursor?: string | null; hasMore?: boolean },
): PaginatedResponse<T> {
  return { data, meta };
}

/**
 * Creates a success response for mutations without return data.
 *
 * @returns Immutable success indicator
 *
 * @example
 * ```ts
 * await deleteColor(db, brandId, colorId);
 * return createSuccessResponse();
 * // Returns: { success: true }
 * ```
 */
export function createSuccessResponse(): SuccessResponse {
  return { success: true } as const;
}

/**
 * Creates a success response with additional metadata.
 *
 * Useful for operations that need to return IDs or flags alongside success.
 *
 * @template T - Additional metadata type
 * @param meta - Additional fields to include in response
 * @returns Success response with custom metadata
 *
 * @example
 * ```ts
 * const result = await leaveBrand(db, userId, brandId);
 * return createSuccessWithMeta({ nextBrandId: result.nextBrandId });
 * // Returns: { success: true, nextBrandId: string }
 * ```
 */
export function createSuccessWithMeta<T extends Record<string, unknown>>(
  meta: T,
): SuccessResponse & T {
  return { success: true, ...meta } as const;
}

/**
 * Creates an entity response wrapping a single created/updated record.
 *
 * @template T - The entity type
 * @param entity - The entity to wrap
 * @returns Immutable entity response
 *
 * @example
 * ```ts
 * const brand = await createBrand(db, userId, input);
 * return createEntityResponse(brand);
 * // Returns: { data: Brand }
 * ```
 */
export function createEntityResponse<T>(entity: T): EntityResponse<T> {
  return { data: entity } as const;
}
