import { and, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { valueMappings } from "../../schema";

/**
 * Entity types supported for value mapping
 */
export type ValueMappingTarget =
  | "MATERIAL"
  | "CATEGORY"
  | "ECO_CLAIM"
  | "FACILITY"
  | "MANUFACTURER"
  | "CERTIFICATION"
  | "SEASON"
  | "TAG";

/**
 * Input for creating a new value mapping
 */
export interface CreateValueMappingInput {
  brandId: string;
  sourceColumn: string;
  rawValue: string;
  target: ValueMappingTarget;
  targetId: string;
}

export interface UpdateValueMappingInput {
  id: string;
  brandId: string;
  target: ValueMappingTarget;
  targetId: string;
}

/**
 * Creates a new value mapping to associate a CSV raw value with a database entity
 *
 * @param db - Database connection
 * @param input - Value mapping creation data
 * @returns Created value mapping with ID
 *
 * @throws Error if duplicate mapping already exists (enforced by unique constraint)
 *
 * @example
 * ```typescript
 * const mapping = await createValueMapping(db, {
 *   brandId: "brand-uuid",
 *   sourceColumn: "color_name",
 *   rawValue: "Red",
 *   target: "COLOR",
 *   targetId: "color-uuid"
 * });
 * ```
 */
export async function createValueMapping(
  db: Database,
  input: CreateValueMappingInput,
): Promise<{ id: string }> {
  const [row] = await db
    .insert(valueMappings)
    .values({
      brandId: input.brandId,
      sourceColumn: input.sourceColumn,
      rawValue: input.rawValue,
      target: input.target,
      targetId: input.targetId,
    })
    .returning({ id: valueMappings.id });

  if (!row) {
    throw new Error("Failed to create value mapping");
  }

  return row;
}

/**
 * Updates the target of an existing value mapping.
 *
 * @param db - Database connection
 * @param input - Value mapping update data
 * @returns Updated value mapping identifier
 *
 * @throws Error when the mapping cannot be found for the provided brand
 */
export async function updateValueMapping(
  db: Database,
  input: UpdateValueMappingInput,
): Promise<{ id: string }> {
  const [row] = await db
    .update(valueMappings)
    .set({
      target: input.target,
      targetId: input.targetId,
    })
    .where(
      and(
        eq(valueMappings.id, input.id),
        eq(valueMappings.brandId, input.brandId),
      ),
    )
    .returning({ id: valueMappings.id });

  if (!row) {
    throw new Error("Value mapping not found for update");
  }

  return row;
}

/**
 * Retrieves a value mapping for a specific brand, column, and raw value
 *
 * @param db - Database connection
 * @param brandId - Brand UUID
 * @param sourceColumn - Source column name from CSV (e.g., "color_name", "material_1_name")
 * @param rawValue - Raw value from CSV
 * @returns Value mapping if found, null otherwise
 *
 * @example
 * ```typescript
 * const mapping = await getValueMapping(db, "brand-uuid", "color_name", "Red");
 * if (mapping) {
 *   console.log(`Mapped to ${mapping.target} with ID: ${mapping.target_id}`);
 * }
 * ```
 */
export async function getValueMapping(
  db: Database,
  brandId: string,
  sourceColumn: string,
  rawValue: string,
): Promise<{
  id: string;
  source_column: string;
  raw_value: string;
  target: string;
  target_id: string;
  created_at: string;
} | null> {
  const [row] = await db
    .select({
      id: valueMappings.id,
      source_column: valueMappings.sourceColumn,
      raw_value: valueMappings.rawValue,
      target: valueMappings.target,
      target_id: valueMappings.targetId,
      created_at: valueMappings.createdAt,
    })
    .from(valueMappings)
    .where(
      and(
        eq(valueMappings.brandId, brandId),
        eq(valueMappings.sourceColumn, sourceColumn),
        eq(valueMappings.rawValue, rawValue),
      ),
    )
    .limit(1);

  return row ?? null;
}

/**
 * Checks if a value mapping exists for a specific brand, column, and raw value
 *
 * @param db - Database connection
 * @param brandId - Brand UUID
 * @param sourceColumn - Source column name from CSV
 * @param rawValue - Raw value from CSV
 * @returns True if mapping exists, false otherwise
 *
 * @example
 * ```typescript
 * const exists = await checkMappingExists(db, "brand-uuid", "color_name", "Blue");
 * if (!exists) {
 *   // Create new mapping or prompt user to define value
 * }
 * ```
 */
export async function checkMappingExists(
  db: Database,
  brandId: string,
  sourceColumn: string,
  rawValue: string,
): Promise<boolean> {
  const mapping = await getValueMapping(db, brandId, sourceColumn, rawValue);
  return mapping !== null;
}

/**
 * Retrieves all value mappings for a specific brand
 *
 * @param db - Database connection
 * @param brandId - Brand UUID
 * @returns Array of all value mappings for the brand
 *
 * @example
 * ```typescript
 * const mappings = await getBrandValueMappings(db, "brand-uuid");
 * console.log(`Brand has ${mappings.length} value mappings`);
 * ```
 */
export async function getBrandValueMappings(
  db: Database,
  brandId: string,
): Promise<
  Array<{
    id: string;
    source_column: string;
    raw_value: string;
    target: string;
    target_id: string;
    created_at: string;
  }>
> {
  return db
    .select({
      id: valueMappings.id,
      source_column: valueMappings.sourceColumn,
      raw_value: valueMappings.rawValue,
      target: valueMappings.target,
      target_id: valueMappings.targetId,
      created_at: valueMappings.createdAt,
    })
    .from(valueMappings)
    .where(eq(valueMappings.brandId, brandId));
}

/**
 * Retrieves all value mappings for a specific target type
 *
 * @param db - Database connection
 * @param brandId - Brand UUID
 * @param target - Target entity type (e.g., "COLOR", "MATERIAL")
 * @returns Array of value mappings for the target type
 *
 * @example
 * ```typescript
 * const colorMappings = await getValueMappingsByTarget(db, "brand-uuid", "COLOR");
 * console.log(`Found ${colorMappings.length} color mappings`);
 * ```
 */
export async function getValueMappingsByTarget(
  db: Database,
  brandId: string,
  target: ValueMappingTarget,
): Promise<
  Array<{
    id: string;
    source_column: string;
    raw_value: string;
    target: string;
    target_id: string;
    created_at: string;
  }>
> {
  return db
    .select({
      id: valueMappings.id,
      source_column: valueMappings.sourceColumn,
      raw_value: valueMappings.rawValue,
      target: valueMappings.target,
      target_id: valueMappings.targetId,
      created_at: valueMappings.createdAt,
    })
    .from(valueMappings)
    .where(
      and(eq(valueMappings.brandId, brandId), eq(valueMappings.target, target)),
    );
}

/**
 * Deletes a value mapping by ID
 *
 * @param db - Database connection
 * @param brandId - Brand UUID (for security check)
 * @param id - Value mapping UUID
 * @returns Deleted mapping ID
 *
 * @example
 * ```typescript
 * await deleteValueMapping(db, "brand-uuid", "mapping-uuid");
 * ```
 */
export async function deleteValueMapping(
  db: Database,
  brandId: string,
  id: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .delete(valueMappings)
    .where(and(eq(valueMappings.id, id), eq(valueMappings.brandId, brandId)))
    .returning({ id: valueMappings.id });

  return row ?? null;
}
