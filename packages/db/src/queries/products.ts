import { and, asc, count, desc, eq, ilike, isNotNull } from "drizzle-orm";
import type { Database } from "../client";
import { evaluateAndUpsertCompletion } from "../completion/evaluate";
import type { ModuleKey } from "../completion/module-keys";
import {
  brandCertifications,
  brandColors,
  brandSizes,
  categories,
  productIdentifiers,
  productVariantIdentifiers,
  productVariants,
  products,
  showcaseBrands,
} from "../schema";

type ListFilters = {
  categoryId?: string;
  season?: string;
  search?: string;
};

export async function listProducts(
  db: Database,
  brandId: string,
  filters: ListFilters = {},
  opts: { cursor?: string; limit?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
  const whereClauses = [eq(products.brandId, brandId)];
  if (filters.categoryId)
    whereClauses.push(eq(products.categoryId, filters.categoryId));
  if (filters.season) whereClauses.push(eq(products.season, filters.season));
  if (filters.search)
    whereClauses.push(ilike(products.name, `%${filters.search}%`));

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      category_id: products.categoryId,
      season: products.season,
      brand_certification_id: products.brandCertificationId,
      showcase_brand_id: products.showcaseBrandId,
      primary_image_url: products.primaryImageUrl,
      created_at: products.createdAt,
      updated_at: products.updatedAt,
    })
    .from(products)
    .where(and(...whereClauses))
    .orderBy(desc(products.createdAt))
    .limit(limit);

  const result = await db
    .select({ value: count(products.id) })
    .from(products)
    .where(and(...whereClauses));
  const total = result[0]?.value ?? 0;

  return { data: rows, meta: { total } } as const;
}

export async function getProduct(db: Database, brandId: string, id: string) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      category_id: products.categoryId,
      season: products.season,
      brand_certification_id: products.brandCertificationId,
      showcase_brand_id: products.showcaseBrandId,
      primary_image_url: products.primaryImageUrl,
      created_at: products.createdAt,
      updated_at: products.updatedAt,
    })
    .from(products)
    .where(and(eq(products.id, id), eq(products.brandId, brandId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createProduct(
  db: Database,
  brandId: string,
  input: {
    name: string;
    description?: string;
    categoryId?: string;
    season?: string;
    brandCertificationId?: string;
    showcaseBrandId?: string;
    primaryImageUrl?: string;
  },
) {
  let created: { id: string } | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(products)
      .values({
        brandId,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        season: input.season ?? null,
        brandCertificationId: input.brandCertificationId ?? null,
        showcaseBrandId: input.showcaseBrandId ?? null,
        primaryImageUrl: input.primaryImageUrl ?? null,
      })
      .returning({ id: products.id });
    created = row;
    if (row?.id) {
      // Evaluate only core module for product basics
      await evaluateAndUpsertCompletion(
        tx as unknown as Database,
        brandId,
        row.id,
        {
          onlyModules: ["core"] as ModuleKey[],
        },
      );
    }
  });
  return created;
}

export async function updateProduct(
  db: Database,
  brandId: string,
  input: {
    id: string;
    name?: string;
    description?: string | null;
    categoryId?: string | null;
    season?: string | null;
    brandCertificationId?: string | null;
    showcaseBrandId?: string | null;
    primaryImageUrl?: string | null;
  },
) {
  let updated: { id: string } | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(products)
      .set({
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        season: input.season ?? null,
        brandCertificationId: input.brandCertificationId ?? null,
        showcaseBrandId: input.showcaseBrandId ?? null,
        primaryImageUrl: input.primaryImageUrl ?? null,
      })
      .where(and(eq(products.id, input.id), eq(products.brandId, brandId)))
      .returning({ id: products.id });
    updated = row;
    if (row?.id) {
      await evaluateAndUpsertCompletion(
        tx as unknown as Database,
        brandId,
        row.id,
        {
          onlyModules: ["core"] as ModuleKey[],
        },
      );
    }
  });
  return updated;
}

export async function deleteProduct(db: Database, brandId: string, id: string) {
  const [row] = await db
    .delete(products)
    .where(and(eq(products.id, id), eq(products.brandId, brandId)))
    .returning({ id: products.id });
  return row;
}

