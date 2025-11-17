import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  notInArray,
  sql,
  sum,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { Database } from "../client";
import { evaluateAndUpsertCompletion } from "../completion/evaluate";
import { reassignPassportTemplate } from "../completion/template-sync";
import {
  brandColors,
  brandSizes,
  categories,
  passportModuleCompletion,
  passportTemplateModules,
  passportTemplates,
  passports,
  productVariants,
  products,
} from "../schema";

export type PassportStatus =
  | "published"
  | "scheduled"
  | "unpublished"
  | "archived";

export interface PassportSummary {
  readonly id: string;
  readonly productId: string;
  readonly productUpid: string;
  readonly upid: string;
  readonly title: string;
  readonly sku?: string;
  readonly color?: string;
  readonly size?: string;
  readonly status: PassportStatus;
  readonly completedSections: number;
  readonly totalSections: number;
  readonly modules: { key: string; completed: boolean }[];
  readonly category: string;
  readonly categoryPath: string[];
  readonly season?: string;
  readonly template: {
    id: string;
    name: string;
    color: string;
  } | null;
  readonly passportUrl?: string;
  readonly primaryImageUrl?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

type PassportSelectRow = {
  id: string;
  product_id: string;
  product_upid: string | null;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
  title: string | null;
  season: string | null;
  primary_image_url: string | null;
  category_id: string | null;
  variant_sku: string | null;
  variant_upid: string | null;
  color_name: string | null;
  size_name: string | null;
  template_id: string | null;
  template_name: string | null;
};

function buildPassportWhereClause(
  brandId: string,
  filters?: { status?: readonly string[] },
) {
  const clauses = [eq(passports.brandId, brandId)];
  if (filters?.status && filters.status.length > 0) {
    clauses.push(inArray(passports.status, filters.status as string[]));
  }
  return and(...clauses);
}

async function hydratePassportRows(
  db: Database,
  rows: PassportSelectRow[],
): Promise<PassportSummary[]> {
  if (!rows.length) return [];

  const passportIds = rows.map((r) => r.id);
  const templateIds = Array.from(
    new Set(rows.map((r) => r.template_id).filter(Boolean)),
  );

  const templateModules = templateIds.length
    ? await db
        .select({
          template_id: passportTemplates.id,
          module_key: passportTemplateModules.moduleKey,
          sort_index: passportTemplateModules.sortIndex,
          enabled: passportTemplateModules.enabled,
        })
        .from(passportTemplates)
        .innerJoin(
          passportTemplateModules,
          eq(passportTemplateModules.templateId, passportTemplates.id),
        )
        .orderBy(asc(passportTemplateModules.sortIndex))
    : [];
  const templateIdToModules = new Map<
    string,
    { key: string; enabled: boolean }[]
  >(
    templateModules.reduce((acc, m) => {
      const list = acc.get(m.template_id) ?? [];
      list.push({ key: m.module_key, enabled: !!m.enabled });
      acc.set(m.template_id, list);
      return acc;
    }, new Map<string, { key: string; enabled: boolean }[]>()),
  );

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

  // Only fetch categories that are used in the current passport set
  const uniqueCategoryIds = Array.from(
    new Set(
      rows
        .map((r) => r.category_id)
        .filter((id): id is string => id !== null && id !== undefined),
    ),
  );

  const catById = new Map<
    string,
    { id: string; name: string; parent_id: string | null }
  >();

  // Fetch categories iteratively, including ancestors
  let pendingIds = uniqueCategoryIds;
  const maxDepth = 10; // Safety limit to prevent infinite loops
  for (let depth = 0; depth < maxDepth && pendingIds.length > 0; depth++) {
    const fetchIds = pendingIds.filter((id) => !catById.has(id));
    if (fetchIds.length === 0) break;

    const fetchedCategories = await db
      .select({
        id: categories.id,
        name: categories.name,
        parent_id: categories.parentId,
      })
      .from(categories)
      .where(inArray(categories.id, fetchIds));

    if (fetchedCategories.length === 0) break;

    const nextIds = new Set<string>();

    for (const cat of fetchedCategories) {
      if (!catById.has(cat.id)) {
        catById.set(cat.id, {
          id: cat.id,
          name: cat.name,
          parent_id: cat.parent_id ?? null,
        });
      }
      if (cat.parent_id && !catById.has(cat.parent_id)) {
        nextIds.add(cat.parent_id);
      }
    }

    pendingIds = Array.from(nextIds);
  }

  const buildCategoryPath = (categoryId?: string | null): string[] => {
    if (!categoryId) return [];
    const path: string[] = [];
    let current: string | null = categoryId;
    const guard = new Set<string>();
    while (current && !guard.has(current)) {
      guard.add(current);
      const node = catById.get(current);
      if (!node) break;
      path.unshift(node.name);
      current = node.parent_id ?? null;
    }
    return path;
  };

  return rows.map((r) => {
    const modDefs =
      (r.template_id
        ? templateIdToModules.get(r.template_id)?.filter((m) => m.enabled)
        : undefined) ?? [];
    const modules = modDefs.map((m) => ({
      key: m.key,
      completed: completionKey.get(`${r.id}:${m.key}`) ?? false,
    }));
    const completedCount = modules.filter((m) => m.completed).length;
    const totalCount = modules.length;
    const sku = r.variant_sku ?? r.variant_upid ?? undefined;
    const categoryPath = buildCategoryPath(r.category_id);
    const category = categoryPath.at(-1) ?? "-";

    return {
      id: r.id,
      productId: r.product_id,
      productUpid: r.product_upid ?? "",
      upid: r.slug,
      title: r.title ?? "-",
      sku,
      color: r.color_name ?? undefined,
      size: r.size_name ?? undefined,
      status: r.status as PassportStatus,
      completedSections: completedCount,
      totalSections: totalCount,
      modules,
      category,
      categoryPath,
      season: r.season ?? undefined,
      template: r.template_id
        ? {
            id: r.template_id,
            name: r.template_name ?? "Untitled",
            color: "#3B82F6",
          }
        : null,
      passportUrl: undefined,
      primaryImageUrl: r.primary_image_url ?? undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export async function listPassportsForBrand(
  db: Database,
  brandId: string,
  opts: {
    page?: number;
    filters?: { status?: readonly string[] };
  } = {},
): Promise<{
  readonly data: PassportSummary[];
  readonly meta: {
    total: number;
    productTotal: number;
  };
}> {
  const pageSize = 50;
  const page = Math.max(0, opts.page ?? 0);
  const offset = page * pageSize;
  const whereExpr = buildPassportWhereClause(brandId, opts.filters);

  const rows = await db
    .select({
      id: passports.id,
      product_id: products.id,
      product_upid: products.productUpid,
      slug: passports.slug,
      status: passports.status,
      created_at: passports.createdAt,
      updated_at: passports.updatedAt,
      title: products.name,
      season: products.season,
      primary_image_url: products.primaryImageUrl,
      category_id: products.categoryId,
      variant_sku: productVariants.sku,
      variant_upid: productVariants.upid,
      color_name: brandColors.name,
      size_name: brandSizes.name,
      template_id: passportTemplates.id,
      template_name: passportTemplates.name,
    })
    .from(passports)
    .innerJoin(products, eq(products.id, passports.productId))
    .innerJoin(productVariants, eq(productVariants.id, passports.variantId))
    .leftJoin(brandColors, eq(brandColors.id, productVariants.colorId))
    .leftJoin(brandSizes, eq(brandSizes.id, productVariants.sizeId))
    .leftJoin(
      passportTemplates,
      eq(passportTemplates.id, passports.templateId),
    )
    .where(whereExpr)
    .orderBy(desc(passports.createdAt))
    .limit(pageSize)
    .offset(offset);

  const totalRes = await db
    .select({
      passportCount: count(passports.id),
      productCount: sql<number>`COUNT(DISTINCT ${passports.productId})`,
    })
    .from(passports)
    .where(whereExpr);
  const total = Number(totalRes[0]?.passportCount ?? 0);
  const productTotal = Number(totalRes[0]?.productCount ?? 0);

  const data = await hydratePassportRows(db, rows);
  const meta: {
    total: number;
    productTotal: number;
  } = {
    total,
    productTotal,
  };
  return { data, meta };
}

export async function listPassports(
  db: Database,
  brandId: string,
  page: number,
) {
  return listPassportsForBrand(db, brandId, { page });
}

export async function getPassportByUpid(
  db: Database,
  brandId: string,
  upid: string,
): Promise<PassportSummary | null> {
  const rows = await db
    .select({
      id: passports.id,
      product_id: products.id,
      product_upid: products.productUpid,
      slug: passports.slug,
      status: passports.status,
      created_at: passports.createdAt,
      updated_at: passports.updatedAt,
      title: products.name,
      season: products.season,
      primary_image_url: products.primaryImageUrl,
      category_id: products.categoryId,
      variant_sku: productVariants.sku,
      variant_upid: productVariants.upid,
      color_name: brandColors.name,
      size_name: brandSizes.name,
      template_id: passportTemplates.id,
      template_name: passportTemplates.name,
    })
    .from(passports)
    .innerJoin(products, eq(products.id, passports.productId))
    .innerJoin(productVariants, eq(productVariants.id, passports.variantId))
    .leftJoin(brandColors, eq(brandColors.id, productVariants.colorId))
    .leftJoin(brandSizes, eq(brandSizes.id, productVariants.sizeId))
    .leftJoin(
      passportTemplates,
      eq(passportTemplates.id, passports.templateId),
    )
    .where(and(eq(passports.brandId, brandId), eq(passports.slug, upid)))
    .limit(1);

  const summaries = await hydratePassportRows(db, rows);
  return summaries[0] ?? null;
}

export async function createPassport(
  db: Database,
  brandId: string,
  input: {
    productId: string;
    variantId: string;
    templateId?: string | null;
    status?: PassportStatus;
  },
): Promise<PassportSummary> {
  const [variant] = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      upid: productVariants.upid,
      brandId: products.brandId,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productVariants.id, input.variantId))
    .limit(1);
  if (!variant) {
    throw new Error("Variant not found");
  }
  if (variant.brandId !== brandId) {
    throw new Error("Variant does not belong to the active brand");
  }
  if (variant.productId !== input.productId) {
    throw new Error("Variant does not belong to the provided product");
  }

  const templateId = input.templateId ?? null;
  if (templateId) {
    const [template] = await db
      .select({ id: passportTemplates.id, brandId: passportTemplates.brandId })
      .from(passportTemplates)
      .where(eq(passportTemplates.id, templateId))
      .limit(1);
    if (!template || template.brandId !== brandId) {
      throw new Error("Template not found for active brand");
    }
  }

  const slug = variant.upid;
  if (!slug) {
    throw new Error("Variant must have a UPID to create a passport");
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: passports.id })
      .from(passports)
      .where(and(eq(passports.brandId, brandId), eq(passports.slug, slug)))
      .limit(1);
    if (existing) {
      throw new Error("Passport already exists for this UPID");
    }

    const [inserted] = await tx
      .insert(passports)
      .values({
        brandId,
        productId: input.productId,
        variantId: input.variantId,
        templateId,
        status: input.status ?? "unpublished",
        slug,
      })
      .returning({ id: passports.id });
    if (!inserted) {
      throw new Error("Failed to create passport");
    }

    await evaluateAndUpsertCompletion(
      tx as unknown as Database,
      brandId,
      input.productId,
    );
  });

