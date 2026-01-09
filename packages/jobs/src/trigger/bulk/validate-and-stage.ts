/**
 * Validate and Stage Job (Refactored)
 *
 * Phase 1 of the bulk import process:
 * 1. Downloads and parses the uploaded Excel file
 * 2. Auto-creates missing entities (manufacturers, tags, seasons, etc.)
 * 3. Validates each product row (only category must exist)
 * 4. Populates staging tables with validated data
 * 5. Auto-triggers the commit-to-production job
 *
 * Key changes from previous version:
 * - Uses Excel parser with Shopify-style row grouping
 * - Auto-creates entities instead of flagging for user mapping
 * - Fire-and-forget flow (no user approval step)
 * - Explicit CREATE vs ENRICH mode
 *
 * @module validate-and-stage
 */

import "../configure-trigger";
import { randomUUID } from "node:crypto";
import { logger, task, tasks } from "@trigger.dev/sdk/v3";
import { type Database, serviceDb as db } from "@v1/db/client";
import { eq, inArray, sql } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { type BrandCatalog, loadBrandCatalog } from "../../lib/catalog-loader";
import {
  type ExcelParseResult,
  type ParsedProduct,
  type ParsedVariant,
  findDuplicateIdentifiers,
  parseExcelFile,
  validateRequiredColumns,
} from "../../lib/excel-parser";

// ============================================================================
// Types
// ============================================================================

/**
 * Task payload for validate-and-stage job
 */
interface ValidateAndStagePayload {
  jobId: string;
  brandId: string;
  filePath: string;
  mode: "CREATE" | "ENRICH";
}

/**
 * Error for a specific row/field
 */
interface RowError {
  field: string;
  message: string;
}

/**
 * Result of validating and staging a product
 */
interface ProductResult {
  productHandle: string;
  rowNumber: number;
  success: boolean;
  errors: RowError[];
  stagingProductId?: string;
}

// ============================================================================
// Schema References
// ============================================================================

const {
  importJobs,
  stagingProducts,
  stagingProductVariants,
  stagingVariantAttributes,
  stagingProductTags,
  stagingProductWeight,
  stagingVariantMaterials,
  stagingVariantEcoClaims,
  stagingVariantEnvironment,
  stagingVariantJourneySteps,
  stagingVariantWeight,
  brandAttributes,
  brandAttributeValues,
  brandMaterials,
  brandSeasons,
  brandTags,
  brandEcoClaims,
  brandFacilities,
  brandManufacturers,
  products,
  productVariants,
  taxonomyCategories,
} = schema;

// ============================================================================
// Constants
// ============================================================================

const BATCH_SIZE = 100;

// ============================================================================
// Main Task
// ============================================================================

