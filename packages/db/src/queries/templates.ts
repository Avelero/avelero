import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client";
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
      updatePayload.theme = input.theme as Record<string, unknown>;
    }

    const [result] = await tx
      .update(passportTemplates)
      .set(updatePayload)
      .where(eq(passportTemplates.id, input.id))
      .returning({
        id: passportTemplates.id,
        brandId: passportTemplates.brandId,
        name: passportTemplates.name,
        theme: passportTemplates.theme,
        createdAt: passportTemplates.createdAt,
        updatedAt: passportTemplates.updatedAt,
      });

    if (!result) {
      return false;
    }

    if (modules) {
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
    }

    return result;
  });

  if (!updated) return null;

  return getPassportTemplateWithModules(db, brandId, input.id);
}

export async function deletePassportTemplate(
  db: Database,
  brandId: string,
  templateId: string,
) {
  const [row] = await db
    .delete(passportTemplates)
    .where(
      and(
        eq(passportTemplates.id, templateId),
        eq(passportTemplates.brandId, brandId),
      ),
    )
    .returning({ id: passportTemplates.id });
  return row;
}