  const created = await getPassportByUpid(db, brandId, slug);
  if (!created) {
    throw new Error("Failed to load created passport");
  }
  return created;
}

export async function updatePassport(
  db: Database,
  brandId: string,
  upid: string,
  input: { status?: PassportStatus; templateId?: string },
): Promise<PassportSummary> {
  await db.transaction(async (tx) => {
    const [passportRow] = await tx
      .select({
        id: passports.id,
        productId: passports.productId,
        templateId: passports.templateId,
      })
      .from(passports)
      .where(and(eq(passports.brandId, brandId), eq(passports.slug, upid)))
      .limit(1);
    if (!passportRow) {
      throw new Error("Passport not found");
    }

    if (input.templateId && input.templateId !== passportRow.templateId) {
      const [template] = await tx
        .select({
          id: passportTemplates.id,
          brandId: passportTemplates.brandId,
        })
        .from(passportTemplates)
        .where(eq(passportTemplates.id, input.templateId))
        .limit(1);
      if (!template || template.brandId !== brandId) {
        throw new Error("Template not found for active brand");
      }

      await reassignPassportTemplate(
        tx as unknown as Database,
        passportRow.id,
        input.templateId,
      );
    }

    const updatePayload: Partial<typeof passports.$inferInsert> = {};
    if (input.status) {
      updatePayload.status = input.status;
    }

    if (Object.keys(updatePayload).length > 0) {
      await tx
        .update(passports)
        .set(updatePayload)
        .where(eq(passports.id, passportRow.id));
    }
  });

  const updated = await getPassportByUpid(db, brandId, upid);
  if (!updated) {
    throw new Error("Passport not found after update");
  }
  return updated;
}

