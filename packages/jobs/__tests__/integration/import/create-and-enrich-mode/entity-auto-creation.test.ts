/**
 * Integration Tests: CREATE_AND_ENRICH Mode - Entity Auto-Creation
 *
 * Tests CREATE_AND_ENRICH mode with automatic entity creation.
 * When an entity (manufacturer, season, tag, material, facility) is not
 * found in the catalog, it should be auto-created.
 *
 * Categories are the ONLY exception - they must exist.
 *
 * @module tests/integration/import/create-and-enrich-mode/entity-auto-creation
 */

import "../../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import * as schema from "@v1/db/schema";
import {
  type InsertedCatalog,
  TestCatalog,
  cleanupTables,
  createTestBrand,
  testDb,
} from "@v1/db/testing";
import { ExcelBuilder, basicProduct } from "@v1/testing/bulk-import";
import { eq, sql } from "drizzle-orm";
import {
  type BrandCatalog,
  loadBrandCatalog,
} from "../../../../src/lib/catalog-loader";
import { parseExcelFile } from "../../../../src/lib/excel";

// Helper to simulate auto-creation logic from validate-and-stage
async function autoCreateMissingEntities(
  database: typeof testDb,
  brandId: string,
  parsedProducts: Awaited<ReturnType<typeof parseExcelFile>>["products"],
  catalog: BrandCatalog,
): Promise<BrandCatalog> {
  const normalizeKey = (s: string) => s.toLowerCase().trim();

  // Collect unique entity names from parsed products
  const uniqueManufacturers = new Set<string>();
  const uniqueSeasons = new Set<string>();
  const uniqueTags = new Set<string>();
  const uniqueMaterials = new Set<string>();
  const uniqueEcoClaims = new Set<string>();
  const uniqueFacilities = new Set<string>();
  const uniqueAttributes = new Set<string>();
  const uniqueAttributeValues = new Map<string, Set<string>>(); // attrName -> values

  for (const product of parsedProducts) {
    if (product.manufacturerName) {
      uniqueManufacturers.add(product.manufacturerName.trim());
    }
    if (product.seasonName) {
      uniqueSeasons.add(product.seasonName.trim());
    }
    for (const tag of product.tags) {
      uniqueTags.add(tag.trim());
    }
    for (const material of product.materials) {
      uniqueMaterials.add(material.name.trim());
    }
    for (const claim of product.ecoClaims) {
      uniqueEcoClaims.add(claim.trim());
    }
    for (const facilityName of Object.values(product.journeySteps)) {
      uniqueFacilities.add(facilityName.trim());
    }
    for (const variant of product.variants) {
      for (const attr of variant.attributes) {
        uniqueAttributes.add(attr.name.trim());
        if (!uniqueAttributeValues.has(attr.name.trim())) {
          uniqueAttributeValues.set(attr.name.trim(), new Set());
        }
        uniqueAttributeValues.get(attr.name.trim())?.add(attr.value.trim());
      }
    }
  }

  // Auto-create missing manufacturers
  const missingManufacturers = [...uniqueManufacturers].filter(
    (name) => !catalog.manufacturers.has(normalizeKey(name)),
  );
  if (missingManufacturers.length > 0) {
    const inserted = await database
      .insert(schema.brandManufacturers)
      .values(missingManufacturers.map((name) => ({ brandId, name })))
      .returning({
        id: schema.brandManufacturers.id,
        name: schema.brandManufacturers.name,
      });

    for (const m of inserted) {
      catalog.manufacturers.set(normalizeKey(m.name), m.id);
    }
  }

  // Auto-create missing seasons
  const missingSeasons = [...uniqueSeasons].filter(
    (name) => !catalog.seasons.has(normalizeKey(name)),
  );
  if (missingSeasons.length > 0) {
    const inserted = await database
      .insert(schema.brandSeasons)
      .values(missingSeasons.map((name) => ({ brandId, name })))
      .returning({
        id: schema.brandSeasons.id,
        name: schema.brandSeasons.name,
      });

    for (const s of inserted) {
      catalog.seasons.set(normalizeKey(s.name), s.id);
    }
  }

  // Auto-create missing tags
  const missingTags = [...uniqueTags].filter(
    (name) => !catalog.tags.has(normalizeKey(name)),
  );
  if (missingTags.length > 0) {
    const inserted = await database
      .insert(schema.brandTags)
      .values(missingTags.map((name) => ({ brandId, name })))
      .returning({ id: schema.brandTags.id, name: schema.brandTags.name });

    for (const t of inserted) {
      catalog.tags.set(normalizeKey(t.name), t.id);
    }
  }

  // Auto-create missing materials
  const missingMaterials = [...uniqueMaterials].filter(
    (name) => !catalog.materials.has(normalizeKey(name)),
  );
  if (missingMaterials.length > 0) {
    const inserted = await database
      .insert(schema.brandMaterials)
      .values(missingMaterials.map((name) => ({ brandId, name })))
      .returning({
        id: schema.brandMaterials.id,
        name: schema.brandMaterials.name,
      });

    for (const m of inserted) {
      catalog.materials.set(normalizeKey(m.name), m.id);
    }
  }

  // Auto-create missing eco claims
  const missingEcoClaims = [...uniqueEcoClaims].filter(
    (name) => !catalog.ecoClaims.has(normalizeKey(name)),
  );
  if (missingEcoClaims.length > 0) {
    const inserted = await database
      .insert(schema.brandEcoClaims)
      .values(missingEcoClaims.map((claim) => ({ brandId, claim })))
      .returning({
        id: schema.brandEcoClaims.id,
        claim: schema.brandEcoClaims.claim,
      });

    for (const e of inserted) {
      catalog.ecoClaims.set(normalizeKey(e.claim), e.id);
    }
  }

  // Auto-create missing facilities
  const missingFacilities = [...uniqueFacilities].filter(
    (name) => !catalog.operators.has(normalizeKey(name)),
  );
  if (missingFacilities.length > 0) {
    const inserted = await database
      .insert(schema.brandFacilities)
      .values(
        missingFacilities.map((name) => ({
          brandId,
          displayName: name,
          type: "MANUFACTURER" as const,
        })),
      )
      .returning({
        id: schema.brandFacilities.id,
        displayName: schema.brandFacilities.displayName,
      });

    for (const f of inserted) {
      if (f.displayName) {
        catalog.operators.set(normalizeKey(f.displayName), f.id);
      }
    }
  }

  // Auto-create missing attributes
  const missingAttributes = [...uniqueAttributes].filter(
    (name) => !catalog.attributes.has(normalizeKey(name)),
  );
  if (missingAttributes.length > 0) {
    const attributeInsertValues = missingAttributes.map((name) => {
      const normalizedName = normalizeKey(name);
      // Check for taxonomy attribute match
      const taxonomyAttr = catalog.taxonomyAttributes.get(normalizedName);
      return {
        brandId,
        name,
        taxonomyAttributeId: taxonomyAttr?.id ?? null,
      };
    });

    const inserted = await database
      .insert(schema.brandAttributes)
      .values(attributeInsertValues)
      .returning({
        id: schema.brandAttributes.id,
        name: schema.brandAttributes.name,
        taxonomyAttributeId: schema.brandAttributes.taxonomyAttributeId,
      });

    for (const a of inserted) {
      catalog.attributes.set(normalizeKey(a.name), a.id);
      if (a.taxonomyAttributeId) {
        catalog.attributeTaxonomyLinks.set(
          normalizeKey(a.name),
          a.taxonomyAttributeId,
        );
      }
    }
  }

  // Auto-create missing attribute values
  const attributeValueInserts: Array<{
    brandId: string;
    attributeId: string;
    name: string;
    taxonomyValueId: string | null;
  }> = [];

  for (const [attrName, values] of uniqueAttributeValues) {
    const attributeId = catalog.attributes.get(normalizeKey(attrName));
    if (!attributeId) continue;

    const taxonomyAttributeId = catalog.attributeTaxonomyLinks.get(
      normalizeKey(attrName),
    );

    for (const valueName of values) {
      const key = `${attributeId}:${normalizeKey(valueName)}`;
      if (!catalog.attributeValues.has(key)) {
        let taxonomyValueId: string | null = null;
        if (taxonomyAttributeId) {
          const taxonomyValueKey = `${taxonomyAttributeId}:${normalizeKey(valueName)}`;
          const taxonomyValue = catalog.taxonomyValues.get(taxonomyValueKey);
          if (taxonomyValue) {
            taxonomyValueId = taxonomyValue.id;
          }
        }

        attributeValueInserts.push({
          brandId,
          attributeId,
          name: valueName,
          taxonomyValueId,
        });
      }
    }
  }

  if (attributeValueInserts.length > 0) {
    const inserted = await database
      .insert(schema.brandAttributeValues)
      .values(attributeValueInserts)
      .returning({
        id: schema.brandAttributeValues.id,
        name: schema.brandAttributeValues.name,
        attributeId: schema.brandAttributeValues.attributeId,
      });

    for (const av of inserted) {
      const key = `${av.attributeId}:${normalizeKey(av.name)}`;
      const attrName =
        [...catalog.attributes.entries()].find(
          ([, id]) => id === av.attributeId,
        )?.[0] || "";
      catalog.attributeValues.set(key, {
        id: av.id,
        name: av.name,
        attributeId: av.attributeId,
        attributeName: attrName,
      });
    }
  }

  return catalog;
}

