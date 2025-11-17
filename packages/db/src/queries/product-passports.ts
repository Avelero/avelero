import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../client";
import { evaluateAndUpsertCompletion } from "../completion/evaluate";
import {
  categories,
  passportModuleCompletion,
  passportTemplateModules,
  passportTemplates,
  passports,
  productEnvironment,
  productJourneySteps,
  productMaterials,
  productVariants,
  products,
} from "../schema";
import { buildDatabaseErrorMessage, getDatabaseErrorMeta } from "../utils/errors.js";
import {
  generateUniqueUpid,
  generateUniqueUpids,
} from "../utils/upid.js";
import type { PassportStatus, PassportSummary } from "./passports.js";
import {
  setProductJourneySteps,
  upsertProductEnvironment,
  upsertProductMaterials,
} from "./product-attributes.js";
import { createProduct, upsertProductVariantsForBrand } from "./products.js";

const PRODUCT_IDENTIFIER_UNIQUE_CONSTRAINT =
  "products_brand_id_product_identifier_unq";

export type PassportStatusCounts = {
  published: number;
  scheduled: number;
  unpublished: number;
  archived: number;
};

const EMPTY_STATUS_COUNTS: PassportStatusCounts = {
  published: 0,
  scheduled: 0,
  unpublished: 0,
  archived: 0,
};

type ProductPassportSelectRow = {
  passportId: string;
  productId: string;
  productUpid: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
  title: string | null;
  season: string | null;
  primary_image_url: string | null;
  category_id: string | null;
  template_id: string | null;
  template_name: string | null;
};

export interface ProductPassportSummary
  extends Omit<PassportSummary, "id" | "productId" | "productUpid" | "upid"> {
  readonly id: string;
  readonly productUpid: string;
  readonly primaryUpid: string;
  readonly variantCount: number;
}

export interface ProductPassportListResult {
  readonly data: ProductPassportSummary[];
  readonly meta: {
    total: number;
    productTotal: number;
    statusCounts?: PassportStatusCounts;
  };
}

function buildProductPassportWhereClause(
  brandId: string,
  filters?: { status?: readonly string[] },
) {
  const clauses = [eq(passports.brandId, brandId)];
  if (filters?.status && filters.status.length > 0) {
    clauses.push(inArray(passports.status, filters.status as string[]));
  }
  return and(...clauses);
}

async function hydrateProductPassportRows(
  db: Database,
  rows: ProductPassportSelectRow[],
  variantCounts: Map<string, number>,
  productOrder: Map<string, number>,
): Promise<ProductPassportSummary[]> {
  if (!rows.length) return [];

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

  const passportIds = rows.map((r) => r.passportId);
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

  let pendingIds = uniqueCategoryIds;
  const maxDepth = 10;
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

  const summaries = rows.map((row) => {
    const modDefs =
      (row.template_id
        ? templateIdToModules.get(row.template_id)?.filter((m) => m.enabled)
        : undefined) ?? [];
    const modules = modDefs.map((m) => ({
      key: m.key,
      completed: completionKey.get(`${row.passportId}:${m.key}`) ?? false,
    }));
    const completedSections = modules.filter((m) => m.completed).length;
    const totalSections = modules.length;
    const categoryPath = buildCategoryPath(row.category_id);
    const category = categoryPath.at(-1) ?? "-";

    return {
      id: row.productId,
      productUpid: row.productUpid,
      primaryUpid: row.slug,
      title: row.title ?? "-",
      sku: undefined,
      color: undefined,
      size: undefined,
      status: row.status as PassportStatus,
      completedSections,
      totalSections,
      modules,
      category,
      categoryPath,
      season: row.season ?? undefined,
      template: row.template_id
        ? {
            id: row.template_id,
            name: row.template_name ?? "Untitled",
            color: "#3B82F6",
          }
        : null,
      passportUrl: undefined,
      primaryImageUrl: row.primary_image_url ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      variantCount: variantCounts.get(row.productId) ?? 0,
    } satisfies ProductPassportSummary;
  });

  summaries.sort((a, b) => {
    const orderA = productOrder.get(a.id) ?? 0;
    const orderB = productOrder.get(b.id) ?? 0;
    return orderA - orderB;
  });

  return summaries;
}

