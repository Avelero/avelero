/**
 * Unit Tests: Catalog Loader - Entity Resolution
 *
 * Tests the in-memory catalog lookup functions used during bulk import.
 * These functions resolve entity names to IDs from the pre-loaded brand catalog.
 *
 * @module __tests__/unit/catalog-loader/entity-resolution
 */

import { beforeEach, describe, expect, it } from "bun:test";
import {
  type BrandCatalog,
  lookupCategoryId,
  lookupMaterialId,
  lookupOperatorId,
  lookupSeasonId,
} from "../../../src/lib/catalog-loader";

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock BrandCatalog for testing
 */
function createMockCatalog(overrides?: Partial<BrandCatalog>): BrandCatalog {
  return {
    materials: new Map([
      ["cotton", "mat_001"],
      ["organic cotton", "mat_002"],
      ["polyester", "mat_003"],
    ]),
    seasons: new Map([
      ["nos", "sea_001"],
      ["ss25", "sea_002"],
      ["fw25", "sea_003"],
    ]),
    categories: new Map([
      ["clothing", "cat_001"],
      ["accessories", "cat_002"],
      ["clothing > t-shirts", "cat_003"],
    ]),
    operators: new Map([
      ["cotton farm italy", "fac_001"],
      ["textile mill portugal", "fac_002"],
      ["dyeing factory spain", "fac_003"],
    ]),
    valueMappings: new Map([
      // entityType:sourceColumn:normalizedRawValue -> targetId
      // Note: Entity types must be uppercase to match lookup functions
      ["MATERIAL:material_1_name:bio cotton", "mat_002"], // Maps "Bio Cotton" to Organic Cotton
      ["SEASON:season:spring 2025", "sea_002"], // Maps "Spring 2025" to SS25
      ["FACILITY:journey_steps:italy farm", "fac_001"], // Maps "Italy Farm" to Cotton Farm Italy
    ]),
    attributes: new Map([
      ["color", "attr_001"],
      ["size", "attr_002"],
      ["material", "attr_003"],
    ]),
    attributeTaxonomyLinks: new Map([
      ["color", "tax_attr_001"],
      ["size", "tax_attr_002"],
    ]),
    attributeValues: new Map([
      // attributeId:normalizedValueName -> AttributeValueInfo
      [
        "attr_001:red",
        {
          id: "val_001",
          name: "Red",
          attributeId: "attr_001",
          attributeName: "Color",
        },
      ],
      [
        "attr_001:blue",
        {
          id: "val_002",
          name: "Blue",
          attributeId: "attr_001",
          attributeName: "Color",
        },
      ],
      [
        "attr_002:small",
        {
          id: "val_003",
          name: "Small",
          attributeId: "attr_002",
          attributeName: "Size",
        },
      ],
      [
        "attr_002:medium",
        {
          id: "val_004",
          name: "Medium",
          attributeId: "attr_002",
          attributeName: "Size",
        },
      ],
      [
        "attr_002:large",
        {
          id: "val_005",
          name: "Large",
          attributeId: "attr_002",
          attributeName: "Size",
        },
      ],
    ]),
    tags: new Map([
      ["bestseller", "tag_001"],
      ["new arrival", "tag_002"],
      ["sale", "tag_003"],
    ]),
    manufacturers: new Map([
      ["premium textiles co", "mfr_001"],
      ["eco fashion manufacturing", "mfr_002"],
    ]),
    taxonomyAttributes: new Map([
      ["color", { id: "tax_attr_001", name: "Color", friendlyId: "color" }],
      ["size", { id: "tax_attr_002", name: "Size", friendlyId: "size" }],
      ["fit", { id: "tax_attr_003", name: "Fit", friendlyId: "fit" }],
    ]),
    taxonomyValues: new Map([
      // taxonomyAttributeId:normalizedValueName -> TaxonomyValueInfo
      [
        "tax_attr_001:red",
        {
          id: "tax_val_001",
          name: "Red",
          attributeId: "tax_attr_001",
          friendlyId: "red",
        },
      ],
      [
        "tax_attr_001:blue",
        {
          id: "tax_val_002",
          name: "Blue",
          attributeId: "tax_attr_001",
          friendlyId: "blue",
        },
      ],
      [
        "tax_attr_002:small",
        {
          id: "tax_val_003",
          name: "Small",
          attributeId: "tax_attr_002",
          friendlyId: "small",
        },
      ],
      [
        "tax_attr_002:medium",
        {
          id: "tax_val_004",
          name: "Medium",
          attributeId: "tax_attr_002",
          friendlyId: "medium",
        },
      ],
    ]),
    ...overrides,
  };
}

// ============================================================================
// Tests: Material Lookup
// ============================================================================

