import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import { passportTemplateModules, passports } from "../schema";
import { evaluateAndUpsertCompletion } from "./evaluate";
import type { ModuleKey } from "./module-keys";

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

export async function syncTemplateModuleDelta(
  db: Database,
  templateId: string,
  delta: { added: ModuleKey[]; removed: ModuleKey[] },
  opts?: { batchSize?: number },
) {
  const batchSize = Math.max(1, Math.min(opts?.batchSize ?? 200, 1000));

  // Find all passports using this template
  const rows = await db
    .select({
      passportId: passports.id,
      brandId: passports.brandId,
      productId: passports.productId,
    })
    .from(passports)
    .where(eq(passports.templateId, templateId));

  // If only removals, we can prune using evaluate with no modules
  const onlyRemove = delta.added.length === 0 && delta.removed.length > 0;

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

export async function reassignPassportTemplate(
  db: Database,
  passportId: string,
  newTemplateId: string,
) {
  // Read current passport state
  const [pp] = await db
    .select({
      id: passports.id,
      brandId: passports.brandId,
      productId: passports.productId,
      oldTemplateId: passports.templateId,
    })
    .from(passports)
    .where(eq(passports.id, passportId))
    .limit(1);
  if (!pp) return;
  if (pp.oldTemplateId === newTemplateId) return;

  const [oldEnabled, newEnabled] = await Promise.all([
    getEnabledModulesForTemplate(db, pp.oldTemplateId),
    getEnabledModulesForTemplate(db, newTemplateId),
  ]);

  const oldSet = new Set<ModuleKey>(oldEnabled);
  const newSet = new Set<ModuleKey>(newEnabled);
  const added: ModuleKey[] = newEnabled.filter((k) => !oldSet.has(k));
  const removed: ModuleKey[] = oldEnabled.filter((k) => !newSet.has(k));

  // Update template assignment first so evaluator uses the new enabled set
  await db
    .update(passports)
    .set({ templateId: newTemplateId })
    .where(eq(passports.id, passportId));

  // Evaluate only newly added modules; pruning will remove removed ones
  if (added.length > 0) {
    await evaluateAndUpsertCompletion(db, pp.brandId, pp.productId, {
      onlyModules: added,
    });
  } else if (removed.length > 0) {
    // Prune-only path
    await evaluateAndUpsertCompletion(db, pp.brandId, pp.productId, {
      onlyModules: [],
    });
  }
}
