/**
 * Filter Configuration
 *
 * Complete filter field definitions, operators, and tRPC endpoint mappings
 * for the passport filtering system.
 */

import type {
  FilterFieldConfig,
  FilterOperator,
  SelectOption,
} from "@/components/passports/filter-types";
import { allProductionSteps } from "@v1/selections/production-steps";

// ============================================================================
// Operator Definitions by Input Type
// ============================================================================

export const OPERATORS = {
  text: [
    "contains",
    "does not contain",
    "is",
    "is not",
    "starts with",
    "ends with",
    "is empty",
    "is not empty",
  ] as const,

  number: [
    "equals",
    "does not equal",
    "greater than",
    "greater than or equal to",
    "less than",
    "less than or equal to",
    "between",
  ] as const,

  multiSelect: ["is any of", "is none of", "is empty", "is not empty"] as const,

  relational: [
    "contains any of",
    "contains all of",
    "does not contain",
    "is empty",
    "is not empty",
  ] as const,

  hierarchical: [
    "is",
    "is not",
    "is any of",
    "is descendant of",
    "is ancestor of",
  ] as const,

  date: ["is before", "is after", "is between"] as const,

  boolean: ["is true", "is false"] as const,
} as const;

// ============================================================================
// Static Option Sets
// ============================================================================

export const STATUS_OPTIONS: SelectOption[] = [
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "unpublished", label: "Unpublished" },
  { value: "archived", label: "Archived" },
];

export const RELATIVE_DATE_OPTIONS: SelectOption[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "last 7 days", label: "Last 7 days" },
  { value: "last 30 days", label: "Last 30 days" },
  { value: "this month", label: "This month" },
  { value: "last month", label: "Last month" },
  { value: "this quarter", label: "This quarter" },
  { value: "this year", label: "This year" },
];

// ============================================================================
// Filter Field Definitions
// ============================================================================

