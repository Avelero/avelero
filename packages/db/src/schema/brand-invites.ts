import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { brands } from "./brands";
import { users } from "./users";

export const brandInvites = pgTable("brand_invites", {
  id: uuid("id").defaultRandom().primaryKey().notNull(),
  brandId: uuid("brand_id")
    .references(() => brands.id, { onDelete: "cascade" })
    .notNull(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  tokenHash: text("token_hash"),
  createdBy: uuid("created_by"),
  expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
    .defaultNow()
    .notNull(),
});
