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

export interface ProductPassportRow {
  id: string; // product id
  productUpid: string;
  name: string;
  productIdentifier?: string;
  status: PassportStatus;
  category?: string | null;
  categoryPath?: string[] | null;
  season?: string | null;
  showcaseBrand?: string | null;
  primaryImagePath?: string | null;
  colors?: string[]; // distinct color names/hexes for variants
  sizes?: string[]; // distinct size names
  variantCount?: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PassportTableRow extends ProductPassportRow {
  passportIds: string[]; // legacy hook for bulk selection, maps to product/row id
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
