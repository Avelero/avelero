import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { brands } from "./brands.js";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().notNull(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  avatarPath: text("avatar_path"),
  avatarHue: integer("avatar_hue"),
  brandId: uuid("brand_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});

// Foreign keys defined via callbacks to avoid circular import issues are not
// strictly necessary in Drizzle for basic usage; relations can be added later
// using drizzle-orm relations() if needed. For now, we rely on DB-level FKs.
