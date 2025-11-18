import { asc } from "drizzle-orm";
import type { Database } from "../client";
import { categories } from "../schema";

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
