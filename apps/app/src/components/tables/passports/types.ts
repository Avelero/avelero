// Passport table domain types
// NOTE: Avoid enums per repo conventions; use string unions and maps instead.

// Re-export filter types for convenience
export type {
  FilterState,
  FilterActions,
  FilterCondition,
  FilterGroup,
  FilterOperator,
} from "@/components/passports/filter-types";

export type PassportStatus =
  | "published"
  | "scheduled"
  | "unpublished"
  | "archived";

export const PASSPORT_STATUS_LABELS: Record<PassportStatus, string> = {
  published: "Published",
  scheduled: "Scheduled",
  unpublished: "Unpublished",
  archived: "Archived",
};

export interface PassportTemplate {
  id: string;
  name: string;
  color: string; // hex color string (e.g., #3B82F6)
}

export interface Passport {
  id: string;
  productId: string;
  productUpid: string;
  // UI label for the product; typically maps from products.name
  title: string;
  // Primary SKU (may derive from a variant or identifier)
  sku?: string;
  // Variant presentation
  color?: string;
  size?: string;

  // Publishing state
  status: PassportStatus;

  // Completion overview (e.g., X of 6 sections complete)
  completedSections: number;
  totalSections: number;
  // Module-by-module detail (keys ordered per template, completion state)
  modules?: { key: string; completed: boolean }[];

  // Category presentation
  category: string; // lowest-level category label (e.g., "Hoodies")
  categoryPath: string[]; // full path for hover breadcrumb

  // Season & template display
  season?: string; // e.g., "SS24", "AW25"
  template?: PassportTemplate;

  // Public DPP URL when published
  passportUrl?: string;

  // Optional image for future use
  primaryImageUrl?: string;

  // Timestamps (ISO strings from API or Date when client-side)
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PassportTableRow extends Omit<Passport, "id"> {
  /**
   * Unique identifier for the row in the table (product-level).
   * We map product IDs to rows while keeping a list of related passport IDs.
   */
  id: string;
  /**
    * All passport identifiers represented by this product row.
    * Used for selection + bulk actions.
    */
  passportIds: string[];
}

// Selection model for scalable bulk actions
export type SelectionMode = "all" | "explicit";

export interface SelectionState {
  mode: SelectionMode;
  includeIds: string[]; // used when mode === 'explicit'
  excludeIds: string[]; // used when mode === 'all'
}

export type BulkSelection =
  | { mode: "all"; excludeIds: string[] }
  | { mode: "explicit"; includeIds: string[] };

export type BulkChanges = {
  status?: PassportStatus;
};
