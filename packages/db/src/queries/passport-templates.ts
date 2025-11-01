import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client";
import type { ModuleKey } from "../completion/module-keys";
import { syncTemplateModuleDelta } from "../completion/template-sync";
import { passportTemplateModules, passportTemplates } from "../schema";

export interface PassportTemplateModuleRow {
  readonly module_key: string;
  readonly enabled: boolean;
  readonly sort_index: number;
}

export interface PassportTemplateRecord {
  readonly id: string;
  readonly brand_id: string;
  readonly name: string;
  readonly theme: Record<string, unknown>;
  readonly created_at: string;
  readonly updated_at: string;
  readonly modules?: PassportTemplateModuleRow[];
}

function normalizeTheme(theme: unknown): Record<string, unknown> {
  if (theme && typeof theme === "object") {
    return theme as Record<string, unknown>;
  }
  return {};
}

function mapTemplate(row: {
  id: string;
  brandId: string;
  name: string;
  theme: unknown;
  createdAt: string;
  updatedAt: string;
}): PassportTemplateRecord {
  return {
    id: row.id,
    brand_id: row.brandId,
    name: row.name,
    theme: normalizeTheme(row.theme),
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function listPassportTemplatesForBrand(
  db: Database,
  brandId: string,
): Promise<PassportTemplateRecord[]> {
  const rows = await db
    .select({
      id: passportTemplates.id,
      brandId: passportTemplates.brandId,
      name: passportTemplates.name,
      theme: passportTemplates.theme,
      createdAt: passportTemplates.createdAt,
      updatedAt: passportTemplates.updatedAt,
    })
    .from(passportTemplates)
    .where(eq(passportTemplates.brandId, brandId))
    .orderBy(asc(passportTemplates.createdAt));
  return rows.map(mapTemplate);
}

export async function getPassportTemplateWithModules(
  db: Database,
  brandId: string,
  templateId: string,
): Promise<PassportTemplateRecord | null> {
  const [template] = await db
    .select({
      id: passportTemplates.id,
      brandId: passportTemplates.brandId,
      name: passportTemplates.name,
      theme: passportTemplates.theme,
      createdAt: passportTemplates.createdAt,
      updatedAt: passportTemplates.updatedAt,
    })
    .from(passportTemplates)
    .where(
      and(
        eq(passportTemplates.id, templateId),
        eq(passportTemplates.brandId, brandId),
      ),
    )
    .limit(1);
  if (!template) return null;

  const modules = await db
    .select({
      module_key: passportTemplateModules.moduleKey,
      enabled: passportTemplateModules.enabled,
      sort_index: passportTemplateModules.sortIndex,
    })
    .from(passportTemplateModules)
    .where(eq(passportTemplateModules.templateId, templateId))
    .orderBy(asc(passportTemplateModules.sortIndex));

  return {
    ...mapTemplate(template),
    modules: modules.map((m) => ({
      module_key: m.module_key,
      enabled: !!m.enabled,
      sort_index: m.sort_index,
    })),
  };
}

export async function createPassportTemplate(
  db: Database,
  brandId: string,
  input: {
    name: string;
    theme?: Record<string, unknown>;
    modules?: PassportTemplateModuleRow[];
  },
): Promise<PassportTemplateRecord> {
  let templateId: string | null = null;
  const modules = input.modules ?? [];

  await db.transaction(async (tx) => {
    const [template] = await tx
      .insert(passportTemplates)
      .values({
        brandId,
        name: input.name,
        theme: (input.theme ?? {}) as Record<string, unknown>,
      })
      .returning({ id: passportTemplates.id });
    if (!template) {
      throw new Error("Failed to create passport template");
    }
    templateId = template.id;

    if (modules.length > 0) {
      await tx.insert(passportTemplateModules).values(
        modules.map((module, index) => ({
          templateId: template.id,
          moduleKey: module.module_key,
          enabled: module.enabled ?? true,
          sortIndex: module.sort_index ?? index,
        })),
      );
    }
  });

  if (!templateId) {
    throw new Error("Passport template id missing after creation");
  }

  const enabledModules = modules
    .filter((module) => module.enabled ?? true)
    .map((module) => module.module_key as ModuleKey);
  if (enabledModules.length) {
    await syncTemplateModuleDelta(db, templateId, {
      added: enabledModules,
      removed: [],
    });
  }

  const created = await getPassportTemplateWithModules(db, brandId, templateId);
  if (!created) {
    throw new Error("Failed to load created passport template");
  }
  return created;
}

export async function updatePassportTemplate(
  db: Database,
  brandId: string,
  input: {
    id: string;
    name?: string;
    theme?: Record<string, unknown>;
    modules?: PassportTemplateModuleRow[];
  },
): Promise<PassportTemplateRecord | null> {
  let delta: { added: ModuleKey[]; removed: ModuleKey[] } | null = null;
  const modules = input.modules;

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: passportTemplates.id })
      .from(passportTemplates)
      .where(
        and(
          eq(passportTemplates.id, input.id),
          eq(passportTemplates.brandId, brandId),
        ),
      )
      .limit(1);
    if (!existing) {
      return false;
    }

    const updatePayload: Partial<typeof passportTemplates.$inferInsert> = {};
    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.theme !== undefined) {
      updatePayload.theme = input.theme ?? ({} as Record<string, unknown>);
    }
    if (Object.keys(updatePayload).length > 0) {
      await tx
        .update(passportTemplates)
        .set(updatePayload)
        .where(eq(passportTemplates.id, input.id));
    }

    if (modules) {
      const previousModules = await tx
        .select({
          module_key: passportTemplateModules.moduleKey,
          enabled: passportTemplateModules.enabled,
        })
        .from(passportTemplateModules)
        .where(eq(passportTemplateModules.templateId, input.id));

      await tx
        .delete(passportTemplateModules)
        .where(eq(passportTemplateModules.templateId, input.id));

      if (modules.length > 0) {
        await tx.insert(passportTemplateModules).values(
          modules.map((module, index) => ({
            templateId: input.id,
            moduleKey: module.module_key,
            enabled: module.enabled ?? true,
            sortIndex: module.sort_index ?? index,
          })),
        );
      }

      const prevEnabled = new Set(
        previousModules
          .filter((m) => m.enabled)
          .map((m) => m.module_key as ModuleKey),
      );
      const nextEnabled = new Set(
        modules
          .filter((m) => m.enabled ?? true)
          .map((m) => m.module_key as ModuleKey),
      );

      const added: ModuleKey[] = [];
      const removed: ModuleKey[] = [];
      for (const key of nextEnabled) {
        if (!prevEnabled.has(key)) added.push(key);
      }
      for (const key of prevEnabled) {
        if (!nextEnabled.has(key)) removed.push(key);
      }
      delta = { added, removed };
    }

    return true;
  });

  if (!updated) {
    return null;
  }

  if (delta) {
    await syncTemplateModuleDelta(db, input.id, delta);
  }

  return getPassportTemplateWithModules(db, brandId, input.id);
}

export async function deletePassportTemplate(
  db: Database,
  brandId: string,
  templateId: string,
): Promise<boolean> {
  const result = await db
    .delete(passportTemplates)
    .where(
      and(
        eq(passportTemplates.id, templateId),
        eq(passportTemplates.brandId, brandId),
      ),
    )
    .returning({ id: passportTemplates.id });

  return result.length > 0;
}

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
          target: [
            passportTemplateModules.templateId,
            passportTemplateModules.moduleKey,
          ],
          set: { enabled: true },
        });
    }
  });
  // Evaluate only added modules for all passports on this template
  await syncTemplateModuleDelta(db, templateId, {
    added: modules,
    removed: [],
  });
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
  await syncTemplateModuleDelta(db, templateId, {
    added: [],
    removed: modules,
  });
  return { count: modules.length } as const;
}