async function isVariantUpidTaken(db: Database, candidate: string) {
  const [existingPassport] = await db
    .select({ slug: passports.slug })
    .from(passports)
    .where(eq(passports.slug, candidate))
    .limit(1);
  if (existingPassport) {
    return true;
  }
  const [existingVariant] = await db
    .select({ upid: productVariants.upid })
    .from(productVariants)
    .where(eq(productVariants.upid, candidate))
    .limit(1);
  return Boolean(existingVariant);
}

async function fetchTakenVariantUpids(
  db: Database,
  candidates: readonly string[],
) {
  if (candidates.length === 0) {
    return new Set<string>();
  }
  const [existingPassports, existingVariants] = await Promise.all([
    db
      .select({ slug: passports.slug })
      .from(passports)
      .where(inArray(passports.slug, candidates)),
    db
      .select({ upid: productVariants.upid })
      .from(productVariants)
      .where(inArray(productVariants.upid, candidates)),
  ]);

  const taken = new Set<string>();
  for (const row of existingPassports) {
    if (row.slug) {
      taken.add(row.slug);
    }
  }
  for (const row of existingVariants) {
    if (row.upid) {
      taken.add(row.upid);
    }
  }
  return taken;
}

async function generateVariantUpids(db: Database, count: number) {
  return generateUniqueUpids({
    count,
    isTaken: (candidate) => isVariantUpidTaken(db, candidate),
    fetchTakenSet: (candidates) => fetchTakenVariantUpids(db, candidates),
  });
}

async function createPassportsForVariants(
  db: Database,
  brandId: string,
  productId: string,
  variantIds: string[],
  status?: PassportStatus | null,
  templateId?: string | null,
): Promise<Array<{ variantId: string; upid: string }>> {
  if (variantIds.length === 0) {
    return [];
  }

  return db.transaction(async (tx) => {
    if (templateId) {
      const [template] = await tx
        .select({
          id: passportTemplates.id,
          brandId: passportTemplates.brandId,
        })
        .from(passportTemplates)
        .where(eq(passportTemplates.id, templateId))
        .limit(1);
      if (!template || template.brandId !== brandId) {
        throw new Error("Template not found for active brand");
      }
    }

    const variantRows = await tx
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        upid: productVariants.upid,
        brandId: products.brandId,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(inArray(productVariants.id, variantIds));

    if (variantRows.length !== variantIds.length) {
      throw new Error("One or more variants were not found for passport creation");
    }

    const insertRows: Array<{
      brandId: string;
      productId: string;
      variantId: string;
      templateId: string | null;
      status: PassportStatus;
      slug: string;
    }> = [];

    for (const variant of variantRows) {
      if (variant.brandId !== brandId) {
        throw new Error("Variant does not belong to the active brand");
      }
      if (variant.productId !== productId) {
        throw new Error("Variant does not belong to the provided product");
      }
      if (!variant.upid) {
        throw new Error("Variant missing UPID assignment");
      }
      insertRows.push({
        brandId,
        productId,
        variantId: variant.id,
        templateId: templateId ?? null,
        status: (status ?? "unpublished") as PassportStatus,
        slug: variant.upid,
      });
    }

    const existing = await tx
      .select({ variantId: passports.variantId })
      .from(passports)
      .where(inArray(passports.variantId, variantIds));
    if (existing.length > 0) {
      throw new Error("Passport already exists for one or more variants");
    }

    await tx.insert(passports).values(insertRows);

    await evaluateAndUpsertCompletion(
      tx as unknown as Database,
      brandId,
      productId,
    );

    return insertRows.map((row) => ({
      variantId: row.variantId,
      upid: row.slug,
    }));
  });
}

export interface PassportWorkflowInput {
  title: string;
  productIdentifier?: string;
  description?: string;
  categoryId?: string | null;
  season?: string | null;
  seasonId?: string | null;
  brandCertificationId?: string | null;
  showcaseBrandId?: string | null;
  primaryImageUrl?: string | null;
  additionalImageUrls?: readonly string[] | null;
  tags?: readonly string[];
  sku: string;
  ean?: string | null;
  colorIds?: readonly string[];
  sizeIds?: readonly string[];
  status?: PassportStatus;
  templateId?: string | null;
  materials?: readonly { brandMaterialId: string; percentage?: number }[];
  journeySteps?: readonly {
    sortIndex: number;
    stepType: string;
    facilityId: string;
  }[];
  environment?: {
    carbonKgCo2e?: string;
    waterLiters?: string;
  };
}