export const validateAndStage = task({
  id: "validate-and-stage",
  maxDuration: 1800, // 30 minutes
  queue: { concurrencyLimit: 5 },
  retry: { maxAttempts: 2 },
  run: async (payload: ValidateAndStagePayload): Promise<void> => {
    const { jobId, brandId, filePath, mode } = payload;
    const startTime = Date.now();

    logger.info("Starting validate-and-stage job", { jobId, brandId, mode });

    try {
      // 1. Update job status to PROCESSING
      await db
        .update(importJobs)
        .set({ status: "PROCESSING", startedAt: new Date().toISOString() })
        .where(eq(importJobs.id, jobId));

      // 2. Download file from Supabase Storage
      const fileBuffer = await downloadFileFromSupabase(filePath);
      logger.info("File downloaded", { size: fileBuffer.byteLength });

      // 3. Parse Excel file
      const parseResult = await parseExcelFile(fileBuffer);

      if (parseResult.errors.length > 0) {
        throw new Error(
          `Excel parsing failed: ${parseResult.errors[0]?.message}`,
        );
      }

      logger.info("Excel parsed", {
        products: parseResult.products.length,
        totalRows: parseResult.totalRows,
      });

      // 4. Validate required columns
      const columnValidation = validateRequiredColumns(parseResult.headers);
      if (!columnValidation.valid) {
        throw new Error(
          `Missing required columns: ${columnValidation.missingColumns.join(", ")}`,
        );
      }

      // 5. Check for duplicate identifiers
      const duplicates = findDuplicateIdentifiers(parseResult.products);
      if (duplicates.length > 0) {
        logger.warn("Duplicate identifiers found", {
          count: duplicates.length,
        });
        // Mark duplicate rows with errors (handled in validation)
      }

      // 6. Load catalog and auto-create missing entities
      let catalog = await loadBrandCatalog(db, brandId);
      catalog = await autoCreateEntities(
        db,
        brandId,
        parseResult.products,
        catalog,
      );

      logger.info("Catalog loaded and entities auto-created", {
        attributes: catalog.attributes.size,
        attributeValues: catalog.attributeValues.size,
        materials: catalog.materials.size,
        tags: catalog.tags.size,
      });

      // 7. Process products in batches
      const results: ProductResult[] = [];
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < parseResult.products.length; i += BATCH_SIZE) {
        const batch = parseResult.products.slice(i, i + BATCH_SIZE);

        for (const product of batch) {
          const result = await validateAndStageProduct(
            db,
            product,
            catalog,
            brandId,
            jobId,
            mode,
            duplicates,
          );

          results.push(result);

          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
        }

        logger.info("Batch processed", {
          processed: Math.min(i + BATCH_SIZE, parseResult.products.length),
          total: parseResult.products.length,
        });
      }

      // 8. Determine final status
      const hasFailures = failureCount > 0;
      const finalStatus = hasFailures ? "COMPLETED_WITH_FAILURES" : "COMPLETED";

      await db
        .update(importJobs)
        .set({
          status: finalStatus,
          finishedAt: new Date().toISOString(),
          hasExportableFailures: hasFailures,
          summary: {
            totalProducts: successCount,
            failedProducts: failureCount,
          },
        })
        .where(eq(importJobs.id, jobId));

      // 9. Auto-trigger commit-to-production job (only if we have successes)
      if (successCount > 0) {
        await tasks.trigger("commit-to-production", {
          jobId,
          brandId,
        });

        logger.info("Triggered commit-to-production job", { jobId });
      }

      const duration = Date.now() - startTime;
      logger.info("Validate-and-stage completed", {
        jobId,
        successCount,
        failureCount,
        duration: `${duration}ms`,
        status: finalStatus,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      logger.error("Validate-and-stage failed", { jobId, error: errorMessage });

      await db
        .update(importJobs)
        .set({
          status: "FAILED",
          finishedAt: new Date().toISOString(),
          summary: { error: errorMessage },
        })
        .where(eq(importJobs.id, jobId));

      throw error;
    }
  },
});

// ============================================================================
// Auto-Create Entities
// ============================================================================

/**
 * Auto-create missing entities in the database.
 * Categories are the ONLY exception - they must exist.
 */
async function autoCreateEntities(
  database: Database,
  brandId: string,
  products: ParsedProduct[],
  catalog: BrandCatalog,
): Promise<BrandCatalog> {
  // Collect all unique entity names from parsed products
  const uniqueManufacturers = new Set<string>();
  const uniqueSeasons = new Set<string>();
  const uniqueTags = new Set<string>();
  const uniqueMaterials = new Set<string>();
  const uniqueEcoClaims = new Set<string>();
  const uniqueFacilities = new Set<string>();
  const uniqueAttributes = new Set<string>();
  const uniqueAttributeValues = new Map<string, Set<string>>(); // attrName -> values

  for (const product of products) {
    if (product.manufacturerName) {
      uniqueManufacturers.add(product.manufacturerName.trim());
    }
    if (product.seasonName) {
      uniqueSeasons.add(product.seasonName.trim());
    }
    for (const tag of product.tags) {
      uniqueTags.add(tag.trim());
    }

    for (const variant of product.variants) {
      // Materials
      for (const material of variant.materials) {
        uniqueMaterials.add(material.name.trim());
      }
      // Eco claims
      for (const claim of variant.ecoClaims) {
        uniqueEcoClaims.add(claim.trim());
      }
      // Journey step facilities
      for (const facilityName of Object.values(variant.journeySteps)) {
        uniqueFacilities.add(facilityName.trim());
      }
      // Attributes
      for (const attr of variant.attributes) {
        uniqueAttributes.add(attr.name.trim());
        if (!uniqueAttributeValues.has(attr.name.trim())) {
          uniqueAttributeValues.set(attr.name.trim(), new Set());
        }
        uniqueAttributeValues.get(attr.name.trim())?.add(attr.value.trim());
      }
    }
  }

  // Auto-create missing entities (batch inserts)
  const normalizeKey = (s: string) => s.toLowerCase().trim();

  // Manufacturers
  const missingManufacturers = [...uniqueManufacturers].filter(
    (name) => !catalog.manufacturers.has(normalizeKey(name)),
  );
  if (missingManufacturers.length > 0) {
    const inserted = await database
      .insert(brandManufacturers)
      .values(
        missingManufacturers.map((name) => ({
          brandId,
          name,
        })),
      )
      .returning({ id: brandManufacturers.id, name: brandManufacturers.name });

    for (const m of inserted) {
      catalog.manufacturers.set(normalizeKey(m.name), m.id);
    }
    logger.info("Auto-created manufacturers", { count: inserted.length });
  }

  // Seasons
  const missingSeasons = [...uniqueSeasons].filter(
    (name) => !catalog.seasons.has(normalizeKey(name)),
  );
  if (missingSeasons.length > 0) {
    const inserted = await database
      .insert(brandSeasons)
      .values(missingSeasons.map((name) => ({ brandId, name })))
      .returning({ id: brandSeasons.id, name: brandSeasons.name });

    for (const s of inserted) {
      catalog.seasons.set(normalizeKey(s.name), s.id);
    }
    logger.info("Auto-created seasons", { count: inserted.length });
  }

  // Tags
  const missingTags = [...uniqueTags].filter(
    (name) => !catalog.tags.has(normalizeKey(name)),
  );
  if (missingTags.length > 0) {
    const inserted = await database
      .insert(brandTags)
      .values(missingTags.map((name) => ({ brandId, name })))
      .returning({ id: brandTags.id, name: brandTags.name });

    for (const t of inserted) {
      catalog.tags.set(normalizeKey(t.name), t.id);
    }
    logger.info("Auto-created tags", { count: inserted.length });
  }

  // Materials
  const missingMaterials = [...uniqueMaterials].filter(
    (name) => !catalog.materials.has(normalizeKey(name)),
  );
  if (missingMaterials.length > 0) {
    const inserted = await database
      .insert(brandMaterials)
      .values(missingMaterials.map((name) => ({ brandId, name })))
      .returning({ id: brandMaterials.id, name: brandMaterials.name });

    for (const m of inserted) {
      catalog.materials.set(normalizeKey(m.name), m.id);
    }
    logger.info("Auto-created materials", { count: inserted.length });
  }

  // Eco Claims
  const missingEcoClaims = [...uniqueEcoClaims].filter(
    (name) => !catalog.ecoClaims.has(normalizeKey(name)),
  );
  if (missingEcoClaims.length > 0) {
    const inserted = await database
      .insert(brandEcoClaims)
      .values(missingEcoClaims.map((claim) => ({ brandId, claim })))
      .returning({ id: brandEcoClaims.id, claim: brandEcoClaims.claim });

    for (const e of inserted) {
      catalog.ecoClaims.set(normalizeKey(e.claim), e.id);
    }
    logger.info("Auto-created eco claims", { count: inserted.length });
  }

  // Facilities
  const missingFacilities = [...uniqueFacilities].filter(
    (name) => !catalog.operators.has(normalizeKey(name)),
  );
  if (missingFacilities.length > 0) {
    const inserted = await database
      .insert(brandFacilities)
      .values(
        missingFacilities.map((name) => ({
          brandId,
          displayName: name,
          type: "MANUFACTURER" as const,
        })),
      )
      .returning({
        id: brandFacilities.id,
        displayName: brandFacilities.displayName,
      });

    for (const f of inserted) {
      if (f.displayName) {
        catalog.operators.set(normalizeKey(f.displayName), f.id);
      }
    }
    logger.info("Auto-created facilities", { count: inserted.length });
  }

  // Attributes
  const missingAttributes = [...uniqueAttributes].filter(
    (name) => !catalog.attributes.has(normalizeKey(name)),
  );
  if (missingAttributes.length > 0) {
    const inserted = await database
      .insert(brandAttributes)
      .values(missingAttributes.map((name) => ({ brandId, name })))
      .returning({ id: brandAttributes.id, name: brandAttributes.name });

    for (const a of inserted) {
      catalog.attributes.set(normalizeKey(a.name), a.id);
    }
    logger.info("Auto-created attributes", { count: inserted.length });
  }

  // Attribute Values
  const attributeValueInserts: Array<{
    brandId: string;
    attributeId: string;
    name: string;
  }> = [];

  for (const [attrName, values] of uniqueAttributeValues) {
    const attributeId = catalog.attributes.get(normalizeKey(attrName));
    if (!attributeId) continue;

    for (const valueName of values) {
      const key = `${attributeId}:${normalizeKey(valueName)}`;
      if (!catalog.attributeValues.has(key)) {
        attributeValueInserts.push({
          brandId,
          attributeId,
          name: valueName,
        });
      }
    }
  }

  if (attributeValueInserts.length > 0) {
    const inserted = await database
      .insert(brandAttributeValues)
      .values(attributeValueInserts)
      .returning({
        id: brandAttributeValues.id,
        name: brandAttributeValues.name,
        attributeId: brandAttributeValues.attributeId,
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
    logger.info("Auto-created attribute values", { count: inserted.length });
  }

  return catalog;
}

// ============================================================================
// Validate and Stage Product
// ============================================================================

async function validateAndStageProduct(
  database: Database,
  product: ParsedProduct,
  catalog: BrandCatalog,
  brandId: string,
  jobId: string,
  mode: "CREATE" | "ENRICH",
  duplicates: ReturnType<typeof findDuplicateIdentifiers>,
): Promise<ProductResult> {
  const errors: RowError[] = [];
  const normalizeKey = (s: string) => s.toLowerCase().trim();

  // Validate required fields
  if (!product.name || product.name.trim() === "") {
    errors.push({ field: "Product Title", message: "Required" });
  }

  // Validate category (MUST exist - no auto-create)
  let categoryId: string | null = null;
  if (product.categoryPath) {
    // Try to match category by name (using the last segment of the path)
    const categoryName = product.categoryPath.split(">").pop()?.trim() || "";
    categoryId = catalog.categories.get(normalizeKey(categoryName)) || null;

    if (!categoryId) {
      errors.push({
        field: "Category",
        message: `Category not found: "${product.categoryPath}"`,
      });
    }
  }

  // Check for duplicate identifiers
  for (const variant of product.variants) {
    const barcodeDup = duplicates.find(
      (d) =>
        d.field === "Barcode" &&
        d.value === variant.barcode &&
        d.rows.length > 1,
    );
    if (barcodeDup) {
      errors.push({
        field: "Barcode",
        message: `Duplicate barcode: ${variant.barcode}`,
      });
    }

    const skuDup = duplicates.find(
      (d) => d.field === "SKU" && d.value === variant.sku && d.rows.length > 1,
    );
    if (skuDup) {
      errors.push({
        field: "SKU",
        message: `Duplicate SKU: ${variant.sku}`,
      });
    }

    // Require at least barcode or SKU
    if (!variant.barcode && !variant.sku) {
      errors.push({
        field: "Barcode/SKU",
        message: "At least one of Barcode or SKU is required",
      });
    }
  }

  // If validation failed, don't stage
  if (errors.length > 0) {
    return {
      productHandle: product.productHandle,
      rowNumber: product.rowNumber,
      success: false,
      errors,
    };
  }

  // Resolve entities
  const manufacturerId = product.manufacturerName
    ? catalog.manufacturers.get(normalizeKey(product.manufacturerName))
    : null;
  const seasonId = product.seasonName
    ? catalog.seasons.get(normalizeKey(product.seasonName))
    : null;

  // Check for existing product/variants in ENRICH mode
  let existingProductId: string | null = null;
  const existingVariantIds = new Map<string, string>(); // barcode/sku -> variantId

  if (mode === "ENRICH") {
    // Look up existing product by handle
    const existingProduct = await database.query.products.findFirst({
      where: sql`${products.brandId} = ${brandId} AND ${products.productHandle} = ${product.productHandle}`,
      columns: { id: true },
    });
    existingProductId = existingProduct?.id || null;

    // Look up existing variants by barcode/sku
    const identifiers: string[] = [];
    for (const v of product.variants) {
      if (v.barcode) identifiers.push(v.barcode);
      if (v.sku) identifiers.push(v.sku);
    }

    if (identifiers.length > 0 && existingProductId) {
      const existingVariants = await database.query.productVariants.findMany({
        where: sql`${productVariants.productId} = ${existingProductId} AND (
          ${productVariants.barcode} = ANY(ARRAY[${sql.join(
            identifiers.map((i) => sql`${i}`),
            sql`, `,
          )}]::text[])
          OR ${productVariants.sku} = ANY(ARRAY[${sql.join(
            identifiers.map((i) => sql`${i}`),
            sql`, `,
          )}]::text[])
        )`,
        columns: { id: true, barcode: true, sku: true },
      });

      for (const ev of existingVariants) {
        if (ev.barcode) existingVariantIds.set(ev.barcode, ev.id);
        if (ev.sku) existingVariantIds.set(ev.sku, ev.id);
      }
    }
  }

  // Generate IDs for staging
  const stagingProductId = randomUUID();
  const productId = existingProductId || randomUUID();
  const action = existingProductId ? "UPDATE" : "CREATE";

  // Insert into staging_products
  await database.insert(stagingProducts).values({
    stagingId: stagingProductId,
    jobId,
    rowNumber: product.rowNumber,
    action,
    existingProductId,
    id: productId,
    brandId,
    productHandle: product.productHandle,
    name: product.name,
    description: product.description,
    imagePath: product.imagePath,
    categoryId,
    seasonId,
    manufacturerId,
    status: "draft",
    rowStatus: "PENDING",
  });

  // Resolve and insert tags
  const tagIds = product.tags
    .map((t) => catalog.tags.get(normalizeKey(t)))
    .filter((id): id is string => !!id);

  if (tagIds.length > 0) {
    await database.insert(stagingProductTags).values(
      tagIds.map((tagId) => ({
        stagingProductId,
        jobId,
        tagId,
      })),
    );
  }

  // Process each variant
  for (const variant of product.variants) {
    const stagingVariantId = randomUUID();
    const existingVariantId =
      existingVariantIds.get(variant.barcode || "") ||
      existingVariantIds.get(variant.sku || "") ||
      null;
    const variantId = existingVariantId || randomUUID();
    const variantAction = existingVariantId ? "UPDATE" : "CREATE";

    // Insert staging variant
    await database.insert(stagingProductVariants).values({
      stagingId: stagingVariantId,
      stagingProductId,
      jobId,
      rowNumber: variant.rowNumber,
      action: variantAction,
      existingVariantId,
      id: variantId,
      productId,
      barcode: variant.barcode,
      sku: variant.sku,
      nameOverride: variant.nameOverride,
      descriptionOverride: variant.descriptionOverride,
      imagePathOverride: variant.imagePathOverride,
      rowStatus: "PENDING",
    });

    // Staging variant attributes
    for (const attr of variant.attributes) {
      const attributeId = catalog.attributes.get(normalizeKey(attr.name));
      if (!attributeId) continue;

      const key = `${attributeId}:${normalizeKey(attr.value)}`;
      const attrValue = catalog.attributeValues.get(key);
      if (!attrValue) continue;

      await database.insert(stagingVariantAttributes).values({
        stagingVariantId,
        jobId,
        attributeId,
        attributeValueId: attrValue.id,
        sortOrder: attr.sortOrder,
      });
    }

    // Staging variant materials
    for (const material of variant.materials) {
      const materialId = catalog.materials.get(normalizeKey(material.name));
      if (!materialId) continue;

      await database.insert(stagingVariantMaterials).values({
        stagingVariantId,
        jobId,
        brandMaterialId: materialId,
        percentage: material.percentage?.toString(),
      });
    }

    // Staging variant eco claims
    for (const claimName of variant.ecoClaims) {
      const ecoClaimId = catalog.ecoClaims.get(normalizeKey(claimName));
      if (!ecoClaimId) continue;

      await database.insert(stagingVariantEcoClaims).values({
        stagingVariantId,
        jobId,
        ecoClaimId,
      });
    }

    // Staging variant environment (carbon/water)
    if (variant.carbonKg !== undefined || variant.waterLiters !== undefined) {
      await database.insert(stagingVariantEnvironment).values({
        stagingVariantId,
        jobId,
        carbonKgCo2e: variant.carbonKg?.toString() ?? null,
        waterLiters: variant.waterLiters?.toString() ?? null,
      });
    }

    // Staging variant journey steps
    const journeyEntries = Object.entries(variant.journeySteps);
    for (let i = 0; i < journeyEntries.length; i++) {
      const [stepType, facilityName] = journeyEntries[i] ?? [];
      if (!stepType || !facilityName) continue;

      const facilityId = catalog.operators.get(normalizeKey(facilityName));
      if (!facilityId) continue;

      await database.insert(stagingVariantJourneySteps).values({
        stagingVariantId,
        jobId,
        stepType,
        sortIndex: i,
        facilityId,
      });
    }

    // Staging variant weight
    if (variant.weightGrams !== undefined) {
      await database.insert(stagingVariantWeight).values({
        stagingVariantId,
        jobId,
        weight: variant.weightGrams.toString(),
        weightUnit: "g",
      });
    }
  }

  return {
    productHandle: product.productHandle,
    rowNumber: product.rowNumber,
    success: true,
    errors: [],
    stagingProductId,
  };
}

// ============================================================================
// Helper: Download File from Supabase
// ============================================================================

async function downloadFileFromSupabase(filePath: string): Promise<Uint8Array> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase configuration missing");
  }

  const normalizedBaseUrl = supabaseUrl.endsWith("/")
    ? supabaseUrl.slice(0, -1)
    : supabaseUrl;

  const encodedPath = filePath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  const downloadUrl = `${normalizedBaseUrl}/storage/v1/object/product-imports/${encodedPath}`;

  const response = await fetch(downloadUrl, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Storage download failed (${response.status}): ${body || response.statusText}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
