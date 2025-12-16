// Field mapping table domain types

export interface FieldMappingRow {
  id: string;
  brandIntegrationId: string;
  fieldKey: string;
  ownershipEnabled: boolean;
  sourceOptionKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SourceOption {
  value: string;
  label: string;
}

/**
 * Field categories for grouping in the UI.
 */
export type FieldCategory =
  | "product"
  | "variant"
  | "environment"
  | "season"
  | "material"
  | "facility"
  | "manufacturer"
  | "color"
  | "size"
  | "tag"
  | "ecoClaim";

export const FIELD_CATEGORY_LABELS: Record<FieldCategory, string> = {
  product: "Product Fields",
  variant: "Variant Fields",
  environment: "Environmental Impact",
  season: "Season Fields",
  material: "Material Fields",
  facility: "Facility Fields",
  manufacturer: "Manufacturer Fields",
  color: "Color Fields",
  size: "Size Fields",
  tag: "Tag Fields",
  ecoClaim: "Eco Claim Fields",
};




