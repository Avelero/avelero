import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import { passportTemplateModules, products } from "../schema";
import { evaluateAndUpsertCompletion } from "./evaluate";
import type { ModuleKey } from "./module-keys";

/**
 * Retrieves all enabled module keys for a given template.
 *
 * @param db - Database instance
 * @param templateId - Template identifier
 * @returns Array of enabled module keys
 */
async function getEnabledModulesForTemplate(
  db: Database,
  templateId: string | null,
): Promise<ModuleKey[]> {
  if (!templateId) return [];

  const rows = await db
    .select({ moduleKey: passportTemplateModules.moduleKey })
    .from(passportTemplateModules)
    .where(
      and(
        eq(passportTemplateModules.templateId, templateId),
        eq(passportTemplateModules.enabled, true),
      ),
    );
  return rows.map((r) => r.moduleKey as ModuleKey);
}

/**
 * Synchronizes module completion for all products using a template when modules are added/removed.
 *
 * When template modules are changed, this function:
 * 1. Finds all products using the template
 * 2. Evaluates newly added modules
 * 3. Prunes completion records for removed modules
 *
 * @param db - Database instance
 * @param templateId - Template that was modified
 * @param delta - Changes to modules (added/removed)
 * @param opts - Optional configuration
 * @param opts.batchSize - Number of products to process in parallel (default: 200, max: 1000)
 * @returns Promise that resolves when sync is complete
 */
export async function syncTemplateModuleDelta(
  db: Database,
  templateId: string,
  delta: { added: ModuleKey[]; removed: ModuleKey[] },
  opts?: { batchSize?: number },
): Promise<void> {
  const batchSize = Math.max(1, Math.min(opts?.batchSize ?? 200, 1000));

  // Find all products using this template
  const rows = await db
    .select({
      brandId: products.brandId,
      productId: products.id,
    })
    .from(products)
    .where(eq(products.templateId, templateId));

  // If only removals, we can prune using evaluate with no modules
  const onlyRemove = delta.added.length === 0 && delta.removed.length > 0;

  // Process products in batches
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    // Run evaluations in parallel per chunk
    await Promise.all(
      chunk.map(({ brandId, productId }) =>
        evaluateAndUpsertCompletion(
          db,
          brandId,
          productId,
          onlyRemove ? { onlyModules: [] } : { onlyModules: delta.added },
        ),
      ),
    );
  }
}

/**
 * Reassigns a product to a new template and updates completion status.
 *
 * This function:
 * 1. Updates the product's template_id
 * 2. Calculates which modules were added/removed
 * 3. Evaluates newly added modules
 * 4. Prunes completion records for removed modules
 *
 * @param db - Database instance
 * @param productId - Product identifier
 * @param brandId - Brand identifier for authorization
 * @param newTemplateId - New template to assign
 * @returns Promise that resolves when reassignment is complete
 */
export async function reassignProductTemplate(
  db: Database,
  productId: string,
  brandId: string,
  newTemplateId: string | null,
): Promise<void> {
  // Read current product state
  const [product] = await db
    .select({
      id: products.id,
      brandId: products.brandId,
      oldTemplateId: products.templateId,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);

  if (!product) return;
  if (product.oldTemplateId === newTemplateId) return;

  // Get enabled modules for both old and new templates
  const [oldEnabled, newEnabled] = await Promise.all([
    getEnabledModulesForTemplate(db, product.oldTemplateId),
    getEnabledModulesForTemplate(db, newTemplateId),
  ]);

  const oldSet = new Set<ModuleKey>(oldEnabled);
  const newSet = new Set<ModuleKey>(newEnabled);
  const added: ModuleKey[] = newEnabled.filter((k) => !oldSet.has(k));
  const removed: ModuleKey[] = oldEnabled.filter((k) => !newSet.has(k));

  // Update template assignment first so evaluator uses the new enabled set
  await db
    .update(products)
    .set({ templateId: newTemplateId })
    .where(eq(products.id, productId));

  // Evaluate only newly added modules; pruning will remove removed ones
  if (added.length > 0) {
    await evaluateAndUpsertCompletion(db, product.brandId, productId, {
      onlyModules: added,
    });
  } else if (removed.length > 0) {
    // Prune-only path
    await evaluateAndUpsertCompletion(db, product.brandId, productId, {
      onlyModules: [],
    });
  }
}
