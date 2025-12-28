/**
 * Batch operations for sync engine.
 * 
 * These functions perform TRUE batch operations using single SQL statements
 * to minimize database round-trips during sync.
 */

import { sql, inArray, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { products, productVariants, productTags, integrationProductLinks, integrationVariantLinks } from "../../schema";

// =============================================================================
// SQL SANITIZATION
// =============================================================================

/**
 * Safely escape a string for use in raw SQL.
 * Handles single quotes, backslashes, null bytes, and unicode escapes.
 */
function escapeSqlString(value: string): string {
  return value
    .replace(/\0/g, '')           // Remove null bytes
    .replace(/\\/g, '\\\\')       // Escape backslashes
    .replace(/'/g, "''");         // Escape single quotes (SQL standard)
}

// =============================================================================
// TYPES
// =============================================================================

/**
 * Update data for the `products` table.
 * NOTE: webshopUrl, price, currency, salesStatus are in `product_commercial` table.
 * NOTE: imagePath updates are handled separately via product update mutations, not batch sync.
 */
export interface ProductUpdateData {
  id: string;
  name?: string;
  description?: string | null;
  categoryId?: string | null;
}

/**
 * Upsert data for the `product_commercial` table.
 */
export interface ProductCommercialUpsertData {
  productId: string;
  webshopUrl?: string | null;
  price?: string | null;
  currency?: string | null;
  salesStatus?: string | null;
}

export interface VariantUpdateData {
  id: string;
  sku?: string | null;
  barcode?: string | null;
  // NEW: Display override fields
  name?: string | null;
  description?: string | null;
  imagePath?: string | null;
  // NEW: Source tracking
  sourceIntegration?: string | null;
  sourceExternalId?: string | null;
}

export interface ProductLinkUpsertData {
  brandIntegrationId: string;
  productId: string;
  externalId: string;
  externalName: string | null;
  lastSyncedHash: string | null;
}

export interface TagAssignmentData {
  productId: string;
  tagIds: string[];
}

// =============================================================================
// BATCH UPDATE PRODUCTS
// =============================================================================

/**
 * Batch update multiple products in a SINGLE SQL query using UPDATE FROM VALUES.
 * This reduces N queries to 1 query.
 * 
 * NOTE: Only updates fields in the `products` table. Commercial fields (price, currency, etc.)
 * are in `product_commercial` and handled by `batchUpsertProductCommercial`.
 * 
 * @returns Number of products updated
 */
export async function batchUpdateProducts(
  db: Database,
  updates: ProductUpdateData[]
): Promise<number> {
  if (updates.length === 0) return 0;

  const now = new Date().toISOString();

  // Build VALUES rows with product table fields only
  const valueRows: string[] = [];

  for (const update of updates) {
    const id = `'${update.id}'::uuid`;
    const name = update.name !== undefined
      ? `'${escapeSqlString(update.name)}'`
      : 'NULL';
    const description = update.description !== undefined
      ? (update.description ? `'${escapeSqlString(update.description)}'` : 'NULL')
      : 'NULL';
    const categoryId = update.categoryId !== undefined
      ? (update.categoryId ? `'${update.categoryId}'::uuid` : 'NULL::uuid')
      : 'NULL::uuid';

    valueRows.push(`(${id}, ${name}, ${description}, ${categoryId})`);
  }

  // Determine which columns have updates
  const hasName = updates.some(u => u.name !== undefined);
  const hasDescription = updates.some(u => u.description !== undefined);
  const hasCategoryId = updates.some(u => u.categoryId !== undefined);

  // Build SET clause
  const setClauses: string[] = [];
  if (hasName) setClauses.push('name = COALESCE(v.name, p.name)');
  if (hasDescription) setClauses.push('description = v.description');
  if (hasCategoryId) setClauses.push('category_id = v.category_id');
  setClauses.push(`updated_at = '${now}'`);

  if (setClauses.length === 1) {
    return 0;
  }

  const query = `
    UPDATE products AS p
    SET ${setClauses.join(', ')}
    FROM (VALUES ${valueRows.join(', ')}) AS v(id, name, description, category_id)
    WHERE p.id = v.id
  `;

  await db.execute(sql.raw(query));

  return updates.length;
}

// =============================================================================
// BATCH UPSERT PRODUCT COMMERCIAL
// =============================================================================

import { productCommercial } from "../../schema";

/**
 * Batch upsert product commercial data (price, currency, webshopUrl, salesStatus).
 * Uses INSERT ON CONFLICT DO UPDATE for efficient upsert.
 * 
 * @returns Number of rows upserted
 */
export async function batchUpsertProductCommercial(
  db: Database,
  data: ProductCommercialUpsertData[]
): Promise<number> {
  if (data.length === 0) return 0;

  const now = new Date().toISOString();

  // Filter to only records that have at least one commercial field set
  const validData = data.filter(d =>
    d.webshopUrl !== undefined ||
    d.price !== undefined ||
    d.currency !== undefined ||
    d.salesStatus !== undefined
  );

  if (validData.length === 0) return 0;

  await db.insert(productCommercial)
    .values(validData.map(d => ({
      productId: d.productId,
      webshopUrl: d.webshopUrl ?? null,
      price: d.price ?? null,
      currency: d.currency ?? null,
      salesStatus: d.salesStatus ?? null,
      createdAt: now,
      updatedAt: now,
    })))
    .onConflictDoUpdate({
      target: productCommercial.productId,
      set: {
        webshopUrl: sql`EXCLUDED.webshop_url`,
        price: sql`EXCLUDED.price`,
        currency: sql`EXCLUDED.currency`,
        salesStatus: sql`EXCLUDED.sales_status`,
        updatedAt: now,
      },
    });

  return validData.length;
}

// =============================================================================
// BATCH UPDATE VARIANTS - TRUE BATCH using UPDATE FROM VALUES
// =============================================================================

/**
 * Batch update multiple variants in a SINGLE SQL query using UPDATE FROM VALUES.
 * This is the key optimization - turns 2400 queries into 1 query.
 * 
 * Uses PostgreSQL's UPDATE FROM with VALUES clause to update all rows atomically.
 * 
 * Now supports variant-level override fields: name, description, imagePath, sourceIntegration, sourceExternalId.
 * 
 * @returns Number of variants updated
 */
export async function batchUpdateVariants(
  db: Database,
  updates: VariantUpdateData[]
): Promise<number> {
  if (updates.length === 0) return 0;

  const now = new Date().toISOString();

  // Build the VALUES clause rows
  // Format: (id::uuid, sku::text, barcode::text, name::text, description::text, image_path::text, source_integration::text, source_external_id::text)
  const valueRows: string[] = [];

  for (const update of updates) {
    const id = `'${update.id}'::uuid`;
    const sku = update.sku !== undefined
      ? (update.sku ? `'${escapeSqlString(update.sku)}'` : 'NULL')
      : 'NULL';
    const barcode = update.barcode !== undefined
      ? (update.barcode ? `'${escapeSqlString(update.barcode)}'` : 'NULL')
      : 'NULL';
    const name = update.name !== undefined
      ? (update.name ? `'${escapeSqlString(update.name)}'` : 'NULL')
      : 'NULL';
    const description = update.description !== undefined
      ? (update.description ? `'${escapeSqlString(update.description)}'` : 'NULL')
      : 'NULL';
    const imagePath = update.imagePath !== undefined
      ? (update.imagePath ? `'${escapeSqlString(update.imagePath)}'` : 'NULL')
      : 'NULL';
    const sourceIntegration = update.sourceIntegration !== undefined
      ? (update.sourceIntegration ? `'${escapeSqlString(update.sourceIntegration)}'` : 'NULL')
      : 'NULL';
    const sourceExternalId = update.sourceExternalId !== undefined
      ? (update.sourceExternalId ? `'${escapeSqlString(update.sourceExternalId)}'` : 'NULL')
      : 'NULL';

    valueRows.push(`(${id}, ${sku}, ${barcode}, ${name}, ${description}, ${imagePath}, ${sourceIntegration}, ${sourceExternalId})`);
  }

  // Determine which columns actually have updates (to avoid setting unchanged columns)
  const hasSkuUpdates = updates.some(u => u.sku !== undefined);
  const hasBarcodeUpdates = updates.some(u => u.barcode !== undefined);
  const hasNameUpdates = updates.some(u => u.name !== undefined);
  const hasDescriptionUpdates = updates.some(u => u.description !== undefined);
  const hasImagePathUpdates = updates.some(u => u.imagePath !== undefined);
  const hasSourceIntegrationUpdates = updates.some(u => u.sourceIntegration !== undefined);
  const hasSourceExternalIdUpdates = updates.some(u => u.sourceExternalId !== undefined);

  // Build SET clause - only update columns that have changes
  const setClauses: string[] = [];
  if (hasSkuUpdates) setClauses.push('sku = v.sku');
  if (hasBarcodeUpdates) setClauses.push('barcode = v.barcode');
  if (hasNameUpdates) setClauses.push('name = v.name');
  if (hasDescriptionUpdates) setClauses.push('description = v.description');
  if (hasImagePathUpdates) setClauses.push('image_path = v.image_path');
  if (hasSourceIntegrationUpdates) setClauses.push('source_integration = v.source_integration');
  if (hasSourceExternalIdUpdates) setClauses.push('source_external_id = v.source_external_id');
  setClauses.push(`updated_at = '${now}'`);

  if (setClauses.length === 1) {
    // Only updated_at, nothing substantive to update
    return 0;
  }

  // Execute single UPDATE FROM VALUES query
  const query = `
    UPDATE product_variants AS pv
    SET ${setClauses.join(', ')}
    FROM (VALUES ${valueRows.join(', ')}) AS v(id, sku, barcode, name, description, image_path, source_integration, source_external_id)
    WHERE pv.id = v.id
  `;

  await db.execute(sql.raw(query));

  return updates.length;
}


// =============================================================================
// BATCH SET PRODUCT TAGS
// =============================================================================

/**
 * Batch set tags for multiple products in minimal queries.
 * Deletes all existing tags for the products, then inserts all new ones.
 * 
 * @returns Number of tag assignments created
 */
export async function batchSetProductTags(
  db: Database,
  assignments: TagAssignmentData[]
): Promise<number> {
  if (assignments.length === 0) return 0;

  const productIds = assignments.map(a => a.productId);

  // Delete all existing tags for these products in one query
  await db.delete(productTags)
    .where(inArray(productTags.productId, productIds));

  // Build all tag assignments to insert
  const toInsert: { productId: string; tagId: string }[] = [];
  for (const assignment of assignments) {
    for (const tagId of assignment.tagIds) {
      toInsert.push({ productId: assignment.productId, tagId });
    }
  }

  if (toInsert.length === 0) return 0;

  // Insert all tags in one query
  await db.insert(productTags).values(toInsert);

  return toInsert.length;
}

// =============================================================================
// BATCH UPSERT PRODUCT LINKS
// =============================================================================

/**
 * Batch upsert product links in a single query.
 */
export async function batchUpsertProductLinks(
  db: Database,
  links: ProductLinkUpsertData[]
): Promise<void> {
  if (links.length === 0) return;

  const now = new Date().toISOString();

  await db.insert(integrationProductLinks)
    .values(links.map(link => ({
      brandIntegrationId: link.brandIntegrationId,
      productId: link.productId,
      externalId: link.externalId,
      externalName: link.externalName,
      lastSyncedHash: link.lastSyncedHash,
      lastSyncedAt: now,
    })))
    .onConflictDoUpdate({
      target: [
        integrationProductLinks.brandIntegrationId,
        integrationProductLinks.externalId,
      ],
      set: {
        externalName: sql`EXCLUDED.external_name`,
        lastSyncedHash: sql`EXCLUDED.last_synced_hash`,
        lastSyncedAt: sql`EXCLUDED.last_synced_at`,
        updatedAt: now,
      },
    });
}

// =============================================================================
// BATCH UPSERT VARIANT LINKS (re-export from variant-links.ts for convenience)
// =============================================================================

export { batchUpsertVariantLinks } from "./links/variant-links";

// =============================================================================
// BATCH REPLACE VARIANT ATTRIBUTES
// =============================================================================

import { productVariantAttributes } from "../../schema";

export interface VariantAttributeAssignmentData {
  variantId: string;
  attributeValueIds: string[];
}

/**
 * Batch replace variant attribute assignments.
 * Deletes existing assignments for the given variants, then inserts new ones.
 * Preserves the order of attributeValueIds via sortOrder.
 *
 * @param db - Database connection
 * @param assignments - Array of variant -> attribute value ID assignments
 * @returns Number of assignments created
 */
export async function batchReplaceVariantAttributes(
  db: Database,
  assignments: VariantAttributeAssignmentData[]
): Promise<number> {
  if (assignments.length === 0) return 0;

  const variantIds = assignments.map((a) => a.variantId);

  // Delete all existing assignments for these variants in one query
  await db
    .delete(productVariantAttributes)
    .where(inArray(productVariantAttributes.variantId, variantIds));

  // Build all assignments to insert with sort order
  const toInsert: Array<{
    variantId: string;
    attributeValueId: string;
    sortOrder: number;
  }> = [];

  for (const assignment of assignments) {
    for (let i = 0; i < assignment.attributeValueIds.length; i++) {
      toInsert.push({
        variantId: assignment.variantId,
        attributeValueId: assignment.attributeValueIds[i]!,
        sortOrder: i,
      });
    }
  }

  if (toInsert.length === 0) return 0;

  // Insert all assignments in one query
  await db.insert(productVariantAttributes).values(toInsert);

  return toInsert.length;
}

// =============================================================================
// VARIANT OVERRIDE BATCH OPERATIONS
// =============================================================================

import {
  variantCommercial,
  variantEnvironment,
  variantMaterials,
  variantWeight,
  variantJourneySteps,
  variantEcoClaims,
} from "../../schema";

/**
 * Upsert data for variant commercial overrides.
 */
export interface VariantCommercialUpsertData {
  variantId: string;
  webshopUrl?: string | null;
  price?: string | null;
  currency?: string | null;
  salesStatus?: string | null;
  sourceIntegration?: string | null;
  sourceExternalId?: string | null;
}

/**
 * Batch upsert variant commercial data.
 * Uses INSERT ON CONFLICT DO UPDATE for efficient upsert.
 *
 * @returns Number of rows upserted
 */
export async function batchUpsertVariantCommercial(
  db: Database,
  data: VariantCommercialUpsertData[]
): Promise<number> {
  if (data.length === 0) return 0;

  const now = new Date().toISOString();

  // Filter to only records that have at least one commercial field set
  const validData = data.filter(
    (d) =>
      d.webshopUrl !== undefined ||
      d.price !== undefined ||
      d.currency !== undefined ||
      d.salesStatus !== undefined
  );

  if (validData.length === 0) return 0;

  await db
    .insert(variantCommercial)
    .values(
      validData.map((d) => ({
        variantId: d.variantId,
        webshopUrl: d.webshopUrl ?? null,
        price: d.price ?? null,
        currency: d.currency ?? null,
        salesStatus: d.salesStatus ?? null,
        sourceIntegration: d.sourceIntegration ?? null,
        sourceExternalId: d.sourceExternalId ?? null,
        createdAt: now,
        updatedAt: now,
      }))
    )
    .onConflictDoUpdate({
      target: variantCommercial.variantId,
      set: {
        webshopUrl: sql`EXCLUDED.webshop_url`,
        price: sql`EXCLUDED.price`,
        currency: sql`EXCLUDED.currency`,
        salesStatus: sql`EXCLUDED.sales_status`,
        sourceIntegration: sql`EXCLUDED.source_integration`,
        sourceExternalId: sql`EXCLUDED.source_external_id`,
        updatedAt: now,
      },
    });

  return validData.length;
}

/**
 * Upsert data for variant environment overrides.
 */
export interface VariantEnvironmentUpsertData {
  variantId: string;
  carbonKgCo2e?: string | null;
  waterLiters?: string | null;
  sourceIntegration?: string | null;
  sourceExternalId?: string | null;
}

/**
 * Batch upsert variant environment data.
 * Uses INSERT ON CONFLICT DO UPDATE for efficient upsert.
 *
 * @returns Number of rows upserted
 */
export async function batchUpsertVariantEnvironment(
  db: Database,
  data: VariantEnvironmentUpsertData[]
): Promise<number> {
  if (data.length === 0) return 0;

  const now = new Date().toISOString();

  // Filter to only records that have at least one environment field set
  const validData = data.filter(
    (d) => d.carbonKgCo2e !== undefined || d.waterLiters !== undefined
  );

  if (validData.length === 0) return 0;

  await db
    .insert(variantEnvironment)
    .values(
      validData.map((d) => ({
        variantId: d.variantId,
        carbonKgCo2e: d.carbonKgCo2e ?? null,
        waterLiters: d.waterLiters ?? null,
        sourceIntegration: d.sourceIntegration ?? null,
        sourceExternalId: d.sourceExternalId ?? null,
        createdAt: now,
        updatedAt: now,
      }))
    )
    .onConflictDoUpdate({
      target: variantEnvironment.variantId,
      set: {
        carbonKgCo2e: sql`EXCLUDED.carbon_kg_co2e`,
        waterLiters: sql`EXCLUDED.water_liters`,
        sourceIntegration: sql`EXCLUDED.source_integration`,
        sourceExternalId: sql`EXCLUDED.source_external_id`,
        updatedAt: now,
      },
    });

  return validData.length;
}

/**
 * Material data for variant material replacement.
 */
export interface VariantMaterialData {
  brandMaterialId: string;
  percentage?: string | null;
}

/**
 * Replacement data for variant materials.
 */
export interface VariantMaterialsReplacementData {
  variantId: string;
  materials: VariantMaterialData[];
  sourceIntegration?: string | null;
  sourceExternalId?: string | null;
}

/**
 * Batch replace variant materials.
 * Deletes existing materials for the given variants, then inserts new ones.
 *
 * @returns Number of material entries created
 */
export async function batchReplaceVariantMaterials(
  db: Database,
  data: VariantMaterialsReplacementData[]
): Promise<number> {
  if (data.length === 0) return 0;

  const variantIds = data.map((d) => d.variantId);

  // Delete all existing materials for these variants in one query
  await db
    .delete(variantMaterials)
    .where(inArray(variantMaterials.variantId, variantIds));

  // Build all materials to insert
  const now = new Date().toISOString();
  const toInsert: Array<{
    variantId: string;
    brandMaterialId: string;
    percentage: string | null;
    sourceIntegration: string | null;
    sourceExternalId: string | null;
    createdAt: string;
  }> = [];

  for (const item of data) {
    for (const material of item.materials) {
      toInsert.push({
        variantId: item.variantId,
        brandMaterialId: material.brandMaterialId,
        percentage: material.percentage ?? null,
        sourceIntegration: item.sourceIntegration ?? null,
        sourceExternalId: item.sourceExternalId ?? null,
        createdAt: now,
      });
    }
  }

  if (toInsert.length === 0) return 0;

  await db.insert(variantMaterials).values(toInsert);

  return toInsert.length;
}

/**
 * Upsert data for variant weight overrides.
 */
export interface VariantWeightUpsertData {
  variantId: string;
  weight?: string | null;
  weightUnit?: string | null;
  sourceIntegration?: string | null;
  sourceExternalId?: string | null;
}

/**
 * Batch upsert variant weight data.
 * Uses INSERT ON CONFLICT DO UPDATE for efficient upsert.
 *
 * @returns Number of rows upserted
 */
export async function batchUpsertVariantWeight(
  db: Database,
  data: VariantWeightUpsertData[]
): Promise<number> {
  if (data.length === 0) return 0;

  const now = new Date().toISOString();

  // Filter to only records that have at least one weight field set
  const validData = data.filter(
    (d) => d.weight !== undefined || d.weightUnit !== undefined
  );

  if (validData.length === 0) return 0;

  await db
    .insert(variantWeight)
    .values(
      validData.map((d) => ({
        variantId: d.variantId,
        weight: d.weight ?? null,
        weightUnit: d.weightUnit ?? null,
        sourceIntegration: d.sourceIntegration ?? null,
        sourceExternalId: d.sourceExternalId ?? null,
        createdAt: now,
        updatedAt: now,
      }))
    )
    .onConflictDoUpdate({
      target: variantWeight.variantId,
      set: {
        weight: sql`EXCLUDED.weight`,
        weightUnit: sql`EXCLUDED.weight_unit`,
        sourceIntegration: sql`EXCLUDED.source_integration`,
        sourceExternalId: sql`EXCLUDED.source_external_id`,
        updatedAt: now,
      },
    });

  return validData.length;
}

/**
 * Journey step data for variant journey replacement.
 */
export interface VariantJourneyStepData {
  sortIndex: number;
  stepType: string;
  facilityId: string;
}

/**
 * Replacement data for variant journey steps.
 */
export interface VariantJourneyReplacementData {
  variantId: string;
  steps: VariantJourneyStepData[];
  sourceIntegration?: string | null;
  sourceExternalId?: string | null;
}

/**
 * Batch replace variant journey steps.
 * Deletes existing journey steps for the given variants, then inserts new ones.
 *
 * @returns Number of journey steps created
 */
export async function batchReplaceVariantJourney(
  db: Database,
  data: VariantJourneyReplacementData[]
): Promise<number> {
  if (data.length === 0) return 0;

  const variantIds = data.map((d) => d.variantId);

  // Delete all existing journey steps for these variants in one query
  await db
    .delete(variantJourneySteps)
    .where(inArray(variantJourneySteps.variantId, variantIds));

  // Build all steps to insert
  const now = new Date().toISOString();
  const toInsert: Array<{
    variantId: string;
    sortIndex: number;
    stepType: string;
    facilityId: string;
    sourceIntegration: string | null;
    sourceExternalId: string | null;
    createdAt: string;
  }> = [];

  for (const item of data) {
    for (const step of item.steps) {
      toInsert.push({
        variantId: item.variantId,
        sortIndex: step.sortIndex,
        stepType: step.stepType,
        facilityId: step.facilityId,
        sourceIntegration: item.sourceIntegration ?? null,
        sourceExternalId: item.sourceExternalId ?? null,
        createdAt: now,
      });
    }
  }

  if (toInsert.length === 0) return 0;

  await db.insert(variantJourneySteps).values(toInsert);

  return toInsert.length;
}

/**
 * Replacement data for variant eco claims.
 */
export interface VariantEcoClaimsReplacementData {
  variantId: string;
  ecoClaimIds: string[];
  sourceIntegration?: string | null;
  sourceExternalId?: string | null;
}

/**
 * Batch replace variant eco claims.
 * Deletes existing eco claims for the given variants, then inserts new ones.
 *
 * @returns Number of eco claims created
 */
export async function batchReplaceVariantEcoClaims(
  db: Database,
  data: VariantEcoClaimsReplacementData[]
): Promise<number> {
  if (data.length === 0) return 0;

  const variantIds = data.map((d) => d.variantId);

  // Delete all existing eco claims for these variants in one query
  await db
    .delete(variantEcoClaims)
    .where(inArray(variantEcoClaims.variantId, variantIds));

  // Build all eco claims to insert
  const now = new Date().toISOString();
  const toInsert: Array<{
    variantId: string;
    ecoClaimId: string;
    sourceIntegration: string | null;
    sourceExternalId: string | null;
    createdAt: string;
  }> = [];

  for (const item of data) {
    for (const ecoClaimId of item.ecoClaimIds) {
      toInsert.push({
        variantId: item.variantId,
        ecoClaimId,
        sourceIntegration: item.sourceIntegration ?? null,
        sourceExternalId: item.sourceExternalId ?? null,
        createdAt: now,
      });
    }
  }

  if (toInsert.length === 0) return 0;

  await db.insert(variantEcoClaims).values(toInsert);

  return toInsert.length;
}