export interface PassportWorkflowResult {
  productId: string;
  productUpid: string;
  variantIds: readonly string[];
  passports: readonly { variantId: string; upid: string }[];
  primaryUpid: string;
}

export interface PassportFormDataResult {
  productId: string;
  productUpid: string;
  passportUpid: string;
  status: PassportStatus;
  title: string;
  description: string | null;
  categoryId: string | null;
  season: string | null;
  showcaseBrandId: string | null;
  tagIds: string[];
  productIdentifier: string;
  primaryImageUrl: string | null;
  colorIds: string[];
  sizeIds: string[];
  ean: string | null;
  materials: Array<{ brandMaterialId: string; percentage: number }>;
  journeySteps: Array<{
    sortIndex: number;
    stepType: string;
    facilityId: string;
  }>;
  environment: { carbonKgCo2e?: string | null; waterLiters?: string | null } | null;
}

export interface PassportWorkflowUpdateInput {
  productUpid: string;
  productId: string;
  title: string;
  productIdentifier: string;
  description?: string;
  categoryId?: string | null;
  season?: string | null;
  showcaseBrandId?: string | null;
  primaryImageUrl?: string | null;
  tagIds?: readonly string[];
  sku: string;
  ean?: string | null;
  status?: PassportStatus;
  materials?: readonly { brandMaterialId: string; percentage?: number }[];
  journeySteps?: readonly {
    sortIndex: number;
    stepType: string;
    facilityId: string;
  }[];
  environment?: {
    carbonKgCo2e?: string;
    waterLiters?: string;
  };
}

export async function createPassportWorkflow(
  db: Database,
  brandId: string,
  input: PassportWorkflowInput,
): Promise<PassportWorkflowResult> {
  const identifier = input.productIdentifier?.trim();
  if (!identifier) {
    throw new Error("Product identifier is required");
  }

  let product: { id: string; upid: string } | undefined;
  try {
    product = await createProduct(db, brandId, {
      name: input.title,
      productIdentifier: identifier,
      description: input.description,
      categoryId: input.categoryId ?? undefined,
      season: input.season ?? undefined,
      seasonId: input.seasonId ?? undefined,
      brandCertificationId: input.brandCertificationId ?? undefined,
      showcaseBrandId: input.showcaseBrandId ?? undefined,
      primaryImageUrl: input.primaryImageUrl ?? undefined,
      additionalImageUrls: input.additionalImageUrls
        ? input.additionalImageUrls.join("|")
        : undefined,
      tags:
        input.tags && input.tags.length > 0 ? input.tags.join("|") : undefined,
    });
  } catch (error) {
    const meta = getDatabaseErrorMeta(error);
    if (
      meta.code === "23505" &&
      meta.constraint === PRODUCT_IDENTIFIER_UNIQUE_CONSTRAINT
    ) {
      throw new Error(
        `Product identifier '${identifier}' already exists for this brand.`,
      );
    }
    throw new Error(buildDatabaseErrorMessage(meta, "Failed to create product"));
  }

  const productId = product?.id;
  const productUpid = product?.upid;
  if (!productId) {
    throw new Error("Failed to create product");
  }
  if (!productUpid) {
    throw new Error("Failed to generate product UPID");
  }

  const colorList =
    input.colorIds && input.colorIds.length > 0
      ? [...input.colorIds]
      : [null];
  const sizeList =
    input.sizeIds && input.sizeIds.length > 0 ? [...input.sizeIds] : [null];

  const variantPayload: Array<{
    upid: string;
    sku: string | null;
    color_id: string | null;
    size_id: string | null;
    ean: string | null;
    status: string | null;
  }> = [];

  const variantCombinationCount = colorList.length * sizeList.length;
  const generatedUpids = await generateVariantUpids(
    db,
    variantCombinationCount,
  );
  const variantUpidOptions = {
    isTaken: (candidate: string) => isVariantUpidTaken(db, candidate),
  };
  let upidCursor = 0;
  for (const colorId of colorList) {
    for (const sizeId of sizeList) {
      const upid =
        generatedUpids[upidCursor++] ??
        (await generateUniqueUpid(variantUpidOptions));
      variantPayload.push({
        upid,
        sku: input.sku ?? null,
        color_id: colorId ?? null,
        size_id: sizeId ?? null,
        ean: input.ean ?? null,
        status: input.status ?? null,
      });
    }
  }

  if (variantPayload.length === 0) {
    const upid = await generateUniqueUpid(variantUpidOptions);
    variantPayload.push({
      upid,
      sku: input.sku ?? null,
      color_id: null,
      size_id: null,
      ean: input.ean ?? null,
      status: input.status ?? null,
    });
  }

  const variantResults = await upsertProductVariantsForBrand(
    db,
    brandId,
    productId,
    variantPayload,
  );

  const variantIds: string[] = [];
  for (const result of variantResults) {
    if (result.status !== "error" && result.variant_id) {
      variantIds.push(result.variant_id);
    }
  }

  if (variantIds.length === 0) {
    throw new Error("Failed to create product variants");
  }

  if (input.materials && input.materials.length > 0) {
    await upsertProductMaterials(
      db,
      productId,
      input.materials.map((item) => ({
        brandMaterialId: item.brandMaterialId,
        percentage: item.percentage,
      })),
    );
  }

  if (
    input.environment &&
    (input.environment.carbonKgCo2e || input.environment.waterLiters)
  ) {
    await upsertProductEnvironment(db, productId, input.environment);
  }

  if (input.journeySteps && input.journeySteps.length > 0) {
    await setProductJourneySteps(
      db,
      productId,
      input.journeySteps.map((step) => ({
        sortIndex: step.sortIndex,
        stepType: step.stepType,
        facilityId: step.facilityId,
      })),
    );
  }

  const passportsCreated = await createPassportsForVariants(
    db,
    brandId,
    productId,
    variantIds,
    input.status ?? "unpublished",
    input.templateId ?? null,
  );
  return {
    productId,
    productUpid,
    variantIds,
    passports: passportsCreated,
    primaryUpid: passportsCreated[0]?.upid ?? "",
  };
}

