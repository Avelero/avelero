import { asc } from "drizzle-orm";
import type { Database } from "../client";
import { careCodes, categories } from "../schema";

export async function listCategories(db: Database) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      parent_id: categories.parentId,
      created_at: categories.createdAt,
      updated_at: categories.updatedAt,
    })
    .from(categories)
    .orderBy(asc(categories.name));
}

export async function listCareCodes(db: Database) {
  return db
    .select({
      id: careCodes.id,
      code: careCodes.code,
      name: careCodes.name,
      description: careCodes.description,
      icon_url: careCodes.iconUrl,
      created_at: careCodes.createdAt,
      updated_at: careCodes.updatedAt,
    })
    .from(careCodes)
    .orderBy(asc(careCodes.name));
}