export async function deletePassport(
  db: Database,
  brandId: string,
  upid: string,
): Promise<{ upid: string } | null> {
  const [row] = await db
    .delete(passports)
    .where(and(eq(passports.brandId, brandId), eq(passports.slug, upid)))
    .returning({ slug: passports.slug });
  if (!row) return null;
  return { upid: row.slug };
}

// Generic bulk update helper (extendable beyond status later)
export type BulkSelection =
  | { mode: "all"; excludeIds: string[] }
  | { mode: "explicit"; includeIds: string[] };

export type BulkChanges = {
  status?: "published" | "scheduled" | "unpublished" | "archived";
};

export async function bulkUpdatePassports(
  db: Database,
  brandId: string,
  selection: BulkSelection,
  changes: BulkChanges,
): Promise<number> {
  // Build SET map from allowed fields
  const setValues: Record<string, unknown> = {};
  if (changes.status) setValues[passports.status.name] = changes.status;

  if (Object.keys(setValues).length === 0) return 0;

  // Base where by brand
  let whereExpr: SQL = eq(passports.brandId, brandId) as unknown as SQL;
  if (selection.mode === "explicit") {
    if (!selection.includeIds.length) return 0;
    const combined = and(
      whereExpr,
      inArray(passports.id, selection.includeIds),
    );
    whereExpr = (combined as SQL | undefined) ?? (whereExpr as SQL);
  } else {
    // all mode: optionally exclude ids
    if (selection.excludeIds.length) {
      const combined = and(
        whereExpr,
        notInArray(passports.id, selection.excludeIds),
      );
      whereExpr = (combined as SQL | undefined) ?? (whereExpr as SQL);
    }
  }

  const res = await db
    .update(passports)
    .set(setValues as any)
    .where(whereExpr)
    .returning({ id: passports.id });
  return res.length;
}