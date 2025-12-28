import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serviceDb, sql } from "@v1/db/index";
import {
  taxonomyAttributes,
  taxonomyCategories,
  taxonomyExternalMappings,
  taxonomyValues,
} from "@v1/db/schema";
import { parse } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

// =============================================================================
// TYPES
// =============================================================================

interface YamlCategory {
  id: string;
  name: string;
  children: string[];
}

interface YamlAttribute {
  id: number;
  name: string;
  description: string;
  friendly_id: string;
  sorting: string;
  values: string[];
}

interface YamlValue {
  id: number;
  name: string;
  friendly_id: string;
  attribute_id: number;
  swatch?: string;
}

// Shopify → Avelero mapping YAML structure
interface ShopifyToAveleroYamlConfig {
  version: string;
  input_taxonomy: string;
  output_taxonomy: string;
  branch_config: {
    root_filter: string;
    branches: Record<string, string | null>;
  };
  excluded_category_ids: string[];
  rules: Record<string, string | null>;
}

// Resolved target with both publicId and UUID
type ResolvedTarget = { publicId: string; id: string } | null;

// Resolved mapping config stored in DB
interface ShopifyToAveleroResolvedConfig {
  version: string;
  input_taxonomy: string;
  output_taxonomy: string;
  branch_config: {
    root_filter: string;
    branches: Record<string, ResolvedTarget>;
  };
  excluded_category_ids: string[];
  rules: Record<string, ResolvedTarget>;
}

// =============================================================================
// HELPERS
// =============================================================================

function loadYaml<T>(filename: string): T {
  const content = readFileSync(join(__dirname, filename), "utf-8");
  return parse(content) as T;
}

// =============================================================================
// SYNC FUNCTIONS
// =============================================================================

async function syncCategories() {
  console.log("Syncing taxonomy categories...");
  const categories = loadYaml<YamlCategory[]>("categories.yml");

  // Build parent map: child publicId -> parent publicId
  const parentMap = new Map<string, string>();
  for (const cat of categories) {
    for (const childId of cat.children) {
      parentMap.set(childId, cat.id);
    }
  }

  // Sort categories by depth level (parents first)
  const getDepth = (publicId: string): number => {
    const parent = parentMap.get(publicId);
    return parent ? getDepth(parent) + 1 : 0;
  };
  const sortedCategories = [...categories].sort(
    (a, b) => getDepth(a.id) - getDepth(b.id)
  );

  // Upsert categories in order
  for (const cat of sortedCategories) {
    const parentPublicId = parentMap.get(cat.id);

    await serviceDb
      .insert(taxonomyCategories)
      .values({
        publicId: cat.id,
        name: cat.name,
        parentId: parentPublicId
          ? sql`(SELECT id FROM taxonomy_categories WHERE public_id = ${parentPublicId})`
          : null,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: taxonomyCategories.publicId,
        set: {
          name: cat.name,
          parentId: parentPublicId
            ? sql`(SELECT id FROM taxonomy_categories WHERE public_id = ${parentPublicId})`
            : null,
          updatedAt: sql`now()`,
        },
      });
  }

  console.log(`✓ Synced ${sortedCategories.length} categories`);
}

