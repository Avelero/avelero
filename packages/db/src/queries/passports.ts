import { and, asc, count, desc, eq, inArray, sql, sum } from "drizzle-orm";
import type { Database } from "../client";
import {
  passports,
  passportTemplateModules,
  passportModuleCompletion,
  products,
  productVariants,
  passportTemplates,
  categories,
  brandColors,
  brandSizes,
} from "../schema";

export type CompletionXofN = {
  passportId: string;
  productId: string;
  completed: number;
  total: number;
};

export async function getCompletionForProducts(
  db: Database,
  brandId: string,
  productIds: string[],
): Promise<CompletionXofN[]> {
  if (!productIds.length) return [];

  const rows = await db
    .select({
      passportId: passports.id,
      productId: passports.productId,
      total: count(passportTemplateModules.moduleKey),
      completed: sum(
        sql`CASE WHEN ${passportModuleCompletion.isCompleted} = true THEN 1 ELSE 0 END`,
      ).mapWith(Number),
    })
    .from(passports)
    .leftJoin(
      passportTemplateModules,
      and(
        eq(passportTemplateModules.templateId, passports.templateId),
        eq(passportTemplateModules.enabled, true),
      ),
    )
    .leftJoin(
      passportModuleCompletion,
      and(
        eq(passportModuleCompletion.passportId, passports.id),
        eq(passportModuleCompletion.moduleKey, passportTemplateModules.moduleKey),
      ),
    )
    .where(and(eq(passports.brandId, brandId), inArray(passports.productId, productIds)))
    .groupBy(passports.id, passports.productId);

  return rows.map((r) => ({
    passportId: r.passportId,
    productId: r.productId,
    completed: Number(r.completed ?? 0),
    total: Number(r.total ?? 0),
  }));
}

export type ModuleIncompleteCount = {
  moduleKey: string;
  incomplete: number;
  total: number;
  completed: number;
};

export async function getIncompleteCountsByModuleForBrand(
  db: Database,
  brandId: string,
): Promise<ModuleIncompleteCount[]> {
  const rows = await db
    .select({
      moduleKey: passportTemplateModules.moduleKey,
      total: count(passports.id),
      completed: sum(
        sql`CASE WHEN ${passportModuleCompletion.isCompleted} = true THEN 1 ELSE 0 END`,
      ).mapWith(Number),
    })
    .from(passports)
    .innerJoin(
      passportTemplateModules,
      and(
        eq(passportTemplateModules.templateId, passports.templateId),
        eq(passportTemplateModules.enabled, true),
      ),
    )
    .leftJoin(
      passportModuleCompletion,
      and(
        eq(passportModuleCompletion.passportId, passports.id),
        eq(passportModuleCompletion.moduleKey, passportTemplateModules.moduleKey),
      ),
    )
    .where(eq(passports.brandId, brandId))
    .groupBy(passportTemplateModules.moduleKey);

  return rows.map((r) => {
    const total = Number(r.total ?? 0);
    const completed = Number(r.completed ?? 0);
    const incomplete = Math.max(0, total - completed);
    return { moduleKey: r.moduleKey, total, completed, incomplete };
  });
}

