import { sql } from "drizzle-orm";
import {
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

/**
 * Custom domains for brands.
 *
 * Each brand can have at most one verified custom domain.
 * Domains are verified via DNS TXT record lookup.
 *
 * Status flow:
 *   pending -> verified (success)
 *   pending -> failed (DNS check failed, can retry)
 *   verified -> (cannot change, must delete and re-add)
 */
export const brandCustomDomains = pgTable(
  "brand_custom_domains",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),

    /** Brand that owns this domain */
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),

    /**
     * The custom domain (e.g., "passport.nike.com")
     * Stored normalized (lowercase, no trailing dot)
     */
    domain: text("domain").notNull(),

    /**
     * Verification status:
     * - 'pending': Domain added, awaiting DNS verification
     * - 'verified': DNS TXT record confirmed
     * - 'failed': DNS verification failed (can retry)
     */
    status: text("status").notNull().default("pending"),

    /**
     * DNS TXT verification token.
     * Brand must add TXT record: _avelero-verification.{domain} = {token}
     */
    verificationToken: text("verification_token").notNull(),

    /**
     * Timestamp of last verification attempt.
     * Null if never attempted.
     */
    lastVerificationAttempt: timestamp("last_verification_attempt", {
      withTimezone: true,
      mode: "string",
    }),

    /**
     * Error message from last failed verification.
     * Null if pending or verified.
     */
    verificationError: text("verification_error"),

    /**
     * Timestamp when domain was successfully verified.
     * Null if not yet verified.
     */
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "string",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One domain per brand (enforced at DB level)
    uniqueIndex("brand_custom_domains_brand_id_unq").on(table.brandId),

    // Global domain uniqueness (no two brands can claim the same domain)
    uniqueIndex("brand_custom_domains_domain_unq").on(table.domain),

    // Index for lookups by domain (used by DPP routing)
    index("idx_brand_custom_domains_domain").on(table.domain),

    // Index for status (useful for admin queries)
    index("idx_brand_custom_domains_status").on(table.status),

    // RLS: Only brand members can read their domain config
    pgPolicy("brand_custom_domains_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),

    // RLS: Only brand owners can insert domains
    pgPolicy("brand_custom_domains_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_owner(brand_id)`,
    }),

    // RLS: Only brand owners can update domains
    pgPolicy("brand_custom_domains_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_owner(brand_id)`,
      withCheck: sql`is_brand_owner(brand_id)`,
    }),

    // RLS: Only brand owners can delete domains
    pgPolicy("brand_custom_domains_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_owner(brand_id)`,
    }),
  ],
);

/** Type for a custom domain record */
export type BrandCustomDomain = typeof brandCustomDomains.$inferSelect;

/** Type for inserting a custom domain */
export type BrandCustomDomainInsert = typeof brandCustomDomains.$inferInsert;
