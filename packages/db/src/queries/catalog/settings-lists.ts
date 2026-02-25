import { asc, eq, sql } from "drizzle-orm";
import type { Database } from "../../client";
import {
  brandAttributeValues,
  brandMaterials,
  productJourneySteps,
  productMaterials,
  productTags,
  productVariantAttributes,
  productVariants,
  products,
  variantJourneySteps,
  variantMaterials,
} from "../../schema";
import { listBrandAttributes } from "./attributes";
import { listCertifications } from "./certifications";
import { listBrandManufacturers } from "./manufacturers";
import { listMaterials } from "./materials";
import { listOperators } from "./operators";
import { listSeasonsForBrand } from "./seasons";
import { listBrandTags } from "./tags";

function appendMetric<T extends { id: string }, K extends string>(
  rows: T[],
  countMap: Map<string, number>,
  key: K,
): Array<T & Record<K, number>> {
  return rows.map((row) => ({
    ...row,
    [key]: countMap.get(row.id) ?? 0,
  })) as Array<T & Record<K, number>>;
}

export async function listSeasonsForBrandWithMetrics(
  db: Database,
  brandId: string,
) {
  const [seasons, counts] = await Promise.all([
    listSeasonsForBrand(db, brandId),
    db
      .select({
        id: products.seasonId,
        count: sql<number>`count(distinct ${products.id})::int`,
      })
      .from(products)
      .where(eq(products.brandId, brandId))
      .groupBy(products.seasonId),
  ]);

  const countMap = new Map<string, number>();
  for (const row of counts) {
    if (!row.id) continue;
    countMap.set(row.id, row.count ?? 0);
  }

  return appendMetric(seasons, countMap, "products_count");
}

export async function listBrandTagsWithMetrics(db: Database, brandId: string) {
  const [tags, counts] = await Promise.all([
    listBrandTags(db, brandId),
    db
      .select({
        id: productTags.tagId,
        count: sql<number>`count(distinct ${productTags.productId})::int`,
      })
      .from(productTags)
      .innerJoin(products, eq(products.id, productTags.productId))
      .where(eq(products.brandId, brandId))
      .groupBy(productTags.tagId),
  ]);

  const countMap = new Map<string, number>();
  for (const row of counts) {
    countMap.set(row.id, row.count ?? 0);
  }

  return appendMetric(tags, countMap, "products_count");
}

export async function listBrandManufacturersWithMetrics(
  db: Database,
  brandId: string,
) {
  const [manufacturers, counts] = await Promise.all([
    listBrandManufacturers(db, brandId),
    db
      .select({
        id: products.manufacturerId,
        count: sql<number>`count(distinct ${products.id})::int`,
      })
      .from(products)
      .where(eq(products.brandId, brandId))
      .groupBy(products.manufacturerId),
  ]);

  const countMap = new Map<string, number>();
  for (const row of counts) {
    if (!row.id) continue;
    countMap.set(row.id, row.count ?? 0);
  }

  return appendMetric(manufacturers, countMap, "products_count");
}

export async function listCertificationsWithMetrics(
  db: Database,
  brandId: string,
) {
  const [certifications, counts] = await Promise.all([
    listCertifications(db, brandId),
    db
      .select({
        id: brandMaterials.certificationId,
        count: sql<number>`count(distinct ${brandMaterials.id})::int`,
      })
      .from(brandMaterials)
      .where(eq(brandMaterials.brandId, brandId))
      .groupBy(brandMaterials.certificationId),
  ]);

  const countMap = new Map<string, number>();
  for (const row of counts) {
    if (!row.id) continue;
    countMap.set(row.id, row.count ?? 0);
  }

  return appendMetric(certifications, countMap, "materials_count");
}