export async function upsertProductIdentifier(
  db: Database,
  productId: string,
  idType: string,
  value: string,
) {
  // Rely on unique index (product_id, id_type, value); duplicate inserts will error; emulate upsert via delete+insert minimalism.
  // First ensure no exact duplicate exists; if exists, return quickly.
  const existing = await db
    .select({ id: productIdentifiers.id })
    .from(productIdentifiers)
    .where(
      and(
        eq(productIdentifiers.productId, productId),
        eq(productIdentifiers.idType, idType),
        eq(productIdentifiers.value, value),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db
    .insert(productIdentifiers)
    .values({ productId, idType, value })
    .returning({ id: productIdentifiers.id });
  return row;
}

// Variants
export async function listVariants(db: Database, productId: string) {
  return db
    .select({
      id: productVariants.id,
      product_id: productVariants.productId,
      color_id: productVariants.colorId,
      size_id: productVariants.sizeId,
      sku: productVariants.sku,
      upid: productVariants.upid,
      product_image_url: productVariants.productImageUrl,
      created_at: productVariants.createdAt,
      updated_at: productVariants.updatedAt,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.createdAt));
}

export async function createVariant(
  db: Database,
  productId: string,
  input: {
    colorId?: string;
    sizeId?: string;
    sku?: string;
    upid: string;
    productImageUrl?: string;
  },
) {
  let created: { id: string } | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(productVariants)
      .values({
        productId,
        colorId: input.colorId ?? null,
        sizeId: input.sizeId ?? null,
        sku: input.sku ?? null,
        upid: input.upid,
        productImageUrl: input.productImageUrl ?? null,
      })
      .returning({ id: productVariants.id });
    created = row;
    if (row?.id) {
      // Need brandId for evaluator: read via product
      const [{ brandId } = { brandId: undefined } as any] = await tx
        .select({ brandId: products.brandId })
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
      if (brandId) {
        await evaluateAndUpsertCompletion(
          tx as unknown as Database,
          brandId,
          productId,
          {
            onlyModules: ["core"] as ModuleKey[],
          },
        );
      }
    }
  });
  return created;
}

export async function updateVariant(
  db: Database,
  id: string,
  input: {
    colorId?: string | null;
    sizeId?: string | null;
    sku?: string | null;
    upid?: string;
    productImageUrl?: string | null;
  },
) {
  let updated: { id: string } | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .update(productVariants)
      .set({
        colorId: input.colorId ?? null,
        sizeId: input.sizeId ?? null,
        sku: input.sku ?? null,
        upid: input.upid,
        productImageUrl: input.productImageUrl ?? null,
      })
      .where(eq(productVariants.id, id))
      .returning({
        id: productVariants.id,
        productId: productVariants.productId,
      });
    updated = row ? { id: row.id } : undefined;
    if (row?.productId) {
      const [{ brandId } = { brandId: undefined } as any] = await tx
        .select({ brandId: products.brandId })
        .from(products)
        .where(eq(products.id, row.productId))
        .limit(1);
      if (brandId) {
        await evaluateAndUpsertCompletion(
          tx as unknown as Database,
          brandId,
          row.productId,
          {
            onlyModules: ["core"] as ModuleKey[],
          },
        );
      }
    }
  });
  return updated;
}

export async function deleteVariant(db: Database, id: string) {
  const [row] = await db
    .delete(productVariants)
    .where(eq(productVariants.id, id))
    .returning({ id: productVariants.id });
  return row;
}

export async function upsertVariantIdentifier(
  db: Database,
  variantId: string,
  idType: string,
  value: string,
) {
  const existing = await db
    .select({ id: productVariantIdentifiers.id })
    .from(productVariantIdentifiers)
    .where(
      and(
        eq(productVariantIdentifiers.variantId, variantId),
        eq(productVariantIdentifiers.idType, idType),
        eq(productVariantIdentifiers.value, value),
      ),
    )
    .limit(1);
  if (existing[0]) return existing[0];
  const [row] = await db
    .insert(productVariantIdentifiers)
    .values({ variantId, idType, value })
    .returning({ id: productVariantIdentifiers.id });
  return row;
}
