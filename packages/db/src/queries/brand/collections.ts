/**
 * Brand collections query functions.
 *
 * Collections are saved product filter presets that users can create
 * to quickly access commonly used filter configurations.
 *
 * @module queries/brand-collections
 */
import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandCollections } from "../../schema";

// =============================================================================
// Types
// =============================================================================

export interface Collection {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  filter: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionCreateInput {
  name: string;
  description?: string;
  filter: Record<string, unknown>;
}

export interface CollectionUpdateInput {
  name?: string;
  description?: string | null;
  filter?: Record<string, unknown>;
}

// =============================================================================
// Query Functions
// =============================================================================

/**
 * Lists all collections for a brand.
 *
 * @param db - Database instance
 * @param brandId - Brand identifier
 * @returns Array of collections sorted by name
 */
export async function listCollections(
  db: Database,
  brandId: string,
): Promise<Collection[]> {
  const rows = await db
    .select({
      id: brandCollections.id,
      brandId: brandCollections.brandId,
      name: brandCollections.name,
      description: brandCollections.description,
      filter: brandCollections.filter,
      createdAt: brandCollections.createdAt,
      updatedAt: brandCollections.updatedAt,
    })
    .from(brandCollections)
    .where(eq(brandCollections.brandId, brandId))
    .orderBy(asc(brandCollections.name));

  return rows.map((row) => ({
    id: row.id,
    brandId: row.brandId,
    name: row.name,
    description: row.description,
    filter: (row.filter as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Creates a new collection for a brand.
 *
 * @param db - Database instance
 * @param brandId - Brand identifier
 * @param input - Collection data
 * @returns The created collection
 */
export async function createCollection(
  db: Database,
  brandId: string,
  input: CollectionCreateInput,
): Promise<Collection> {
  const [row] = await db
    .insert(brandCollections)
    .values({
      brandId,
      name: input.name,
      description: input.description ?? null,
      filter: input.filter,
    })
    .returning({
      id: brandCollections.id,
      brandId: brandCollections.brandId,
      name: brandCollections.name,
      description: brandCollections.description,
      filter: brandCollections.filter,
      createdAt: brandCollections.createdAt,
      updatedAt: brandCollections.updatedAt,
    });

  if (!row) {
    throw new Error("Failed to create collection");
  }

  return {
    id: row.id,
    brandId: row.brandId,
    name: row.name,
    description: row.description,
    filter: (row.filter as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Updates an existing collection.
 *
 * @param db - Database instance
 * @param brandId - Brand identifier (for access control)
 * @param id - Collection identifier
 * @param input - Fields to update
 * @returns The updated collection or null if not found
 */
export async function updateCollection(
  db: Database,
  brandId: string,
  id: string,
  input: CollectionUpdateInput,
): Promise<Collection | null> {
  const updateData: Partial<{
    name: string;
    description: string | null;
    filter: Record<string, unknown>;
    updatedAt: string;
  }> = {
    updatedAt: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.description !== undefined) {
    updateData.description = input.description;
  }
  if (input.filter !== undefined) {
    updateData.filter = input.filter;
  }

  const [row] = await db
    .update(brandCollections)
    .set(updateData)
    .where(
      and(eq(brandCollections.id, id), eq(brandCollections.brandId, brandId)),
    )
    .returning({
      id: brandCollections.id,
      brandId: brandCollections.brandId,
      name: brandCollections.name,
      description: brandCollections.description,
      filter: brandCollections.filter,
      createdAt: brandCollections.createdAt,
      updatedAt: brandCollections.updatedAt,
    });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    brandId: row.brandId,
    name: row.name,
    description: row.description,
    filter: (row.filter as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Deletes a collection.
 *
 * @param db - Database instance
 * @param brandId - Brand identifier (for access control)
 * @param id - Collection identifier
 * @returns The deleted collection or null if not found
 */
export async function deleteCollection(
  db: Database,
  brandId: string,
  id: string,
): Promise<Collection | null> {
  const [row] = await db
    .delete(brandCollections)
    .where(
      and(eq(brandCollections.id, id), eq(brandCollections.brandId, brandId)),
    )
    .returning({
      id: brandCollections.id,
      brandId: brandCollections.brandId,
      name: brandCollections.name,
      description: brandCollections.description,
      filter: brandCollections.filter,
      createdAt: brandCollections.createdAt,
      updatedAt: brandCollections.updatedAt,
    });

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    brandId: row.brandId,
    name: row.name,
    description: row.description,
    filter: (row.filter as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Gets a single collection by ID.
 *
 * @param db - Database instance
 * @param brandId - Brand identifier (for access control)
 * @param id - Collection identifier
 * @returns The collection or null if not found
 */
export async function getCollectionById(
  db: Database,
  brandId: string,
  id: string,
): Promise<Collection | null> {
  const [row] = await db
    .select({
      id: brandCollections.id,
      brandId: brandCollections.brandId,
      name: brandCollections.name,
      description: brandCollections.description,
      filter: brandCollections.filter,
      createdAt: brandCollections.createdAt,
      updatedAt: brandCollections.updatedAt,
    })
    .from(brandCollections)
    .where(
      and(eq(brandCollections.id, id), eq(brandCollections.brandId, brandId)),
    )
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    brandId: row.brandId,
    name: row.name,
    description: row.description,
    filter: (row.filter as Record<string, unknown>) ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

