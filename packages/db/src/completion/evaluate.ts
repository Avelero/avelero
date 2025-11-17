import { and, eq, inArray, notInArray } from "drizzle-orm";
import type { Database } from "../client";
import {
  passportModuleCompletion,
  passportTemplateModules,
  passports,
  products,
} from "../schema";
import type { ModuleKey } from "./module-keys";
import { RULES } from "./rules";

export async function evaluateAndUpsertCompletion(
  db: Database,
  brandId: string,
  productId: string,
  opts?: { onlyModules?: ModuleKey[] },
) {
  // Resolve passport and template enabled modules for this product/brand
  const [pp] = await db
    .select({
      passportId: passports.id,
      templateId: passports.templateId,
    })
    .from(passports)
    .innerJoin(products, eq(passports.productId, products.id))
    .where(and(eq(products.id, productId), eq(passports.brandId, brandId)))
    .limit(1);
  if (!pp) return;

  // If passport has no template, return early with no enabled modules
  if (!pp.templateId) {
    return;
  }

  const enabledModulesRows = await db
    .select({ moduleKey: passportTemplateModules.moduleKey })
    .from(passportTemplateModules)
    .where(
      and(
        eq(passportTemplateModules.templateId, pp.templateId),
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
    await pruneDisabledModules(db, pp.passportId, Array.from(enabled));
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

  // Upsert results
  await db
    .insert(passportModuleCompletion)
    .values(
      results.map((r) => ({
        passportId: pp.passportId,
        moduleKey: r.key,
        isCompleted: r.isCompleted,
        lastEvaluatedAt: new Date().toISOString(),
      })),
    )
    .onConflictDoUpdate({
      target: [
        passportModuleCompletion.passportId,
        passportModuleCompletion.moduleKey,
      ],
      set: {
        isCompleted: (passportModuleCompletion as any).excluded.isCompleted,
        lastEvaluatedAt: (passportModuleCompletion as any).excluded
          .lastEvaluatedAt,
      },
    });

  // Prune rows for modules that are no longer enabled
  await pruneDisabledModules(db, pp.passportId, Array.from(enabled));
}

async function pruneDisabledModules(
  db: Database,
  passportId: string,
  enabledKeys: string[],
) {
  if (!enabledKeys.length) {
    await db
      .delete(passportModuleCompletion)
      .where(eq(passportModuleCompletion.passportId, passportId));
    return;
  }
  await db
    .delete(passportModuleCompletion)
    .where(
      and(
        eq(passportModuleCompletion.passportId, passportId),
        notInArray(passportModuleCompletion.moduleKey, enabledKeys),
      ),
    );
}