export async function getPassportFormData(
  db: Database,
  brandId: string,
  productUpid: string,
): Promise<PassportFormDataResult> {
  const [productRow] = await db
    .select({
      productId: products.id,
      productUpid: products.productUpid,
      productIdentifier: products.productIdentifier,
      productName: products.name,
      description: products.description,
      categoryId: products.categoryId,
      season: products.season,
      showcaseBrandId: products.showcaseBrandId,
      tags: products.tags,
      primaryImageUrl: products.primaryImageUrl,
    })
    .from(products)
    .where(and(eq(products.brandId, brandId), eq(products.productUpid, productUpid)))
    .limit(1);

  if (!productRow) {
    throw new Error("Product not found for the specified brand");
  }

  const [passportRow] = await db
    .select({
      passportSlug: passports.slug,
      status: passports.status,
    })
    .from(passports)
    .where(eq(passports.productId, productRow.productId))
    .orderBy(asc(passports.createdAt))
    .limit(1);

  if (!passportRow) {
    throw new Error("No passports found for this product");
  }

  const variants = await db
    .select({
      id: productVariants.id,
      colorId: productVariants.colorId,
      sizeId: productVariants.sizeId,
      ean: productVariants.ean,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, productRow.productId));

  const colorIds = Array.from(
    new Set(
      variants
        .map((variant) => variant.colorId)
        .filter((id): id is string => !!id),
    ),
  );

  const sizeIds = Array.from(
    new Set(
      variants
        .map((variant) => variant.sizeId)
        .filter((id): id is string => !!id),
    ),
  );

  const firstEan = variants.find((variant) => !!variant.ean)?.ean ?? null;

  const materialRows = await db
    .select({
      brandMaterialId: productMaterials.brandMaterialId,
      percentage: productMaterials.percentage,
    })
    .from(productMaterials)
    .where(eq(productMaterials.productId, productRow.productId));

  const materials = materialRows.map((row) => ({
    brandMaterialId: row.brandMaterialId,
    percentage: row.percentage ? Number(row.percentage) : 0,
  }));

  const journeyRows = await db
    .select({
      sortIndex: productJourneySteps.sortIndex,
      stepType: productJourneySteps.stepType,
      facilityId: productJourneySteps.facilityId,
    })
    .from(productJourneySteps)
    .where(eq(productJourneySteps.productId, productRow.productId))
    .orderBy(asc(productJourneySteps.sortIndex));

  const journeySteps = journeyRows.map((row) => ({
    sortIndex: row.sortIndex,
    stepType: row.stepType,
    facilityId: row.facilityId,
  }));

  const [environmentRow] = await db
    .select({
      carbon: productEnvironment.carbonKgCo2e,
      water: productEnvironment.waterLiters,
    })
    .from(productEnvironment)
    .where(eq(productEnvironment.productId, productRow.productId))
    .limit(1);

  const tagIds =
    productRow.tags
      ?.split("|")
      .map((tag) => tag.trim())
      .filter((tag) => !!tag) ?? [];

  return {
    productId: productRow.productId,
    productUpid: productRow.productUpid,
    passportUpid: passportRow.passportSlug,
    status: passportRow.status as PassportStatus,
    title: productRow.productName ?? "",
    description: productRow.description ?? null,
    categoryId: productRow.categoryId ?? null,
    season: productRow.season ?? null,
    showcaseBrandId: productRow.showcaseBrandId ?? null,
    tagIds,
    productIdentifier: productRow.productIdentifier,
    primaryImageUrl: productRow.primaryImageUrl ?? null,
    colorIds,
    sizeIds,
    ean: firstEan,
    materials,
    journeySteps,
    environment: environmentRow
      ? {
          carbonKgCo2e: environmentRow.carbon ?? null,
          waterLiters: environmentRow.water ?? null,
        }
      : null,
  };
}