describe("Catalog Loader - Entity Resolution", () => {
  let catalog: BrandCatalog;

  beforeEach(() => {
    catalog = createMockCatalog();
  });

  describe("Material Lookup", () => {
    it("looks up material by exact name", () => {
      const result = lookupMaterialId(catalog, "cotton");
      expect(result).toBe("mat_001");
    });

    it("looks up material case-insensitively", () => {
      // Test various case variations
      expect(lookupMaterialId(catalog, "Cotton")).toBe("mat_001");
      expect(lookupMaterialId(catalog, "COTTON")).toBe("mat_001");
      expect(lookupMaterialId(catalog, "ORGANIC COTTON")).toBe("mat_002");
      expect(lookupMaterialId(catalog, "Organic Cotton")).toBe("mat_002");
    });

    it("returns null for unknown material", () => {
      const result = lookupMaterialId(catalog, "Unknown Material");
      expect(result).toBeNull();
    });

    it("checks value mappings before direct lookup", () => {
      // "Bio Cotton" is mapped to Organic Cotton (mat_002)
      const result = lookupMaterialId(catalog, "Bio Cotton", "material_1_name");
      expect(result).toBe("mat_002");
    });

    it("handles empty or whitespace-only material name", () => {
      expect(lookupMaterialId(catalog, "")).toBeNull();
      expect(lookupMaterialId(catalog, "   ")).toBeNull();
    });

    it("trims whitespace from material name", () => {
      expect(lookupMaterialId(catalog, "  cotton  ")).toBe("mat_001");
    });
  });

  // ============================================================================
  // Tests: Season Lookup
  // ============================================================================

  describe("Season Lookup", () => {
    it("looks up season by name", () => {
      expect(lookupSeasonId(catalog, "NOS")).toBe("sea_001");
      expect(lookupSeasonId(catalog, "SS25")).toBe("sea_002");
      expect(lookupSeasonId(catalog, "FW25")).toBe("sea_003");
    });

    it("looks up season case-insensitively", () => {
      expect(lookupSeasonId(catalog, "nos")).toBe("sea_001");
      expect(lookupSeasonId(catalog, "Nos")).toBe("sea_001");
      expect(lookupSeasonId(catalog, "ss25")).toBe("sea_002");
    });

    it("returns null for unknown season", () => {
      expect(lookupSeasonId(catalog, "Unknown Season")).toBeNull();
    });

    it("checks value mappings for seasons", () => {
      // "Spring 2025" is mapped to SS25 (sea_002)
      const result = lookupSeasonId(catalog, "Spring 2025", "season");
      expect(result).toBe("sea_002");
    });
  });

  // ============================================================================
  // Tests: Category Lookup
  // ============================================================================

  describe("Category Lookup", () => {
    it("looks up category by name", () => {
      expect(lookupCategoryId(catalog, "Clothing")).toBe("cat_001");
      expect(lookupCategoryId(catalog, "Accessories")).toBe("cat_002");
    });

    it("looks up hierarchical category by full path", () => {
      expect(lookupCategoryId(catalog, "Clothing > T-shirts")).toBe("cat_003");
    });

    it("looks up category case-insensitively", () => {
      expect(lookupCategoryId(catalog, "clothing")).toBe("cat_001");
      expect(lookupCategoryId(catalog, "ACCESSORIES")).toBe("cat_002");
    });

    it("returns null for unknown category", () => {
      expect(lookupCategoryId(catalog, "Unknown Category")).toBeNull();
    });

    it("handles empty category name", () => {
      expect(lookupCategoryId(catalog, "")).toBeNull();
    });
  });

  // ============================================================================
  // Tests: Operator/Facility Lookup
  // ============================================================================

  describe("Operator/Facility Lookup", () => {
    it("looks up facility/operator by display name", () => {
      expect(lookupOperatorId(catalog, "Cotton Farm Italy")).toBe("fac_001");
      expect(lookupOperatorId(catalog, "Textile Mill Portugal")).toBe(
        "fac_002",
      );
    });

    it("looks up operator case-insensitively", () => {
      expect(lookupOperatorId(catalog, "cotton farm italy")).toBe("fac_001");
      expect(lookupOperatorId(catalog, "DYEING FACTORY SPAIN")).toBe("fac_003");
    });

    it("returns null for unknown operator", () => {
      expect(lookupOperatorId(catalog, "Unknown Factory")).toBeNull();
    });

    it("checks value mappings for facilities", () => {
      // "Italy Farm" is mapped to Cotton Farm Italy (fac_001)
      const result = lookupOperatorId(catalog, "Italy Farm", "journey_steps");
      expect(result).toBe("fac_001");
    });
  });

  // ============================================================================
  // Tests: Attribute Lookup
  // ============================================================================

  describe("Attribute Lookup", () => {
    it("looks up attribute by name", () => {
      const colorAttrId = catalog.attributes.get("color");
      const sizeAttrId = catalog.attributes.get("size");

      expect(colorAttrId).toBe("attr_001");
      expect(sizeAttrId).toBe("attr_002");
    });

    it("looks up attribute case-insensitively", () => {
      // Catalog stores normalized (lowercase) keys
      expect(catalog.attributes.get("color")).toBe("attr_001");
      expect(catalog.attributes.get("size")).toBe("attr_002");
    });

    it("returns undefined for unknown attribute", () => {
      expect(catalog.attributes.get("unknown attribute")).toBeUndefined();
    });
  });

  // ============================================================================
  // Tests: Attribute Value Lookup
  // ============================================================================

  describe("Attribute Value Lookup", () => {
    it("looks up attribute value by attribute+name composite key", () => {
      const redValue = catalog.attributeValues.get("attr_001:red");
      const mediumValue = catalog.attributeValues.get("attr_002:medium");

      expect(redValue).toBeDefined();
      expect(redValue?.id).toBe("val_001");
      expect(redValue?.name).toBe("Red");
      expect(redValue?.attributeId).toBe("attr_001");
      expect(redValue?.attributeName).toBe("Color");

      expect(mediumValue).toBeDefined();
      expect(mediumValue?.id).toBe("val_004");
      expect(mediumValue?.attributeName).toBe("Size");
    });

    it("returns undefined for unknown attribute value", () => {
      expect(catalog.attributeValues.get("attr_001:purple")).toBeUndefined();
    });

    it("requires both attribute ID and value name in key", () => {
      // Just the value name without attribute ID shouldn't work
      expect(catalog.attributeValues.get("red")).toBeUndefined();
    });
  });

  // ============================================================================
  // Tests: Taxonomy Attribute Lookup
  // ============================================================================

  describe("Taxonomy Attribute Lookup", () => {
    it("looks up taxonomy attribute by name", () => {
      const colorTaxAttr = catalog.taxonomyAttributes.get("color");
      const sizeTaxAttr = catalog.taxonomyAttributes.get("size");

      expect(colorTaxAttr).toBeDefined();
      expect(colorTaxAttr?.id).toBe("tax_attr_001");
      expect(colorTaxAttr?.name).toBe("Color");
      expect(colorTaxAttr?.friendlyId).toBe("color");

      expect(sizeTaxAttr).toBeDefined();
      expect(sizeTaxAttr?.id).toBe("tax_attr_002");
    });

    it("returns undefined for unknown taxonomy attribute", () => {
      expect(catalog.taxonomyAttributes.get("unknown")).toBeUndefined();
    });
  });

  // ============================================================================
  // Tests: Taxonomy Value Lookup
  // ============================================================================

  describe("Taxonomy Value Lookup", () => {
    it("looks up taxonomy value by attribute+name composite key", () => {
      const redTaxValue = catalog.taxonomyValues.get("tax_attr_001:red");
      const mediumTaxValue = catalog.taxonomyValues.get("tax_attr_002:medium");

      expect(redTaxValue).toBeDefined();
      expect(redTaxValue?.id).toBe("tax_val_001");
      expect(redTaxValue?.name).toBe("Red");
      expect(redTaxValue?.attributeId).toBe("tax_attr_001");
      expect(redTaxValue?.friendlyId).toBe("red");

      expect(mediumTaxValue).toBeDefined();
      expect(mediumTaxValue?.id).toBe("tax_val_004");
    });

    it("returns undefined for unknown taxonomy value", () => {
      expect(catalog.taxonomyValues.get("tax_attr_001:purple")).toBeUndefined();
    });
  });

  // ============================================================================
  // Tests: Tags Lookup
  // ============================================================================

  describe("Tags Lookup", () => {
    it("looks up tag by name", () => {
      expect(catalog.tags.get("bestseller")).toBe("tag_001");
      expect(catalog.tags.get("new arrival")).toBe("tag_002");
    });

    it("returns undefined for unknown tag", () => {
      expect(catalog.tags.get("unknown tag")).toBeUndefined();
    });
  });

  // ============================================================================
  // Tests: Manufacturers Lookup
  // ============================================================================

  describe("Manufacturers Lookup", () => {
    it("looks up manufacturer by name", () => {
      expect(catalog.manufacturers.get("premium textiles co")).toBe("mfr_001");
      expect(catalog.manufacturers.get("eco fashion manufacturing")).toBe(
        "mfr_002",
      );
    });

    it("returns undefined for unknown manufacturer", () => {
      expect(catalog.manufacturers.get("unknown manufacturer")).toBeUndefined();
    });
  });
});