export async function listMaterialsWithMetrics(db: Database, brandId: string) {
  const [materials, directUsage, variantUsage] = await Promise.all([
    listMaterials(db, brandId),
    db
      .select({
        materialId: productMaterials.brandMaterialId,
        productId: productMaterials.productId,
      })
      .from(productMaterials)
      .innerJoin(products, eq(products.id, productMaterials.productId))
      .where(eq(products.brandId, brandId)),
    db
      .select({
        materialId: variantMaterials.brandMaterialId,
        productId: productVariants.productId,
      })
      .from(variantMaterials)
      .innerJoin(productVariants, eq(productVariants.id, variantMaterials.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(products.brandId, brandId)),
  ]);

  const usageMap = new Map<string, Set<string>>();
  for (const row of [...directUsage, ...variantUsage]) {
    const set = usageMap.get(row.materialId) ?? new Set<string>();
    set.add(row.productId);
    usageMap.set(row.materialId, set);
  }

  return materials.map((row) => ({
    ...row,
    products_count: usageMap.get(row.id)?.size ?? 0,
  }));
}

export async function listOperatorsWithMetrics(db: Database, brandId: string) {
  const [operators, directUsage, variantUsage] = await Promise.all([
    listOperators(db, brandId),
    db
      .select({
        operatorId: productJourneySteps.operatorId,
        productId: productJourneySteps.productId,
      })
      .from(productJourneySteps)
      .innerJoin(products, eq(products.id, productJourneySteps.productId))
      .where(eq(products.brandId, brandId)),
    db
      .select({
        operatorId: variantJourneySteps.operatorId,
        productId: productVariants.productId,
      })
      .from(variantJourneySteps)
      .innerJoin(productVariants, eq(productVariants.id, variantJourneySteps.variantId))
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(eq(products.brandId, brandId)),
  ]);

  const usageMap = new Map<string, Set<string>>();
  for (const row of [...directUsage, ...variantUsage]) {
    const set = usageMap.get(row.operatorId) ?? new Set<string>();
    set.add(row.productId);
    usageMap.set(row.operatorId, set);
  }

  return operators.map((row) => ({
    ...row,
    products_count: usageMap.get(row.id)?.size ?? 0,
  }));
}

type AttributeValueGroupedRow = {
  id: string;
  brandId: string;
  attributeId: string;
  taxonomyValueId: string | null;
  name: string;
  metadata: unknown;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
  variants_count: number;
};

export async function listAttributesGroupedWithMetrics(
  db: Database,
  brandId: string,
) {
  const [attributes, values, valueVariantCounts, attributeVariantCounts] =
      await Promise.all([
      listBrandAttributes(db, brandId),
      db
        .select({
          id: brandAttributeValues.id,
          brandId: brandAttributeValues.brandId,
          attributeId: brandAttributeValues.attributeId,
          taxonomyValueId: brandAttributeValues.taxonomyValueId,
          name: brandAttributeValues.name,
          metadata: brandAttributeValues.metadata,
          sortOrder: brandAttributeValues.sortOrder,
          createdAt: brandAttributeValues.createdAt,
          updatedAt: brandAttributeValues.updatedAt,
        })
        .from(brandAttributeValues)
        .where(eq(brandAttributeValues.brandId, brandId))
        .orderBy(
          asc(brandAttributeValues.attributeId),
          sql`${brandAttributeValues.sortOrder} nulls last`,
          asc(brandAttributeValues.name),
        ),
      db
        .select({
          id: brandAttributeValues.id,
          count: sql<number>`count(distinct ${productVariantAttributes.variantId})::int`,
        })
        .from(brandAttributeValues)
        .leftJoin(
          productVariantAttributes,
          eq(productVariantAttributes.attributeValueId, brandAttributeValues.id),
        )
        .where(eq(brandAttributeValues.brandId, brandId))
        .groupBy(brandAttributeValues.id),
      db
        .select({
          attributeId: brandAttributeValues.attributeId,
          count: sql<number>`count(distinct ${productVariantAttributes.variantId})::int`,
        })
        .from(brandAttributeValues)
        .leftJoin(
          productVariantAttributes,
          eq(productVariantAttributes.attributeValueId, brandAttributeValues.id),
        )
        .where(eq(brandAttributeValues.brandId, brandId))
        .groupBy(brandAttributeValues.attributeId),
    ]);

  const valueCountMap = new Map<string, number>();
  for (const row of valueVariantCounts) {
    valueCountMap.set(row.id, row.count ?? 0);
  }

  const attrVariantCountMap = new Map<string, number>();
  for (const row of attributeVariantCounts) {
    attrVariantCountMap.set(row.attributeId, row.count ?? 0);
  }

  const valuesByAttribute = new Map<string, AttributeValueGroupedRow[]>();
  for (const row of values) {
    const list = valuesByAttribute.get(row.attributeId) ?? [];
    list.push({
      id: row.id,
      brandId: row.brandId,
      attributeId: row.attributeId,
          taxonomyValueId: row.taxonomyValueId,
          name: row.name,
          metadata: row.metadata,
          sortOrder: row.sortOrder,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          variants_count: valueCountMap.get(row.id) ?? 0,
        });
    valuesByAttribute.set(row.attributeId, list);
  }

  return attributes.map((attribute) => {
    const groupedValues = valuesByAttribute.get(attribute.id) ?? [];
    return {
      ...attribute,
      values_count: groupedValues.length,
      variants_count: attrVariantCountMap.get(attribute.id) ?? 0,
      values: groupedValues,
    };
  });
}

export async function listBrandAttributesWithMetrics(
  db: Database,
  brandId: string,
) {
  const grouped = await listAttributesGroupedWithMetrics(db, brandId);
  return grouped.map(({ values, ...attribute }) => attribute);
}
