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

export type PassportStatus = "published" | "unpublished" | "scheduled";

const PASSPORT_STATUS_LABELS: Record<PassportStatus, string> = {
  published: "Published",
  unpublished: "Unpublished",
  scheduled: "Scheduled",
};

export interface ProductPassportRow {
  id: string; // product id
  /** URL-friendly identifier for product (used in navigation) */
  productHandle: string;
  name: string;
  status: PassportStatus;
  category?: string | null;
  categoryPath?: string[] | null;
  season?: string | null;
  manufacturer?: string | null;
  imagePath?: string | null;
  colors?: string[]; // distinct color names/hexes for variants
  sizes?: string[]; // distinct size names
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PassportTableRow extends ProductPassportRow {
  passportIds: string[]; // legacy hook for bulk selection, maps to product/row id
  variantCount: number; // number of variants for this product
  variantsWithBarcode: number; // number of variants with barcodes
  tags: Array<{ id: string; name: string | null; hex: string | null }>; // product tags with swatches
  /** First variant's passport UPID (for viewing the public passport) */
  firstVariantUpid?: string | null;
}

// Selection model for scalable bulk actions
export type SelectionMode = "all" | "explicit";

export interface SelectionState {
  mode: SelectionMode;
  includeIds: string[]; // used when mode === 'explicit'
  excludeIds: string[]; // used when mode === 'all'
}

type BulkSelection =
  | { mode: "all"; excludeIds: string[] }
  | { mode: "explicit"; includeIds: string[] };

type BulkChanges = {
  status?: PassportStatus;
};