export async function updatePassportWorkflow(
  db: Database,
  brandId: string,
  input: PassportWorkflowUpdateInput,
): Promise<PassportWorkflowResult> {
  const productIdentifier = input.productIdentifier?.trim();
  if (!productIdentifier) {
    throw new Error("Product identifier is required");
  }

  const tagsValue =
    input.tagIds && input.tagIds.length > 0
      ? input.tagIds.join("|")
      : null;

  await db.transaction(async (tx) => {
    const [productRow] = await tx
      .select({
        id: products.id,
      })
      .from(products)
      .where(
        and(
          eq(products.id, input.productId),
          eq(products.brandId, brandId),
          eq(products.productUpid, input.productUpid),
        ),
      )
      .limit(1);

    if (!productRow) {
      throw new Error("Product not found for this brand");
    }

    try {
      await tx
        .update(products)
        .set({
          name: input.title,
          productIdentifier,
          description: input.description ?? null,
          categoryId: input.categoryId ?? null,
          season: input.season ?? null,
          showcaseBrandId: input.showcaseBrandId ?? null,
          primaryImageUrl: input.primaryImageUrl ?? null,
          tags: tagsValue,
        })
        .where(and(eq(products.id, input.productId), eq(products.brandId, brandId)));
    } catch (error) {
      const meta = getDatabaseErrorMeta(error);
      if (
        meta.code === "23505" &&
        meta.constraint === PRODUCT_IDENTIFIER_UNIQUE_CONSTRAINT
      ) {
        throw new Error(
          `Product identifier '${productIdentifier}' already exists for this brand.`,
        );
      }
      throw new Error(buildDatabaseErrorMessage(meta, "Failed to update product"));
    }

    await tx
      .update(productVariants)
      .set({
        sku: input.sku ?? null,
        ean: input.ean ?? null,
      })
      .where(eq(productVariants.productId, input.productId));

    await tx
      .update(passports)
      .set({
        status: input.status ?? "unpublished",
      })
      .where(eq(passports.productId, input.productId));
  });

  await upsertProductMaterials(
    db,
    input.productId,
    (input.materials ?? []).map((material) => ({
      brandMaterialId: material.brandMaterialId,
      percentage: material.percentage,
    })),
  );

  await setProductJourneySteps(
    db,
    input.productId,
    (input.journeySteps ?? []).map((step) => ({
      sortIndex: step.sortIndex,
      stepType: step.stepType,
      facilityId: step.facilityId,
    })),
  );

  if (input.environment) {
    await upsertProductEnvironment(db, input.productId, {
      carbonKgCo2e: input.environment.carbonKgCo2e ?? undefined,
      waterLiters: input.environment.waterLiters ?? undefined,
    });
  } else {
    await upsertProductEnvironment(db, input.productId, {
      carbonKgCo2e: undefined,
      waterLiters: undefined,
    });
  }

  const variantRows = await db
    .select({
      id: productVariants.id,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, input.productId));

  const passportRows = await db
    .select({
      variantId: passports.variantId,
      slug: passports.slug,
    })
    .from(passports)
    .where(eq(passports.productId, input.productId));

  const [{ productUpid } = { productUpid: input.productUpid }] = await db
    .select({ productUpid: products.productUpid })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);

  return {
    productId: input.productId,
    productUpid: productUpid ?? input.productUpid,
    variantIds: variantRows.map((row) => row.id),
    passports: passportRows.map((row) => ({
      variantId: row.variantId,
      upid: row.slug,
    })),
    primaryUpid: passportRows[0]?.slug ?? "",
  };
}

