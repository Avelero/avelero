/**
 * Field Registry - Master Definition of All Syncable Fields
 *
 * This file is the single source of truth for all fields that can be:
 * - Synced from external integrations (Shopify, It's Perfect, etc.)
 * - Displayed on Digital Product Passports
 * - Managed via bulk imports
 *
 * Field keys follow the pattern: `{entity}.{fieldName}`
 * Example: `product.name`, `material.recyclable`, `facility.city`
 *
 * @see plan-integration.md for architecture details
 */

import type { FieldCategory, FieldDefinition } from "./types";
import { entities } from "./entities";

// Re-export types and entities for convenience
export * from "./types";
export * from "./entities";

// =============================================================================
// FIELD REGISTRY
// =============================================================================

export const fieldRegistry: Record<string, FieldDefinition> = {
  // ===========================================================================
  // PRODUCT FIELDS
  // ===========================================================================

  // --- Identifiers ---

  "product.productHandle": {
    table: "products",
    column: "product_handle",
    type: "string",
    required: true,
    maxLength: 100,
    label: "Product Handle",
    description:
      "Internal product handle used by the brand. Must be unique within a brand.",
    category: "identifiers",
  },

  "product.ean": {
    table: "products",
    column: "ean",
    type: "string",
    maxLength: 13,
    label: "EAN",
    description: "European Article Number (13-digit barcode)",
    category: "identifiers",
  },

  "product.gtin": {
    table: "products",
    column: "gtin",
    type: "string",
    maxLength: 14,
    label: "GTIN",
    description: "Global Trade Item Number (14-digit)",
    category: "identifiers",
  },

  "product.upid": {
    table: "products",
    column: "upid",
    type: "string",
    maxLength: 50,
    label: "UPID",
    description: "Avelero Unique Product Identifier (system-generated)",
    category: "identifiers",
  },

  // --- Basic Info ---

  "product.name": {
    table: "products",
    column: "name",
    type: "string",
    required: true,
    maxLength: 100,
    label: "Product Name",
    description: "Display name of the product",
    category: "basic",
  },

  "product.description": {
    table: "products",
    column: "description",
    type: "text",
    maxLength: 2000,
    label: "Description",
    description: "Full product description",
    category: "basic",
  },

  "product.gender": {
    table: "products",
    column: "gender",
    type: "enum",
    enumValues: ["unisex", "male", "female", "kids", "other"] as const,
    label: "Gender",
    description: "Target gender for the product",
    category: "basic",
  },

  "product.status": {
    table: "products",
    column: "status",
    type: "enum",
    enumValues: ["unpublished", "published", "archived", "scheduled"] as const,
    label: "Publication Status",
    description: "DPP publication status",
    category: "basic",
  },

  // --- Commercial ---

  "product.price": {
    table: "products",
    column: "price",
    type: "decimal",
    precision: [10, 2],
    label: "Price",
    description: "Retail price of the product",
    category: "commercial",
  },

  "product.currency": {
    table: "products",
    column: "currency",
    type: "string",
    maxLength: 3,
    label: "Currency",
    description: "ISO 4217 currency code",
    category: "commercial",
  },

  "product.salesStatus": {
    table: "products",
    column: "sales_status",
    type: "enum",
    enumValues: [
      "available",
      "sold_out",
      "preorder",
      "discontinued",
    ] as const,
    label: "Sales Status",
    description: "Current availability status",
    category: "commercial",
  },

  "product.webshopUrl": {
    table: "products",
    column: "webshop_url",
    type: "string",
    maxLength: 500,
    label: "Webshop URL",
    description: "Link to product page on e-commerce site",
    category: "commercial",
  },

  // --- Physical ---

  "product.weight": {
    table: "products",
    column: "weight",
    type: "decimal",
    precision: [10, 2],
    label: "Weight",
    description: "Product weight",
    category: "physical",
  },

  "product.weightUnit": {
    table: "products",
    column: "weight_unit",
    type: "enum",
    enumValues: ["grams", "kg", "oz", "lbs"] as const,
    label: "Weight Unit",
    description: "Unit of measurement for weight",
    category: "physical",
  },

  // --- Organization (References) ---

  "product.categoryId": {
    table: "products",
    column: "category_id",
    type: "reference",
    referencesTable: "categories",
    referencesColumn: "name",
    label: "Category",
    description: "Product category (e.g., Jackets, T-Shirts)",
    category: "organization",
  },

  "product.seasonId": {
    table: "products",
    column: "season_id",
    type: "reference",
    referencesTable: "brand_seasons",
    referencesColumn: "name",
    label: "Season",
    description: "Fashion season (e.g., SS25, FW24)",
    category: "organization",
  },

  "product.manufacturerId": {
    table: "products",
    column: "manufacturer_id",
    type: "reference",
    referencesTable: "brand_manufacturers",
    referencesColumn: "name",
    label: "Manufacturer",
    description: "Product manufacturer or brand owner",
    category: "organization",
  },

  // --- Media ---

  "product.imagePath": {
    table: "products",
    column: "image_path",
    type: "string",
    maxLength: 500,
    label: "Primary Image",
    description: "URL or path to the main product image",
    category: "media",
  },

  // --- Relations ---

  "product.materials": {
    table: "products",
    type: "relation",
    relationType: "many-to-many",
    throughTable: "product_materials",
    targetEntity: "material",
    label: "Materials",
    description: "Material composition with percentages",
    category: "materials",
  },

  "product.journeySteps": {
    table: "products",
    type: "relation",
    relationType: "one-to-many",
    targetEntity: "journeyStep",
    label: "Supply Chain",
    description: "Manufacturing journey steps (spinning, weaving, etc.)",
    category: "supply-chain",
  },

  "product.ecoClaims": {
    table: "products",
    type: "relation",
    relationType: "many-to-many",
    throughTable: "product_eco_claims",
    targetEntity: "ecoClaim",
    label: "Eco Claims",
    description: "Environmental and sustainability claims",
    category: "certifications",
  },

  "product.tags": {
    table: "products",
    type: "relation",
    relationType: "many-to-many",
    throughTable: "tags_on_product",
    targetEntity: "tag",
    label: "Tags",
    description: "Custom product tags for organization",
    category: "organization",
  },

  "product.variants": {
    table: "products",
    type: "relation",
    relationType: "one-to-many",
    targetEntity: "variant",
    label: "Variants",
    description: "Color and size variants",
    category: "variants",
  },

  // ===========================================================================
  // PRODUCT VARIANT FIELDS
  // ===========================================================================

  "variant.upid": {
    table: "product_variants",
    column: "upid",
    type: "string",
    maxLength: 50,
    label: "Variant UPID",
    description: "Unique identifier for variant (for QR codes)",
    category: "variants",
  },

  // ===========================================================================
  // PRODUCT ENVIRONMENT FIELDS
  // ===========================================================================

  "environment.carbonKgCo2e": {
    table: "product_environment",
    column: "carbon_kg_co2e",
    type: "decimal",
    precision: [12, 4],
    label: "Carbon Emissions",
    description: "Carbon footprint in kg CO2 equivalent",
    category: "environment",
  },

  "environment.waterLiters": {
    table: "product_environment",
    column: "water_liters",
    type: "decimal",
    precision: [12, 4],
    label: "Water Usage",
    description: "Water consumption in liters",
    category: "environment",
  },

  // ===========================================================================
  // MATERIAL FIELDS (brand_materials)
  // ===========================================================================

  "material.name": {
    table: "brand_materials",
    column: "name",
    type: "string",
    required: true,
    maxLength: 100,
    label: "Material Name",
    description: "Name of the material (e.g., Organic Cotton)",
    category: "materials",
  },

  "material.recyclable": {
    table: "brand_materials",
    column: "recyclable",
    type: "boolean",
    label: "Recyclable",
    description: "Whether the material is recyclable",
    category: "materials",
  },

  "material.countryOfOrigin": {
    table: "brand_materials",
    column: "country_of_origin",
    type: "string",
    maxLength: 100,
    label: "Country of Origin",
    description: "Country where the material originates",
    category: "materials",
  },

  "material.certificationId": {
    table: "brand_materials",
    column: "certification_id",
    type: "reference",
    referencesTable: "brand_certifications",
    referencesColumn: "title",
    label: "Certification",
    description: "Associated certification (GOTS, GRS, etc.)",
    category: "materials",
  },

  // ===========================================================================
  // PRODUCT MATERIAL JUNCTION FIELDS (product_materials)
  // ===========================================================================

  "productMaterial.percentage": {
    table: "product_materials",
    column: "percentage",
    type: "decimal",
    precision: [6, 2],
    label: "Material Percentage",
    description: "Percentage of this material in the product composition",
    category: "materials",
  },

  // ===========================================================================
  // FACILITY FIELDS (brand_facilities)
  // ===========================================================================

  "facility.displayName": {
    table: "brand_facilities",
    column: "display_name",
    type: "string",
    required: true,
    maxLength: 100,
    label: "Facility Name",
    description: "Display name of the facility",
    category: "supply-chain",
  },

  "facility.legalName": {
    table: "brand_facilities",
    column: "legal_name",
    type: "string",
    maxLength: 200,
    label: "Legal Name",
    description: "Official registered name of the facility",
    category: "supply-chain",
  },

  "facility.email": {
    table: "brand_facilities",
    column: "email",
    type: "string",
    maxLength: 100,
    label: "Email",
    description: "Contact email address",
    category: "supply-chain",
  },

  "facility.phone": {
    table: "brand_facilities",
    column: "phone",
    type: "string",
    maxLength: 30,
    label: "Phone",
    description: "Contact phone number",
    category: "supply-chain",
  },

  "facility.website": {
    table: "brand_facilities",
    column: "website",
    type: "string",
    maxLength: 200,
    label: "Website",
    description: "Facility website URL",
    category: "supply-chain",
  },

  "facility.addressLine1": {
    table: "brand_facilities",
    column: "address_line1",
    type: "string",
    maxLength: 200,
    label: "Address Line 1",
    description: "Street address",
    category: "supply-chain",
  },

  "facility.addressLine2": {
    table: "brand_facilities",
    column: "address_line2",
    type: "string",
    maxLength: 200,
    label: "Address Line 2",
    description: "Additional address information",
    category: "supply-chain",
  },

  "facility.city": {
    table: "brand_facilities",
    column: "city",
    type: "string",
    maxLength: 100,
    label: "City",
    description: "City name",
    category: "supply-chain",
  },

  "facility.state": {
    table: "brand_facilities",
    column: "state",
    type: "string",
    maxLength: 100,
    label: "State/Province",
    description: "State or province",
    category: "supply-chain",
  },

  "facility.zip": {
    table: "brand_facilities",
    column: "zip",
    type: "string",
    maxLength: 20,
    label: "ZIP/Postal Code",
    description: "Postal or ZIP code",
    category: "supply-chain",
  },

  "facility.countryCode": {
    table: "brand_facilities",
    column: "country_code",
    type: "string",
    maxLength: 2,
    label: "Country Code",
    description: "ISO 3166-1 alpha-2 country code",
    category: "supply-chain",
  },

  // ===========================================================================
  // JOURNEY STEP FIELDS (product_journey_steps)
  // ===========================================================================

  "journeyStep.sortIndex": {
    table: "product_journey_steps",
    column: "sort_index",
    type: "number",
    required: true,
    label: "Step Order",
    description: "Order of this step in the supply chain (0 = first)",
    category: "supply-chain",
  },

  "journeyStep.stepType": {
    table: "product_journey_steps",
    column: "step_type",
    type: "string",
    required: true,
    maxLength: 50,
    label: "Process Step",
    description: "Type of manufacturing process",
    category: "supply-chain",
  },

  "journeyStep.facilityId": {
    table: "product_journey_steps",
    column: "facility_id",
    type: "reference",
    referencesTable: "brand_facilities",
    referencesColumn: "displayName",
    required: true,
    label: "Facility",
    description: "Facility performing this step",
    category: "supply-chain",
  },

  // ===========================================================================
  // MANUFACTURER FIELDS (brand_manufacturers)
  // ===========================================================================

  "manufacturer.name": {
    table: "brand_manufacturers",
    column: "name",
    type: "string",
    required: true,
    maxLength: 100,
    label: "Manufacturer Name",
    description: "Display name of the manufacturer",
    category: "organization",
  },

  "manufacturer.legalName": {
    table: "brand_manufacturers",
    column: "legal_name",
    type: "string",
    maxLength: 200,
    label: "Legal Name",
    description: "Official registered company name",
    category: "organization",
  },

  "manufacturer.email": {
    table: "brand_manufacturers",
    column: "email",
    type: "string",
    maxLength: 100,
    label: "Email",
    description: "Contact email address",
    category: "organization",
  },

  "manufacturer.phone": {
    table: "brand_manufacturers",
    column: "phone",
    type: "string",
    maxLength: 30,
    label: "Phone",
    description: "Contact phone number",
    category: "organization",
  },

  "manufacturer.website": {
    table: "brand_manufacturers",
    column: "website",
    type: "string",
    maxLength: 200,
    label: "Website",
    description: "Manufacturer website URL",
    category: "organization",
  },

  "manufacturer.addressLine1": {
    table: "brand_manufacturers",
    column: "address_line1",
    type: "string",
    maxLength: 200,
    label: "Address Line 1",
    description: "Street address",
    category: "organization",
  },

  "manufacturer.addressLine2": {
    table: "brand_manufacturers",
    column: "address_line2",
    type: "string",
    maxLength: 200,
    label: "Address Line 2",
    description: "Additional address information",
    category: "organization",
  },

  "manufacturer.city": {
    table: "brand_manufacturers",
    column: "city",
    type: "string",
    maxLength: 100,
    label: "City",
    description: "City name",
    category: "organization",
  },

  "manufacturer.state": {
    table: "brand_manufacturers",
    column: "state",
    type: "string",
    maxLength: 100,
    label: "State/Province",
    description: "State or province",
    category: "organization",
  },

  "manufacturer.zip": {
    table: "brand_manufacturers",
    column: "zip",
    type: "string",
    maxLength: 20,
    label: "ZIP/Postal Code",
    description: "Postal or ZIP code",
    category: "organization",
  },

  "manufacturer.countryCode": {
    table: "brand_manufacturers",
    column: "country_code",
    type: "string",
    maxLength: 2,
    label: "Country Code",
    description: "ISO 3166-1 alpha-2 country code",
    category: "organization",
  },

  // ===========================================================================
  // SEASON FIELDS (brand_seasons)
  // ===========================================================================

  "season.name": {
    table: "brand_seasons",
    column: "name",
    type: "string",
    required: true,
    maxLength: 50,
    label: "Season Name",
    description: "Season identifier (e.g., SS25, FW24)",
    category: "organization",
  },

  "season.startDate": {
    table: "brand_seasons",
    column: "start_date",
    type: "date",
    label: "Start Date",
    description: "Season start date",
    category: "organization",
  },

  "season.endDate": {
    table: "brand_seasons",
    column: "end_date",
    type: "date",
    label: "End Date",
    description: "Season end date",
    category: "organization",
  },

  "season.ongoing": {
    table: "brand_seasons",
    column: "ongoing",
    type: "boolean",
    label: "Ongoing",
    description: "Whether this is an evergreen/ongoing season",
    category: "organization",
  },

  // ===========================================================================
  // CATEGORY FIELDS (categories)
  // ===========================================================================

  "category.name": {
    table: "categories",
    column: "name",
    type: "string",
    required: true,
    maxLength: 100,
    label: "Category Name",
    description: "Product category name",
    category: "organization",
  },

  "category.parentId": {
    table: "categories",
    column: "parent_id",
    type: "reference",
    referencesTable: "categories",
    referencesColumn: "name",
    label: "Parent Category",
    description: "Parent category for hierarchical organization",
    category: "organization",
  },

  // ===========================================================================
  // COLOR FIELDS (brand_colors)
  // ===========================================================================

  "color.name": {
    table: "brand_colors",
    column: "name",
    type: "string",
    required: true,
    maxLength: 50,
    label: "Color Name",
    description: "Display name of the color",
    category: "variants",
  },

  "color.hex": {
    table: "brand_colors",
    column: "hex",
    type: "string",
    maxLength: 7,
    label: "Hex Code",
    description: "Color hex code (e.g., #1A237E)",
    category: "variants",
  },

  // ===========================================================================
  // SIZE FIELDS (brand_sizes)
  // ===========================================================================

  "size.name": {
    table: "brand_sizes",
    column: "name",
    type: "string",
    required: true,
    maxLength: 20,
    label: "Size Name",
    description: "Size code or name",
    category: "variants",
  },

  "size.sortIndex": {
    table: "brand_sizes",
    column: "sort_index",
    type: "number",
    label: "Sort Order",
    description: "Order for displaying sizes (XS=0, S=1, M=2, etc.)",
    category: "variants",
  },

  // ===========================================================================
  // TAG FIELDS (brand_tags)
  // ===========================================================================

  "tag.name": {
    table: "brand_tags",
    column: "name",
    type: "string",
    required: true,
    maxLength: 50,
    label: "Tag Name",
    description: "Tag name for categorization",
    category: "organization",
  },

  "tag.hex": {
    table: "brand_tags",
    column: "hex",
    type: "string",
    maxLength: 7,
    label: "Tag Color",
    description: "Optional color for the tag",
    category: "organization",
  },

  // ===========================================================================
  // ECO CLAIM FIELDS (brand_eco_claims)
  // ===========================================================================

  "ecoClaim.claim": {
    table: "brand_eco_claims",
    column: "claim",
    type: "string",
    required: true,
    maxLength: 50,
    label: "Eco Claim",
    description: "Environmental or sustainability claim",
    category: "certifications",
  },

  // ===========================================================================
  // CERTIFICATION FIELDS (brand_certifications)
  // ===========================================================================

  "certification.title": {
    table: "brand_certifications",
    column: "title",
    type: "string",
    required: true,
    maxLength: 100,
    label: "Certification Title",
    description: "Name of the certification (e.g., GOTS, GRS)",
    category: "certifications",
  },

  "certification.certificationCode": {
    table: "brand_certifications",
    column: "certification_code",
    type: "string",
    maxLength: 50,
    label: "Certification Code",
    description: "Unique certification identifier or license number",
    category: "certifications",
  },

  "certification.instituteName": {
    table: "brand_certifications",
    column: "institute_name",
    type: "string",
    maxLength: 200,
    label: "Institute Name",
    description: "Name of the certifying institute",
    category: "certifications",
    commonlyIntegrated: true,
    example: "Control Union Certifications",
    dppPath: "materials.composition[].certification.testingInstitute.legalName",
  },

  "certification.instituteEmail": {
    table: "brand_certifications",
    column: "institute_email",
    type: "string",
    maxLength: 100,
    label: "Institute Email",
    description: "Contact email of the certifying institute",
    category: "certifications",
  },

  "certification.instituteWebsite": {
    table: "brand_certifications",
    column: "institute_website",
    type: "string",
    maxLength: 200,
    label: "Institute Website",
    description: "Website of the certifying institute",
    category: "certifications",
  },

  "certification.institutePhone": {
    table: "brand_certifications",
    column: "institute_phone",
    type: "string",
    maxLength: 30,
    label: "Institute Phone",
    description: "Phone number of the certifying institute",
    category: "certifications",
  },

  "certification.instituteAddressLine1": {
    table: "brand_certifications",
    column: "institute_address_line1",
    type: "string",
    maxLength: 200,
    label: "Institute Address",
    description: "Street address of the certifying institute",
    category: "certifications",
  },

  "certification.instituteAddressLine2": {
    table: "brand_certifications",
    column: "institute_address_line2",
    type: "string",
    maxLength: 200,
    label: "Institute Address Line 2",
    description: "Additional address of the certifying institute",
    category: "certifications",
  },

  "certification.instituteCity": {
    table: "brand_certifications",
    column: "institute_city",
    type: "string",
    maxLength: 100,
    label: "Institute City",
    description: "City of the certifying institute",
    category: "certifications",
  },

  "certification.instituteState": {
    table: "brand_certifications",
    column: "institute_state",
    type: "string",
    maxLength: 100,
    label: "Institute State",
    description: "State/province of the certifying institute",
    category: "certifications",
  },

  "certification.instituteZip": {
    table: "brand_certifications",
    column: "institute_zip",
    type: "string",
    maxLength: 20,
    label: "Institute ZIP",
    description: "Postal code of the certifying institute",
    category: "certifications",
  },

  "certification.instituteCountryCode": {
    table: "brand_certifications",
    column: "institute_country_code",
    type: "string",
    maxLength: 2,
    label: "Institute Country",
    description: "Country code of the certifying institute",
    category: "certifications",
  },

  "certification.issueDate": {
    table: "brand_certifications",
    column: "issue_date",
    type: "datetime",
    label: "Issue Date",
    description: "Date the certification was issued",
    category: "certifications",
  },

  "certification.expiryDate": {
    table: "brand_certifications",
    column: "expiry_date",
    type: "datetime",
    label: "Expiry Date",
    description: "Date the certification expires",
    category: "certifications",
  },

  "certification.filePath": {
    table: "brand_certifications",
    column: "file_path",
    type: "string",
    maxLength: 500,
    label: "Certificate File",
    description: "Path to the uploaded certificate document",
    category: "certifications",
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all fields for a specific entity
 */
export function getFieldsForEntity(entityName: string): Record<string, FieldDefinition> {
  const prefix = `${entityName}.`;
  return Object.fromEntries(
    Object.entries(fieldRegistry).filter(([key]) => key.startsWith(prefix))
  );
}

/**
 * Get all fields in a specific category
 */
export function getFieldsInCategory(category: FieldCategory): Record<string, FieldDefinition> {
  return Object.fromEntries(
    Object.entries(fieldRegistry).filter(([, def]) => def.category === category)
  );
}

/**
 * Get all commonly integrated fields
 */
export function getCommonlyIntegratedFields(): Record<string, FieldDefinition> {
  return Object.fromEntries(
    Object.entries(fieldRegistry).filter(([, def]) => def.commonlyIntegrated)
  );
}

/**
 * Get all relation fields
 */
export function getRelationFields(): Record<string, FieldDefinition> {
  return Object.fromEntries(
    Object.entries(fieldRegistry).filter(([, def]) => def.type === "relation")
  );
}

/**
 * Get all reference fields (foreign keys)
 */
export function getReferenceFields(): Record<string, FieldDefinition> {
  return Object.fromEntries(
    Object.entries(fieldRegistry).filter(([, def]) => def.type === "reference")
  );
}

/**
 * Validate a field key exists in the registry
 */
export function isValidFieldKey(key: string): key is keyof typeof fieldRegistry {
  return key in fieldRegistry;
}

/**
 * Get entity name from a field key
 */
export function getEntityFromFieldKey(key: string): string | null {
  const dotIndex = key.indexOf(".");
  if (dotIndex === -1) return null;
  return key.slice(0, dotIndex);
}

/**
 * Get field name (without entity prefix) from a field key
 */
export function getFieldNameFromKey(key: string): string | null {
  const dotIndex = key.indexOf(".");
  if (dotIndex === -1) return null;
  return key.slice(dotIndex + 1);
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Registry statistics for documentation
 */
export const registryStats = {
  totalEntities: Object.keys(entities).length,
  totalFields: Object.keys(fieldRegistry).length,
  fieldsByCategory: Object.entries(
    Object.values(fieldRegistry).reduce(
      (acc, field) => {
        acc[field.category] = (acc[field.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    )
  ).sort((a, b) => b[1] - a[1]),
  commonlyIntegratedCount: Object.values(fieldRegistry).filter((f) => f.commonlyIntegrated).length,
  relationFields: Object.values(fieldRegistry).filter((f) => f.type === "relation").length,
  referenceFields: Object.values(fieldRegistry).filter((f) => f.type === "reference").length,
} as const;

/*
 * REGISTRY STATISTICS:
 * 
 * Total Entities: 14
 *   - product, variant, environment, material, productMaterial
 *   - facility, journeyStep, manufacturer, season, category
 *   - color, size, tag, ecoClaim, certification
 * 
 * Total Fields: 87
 * 
 * Fields by Category:
 *   - certifications: 16
 *   - supply-chain: 15
 *   - organization: 14
 *   - materials: 6
 *   - basic: 5
 *   - variants: 6
 *   - identifiers: 4
 *   - commercial: 4
 *   - environment: 2
 *   - physical: 2
 *   - media: 1
 *   - (relations counted separately)
 * 
 * Commonly Integrated: ~55 fields
 * Relation Fields: 5 (materials, journeySteps, ecoClaims, tags, variants)
 * Reference Fields: 7 (seasonId, categoryId, manufacturerId, etc.)
 */