export async function getPassportStatusByProduct(
  db: Database,
  brandId: string,
  productId: string,
) {
  const rows = await db
    .select({ id: passports.id, status: passports.status })
    .from(passports)
    .where(and(eq(passports.brandId, brandId), eq(passports.productId, productId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function setPassportStatusByProduct(
  db: Database,
  brandId: string,
  productId: string,
  status: string,
) {
  const [row] = await db
    .update(passports)
    .set({ status })
    .where(and(eq(passports.brandId, brandId), eq(passports.productId, productId)))
    .returning({ id: passports.id, status: passports.status });
  return row ?? null;
}

// Completion for specific passports (X of N per passport)
export type CompletionForPassport = {
  passportId: string;
  completed: number;
  total: number;
};

export async function getCompletionForPassports(
  db: Database,
  passportIds: string[],
): Promise<CompletionForPassport[]> {
  if (!passportIds.length) return [];

  const rows = await db
    .select({
      passportId: passports.id,
      total: count(passportTemplateModules.moduleKey),
      completed: sum(
        sql`CASE WHEN ${passportModuleCompletion.isCompleted} = true THEN 1 ELSE 0 END`,
      ).mapWith(Number),
    })
    .from(passports)
    .leftJoin(
      passportTemplateModules,
      and(
        eq(passportTemplateModules.templateId, passports.templateId),
        eq(passportTemplateModules.enabled, true),
      ),
    )
    .leftJoin(
      passportModuleCompletion,
      and(
        eq(passportModuleCompletion.passportId, passports.id),
        eq(
          passportModuleCompletion.moduleKey,
          passportTemplateModules.moduleKey,
        ),
      ),
    )
    .where(inArray(passports.id, passportIds))
    .groupBy(passports.id);

  return rows.map((r) => ({
    passportId: r.passportId,
    completed: Number(r.completed ?? 0),
    total: Number(r.total ?? 0),
  }));
}

// List passports for a brand (page-only pagination, size=50, newest first)
export async function listPassports(
  db: Database,
  brandId: string,
  page: number,
) {
  const pageSize = 50;
  const offset = Math.max(0, page) * pageSize;

  const rows = await db
    .select({
      id: passports.id,
      status: passports.status,
      created_at: passports.createdAt,
      updated_at: passports.updatedAt,
      // product
      product_id: products.id,
      title: products.name,
      season: products.season,
      primary_image_url: products.primaryImageUrl,
      category_id: products.categoryId,
      // variant
      variant_sku: productVariants.sku,
      variant_upid: productVariants.upid,
      color_name: brandColors.name,
      size_name: brandSizes.name,
      // template
      template_id: passportTemplates.id,
      template_name: passportTemplates.name,
    })
    .from(passports)
    .innerJoin(products, eq(products.id, passports.productId))
    .innerJoin(productVariants, eq(productVariants.id, passports.variantId))
    .leftJoin(brandColors, eq(brandColors.id, productVariants.colorId))
    .leftJoin(brandSizes, eq(brandSizes.id, productVariants.sizeId))
    .innerJoin(passportTemplates, eq(passportTemplates.id, passports.templateId))
    .where(eq(passports.brandId, brandId))
    .orderBy(desc(passports.createdAt))
    .limit(pageSize)
    .offset(offset);

  const totalRes = await db
    .select({ value: count(passports.id) })
    .from(passports)
    .where(eq(passports.brandId, brandId));
  const total = Number(totalRes[0]?.value ?? 0);

  const passportIds = rows.map((r) => r.id);

  // Fetch enabled template modules for all templates present
  const templateIds = Array.from(new Set(rows.map((r) => r.template_id)));
  const templateModules = templateIds.length
    ? await db
        .select({
          template_id: passportTemplates.id,
          module_key: passportTemplateModules.moduleKey,
          sort_index: passportTemplateModules.sortIndex,
        })
        .from(passportTemplates)
        .innerJoin(
          passportTemplateModules,
          eq(passportTemplateModules.templateId, passportTemplates.id),
        )
        .where(eq(passportTemplateModules.enabled, true))
        .orderBy(asc(passportTemplateModules.sortIndex))
    : [];
  const templateIdToModules = new Map<string, { key: string }[]>(
    templateModules.reduce((acc, m) => {
      const list = acc.get(m.template_id) ?? [];
      list.push({ key: m.module_key });
      acc.set(m.template_id, list);
      return acc;
    }, new Map<string, { key: string }[]>()),
  );

  // Fetch completion rows for these passports
  const completionRows = passportIds.length
    ? await db
        .select({
          passport_id: passportModuleCompletion.passportId,
          module_key: passportModuleCompletion.moduleKey,
          is_completed: passportModuleCompletion.isCompleted,
        })
        .from(passportModuleCompletion)
        .where(inArray(passportModuleCompletion.passportId, passportIds))
    : [];
  const completionKey = new Map<string, boolean>();
  for (const r of completionRows) {
    completionKey.set(`${r.passport_id}:${r.module_key}`, !!r.is_completed);
  }

  // Fetch categories (id, name, parentId) to compute breadcrumb path
  const allCategories = await db
    .select({ id: categories.id, name: categories.name, parent_id: categories.parentId })
    .from(categories);
  const catById = new Map<string, { id: string; name: string; parent_id: string | null }>(
    allCategories.map((c) => [c.id, { id: c.id, name: c.name, parent_id: c.parent_id ?? null }]),
  );

  function buildCategoryPath(categoryId?: string | null): string[] {
    if (!categoryId) return [];
    const path: string[] = [];
    let current: string | null = categoryId;
    const guard = new Set<string>();
    while (current && !guard.has(current)) {
      guard.add(current);
      const node = catById.get(current);
      if (!node) break;
      // unshift to have root → leaf order
      path.unshift(node.name);
      current = node.parent_id ?? null;
    }
    return path;
  }

  const data = rows.map((r) => {
    const modDefs = templateIdToModules.get(r.template_id) ?? [];
    const modules = modDefs.map((m) => ({
      key: m.key,
      completed: completionKey.get(`${r.id}:${m.key}`) ?? false,
    }));
    const completedCount = modules.filter((m) => m.completed).length;
    const totalCount = modules.length;
    const sku = r.variant_sku ?? r.variant_upid ?? undefined;
    const categoryPath = buildCategoryPath(r.category_id);
    const category = categoryPath.length ? categoryPath[categoryPath.length - 1] : "-";
    return {
      id: r.id,
      title: r.title,
      sku,
      color: r.color_name ?? undefined,
      size: r.size_name ?? undefined,
      status: r.status as string,
      completedSections: completedCount,
      totalSections: totalCount,
      modules,
      category,
      categoryPath,
      season: r.season ?? undefined,
      template: {
        id: r.template_id,
        name: r.template_name,
        color: "#3B82F6", // static for now
      },
      passportUrl: undefined,
      primaryImageUrl: r.primary_image_url ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    } as const;
  });

  return { data, meta: { total } } as const;
}

export async function countPassportsByStatus(
  db: Database,
  brandId: string,
) {
  const rows = await db
    .select({ status: passports.status, value: count(passports.id) })
    .from(passports)
    .where(eq(passports.brandId, brandId))
    .groupBy(passports.status);

  const base = {
    published: 0,
    scheduled: 0,
    unpublished: 0,
    archived: 0,
  } as Record<string, number>;
  for (const r of rows) base[String(r.status)] = Number(r.value ?? 0);
  return base as {
    published: number;
    scheduled: number;
    unpublished: number;
    archived: number;
  };
}
