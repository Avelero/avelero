import { and, count, eq, isNotNull } from "drizzle-orm";
import type { Database } from "../client";
import {
  productEnvironment,
  productJourneySteps,
  productMaterials,
  productVariants,
  products,
} from "../schema";
import type { ModuleKey } from "./module-keys";

export type ModuleEvaluationContext = {
  db: Database;
  productId: string;
};

export type ModuleRule = {
  key: ModuleKey;
  evaluate: (ctx: ModuleEvaluationContext) => Promise<boolean>;
};

// Core: product has name, description, category, primary image, and at least one variant with a SKU
const coreRule: ModuleRule = {
  key: "core",
  evaluate: async ({ db, productId }) => {
    const [p] = await db
      .select({
        name: products.name,
        description: products.description,
        categoryId: products.categoryId,
        primaryImageUrl: products.primaryImageUrl,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!p) return false;
    const hasBasics = Boolean(
      p.name && p.description && p.categoryId && p.primaryImageUrl,
    );
    if (!hasBasics) return false;
    const [{ value: variantWithSkuCount = 0 } = { value: 0 }] = await db
      .select({ value: count(productVariants.id) })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, productId),
          isNotNull(productVariants.sku),
        ),
      )
      .limit(1);
    return variantWithSkuCount > 0;
  },
};

// Environment: carbon and water values present (both required for now)
const environmentRule: ModuleRule = {
  key: "environment",
  evaluate: async ({ db, productId }) => {
    const [row] = await db
      .select({
        carbon: productEnvironment.carbonKgCo2e,
        water: productEnvironment.waterLiters,
      })
      .from(productEnvironment)
      .where(eq(productEnvironment.productId, productId))
      .limit(1);
    return Boolean(row?.carbon && row?.water);
  },
};

// Materials: at least one row and percentages sum to ~100%
const materialsRule: ModuleRule = {
  key: "materials",
  evaluate: async ({ db, productId }) => {
    const rows = await db
      .select({ percentage: productMaterials.percentage })
      .from(productMaterials)
      .where(eq(productMaterials.productId, productId));
    if (!rows.length) return false;
    const sum = rows.reduce((acc, r) => acc + Number(r.percentage ?? 0), 0);
    const tolerance = 0.5; // allow minor rounding differences
    return Math.abs(sum - 100) <= tolerance;
  },
};

// Journey: at least one journey step
const journeyRule: ModuleRule = {
  key: "journey",
  evaluate: async ({ db, productId }) => {
    const [{ value: steps = 0 } = { value: 0 }] = await db
      .select({ value: count(productJourneySteps.id) })
      .from(productJourneySteps)
      .where(eq(productJourneySteps.productId, productId))
      .limit(1);
    return steps > 0;
  },
};

// Placeholders until sources exist
const carouselRule: ModuleRule = {
  key: "carousel",
  evaluate: async () => false,
};

const ctaBannerRule: ModuleRule = {
  key: "cta_banner",
  evaluate: async () => false,
};

export const RULES: Record<ModuleKey, ModuleRule> = {
  core: coreRule,
  environment: environmentRule,
  materials: materialsRule,
  journey: journeyRule,
  carousel: carouselRule,
  cta_banner: ctaBannerRule,
};