export async function listProductPassportsForBrand(
  db: Database,
  brandId: string,
  opts: {
    page?: number;
    filters?: { status?: readonly string[] };
    includeStatusCounts?: boolean;
  } = {},
): Promise<ProductPassportListResult> {
  const pageSize = 50;
  const page = Math.max(0, opts.page ?? 0);
  const offset = page * pageSize;
  const whereExpr = buildProductPassportWhereClause(brandId, opts.filters);

  const [countsRow, productPage] = await Promise.all([
    db
      .select({
        passportCount: count(passports.id),
        productCount: sql<number>`COUNT(DISTINCT ${passports.productId})`,
      })
      .from(passports)
      .innerJoin(products, eq(products.id, passports.productId))
      .where(whereExpr),
    db
      .select({
        productId: products.id,
        createdAt: products.createdAt,
      })
      .from(products)
      .innerJoin(passports, eq(passports.productId, products.id))
      .where(whereExpr)
      .groupBy(products.id, products.createdAt)
      .orderBy(desc(products.createdAt))
      .limit(pageSize)
      .offset(offset),
  ]);

  const total = Number(countsRow[0]?.passportCount ?? 0);
  const productTotal = Number(countsRow[0]?.productCount ?? 0);

  const productIds = productPage.map((row) => row.productId);
  if (!productIds.length) {
    const meta: ProductPassportListResult["meta"] = {
      total,
      productTotal,
    };
    if (opts.includeStatusCounts) {
      meta.statusCounts = await countProductPassportsByStatus(db, brandId);
    }
    return {
      data: [],
      meta,
    };
  }

  const productOrder = new Map<string, number>();
  productPage.forEach((row, index) => productOrder.set(row.productId, index));

  const rows = await db
    .select({
      passportId: passports.id,
      productId: products.id,
      productUpid: products.productUpid,
      slug: passports.slug,
      status: passports.status,
      created_at: passports.createdAt,
      updated_at: passports.updatedAt,
      title: products.name,
      season: products.season,
      primary_image_url: products.primaryImageUrl,
      category_id: products.categoryId,
      template_id: passportTemplates.id,
      template_name: passportTemplates.name,
    })
    .from(products)
    .innerJoin(passports, eq(passports.productId, products.id))
    .leftJoin(
      passportTemplates,
      eq(passportTemplates.id, passports.templateId),
    )
    .where(inArray(products.id, productIds))
    .orderBy(desc(passports.createdAt));

  const grouped = new Map<string, ProductPassportSelectRow[]>();
  for (const row of rows) {
    const list = grouped.get(row.productId) ?? [];
    list.push(row);
    grouped.set(row.productId, list);
  }

  const variantCounts = new Map<string, number>();
  for (const [productId, list] of grouped.entries()) {
    variantCounts.set(productId, list.length);
  }

  const primaryRows: ProductPassportSelectRow[] = [];
  for (const list of grouped.values()) {
    const sorted = [...list].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
    primaryRows.push(sorted[0]!);
  }

  const data = await hydrateProductPassportRows(
    db,
    primaryRows,
    variantCounts,
    productOrder,
  );

  const meta: ProductPassportListResult["meta"] = {
    total,
    productTotal,
  };
  if (opts.includeStatusCounts) {
    meta.statusCounts = await countProductPassportsByStatus(db, brandId);
  }

  return { data, meta };
}

export async function countProductPassportsByStatus(
  db: Database,
  brandId: string,
): Promise<PassportStatusCounts> {
  const rows = await db
    .select({
      status: passports.status,
      value: sql<number>`COUNT(DISTINCT ${passports.productId})`,
    })
    .from(passports)
    .where(eq(passports.brandId, brandId))
    .groupBy(passports.status);

  const base = { ...EMPTY_STATUS_COUNTS };
  for (const r of rows) {
    const key = String(r.status) as PassportStatus;
    if (key in base) {
      base[key] = Number(r.value ?? 0);
    }
  }
  return base;
}