async function syncShopifyToAveleroMapping() {
  console.log("Syncing Shopify → Avelero taxonomy mapping...");

  const raw = loadYaml<ShopifyToAveleroYamlConfig>(
    "mappings/shopify-to-avelero.yml"
  );

  // Load all categories from DB to resolve publicId → UUID
  const categories = await serviceDb
    .select({ id: taxonomyCategories.id, publicId: taxonomyCategories.publicId })
    .from(taxonomyCategories);

  const idByPublicId = new Map(
    categories.map((c) => [c.publicId, c.id] as const)
  );

  // Resolve a publicId to { publicId, id } or null
  const resolve = (publicId: string | null): ResolvedTarget => {
    if (publicId === null) return null;
    const id = idByPublicId.get(publicId);
    if (!id) {
      throw new Error(
        `Unknown taxonomy category publicId in mapping: "${publicId}". Make sure categories.yml includes this category.`
      );
    }
    return { publicId, id };
  };

  // Build resolved config with UUIDs
  const resolved: ShopifyToAveleroResolvedConfig = {
    version: raw.version,
    input_taxonomy: raw.input_taxonomy,
    output_taxonomy: raw.output_taxonomy,
    branch_config: {
      root_filter: raw.branch_config.root_filter,
      branches: Object.fromEntries(
        Object.entries(raw.branch_config.branches).map(([k, v]) => [
          k,
          resolve(v),
        ])
      ),
    },
    excluded_category_ids: raw.excluded_category_ids,
    rules: Object.fromEntries(
      Object.entries(raw.rules).map(([k, v]) => [k, resolve(v)])
    ),
  };

  // Count rules for logging
  const ruleCount = Object.keys(resolved.rules).length;
  const branchCount = Object.keys(resolved.branch_config.branches).length;

  // Upsert into DB
  await serviceDb
    .insert(taxonomyExternalMappings)
    .values({
      slug: "shopify-to-avelero",
      sourceSystem: "shopify",
      sourceTaxonomy: raw.input_taxonomy,
      targetTaxonomy: raw.output_taxonomy,
      version: raw.version,
      data: resolved,
      updatedAt: sql`now()`,
    })
    .onConflictDoUpdate({
      target: taxonomyExternalMappings.slug,
      set: {
        sourceSystem: "shopify",
        sourceTaxonomy: raw.input_taxonomy,
        targetTaxonomy: raw.output_taxonomy,
        version: raw.version,
        data: resolved,
        updatedAt: sql`now()`,
      },
    });

  console.log(
    `✓ Synced Shopify mapping v${raw.version} (${ruleCount} rules, ${branchCount} branches)`
  );
}

async function syncAttributes() {
  console.log("Syncing taxonomy attributes...");
  const attributes = loadYaml<YamlAttribute[]>("attributes.yml");

  for (const attr of attributes) {
    await serviceDb
      .insert(taxonomyAttributes)
      .values({
        publicId: String(attr.id),
        friendlyId: attr.friendly_id,
        name: attr.name,
        description: attr.description,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: taxonomyAttributes.friendlyId,
        set: {
          publicId: String(attr.id),
          name: attr.name,
          description: attr.description,
          updatedAt: sql`now()`,
        },
      });
  }

  console.log(`✓ Synced ${attributes.length} attributes`);
}

async function syncValues() {
  console.log("Syncing taxonomy values...");
  const values = loadYaml<YamlValue[]>("values.yml");
  const attributes = loadYaml<YamlAttribute[]>("attributes.yml");

  // Build attribute numeric id -> friendly_id map
  const attrFriendlyIdMap = new Map<number, string>();
  for (const attr of attributes) {
    attrFriendlyIdMap.set(attr.id, attr.friendly_id);
  }

  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (!val) continue;

    const attrFriendlyId = attrFriendlyIdMap.get(val.attribute_id);
    if (!attrFriendlyId) {
      console.warn(
        `⚠ Skipping value ${val.friendly_id}: unknown attribute_id ${val.attribute_id}`
      );
      continue;
    }

    const metadata = val.swatch ? { swatch: val.swatch } : {};

    await serviceDb
      .insert(taxonomyValues)
      .values({
        publicId: String(val.id),
        publicAttributeId: String(val.attribute_id),
        attributeId: sql`(SELECT id FROM taxonomy_attributes WHERE friendly_id = ${attrFriendlyId})`,
        friendlyId: val.friendly_id,
        name: val.name,
        sortOrder: i,
        metadata,
        updatedAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: taxonomyValues.friendlyId,
        set: {
          publicId: String(val.id),
          publicAttributeId: String(val.attribute_id),
          name: val.name,
          sortOrder: i,
          metadata,
          updatedAt: sql`now()`,
        },
      });
  }

  console.log(`✓ Synced ${values.length} values`);
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("Starting taxonomy sync...\n");

  try {
    // Sync categories first (required for mapping resolution)
    await syncCategories();

    // Sync external mappings (depends on categories)
    await syncShopifyToAveleroMapping();

    // Sync attributes and values
    await syncAttributes();
    await syncValues();

    console.log("\n✓ Taxonomy sync complete!");
    process.exit(0);
  } catch (error) {
    console.error("\n✗ Taxonomy sync failed:", error);
    process.exit(1);
  }
}

main();
