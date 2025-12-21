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
// TYPES
// =============================================================================

export interface ProductUpdateData {
  id: string;
  name?: string;
  description?: string | null;
  webshopUrl?: string | null;
  price?: string | null;
  currency?: string | null;
  salesStatus?: string | null;
  categoryId?: string | null;
}

export interface VariantUpdateData {
  id: string;
  sku?: string | null;
  barcode?: string | null;
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
 * @returns Number of products updated
 */
export async function batchUpdateProducts(
  db: Database,
  updates: ProductUpdateData[]
): Promise<number> {
  if (updates.length === 0) return 0;

  const now = new Date().toISOString();
  
  // Build VALUES rows with all updateable fields
  const valueRows: string[] = [];
  
  for (const update of updates) {
    const id = `'${update.id}'::uuid`;
    const name = update.name !== undefined 
      ? `'${update.name.replace(/'/g, "''")}'` 
      : 'NULL';
    const description = update.description !== undefined
      ? (update.description ? `'${update.description.replace(/'/g, "''")}'` : 'NULL')
      : 'NULL';
    const webshopUrl = update.webshopUrl !== undefined
      ? (update.webshopUrl ? `'${update.webshopUrl.replace(/'/g, "''")}'` : 'NULL')
      : 'NULL';
    const price = update.price !== undefined
      ? (update.price ? `'${update.price}'` : 'NULL')
      : 'NULL';
    const currency = update.currency !== undefined
      ? (update.currency ? `'${update.currency.replace(/'/g, "''")}'` : 'NULL')
      : 'NULL';
    const salesStatus = update.salesStatus !== undefined
      ? (update.salesStatus ? `'${update.salesStatus.replace(/'/g, "''")}'` : 'NULL')
      : 'NULL';
    const categoryId = update.categoryId !== undefined
      ? (update.categoryId ? `'${update.categoryId}'::uuid` : 'NULL::uuid')
      : 'NULL::uuid';
    
    valueRows.push(`(${id}, ${name}, ${description}, ${webshopUrl}, ${price}, ${currency}, ${salesStatus}, ${categoryId})`);
  }
  
  // Determine which columns have updates
  const hasName = updates.some(u => u.name !== undefined);
  const hasDescription = updates.some(u => u.description !== undefined);
  const hasWebshopUrl = updates.some(u => u.webshopUrl !== undefined);
  const hasPrice = updates.some(u => u.price !== undefined);
  const hasCurrency = updates.some(u => u.currency !== undefined);
  const hasSalesStatus = updates.some(u => u.salesStatus !== undefined);
  const hasCategoryId = updates.some(u => u.categoryId !== undefined);
  
  // Build SET clause
  const setClauses: string[] = [];
  if (hasName) setClauses.push('name = COALESCE(v.name, p.name)');
  if (hasDescription) setClauses.push('description = v.description');
  if (hasWebshopUrl) setClauses.push('webshop_url = v.webshop_url');
  if (hasPrice) setClauses.push('price = v.price');
  if (hasCurrency) setClauses.push('currency = v.currency');
  if (hasSalesStatus) setClauses.push('sales_status = v.sales_status');
  if (hasCategoryId) setClauses.push('category_id = v.category_id');
  setClauses.push(`updated_at = '${now}'`);
  
  if (setClauses.length === 1) {
    return 0;
  }
  
  const query = `
    UPDATE products AS p
    SET ${setClauses.join(', ')}
    FROM (VALUES ${valueRows.join(', ')}) AS v(id, name, description, webshop_url, price, currency, sales_status, category_id)
    WHERE p.id = v.id
  `;
  
  await db.execute(sql.raw(query));
  
  return updates.length;
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
 * @returns Number of variants updated
 */
export async function batchUpdateVariants(
  db: Database,
  updates: VariantUpdateData[]
): Promise<number> {
  if (updates.length === 0) return 0;
  
  const now = new Date().toISOString();
  
  // Build the VALUES clause rows
  // Format: (id::uuid, sku::text, barcode::text)
  const valueRows: string[] = [];
  
  for (const update of updates) {
    const id = `'${update.id}'::uuid`;
    const sku = update.sku !== undefined
      ? (update.sku ? `'${update.sku.replace(/'/g, "''")}'` : 'NULL')
      : 'NULL';
    const barcode = update.barcode !== undefined
      ? (update.barcode ? `'${update.barcode.replace(/'/g, "''")}'` : 'NULL')
      : 'NULL';
    
    valueRows.push(`(${id}, ${sku}, ${barcode})`);
  }
  
  // Determine which columns actually have updates (to avoid setting unchanged columns)
  const hasSkuUpdates = updates.some(u => u.sku !== undefined);
  const hasBarcodeUpdates = updates.some(u => u.barcode !== undefined);
  
  // Build SET clause - only update columns that have changes
  const setClauses: string[] = [];
  if (hasSkuUpdates) setClauses.push('sku = v.sku');
  if (hasBarcodeUpdates) setClauses.push('barcode = v.barcode');
  setClauses.push(`updated_at = '${now}'`);
  
  if (setClauses.length === 1) {
    // Only updated_at, nothing substantive to update
    return 0;
  }
  
  // Execute single UPDATE FROM VALUES query
  const query = `
    UPDATE product_variants AS pv
    SET ${setClauses.join(', ')}
    FROM (VALUES ${valueRows.join(', ')}) AS v(id, sku, barcode)
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

