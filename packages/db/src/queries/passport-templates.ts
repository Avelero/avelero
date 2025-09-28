import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import { passportTemplateModules } from "../schema";
import type { ModuleKey } from "../completion/module-keys";
import { syncTemplateModuleDelta } from "../completion/template-sync";

export async function enableTemplateModules(
  db: Database,
  templateId: string,
  modules: ModuleKey[],
) {
  if (!modules.length) return { count: 0 } as const;
  await db.transaction(async (tx) => {
    // Set enabled=true for listed modules; insert missing rows
    for (const m of modules) {
      await tx
        .insert(passportTemplateModules)
        .values({ templateId, moduleKey: m, enabled: true, sortIndex: 0 })
        .onConflictDoUpdate({
          target: [passportTemplateModules.templateId, passportTemplateModules.moduleKey],
          set: { enabled: true },
        });
    }
  });
  // Evaluate only added modules for all passports on this template
  await syncTemplateModuleDelta(db, templateId, { added: modules, removed: [] });
  return { count: modules.length } as const;
}

export async function disableTemplateModules(
  db: Database,
  templateId: string,
  modules: ModuleKey[],
) {
  if (!modules.length) return { count: 0 } as const;
  await db
    .update(passportTemplateModules)
    .set({ enabled: false })
    .where(
      and(
        eq(passportTemplateModules.templateId, templateId),
        eq(passportTemplateModules.enabled, true),
        // Typing: `inArray` is not imported to keep this minimal; do per-module updates
        // If large sets are common, switch to inArray-based batch update.
        // We'll keep this simple with a chain of OR via multiple calls for now.
        // The per-item update approach is acceptable due to small module set size.
        eq(passportTemplateModules.moduleKey, modules[0] as string),
      ),
    );
  // For remaining modules beyond index 0, run updates individually
  for (let i = 1; i < modules.length; i++) {
    await db
      .update(passportTemplateModules)
      .set({ enabled: false })
      .where(
        and(
          eq(passportTemplateModules.templateId, templateId),
          eq(passportTemplateModules.moduleKey, modules[i] as string),
          eq(passportTemplateModules.enabled, true),
        ),
      );
  }
  // Prune-only path via delta with removed modules
  await syncTemplateModuleDelta(db, templateId, { added: [], removed: modules });
  return { count: modules.length } as const;
}


