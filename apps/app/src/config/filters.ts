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

  number: ["equals", "does not equal", "greater than", "greater than or equal to", "less than", "less than or equal to", "between"] as const,

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

  date: [
    "is before",
    "is after",
    "is between",
  ] as const,

  boolean: ["is true", "is false"] as const,

  moduleCompletion: ["is complete", "is not complete"] as const,
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

export const MODULE_OPTIONS: SelectOption[] = [
  { value: "core", label: "Core" },
  { value: "environment", label: "Environment" },
  { value: "journey", label: "Journey" },
  { value: "materials", label: "Materials" },
  { value: "certifications", label: "Certifications" },
  { value: "care", label: "Care" },
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

  moduleCompletion: {
    id: "moduleCompletion",
    label: "Module completion",
    tier: 1,
    category: "metadata",
    inputType: "multi-select",
    operators: [
      "is complete",
      "is not complete",
    ] as unknown as FilterOperator[],
    options: MODULE_OPTIONS,
    description:
      "Filter by specific module completion status (e.g., Environment complete, Journey not complete)",
  },

  categoryId: {
    id: "categoryId",
    label: "Category",
    tier: 1,
    category: "product",
    inputType: "hierarchical",
    operators: [...OPERATORS.hierarchical] as FilterOperator[],
    optionsSource: {
      type: "trpc",
      endpoint: "catalog.categories.list",
      transform: (data: any) => {
        const categories = data?.data ?? [];
        return categories.map((c: any) => ({
          value: c.id,
          label: c.name,
        }));
      },
    },
    description: "Filter by product category with hierarchy support",
  },

  colorId: {
    id: "colorId",
    label: "Color",
    tier: 1,
    category: "variants",
    inputType: "multi-select",
    operators: [...OPERATORS.multiSelect] as FilterOperator[],
    optionsSource: {
      type: "trpc",
      endpoint: "brandCatalog.colors.list",
      transform: (data: any) => {
        const colors = data?.data ?? [];
        return colors.map((c: any) => ({
          value: c.id,
          label: c.name,
        }));
      },
    },
    description: "Filter by variant colors",
  },

  sizeId: {
    id: "sizeId",
    label: "Size",
    tier: 1,
    category: "variants",
    inputType: "multi-select",
    operators: [...OPERATORS.multiSelect] as FilterOperator[],
    optionsSource: {
      type: "trpc",
      endpoint: "brandCatalog.sizes.list",
      transform: (data: any) => {
        const sizes = data?.data ?? [];
        return sizes.map((s: any) => ({
          value: s.id,
          label: s.name,
        }));
      },
    },
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
    inputType: "nested",
    operators: [...OPERATORS.relational] as FilterOperator[],
    optionsSource: {
      type: "trpc",
      endpoint: "brandCatalog.materials.list",
      transform: (data: any) => {
        const materials = data?.data ?? [];
        return materials.map((m: any) => ({
          value: m.id,
          label: m.name,
        }));
      },
    },
    nested: {
      type: "materials",
      primaryField: "brandMaterialId",
      nestedFields: [
        "percentage",
        "recyclable",
        "countryOfOrigin",
        "certificationId",
      ],
    },
    description: "Filter by materials with nested conditions",
  },

  ecoClaimId: {
    id: "ecoClaimId",
    label: "Eco claims",
    tier: 2,
    category: "sustainability",
    inputType: "multi-select",
    operators: [...OPERATORS.relational] as FilterOperator[],
    optionsSource: {
      type: "trpc",
      endpoint: "brandCatalog.ecoClaims.list",
      transform: (data: any) => {
        const claims = data?.data ?? [];
        return claims.map((c: any) => ({
          value: c.id,
          label: c.title,
        }));
      },
    },
    description: "Filter by eco claims",
  },

  templateId: {
    id: "templateId",
    label: "Template",
    tier: 2,
    category: "metadata",
    inputType: "select",
    operators: ["is", "is not", "is any of"] as FilterOperator[],
    optionsSource: {
      type: "trpc",
      endpoint: "passportTemplates.list",
      transform: (data: any) => {
        const templates = data?.data ?? [];
        return templates.map((t: any) => ({
          value: t.id,
          label: t.name,
        }));
      },
    },
    description: "Filter by passport template",
  },

  facilityCountryCode: {
    id: "facilityCountryCode",
    label: "Country of manufacture",
    tier: 2,
    category: "manufacturing",
    inputType: "country",
    operators: ["is", "is not", "is any of"] as FilterOperator[],
    description: "Filter by manufacturing country (nested in facilities)",
  },

  brandCertificationId: {
    id: "brandCertificationId",
    label: "Certifications",
    tier: 2,
    category: "sustainability",
    inputType: "multi-select",
    operators: [...OPERATORS.multiSelect] as FilterOperator[],
    optionsSource: {
      type: "trpc",
      endpoint: "brandCatalog.certifications.list",
      transform: (data: any) => {
        const certs = data?.data ?? [];
        return certs.map((c: any) => ({
          value: c.id,
          label: c.title,
        }));
      },
    },
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

  sku: {
    id: "sku",
    label: "SKU",
    tier: 3,
    category: "variants",
    inputType: "text",
    operators: [...OPERATORS.text] as FilterOperator[],
    placeholder: "Search SKUs...",
    description: "Filter by product SKU",
  },

  upid: {
    id: "upid",
    label: "UPID",
    tier: 3,
    category: "variants",
    inputType: "text",
    operators: [...OPERATORS.text] as FilterOperator[],
    placeholder: "Search UPIDs...",
    description: "Filter by unique product ID",
  },

  facilityId: {
    id: "facilityId",
    label: "Facility",
    tier: 3,
    category: "manufacturing",
    inputType: "nested",
    operators: [...OPERATORS.relational] as FilterOperator[],
    optionsSource: {
      type: "trpc",
      endpoint: "brandCatalog.facilities.list",
      transform: (data: any) => {
        const facilities = data?.data ?? [];
        return facilities.map((f: any) => ({
          value: f.id,
          label: f.name,
        }));
      },
    },
    nested: {
      type: "facilities",
      primaryField: "facilityId",
      nestedFields: ["countryCode", "city", "stepType"],
    },
    description: "Filter by manufacturing facilities with nested conditions",
  },

  stepType: {
    id: "stepType",
    label: "Journey step type",
    tier: 3,
    category: "manufacturing",
    inputType: "multi-select",
    operators: [...OPERATORS.relational] as FilterOperator[],
    options: [
      { value: "manufacturing", label: "Manufacturing" },
      { value: "assembly", label: "Assembly" },
      { value: "finishing", label: "Finishing" },
      { value: "packaging", label: "Packaging" },
    ],
    description: "Filter by journey step types",
  },

  careCodeId: {
    id: "careCodeId",
    label: "Care codes",
    tier: 3,
    category: "product",
    inputType: "multi-select",
    operators: [...OPERATORS.relational] as FilterOperator[],
    optionsSource: {
      type: "trpc",
      endpoint: "catalog.careCodes.list",
      transform: (data: any) => {
        const codes = data?.data ?? [];
        return codes.map((c: any) => ({
          value: c.id,
          label: c.name,
        }));
      },
    },
    description: "Filter by care instruction codes",
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
    optionsSource: {
      type: "trpc",
      endpoint: "brandCatalog.showcaseBrands.list",
      transform: (data: any) => {
        const brands = data?.data ?? [];
        return brands.map((b: any) => ({
          value: b.id,
          label: b.name,
        }));
      },
    },
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
    fields: ["colorId", "sizeId", "sku", "upid"],
  },
  manufacturing: {
    label: "Manufacturing",
    fields: [
      "materials",
      "facilityId",
      "facilityCountryCode",
      "stepType",
      "careCodeId",
    ],
  },
  metadata: {
    label: "Metadata",
    fields: [
      "status",
      "moduleCompletion",
      "templateId",
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
 */
export function getFieldConfig(fieldId: string): FilterFieldConfig | undefined {
  return FILTER_FIELDS[fieldId];
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
 * Get advanced fields organized by category (excludes tier 1 quick filters)
 */
export function getAdvancedFieldsByCategoryForUI(): Array<{
  category: string;
  label: string;
  fields: FilterFieldConfig[];
}> {
  return Object.entries(FIELD_CATEGORIES)
    .map(([category, config]) => ({
      category,
      label: config.label,
      fields: config.fields
        .map((fieldId) => FILTER_FIELDS[fieldId])
        .filter((field) => field && field.tier !== 1) as FilterFieldConfig[],
    }))
    .filter((categoryGroup) => categoryGroup.fields.length > 0);
}
