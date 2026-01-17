import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import {
  integrations,
  brandIntegrations,
  integrationFieldConfigs,
} from "../../schema";

// =============================================================================
// FIELD CONFIGS (Field ownership settings)
// =============================================================================

/**
 * List all field configs for a brand integration.
 */
export async function listFieldConfigs(
  db: Database,
  brandIntegrationId: string,
) {
  return db
    .select({
      id: integrationFieldConfigs.id,
      brandIntegrationId: integrationFieldConfigs.brandIntegrationId,
      fieldKey: integrationFieldConfigs.fieldKey,
      ownershipEnabled: integrationFieldConfigs.ownershipEnabled,
      sourceOptionKey: integrationFieldConfigs.sourceOptionKey,
      createdAt: integrationFieldConfigs.createdAt,
      updatedAt: integrationFieldConfigs.updatedAt,
    })
    .from(integrationFieldConfigs)
    .where(eq(integrationFieldConfigs.brandIntegrationId, brandIntegrationId))
    .orderBy(asc(integrationFieldConfigs.fieldKey));
}

/**
 * Get a specific field config.
 */
export async function getFieldConfig(
  db: Database,
  brandIntegrationId: string,
  fieldKey: string,
) {
  const [row] = await db
    .select({
      id: integrationFieldConfigs.id,
      brandIntegrationId: integrationFieldConfigs.brandIntegrationId,
      fieldKey: integrationFieldConfigs.fieldKey,
      ownershipEnabled: integrationFieldConfigs.ownershipEnabled,
      sourceOptionKey: integrationFieldConfigs.sourceOptionKey,
      createdAt: integrationFieldConfigs.createdAt,
      updatedAt: integrationFieldConfigs.updatedAt,
    })
    .from(integrationFieldConfigs)
    .where(
      and(
        eq(integrationFieldConfigs.brandIntegrationId, brandIntegrationId),
        eq(integrationFieldConfigs.fieldKey, fieldKey),
      ),
    )
    .limit(1);
  return row;
}

/**
 * Create or update a field config.
 */
export async function upsertFieldConfig(
  db: Database,
  brandIntegrationId: string,
  fieldKey: string,
  input: {
    ownershipEnabled?: boolean;
    sourceOptionKey?: string | null;
  },
) {
  const [row] = await db
    .insert(integrationFieldConfigs)
    .values({
      brandIntegrationId,
      fieldKey,
      ownershipEnabled: input.ownershipEnabled ?? true,
      sourceOptionKey: input.sourceOptionKey ?? null,
    })
    .onConflictDoUpdate({
      target: [
        integrationFieldConfigs.brandIntegrationId,
        integrationFieldConfigs.fieldKey,
      ],
      set: {
        ownershipEnabled: input.ownershipEnabled,
        sourceOptionKey: input.sourceOptionKey,
        updatedAt: new Date().toISOString(),
      },
    })
    .returning({
      id: integrationFieldConfigs.id,
      brandIntegrationId: integrationFieldConfigs.brandIntegrationId,
      fieldKey: integrationFieldConfigs.fieldKey,
      ownershipEnabled: integrationFieldConfigs.ownershipEnabled,
      sourceOptionKey: integrationFieldConfigs.sourceOptionKey,
      createdAt: integrationFieldConfigs.createdAt,
      updatedAt: integrationFieldConfigs.updatedAt,
    });
  return row;
}

/**
 * Update a field config by ID.
 */
export async function updateFieldConfig(
  db: Database,
  id: string,
  input: {
    ownershipEnabled?: boolean;
    sourceOptionKey?: string | null;
  },
) {
  const [row] = await db
    .update(integrationFieldConfigs)
    .set({
      ownershipEnabled: input.ownershipEnabled,
      sourceOptionKey: input.sourceOptionKey,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(integrationFieldConfigs.id, id))
    .returning({
      id: integrationFieldConfigs.id,
      brandIntegrationId: integrationFieldConfigs.brandIntegrationId,
      fieldKey: integrationFieldConfigs.fieldKey,
      ownershipEnabled: integrationFieldConfigs.ownershipEnabled,
      sourceOptionKey: integrationFieldConfigs.sourceOptionKey,
      createdAt: integrationFieldConfigs.createdAt,
      updatedAt: integrationFieldConfigs.updatedAt,
    });
  return row;
}

/**
 * Batch create field configs for a new integration.
 */
export async function createFieldConfigsBatch(
  db: Database,
  brandIntegrationId: string,
  configs: Array<{
    fieldKey: string;
    ownershipEnabled?: boolean;
    sourceOptionKey?: string | null;
  }>,
) {
  if (configs.length === 0) return [];

  return db
    .insert(integrationFieldConfigs)
    .values(
      configs.map((config) => ({
        brandIntegrationId,
        fieldKey: config.fieldKey,
        ownershipEnabled: config.ownershipEnabled ?? true,
        sourceOptionKey: config.sourceOptionKey ?? null,
      })),
    )
    .returning({
      id: integrationFieldConfigs.id,
      fieldKey: integrationFieldConfigs.fieldKey,
      ownershipEnabled: integrationFieldConfigs.ownershipEnabled,
      sourceOptionKey: integrationFieldConfigs.sourceOptionKey,
    });
}

/**
 * Get all owned fields across all integrations for a brand.
 * Useful for showing field ownership conflicts.
 */
export async function listAllOwnedFields(db: Database, brandId: string) {
  return db
    .select({
      fieldKey: integrationFieldConfigs.fieldKey,
      ownershipEnabled: integrationFieldConfigs.ownershipEnabled,
      sourceOptionKey: integrationFieldConfigs.sourceOptionKey,
      brandIntegrationId: integrationFieldConfigs.brandIntegrationId,
      integrationSlug: integrations.slug,
      integrationName: integrations.name,
    })
    .from(integrationFieldConfigs)
    .innerJoin(
      brandIntegrations,
      eq(integrationFieldConfigs.brandIntegrationId, brandIntegrations.id),
    )
    .innerJoin(
      integrations,
      eq(brandIntegrations.integrationId, integrations.id),
    )
    .where(
      and(
        eq(brandIntegrations.brandId, brandId),
        eq(integrationFieldConfigs.ownershipEnabled, true),
      ),
    )
    .orderBy(asc(integrationFieldConfigs.fieldKey));
}
