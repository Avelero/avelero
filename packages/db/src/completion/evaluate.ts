import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { Database } from "../client";
import {
  passportTemplateModules,
  productModuleCompletion,
  products,
} from "../schema";
import type { ModuleKey } from "./module-keys";
import { RULES } from "./rules";

/**
 * Evaluates and upserts completion status for product modules.
 *
 * This function:
 * 1. Retrieves the product and its associated template
 * 2. Determines which modules are enabled in the template
 * 3. Evaluates completion status for each enabled module
 * 4. Upserts the completion status into product_module_completion
 * 5. Prunes completion records for disabled modules
 *
 * @param db - Database instance
 * @param brandId - Brand identifier for authorization
 * @param productId - Product identifier to evaluate
 * @param opts - Optional configuration
 * @param opts.onlyModules - If provided, only evaluate these specific modules
 * @returns Promise that resolves when evaluation is complete
 */
export async function evaluateAndUpsertCompletion(
  db: Database,
  brandId: string,
  productId: string,
  opts?: { onlyModules?: ModuleKey[] },
): Promise<void> {
  // Resolve product and template enabled modules
  const [product] = await db
    .select({
      id: products.id,
      templateId: products.templateId,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);

  if (!product) return;

  // If product has no template, return early with no enabled modules
  if (!product.templateId) {
    return;
  }

  // Get enabled modules from the template
  const enabledModulesRows = await db
    .select({ moduleKey: passportTemplateModules.moduleKey })
    .from(passportTemplateModules)
    .where(
      and(
        eq(passportTemplateModules.templateId, product.templateId),
        eq(passportTemplateModules.enabled, true),
      ),
    );

  const enabled = new Set<ModuleKey>(
    enabledModulesRows.map((r) => r.moduleKey as ModuleKey),
  );

  const targetModules: ModuleKey[] = (
    opts?.onlyModules ?? Array.from(enabled)
  ).filter((k) => enabled.has(k)) as ModuleKey[];

  if (!targetModules.length) {
    // Nothing to evaluate; still prune rows for modules no longer enabled
    await pruneDisabledModules(db, productId, Array.from(enabled));
    return;
  }

  // Evaluate in parallel with minimal reads per rule
  const results = await Promise.all(
    targetModules.map(async (key) => {
      const rule = RULES[key];
      const isCompleted = rule ? await rule.evaluate({ db, productId }) : false;
      return { key, isCompleted } as const;
    }),
  );

  // Upsert results into product_module_completion
  await db
    .insert(productModuleCompletion)
    .values(
      results.map((r) => ({
        productId: product.id,
        moduleKey: r.key,
        isCompleted: r.isCompleted,
        lastEvaluatedAt: new Date().toISOString(),
      })),
    )
    .onConflictDoUpdate({
      target: [
        productModuleCompletion.productId,
        productModuleCompletion.moduleKey,
      ],
      set: {
        isCompleted: (productModuleCompletion as any).excluded.isCompleted,
        lastEvaluatedAt: (productModuleCompletion as any).excluded
          .lastEvaluatedAt,
      },
    });

  // Prune rows for modules that are no longer enabled
  await pruneDisabledModules(db, productId, Array.from(enabled));
}

/**
 * Removes completion records for modules that are no longer enabled in the template.
 *
 * @param db - Database instance
 * @param productId - Product identifier
 * @param enabledKeys - Array of currently enabled module keys
 * @returns Promise that resolves when pruning is complete
 */
async function pruneDisabledModules(
  db: Database,
  productId: string,
  enabledKeys: string[],
): Promise<void> {
  if (!enabledKeys.length) {
    await db
      .delete(productModuleCompletion)
      .where(eq(productModuleCompletion.productId, productId));
    return;
  }
  await db
    .delete(productModuleCompletion)
    .where(
      and(
        eq(productModuleCompletion.productId, productId),
        notInArray(productModuleCompletion.moduleKey, enabledKeys),
      ),
    );
}