export const FILTER_FIELDS: Record<string, FilterFieldConfig> = {
  // ==========================================================================
  // TIER 1: Quick Filters (Must-Have)
  // ==========================================================================

  status: {
    id: "status",
    label: "Status",
    tier: 1,
    category: "metadata",
    inputType: "multi-select",
    operators: [...OPERATORS.multiSelect] as FilterOperator[],
    options: STATUS_OPTIONS,
    description: "Filter by passport publication status",
  },

  categoryId: {
    id: "categoryId",
    label: "Category",
    tier: 1,
    category: "product",
    inputType: "hierarchical",
    operators: [...OPERATORS.hierarchical] as FilterOperator[],
    description: "Filter by product category with hierarchy support",
    // Also available in advanced filters as multi-select (handled by getFieldConfig)
  },

  colorId: {
    id: "colorId",
    label: "Color",
    tier: 1,
    category: "variants",
    inputType: "multi-select",
    operators: [...OPERATORS.multiSelect] as FilterOperator[],
    description: "Filter by variant colors",
  },

  sizeId: {
    id: "sizeId",
    label: "Size",
    tier: 1,
    category: "variants",
    inputType: "multi-select",
    operators: [...OPERATORS.multiSelect] as FilterOperator[],
    description: "Filter by variant sizes",
  },

  season: {
    id: "season",
    label: "Season",
    tier: 1,
    category: "product",
    inputType: "multi-select",
    operators: [...OPERATORS.multiSelect] as FilterOperator[],
    placeholder: "e.g., SS24, AW25",
    description: "Filter by product season",
  },

  // ==========================================================================
  // TIER 2: Advanced Filters
  // ==========================================================================

  productName: {
    id: "productName",
    label: "Product name",
    tier: 2,
    category: "product",
    inputType: "text",
    operators: [...OPERATORS.text] as FilterOperator[],
    placeholder: "Search product names...",
    description: "Search products by name",
  },

  carbonKgCo2e: {
    id: "carbonKgCo2e",
    label: "Carbon footprint",
    tier: 2,
    category: "sustainability",
    inputType: "number",
    operators: [...OPERATORS.number] as FilterOperator[],
    unit: "kg CO₂e",
    placeholder: "0.00",
    description: "Filter by carbon emissions",
  },

  waterLiters: {
    id: "waterLiters",
    label: "Water usage",
    tier: 2,
    category: "sustainability",
    inputType: "number",
    operators: [...OPERATORS.number] as FilterOperator[],
    unit: "Liter",
    placeholder: "0.00",
    description: "Filter by water consumption",
  },

  materials: {
    id: "materials",
    label: "Materials",
    tier: 2,
    category: "manufacturing",
    inputType: "multi-select",
    operators: [...OPERATORS.multiSelect] as FilterOperator[],
    description: "Filter by materials",
  },

  ecoClaimId: {
    id: "ecoClaimId",
    label: "Eco claims",
    tier: 2,
    category: "sustainability",
    inputType: "multi-select",
    operators: [...OPERATORS.multiSelect] as FilterOperator[],
    description: "Filter by eco claims",
  },

  tagId: {
    id: "tagId",
    label: "Tags",
    tier: 2,
    category: "metadata",
    inputType: "multi-select",
    operators: [...OPERATORS.multiSelect] as FilterOperator[],
    description: "Filter by organizational tags",
  },

  brandCertificationId: {
    id: "brandCertificationId",
    label: "Certifications",
    tier: 2,
    category: "sustainability",
    inputType: "multi-select",
    operators: [...OPERATORS.multiSelect] as FilterOperator[],
    description: "Filter by certifications",
  },

  createdAt: {
    id: "createdAt",
    label: "Created date",
    tier: 2,
    category: "metadata",
    inputType: "date",
    operators: [...OPERATORS.date] as FilterOperator[],
    description: "Filter by creation date",
  },

  updatedAt: {
    id: "updatedAt",
    label: "Updated date",
    tier: 2,
    category: "metadata",
    inputType: "date",
    operators: [...OPERATORS.date] as FilterOperator[],
    description: "Filter by last update date",
  },

  // ==========================================================================
  // TIER 3: Power User Filters
  // ==========================================================================

  operatorId: {
    id: "operatorId",
    label: "Operator",
    tier: 2,
    category: "manufacturing",
    inputType: "multi-select",
    operators: [...OPERATORS.multiSelect] as FilterOperator[],
    description: "Filter by operators",
  },

  stepType: {
    id: "stepType",
    label: "Journey step type",
    tier: 3,
    category: "manufacturing",
    inputType: "multi-select",
    operators: [...OPERATORS.relational] as FilterOperator[],
    options: allProductionSteps.map((step) => ({
      value: step.name,
      label: step.name,
    })),
    description: "Filter by journey step types",
  },

  materialRecyclable: {
    id: "materialRecyclable",
    label: "Material recyclability",
    tier: 3,
    category: "sustainability",
    inputType: "boolean",
    operators: [...OPERATORS.boolean] as FilterOperator[],
    description: "Filter by material recyclability",
  },

  hasImage: {
    id: "hasImage",
    label: "Has image",
    tier: 3,
    category: "product",
    inputType: "boolean",
    operators: [...OPERATORS.boolean] as FilterOperator[],
    description: "Filter products with or without images",
  },

  showcaseBrandId: {
    id: "showcaseBrandId",
    label: "Showcase brand",
    tier: 3,
    category: "product",
    inputType: "select",
    operators: [
      "is",
      "is not",
      "is any of",
      "is empty",
      "is not empty",
    ] as FilterOperator[],
    description: "Filter by showcase brand (for multi-brand products)",
  },

  description: {
    id: "description",
    label: "Description",
    tier: 3,
    category: "product",
    inputType: "text",
    operators: [...OPERATORS.text] as FilterOperator[],
    placeholder: "Search descriptions...",
    description: "Search product descriptions",
  },
};

// ============================================================================
// Field Categories for UI Organization
// ============================================================================

