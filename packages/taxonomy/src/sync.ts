import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serviceDb, sql } from "@v1/db/index";
import {
  taxonomyAttributes,
  taxonomyCategories,
  taxonomyValues,
} from "@v1/db/schema";
import { parse } from "yaml";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

function loadYaml<T>(filename: string): T {
  const content = readFileSync(join(__dirname, filename), "utf-8");
  return parse(content) as T;
}

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
    (a, b) => getDepth(a.id) - getDepth(b.id),
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
        `⚠ Skipping value ${val.friendly_id}: unknown attribute_id ${val.attribute_id}`,
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

async function main() {
  console.log("Starting taxonomy sync...\n");

  try {
    await syncCategories();
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