describe("CREATE_AND_ENRICH Mode - Entity Auto-Creation", () => {
  let brandId: string;
  let emptyCatalog: InsertedCatalog;

  beforeEach(async () => {
    await cleanupTables();
    brandId = await createTestBrand("Test Brand");
    // Setup an empty catalog to test auto-creation
    emptyCatalog = await TestCatalog.setupEmpty(testDb, brandId);
  });

  describe("Manufacturer Auto-Creation", () => {
    it("auto-creates manufacturer when not found in catalog", async () => {
      const productWithNewManufacturer = {
        ...basicProduct,
        manufacturer: "New Textile Company",
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithNewManufacturer],
      });

      const parseResult = await parseExcelFile(excelBuffer);
      expect(parseResult.products[0]?.manufacturerName).toBe(
        "New Textile Company",
      );

      // Load empty catalog and run auto-creation
      const catalog = await loadBrandCatalog(testDb, brandId);
      expect(catalog.manufacturers.has("new textile company")).toBe(false);

      // Simulate auto-creation
      const updatedCatalog = await autoCreateMissingEntities(
        testDb,
        brandId,
        parseResult.products,
        catalog,
      );

      // Verify manufacturer was created
      expect(updatedCatalog.manufacturers.has("new textile company")).toBe(
        true,
      );

      // Verify it exists in database
      const dbManufacturer = await testDb.query.brandManufacturers.findFirst({
        where: sql`${schema.brandManufacturers.brandId} = ${brandId} AND LOWER(${schema.brandManufacturers.name}) = 'new textile company'`,
      });
      expect(dbManufacturer).toBeDefined();
      expect(dbManufacturer?.name).toBe("New Textile Company");
    });
  });

  describe("Season Auto-Creation", () => {
    it("auto-creates season when not found in catalog", async () => {
      const productWithNewSeason = {
        ...basicProduct,
        season: "AW27",
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithNewSeason],
      });

      const parseResult = await parseExcelFile(excelBuffer);
      const catalog = await loadBrandCatalog(testDb, brandId);

      expect(catalog.seasons.has("aw27")).toBe(false);

      const updatedCatalog = await autoCreateMissingEntities(
        testDb,
        brandId,
        parseResult.products,
        catalog,
      );

      expect(updatedCatalog.seasons.has("aw27")).toBe(true);

      // Verify in database
      const dbSeason = await testDb.query.brandSeasons.findFirst({
        where: sql`${schema.brandSeasons.brandId} = ${brandId} AND LOWER(${schema.brandSeasons.name}) = 'aw27'`,
      });
      expect(dbSeason).toBeDefined();
      expect(dbSeason?.name).toBe("AW27");
    });
  });

  describe("Tag Auto-Creation", () => {
    it("auto-creates tag when not found in catalog", async () => {
      const productWithNewTag = {
        ...basicProduct,
        tags: ["Exclusive Collection", "Premium Quality"],
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithNewTag],
      });

      const parseResult = await parseExcelFile(excelBuffer);
      const catalog = await loadBrandCatalog(testDb, brandId);

      expect(catalog.tags.has("exclusive collection")).toBe(false);
      expect(catalog.tags.has("premium quality")).toBe(false);

      const updatedCatalog = await autoCreateMissingEntities(
        testDb,
        brandId,
        parseResult.products,
        catalog,
      );

      expect(updatedCatalog.tags.has("exclusive collection")).toBe(true);
      expect(updatedCatalog.tags.has("premium quality")).toBe(true);

      // Verify both tags created in database
      const dbTags = await testDb.query.brandTags.findMany({
        where: eq(schema.brandTags.brandId, brandId),
      });
      expect(dbTags.length).toBe(2);
      expect(dbTags.map((t) => t.name)).toContain("Exclusive Collection");
      expect(dbTags.map((t) => t.name)).toContain("Premium Quality");
    });
  });

  describe("Material Auto-Creation", () => {
    it("auto-creates material when not found in catalog", async () => {
      const productWithNewMaterial = {
        ...basicProduct,
        materials: [
          { name: "Tencel", percentage: 60 },
          { name: "Modal", percentage: 40 },
        ],
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithNewMaterial],
      });

      const parseResult = await parseExcelFile(excelBuffer);
      const catalog = await loadBrandCatalog(testDb, brandId);

      expect(catalog.materials.has("tencel")).toBe(false);
      expect(catalog.materials.has("modal")).toBe(false);

      const updatedCatalog = await autoCreateMissingEntities(
        testDb,
        brandId,
        parseResult.products,
        catalog,
      );

      expect(updatedCatalog.materials.has("tencel")).toBe(true);
      expect(updatedCatalog.materials.has("modal")).toBe(true);

      // Verify in database
      const dbMaterials = await testDb.query.brandMaterials.findMany({
        where: eq(schema.brandMaterials.brandId, brandId),
      });
      expect(dbMaterials.length).toBe(2);
    });
  });

  describe("Facility Auto-Creation", () => {
    it("auto-creates facility when not found in catalog", async () => {
      const productWithNewFacility = {
        ...basicProduct,
        journey: {
          rawMaterial: "New Cotton Farm Brazil",
          weaving: "Modern Textile Factory India",
        },
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithNewFacility],
      });

      const parseResult = await parseExcelFile(excelBuffer);
      const catalog = await loadBrandCatalog(testDb, brandId);

      expect(catalog.operators.has("new cotton farm brazil")).toBe(false);
      expect(catalog.operators.has("modern textile factory india")).toBe(false);

      const updatedCatalog = await autoCreateMissingEntities(
        testDb,
        brandId,
        parseResult.products,
        catalog,
      );

      expect(updatedCatalog.operators.has("new cotton farm brazil")).toBe(true);
      expect(updatedCatalog.operators.has("modern textile factory india")).toBe(
        true,
      );

      // Verify in database
      const dbFacilities = await testDb.query.brandFacilities.findMany({
        where: eq(schema.brandFacilities.brandId, brandId),
      });
      expect(dbFacilities.length).toBe(2);
      expect(dbFacilities.map((f) => f.displayName)).toContain(
        "New Cotton Farm Brazil",
      );
    });
  });

  describe("Attribute Auto-Creation", () => {
    it("auto-creates attribute when not found in catalog", async () => {
      const productWithNewAttribute = {
        ...basicProduct,
        variants: [
          {
            sku: "TEST-001",
            barcode: "1234567890123",
            attributes: [
              { name: "Fit", value: "Slim" },
              { name: "Neckline", value: "V-Neck" },
            ],
          },
        ],
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithNewAttribute],
      });

      const parseResult = await parseExcelFile(excelBuffer);
      const catalog = await loadBrandCatalog(testDb, brandId);

      expect(catalog.attributes.has("fit")).toBe(false);
      expect(catalog.attributes.has("neckline")).toBe(false);

      const updatedCatalog = await autoCreateMissingEntities(
        testDb,
        brandId,
        parseResult.products,
        catalog,
      );

      expect(updatedCatalog.attributes.has("fit")).toBe(true);
      expect(updatedCatalog.attributes.has("neckline")).toBe(true);

      // Verify in database
      const dbAttributes = await testDb.query.brandAttributes.findMany({
        where: eq(schema.brandAttributes.brandId, brandId),
      });
      expect(dbAttributes.length).toBe(2);
    });
  });

  describe("Attribute Value Auto-Creation", () => {
    it("auto-creates attribute value when not found in catalog", async () => {
      const productWithNewAttributeValue = {
        ...basicProduct,
        variants: [
          {
            sku: "TEST-001",
            barcode: "1234567890123",
            attributes: [{ name: "Style", value: "Casual" }],
          },
          {
            sku: "TEST-002",
            barcode: "1234567890124",
            attributes: [{ name: "Style", value: "Formal" }],
          },
        ],
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithNewAttributeValue],
      });

      const parseResult = await parseExcelFile(excelBuffer);
      const catalog = await loadBrandCatalog(testDb, brandId);

      const updatedCatalog = await autoCreateMissingEntities(
        testDb,
        brandId,
        parseResult.products,
        catalog,
      );

      // Attribute should be created
      expect(updatedCatalog.attributes.has("style")).toBe(true);

      // Get the attribute ID
      const styleAttrId = updatedCatalog.attributes.get("style")!;

      // Both values should be created
      expect(updatedCatalog.attributeValues.has(`${styleAttrId}:casual`)).toBe(
        true,
      );
      expect(updatedCatalog.attributeValues.has(`${styleAttrId}:formal`)).toBe(
        true,
      );

      // Verify in database
      const dbAttributeValues =
        await testDb.query.brandAttributeValues.findMany({
          where: eq(schema.brandAttributeValues.attributeId, styleAttrId),
        });
      expect(dbAttributeValues.length).toBe(2);
      expect(dbAttributeValues.map((v) => v.name)).toContain("Casual");
      expect(dbAttributeValues.map((v) => v.name)).toContain("Formal");
    });
  });

  describe("Reuse Existing Entities", () => {
    it("reuses existing entity if found instead of creating duplicate", async () => {
      // First, setup a catalog with an existing manufacturer
      const existingCatalog = await TestCatalog.setup(testDb, {
        brandId,
        manufacturers: ["Existing Manufacturer"],
      });

      const productWithExistingManufacturer = {
        ...basicProduct,
        manufacturer: "Existing Manufacturer",
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithExistingManufacturer],
      });

      const parseResult = await parseExcelFile(excelBuffer);
      const catalog = await loadBrandCatalog(testDb, brandId);

      // Should already exist
      expect(catalog.manufacturers.has("existing manufacturer")).toBe(true);
      const existingId = catalog.manufacturers.get("existing manufacturer");

      const updatedCatalog = await autoCreateMissingEntities(
        testDb,
        brandId,
        parseResult.products,
        catalog,
      );

      // Should still use the same ID (no duplicate created)
      expect(updatedCatalog.manufacturers.get("existing manufacturer")).toBe(
        existingId,
      );

      // Verify only one manufacturer in database
      const dbManufacturers = await testDb.query.brandManufacturers.findMany({
        where: eq(schema.brandManufacturers.brandId, brandId),
      });
      expect(dbManufacturers.length).toBe(1);
    });
  });

  describe("Eco Claims Auto-Creation", () => {
    it("auto-creates eco claim when not found in catalog", async () => {
      const productWithNewEcoClaim = {
        ...basicProduct,
        ecoClaims: ["Carbon Neutral", "Vegan Friendly"],
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithNewEcoClaim],
      });

      const parseResult = await parseExcelFile(excelBuffer);
      const catalog = await loadBrandCatalog(testDb, brandId);

      expect(catalog.ecoClaims.has("carbon neutral")).toBe(false);
      expect(catalog.ecoClaims.has("vegan friendly")).toBe(false);

      const updatedCatalog = await autoCreateMissingEntities(
        testDb,
        brandId,
        parseResult.products,
        catalog,
      );

      expect(updatedCatalog.ecoClaims.has("carbon neutral")).toBe(true);
      expect(updatedCatalog.ecoClaims.has("vegan friendly")).toBe(true);

      // Verify in database
      const dbEcoClaims = await testDb.query.brandEcoClaims.findMany({
        where: eq(schema.brandEcoClaims.brandId, brandId),
      });
      expect(dbEcoClaims.length).toBe(2);
    });
  });

  describe("Category Exception", () => {
    it("does NOT auto-create category - categories must exist", async () => {
      // Categories come from taxonomy, not brand-level entities
      // They are never auto-created

      const productWithUnknownCategory = {
        ...basicProduct,
        category: "Unknown Category Path",
      };

      const excelBuffer = await ExcelBuilder.create({
        products: [productWithUnknownCategory],
      });

      const parseResult = await parseExcelFile(excelBuffer);
      const catalog = await loadBrandCatalog(testDb, brandId);

      // Category should not be in catalog
      expect(catalog.categories.has("unknown category path")).toBe(false);

      // After auto-creation, category should STILL not exist
      const updatedCatalog = await autoCreateMissingEntities(
        testDb,
        brandId,
        parseResult.products,
        catalog,
      );

      // Category was NOT auto-created
      expect(updatedCatalog.categories.has("unknown category path")).toBe(
        false,
      );

      // In the actual validate-and-stage, this would result in a validation error
    });
  });
});