export const FIELD_CATEGORIES = {
  product: {
    label: "Product",
    fields: [
      "productName",
      "description",
      "season",
      "categoryId",
      "colorId",
      "sizeId",
      "hasImage",
      "showcaseBrandId",
    ],
  },
  sustainability: {
    label: "Sustainability",
    fields: [
      "carbonKgCo2e",
      "waterLiters",
      "ecoClaimId",
      "brandCertificationId",
      "materialRecyclable",
    ],
  },
  variants: {
    label: "Variants",
    fields: [],
  },
  manufacturing: {
    label: "Manufacturing",
    fields: ["materials", "operatorId", "stepType"],
  },
  metadata: {
    label: "Metadata",
    fields: [
      "status",
      "tagId",
      "createdAt",
      "updatedAt",
    ],
  },
} as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all fields for a specific tier
 */
export function getFieldsByTier(tier: 1 | 2 | 3): FilterFieldConfig[] {
  return Object.values(FILTER_FIELDS).filter((field) => field.tier === tier);
}

/**
 * Get all fields in a specific category
 */
export function getFieldsByCategory(
  category:
    | "product"
    | "sustainability"
    | "variants"
    | "manufacturing"
    | "metadata",
): FilterFieldConfig[] {
  return Object.values(FILTER_FIELDS).filter(
    (field) => field.category === category,
  );
}

/**
 * Get field configuration by ID
 * For advanced filters, returns transformed version if applicable (e.g., categoryId as multi-select)
 */
export function getFieldConfig(fieldId: string, forAdvancedFilters = false): FilterFieldConfig | undefined {
  const field = FILTER_FIELDS[fieldId];
  if (!field) return undefined;
  
  // For advanced filters, transform categoryId from hierarchical to multi-select
  if (forAdvancedFilters && fieldId === "categoryId" && field.tier === 1) {
    return {
      ...field,
      inputType: "multi-select" as const,
      operators: [...OPERATORS.multiSelect] as FilterOperator[],
    };
  }
  
  return field;
}

/**
 * Get available operators for a field
 */
export function getOperatorsForField(fieldId: string): FilterOperator[] {
  const config = getFieldConfig(fieldId);
  return config?.operators ?? [];
}

/**
 * Get Tier 1 (Quick Filter) fields
 */
export function getQuickFilterFields(): FilterFieldConfig[] {
  return getFieldsByTier(1);
}

/**
 * Get fields organized by category for the advanced filter panel
 */
export function getFieldsByCategoryForUI(): Array<{
  category: string;
  label: string;
  fields: FilterFieldConfig[];
}> {
  return Object.entries(FIELD_CATEGORIES).map(([category, config]) => ({
    category,
    label: config.label,
    fields: config.fields
      .map((fieldId) => FILTER_FIELDS[fieldId])
      .filter(Boolean) as FilterFieldConfig[],
  }));
}

/**
 * Get advanced filter fields (Tier 2 and 3 only - excludes quick filters)
 */
export function getAdvancedFilterFields(): FilterFieldConfig[] {
  return Object.values(FILTER_FIELDS).filter(
    (field) => field.tier === 2 || field.tier === 3,
  );
}

/**
 * Get advanced fields organized by category (includes tier 1 fields for categoryId, colorId, sizeId, season)
 */
export function getAdvancedFieldsByCategoryForUI(): Array<{
  category: string;
  label: string;
  fields: FilterFieldConfig[];
}> {
  // Fields that should be available in advanced filters even though they're Tier 1
  const tier1FieldsInAdvanced = ["categoryId", "colorId", "sizeId", "season"];
  
  return Object.entries(FIELD_CATEGORIES)
    .map(([category, config]) => ({
      category,
      label: config.label,
      fields: config.fields
        .map((fieldId) => {
          const field = FILTER_FIELDS[fieldId];
          if (!field) return null;
          // Include Tier 2/3 fields, or Tier 1 fields that should be in advanced
          if (field.tier !== 1 || tier1FieldsInAdvanced.includes(fieldId)) {
            // For categoryId in advanced filters, create a multi-select version
            if (fieldId === "categoryId" && field.tier === 1) {
              return {
                ...field,
                inputType: "multi-select" as const,
                operators: [...OPERATORS.multiSelect] as FilterOperator[],
              };
            }
            return field;
          }
          return null;
        })
        .filter((field): field is FilterFieldConfig => field !== null),
    }))
    .filter((categoryGroup) => categoryGroup.fields.length > 0);
}
