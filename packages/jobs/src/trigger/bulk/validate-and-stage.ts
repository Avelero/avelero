/**
 * Validate and Stage Job (Optimized with Batch Operations)
 *
 * Phase 1 of the bulk import process:
 * 1. Downloads and parses the uploaded Excel file
 * 2. Auto-creates missing entities (manufacturers, tags, seasons, etc.)
 * 3. Validates each product row (only category must exist)
 * 4. Populates staging tables with validated data
 * 5. Auto-triggers the commit-to-production job
 *
 * Key optimizations (matching integrations engine pattern):
 * - Processes products in batches of 250 (same as integrations)
 * - Each batch goes through complete cycle: prefetch → compute → insert
 * - Memory-efficient: only 250 products in memory at a time
 *
 * @module validate-and-stage
 */

import "../configure-trigger";
import { randomUUID } from "node:crypto";
import { logger, task, tasks } from "@trigger.dev/sdk/v3";
import { type Database, serviceDb as db } from "@v1/db/client";
import { and, eq, inArray } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { type BrandCatalog, loadBrandCatalog } from "../../lib/catalog-loader";
import {
  type ParsedProduct,
  findDuplicateIdentifiers,
  parseExcelFile,
  validateTemplateMatch,
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
  mode: "CREATE" | "CREATE_AND_ENRICH";
  /** User email for error report notifications (optional) */
  userEmail?: string | null;
}

/**
 * Error for a specific row/field
 */
interface RowError {
  field: string;
  message: string;
}

/**
 * Product action determined by mode and existence
 */
type ProductAction = "CREATE" | "ENRICH" | "SKIP";

/**
 * Result of validating and staging a product
 */
interface ProductResult {
  productHandle: string;
  rowNumber: number;
  success: boolean;
  action: ProductAction;
  errors: RowError[];
  stagingProductId?: string;
}

/**
 * Pre-fetched data for batch lookups (replaces N individual queries)
 */
interface PreFetchedData {
  /** Map of productHandle (lowercase) -> existing product record */
  existingProductsByHandle: Map<string, { id: string }>;
  /** Map of productId -> existing variants with UPIDs */
  existingVariantsByProductId: Map<
    string,
    Array<{ id: string; upid: string | null }>
  >;
}

/**
 * Pending staging operations to be batch inserted (for one batch of 250)
 */
interface PendingStagingOps {
  products: Array<{
    stagingId: string;
    jobId: string;
    rowNumber: number;
    action: string;
    existingProductId: string | null;
    id: string;
    brandId: string;
    productHandle: string;
    name: string;
    description: string | null;
    imagePath: string | null;
    categoryId: string | null;
    seasonId: string | null;
    manufacturerId: string | null;
    status: string;
  }>;
  variants: Array<{
    stagingId: string;
    stagingProductId: string;
    jobId: string;
    rowNumber: number;
    action: string;
    existingVariantId: string | null;
    id: string;
    productId: string;
    upid: string | null;
    barcode: string | null;
    sku: string | null;
    nameOverride: string | null;
    descriptionOverride: string | null;
    imagePathOverride: string | null;
  }>;
  productTags: Array<{
    stagingProductId: string;
    jobId: string;
    tagId: string;
  }>;
  productMaterials: Array<{
    stagingProductId: string;
    jobId: string;
    brandMaterialId: string;
    percentage: string | null;
  }>;
  productEcoClaims: Array<{
    stagingProductId: string;
    jobId: string;
    ecoClaimId: string;
  }>;
  productEnvironment: Array<{
    stagingProductId: string;
    jobId: string;
    carbonKgCo2E: string | null;
    waterLiters: string | null;
  }>;
  productJourneySteps: Array<{
    stagingProductId: string;
    jobId: string;
    stepType: string;
    sortIndex: number;
    facilityId: string;
  }>;
  productWeight: Array<{
    stagingProductId: string;
    jobId: string;
    weight: string;
    weightUnit: string;
  }>;
  variantAttributes: Array<{
    stagingVariantId: string;
    jobId: string;
    attributeId: string;
    attributeValueId: string;
    sortOrder: number;
  }>;
  variantMaterials: Array<{
    stagingVariantId: string;
    jobId: string;
    brandMaterialId: string;
    percentage: string | null;
  }>;
  variantEcoClaims: Array<{
    stagingVariantId: string;
    jobId: string;
    ecoClaimId: string;
  }>;
  variantEnvironment: Array<{
    stagingVariantId: string;
    jobId: string;
    carbonKgCo2e: string | null;
    waterLiters: string | null;
  }>;
  variantJourneySteps: Array<{
    stagingVariantId: string;
    jobId: string;
    stepType: string;
    sortIndex: number;
    facilityId: string;
  }>;
  variantWeight: Array<{
    stagingVariantId: string;
    jobId: string;
    weight: string;
    weightUnit: string;
  }>;
  variantsToDelete: Array<{
    stagingId: string;
    stagingProductId: string;
    jobId: string;
    rowNumber: number;
    action: string;
    existingVariantId: string;
    id: string;
    productId: string;
  }>;
}

/**
 * Computed result for a single product (pure computation, no DB)
 */
interface ComputedProductResult {
  result: ProductResult;
  ops: Partial<PendingStagingOps> | null;
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
  // Product-level staging tables (for parent row data)
  stagingProductMaterials,
  stagingProductEcoClaims,
  stagingProductEnvironment,
  stagingProductJourneySteps,
  stagingProductWeight,
  // Variant-level staging tables (for child row overrides only)
  stagingVariantMaterials,
  stagingVariantEcoClaims,
  stagingVariantEnvironment,
  stagingVariantJourneySteps,
  stagingVariantWeight,
  // Brand entity tables
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
} = schema;

// ============================================================================
// Constants
// ============================================================================

/**
 * Batch size for processing products (same as integrations engine)
 * Each batch goes through complete cycle: prefetch → compute → insert
 */
const BATCH_SIZE = 250;

/**
 * Valid status values for products
 */
const VALID_STATUSES = [
  "unpublished",
  "published",
  "archived",
  "scheduled",
] as const;
type ValidStatus = (typeof VALID_STATUSES)[number];

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
        headers: parseResult.headers,
      });

      // Debug: Log first product's data to verify parsing
      if (parseResult.products.length > 0) {
        const firstProduct = parseResult.products[0];
        const firstVariant = firstProduct?.variants[0];
        logger.info("Debug: First product parsed data", {
          productHandle: firstProduct?.productHandle,
          status: firstProduct?.status,
          tags: firstProduct?.tags,
          productLevelData: {
            materials: firstProduct?.materials,
            ecoClaims: firstProduct?.ecoClaims,
            carbonKg: firstProduct?.carbonKg,
            waterLiters: firstProduct?.waterLiters,
            weightGrams: firstProduct?.weightGrams,
            journeySteps: firstProduct?.journeySteps,
          },
          variantData: firstVariant
            ? {
                barcode: firstVariant.barcode,
                sku: firstVariant.sku,
                attributes: firstVariant.attributes,
                materialsOverride: firstVariant.materialsOverride,
                ecoClaimsOverride: firstVariant.ecoClaimsOverride,
                rawData: Object.keys(firstVariant.rawData),
              }
            : null,
        });
      }

      // 4. Validate template match (strict column validation)
      const templateValidation = validateTemplateMatch(parseResult.headers);
      if (!templateValidation.valid) {
        throw new Error(
          templateValidation.error || "Template validation failed",
        );
      }

      logger.info("Template validation passed", {
        hasUpid: templateValidation.hasUpid,
      });

      // 5. Check for duplicate identifiers (only Product Handle and UPID)
      const duplicates = findDuplicateIdentifiers(parseResult.products);

      // Build a set of duplicate product handles to skip
      const seenHandles = new Set<string>();

      if (duplicates.length > 0) {
        logger.warn("Duplicate identifiers found", {
          count: duplicates.length,
          handles: duplicates.filter((d) => d.field === "Product Handle")
            .length,
          upids: duplicates.filter((d) => d.field === "UPID").length,
        });
      }

      // 6. Load catalog and auto-create missing entities (batch)
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

      // 7. Process products in batches of 250 (same as integrations engine)
      // Each batch goes through complete cycle: prefetch → compute → insert
      const results: ProductResult[] = [];
      let successCount = 0;
      let failureCount = 0;
      const totalBatches = Math.ceil(parseResult.products.length / BATCH_SIZE);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batchStart = batchIndex * BATCH_SIZE;
        const batchEnd = Math.min(
          batchStart + BATCH_SIZE,
          parseResult.products.length,
        );
        const batch = parseResult.products.slice(batchStart, batchEnd);
        const batchNumber = batchIndex + 1;
        const batchStartTime = Date.now();

        logger.info(`Batch ${batchNumber}/${totalBatches}: Starting`, {
          products: batch.length,
          range: `${batchStart + 1}-${batchEnd}`,
        });

        // PHASE 1: Pre-fetch for this batch
        const preFetched = await batchPreFetchExistingData(
          db,
          brandId,
          batch,
          mode,
        );

        // PHASE 2: Pure computation for this batch (no DB calls)
        const batchOps = createEmptyPendingOps();
        const batchResults: ProductResult[] = [];
        let batchSuccess = 0;
        let batchFailure = 0;

        for (const product of batch) {
          // Skip duplicate product handles (keep first, reject subsequent)
          if (seenHandles.has(product.productHandle)) {
            batchResults.push({
              productHandle: product.productHandle,
              rowNumber: product.rowNumber,
              success: false,
              action: "SKIP",
              errors: [
                {
                  field: "Product Handle",
                  message: `Duplicate product handle: "${product.productHandle}". Only the first occurrence will be processed.`,
                },
              ],
            });
            batchFailure++;
            continue;
          }
          seenHandles.add(product.productHandle);

          // Pure computation - no DB calls!
          const computed = computeProductStagingOps(
            product,
            catalog,
            brandId,
            jobId,
            mode,
            preFetched,
            duplicates,
          );

          batchResults.push(computed.result);

          if (computed.result.success && computed.ops) {
            batchSuccess++;
            mergePendingOps(batchOps, computed.ops);
          } else if (!computed.result.success) {
            batchFailure++;
          }
        }

        // PHASE 3: Insert staging data for this batch
        if (batchOps.products.length > 0) {
          await batchInsertStagingData(db, batchOps);
        }

        // Accumulate results
        results.push(...batchResults);
        successCount += batchSuccess;
        failureCount += batchFailure;

        const batchDuration = Date.now() - batchStartTime;
        logger.info(`Batch ${batchNumber}/${totalBatches}: Complete`, {
          success: batchSuccess,
          failure: batchFailure,
          variants: batchOps.variants.length,
          duration: `${batchDuration}ms`,
        });
      }

      // 8. Determine final status and summary
      const hasFailures = failureCount > 0;
      const finalStatus = hasFailures ? "COMPLETED_WITH_FAILURES" : "COMPLETED";

      // Count by action type
      const createdCount = results.filter(
        (r) => r.success && r.action === "CREATE",
      ).length;
      const enrichedCount = results.filter(
        (r) => r.success && r.action === "ENRICH",
      ).length;
      const skippedCount = results.filter(
        (r) => r.success && r.action === "SKIP",
      ).length;

      await db
        .update(importJobs)
        .set({
          status: finalStatus,
          finishedAt: new Date().toISOString(),
          hasExportableFailures: hasFailures,
          summary: {
            totalProducts: successCount,
            failedProducts: failureCount,
            productsCreated: createdCount,
            productsEnriched: enrichedCount,
            productsSkipped: skippedCount,
          },
        })
        .where(eq(importJobs.id, jobId));

      // 9. Auto-trigger commit-to-production job (only if we have successes)
      if (successCount > 0) {
        await tasks.trigger("commit-to-production", {
          jobId,
          brandId,
          userEmail: payload.userEmail ?? null,
        });

        logger.info("Triggered commit-to-production job", { jobId });
      } else if (failureCount > 0) {
        // All products failed - trigger error report directly (no commit needed)
        await tasks.trigger("generate-error-report", {
          jobId,
          brandId,
          userEmail: payload.userEmail ?? null,
        });

        logger.info("Triggered error report generation (all products failed)", {
          jobId,
        });
      }

      const duration = Date.now() - startTime;
      logger.info("Validate-and-stage completed", {
        jobId,
        successCount,
        failureCount,
        batches: totalBatches,
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
// Batch Pre-fetch (for one batch of 250 products)
// ============================================================================

/**
 * Pre-fetch existing products and variants for a batch.
 * This replaces N individual queries with just 2 queries per batch.
 */
async function batchPreFetchExistingData(
  database: Database,
  brandId: string,
  batchProducts: ParsedProduct[],
  mode: "CREATE" | "CREATE_AND_ENRICH",
): Promise<PreFetchedData> {
  // Extract all unique product handles from this batch
  const handles = batchProducts.map((p) => p.productHandle);

  // Single query: fetch existing products by handle for this batch
  const existingProducts = await database
    .select({ id: products.id, productHandle: products.productHandle })
    .from(products)
    .where(
      and(
        eq(products.brandId, brandId),
        inArray(products.productHandle, handles),
      ),
    );

  const existingProductsByHandle = new Map(
    existingProducts.map((p) => [p.productHandle.toLowerCase(), { id: p.id }]),
  );

  // For ENRICH mode: fetch variants for existing products in this batch
  const existingVariantsByProductId = new Map<
    string,
    Array<{ id: string; upid: string | null }>
  >();

  if (mode === "CREATE_AND_ENRICH" && existingProducts.length > 0) {
    const productIds = existingProducts.map((p) => p.id);

    const existingVariants = await database
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        upid: productVariants.upid,
      })
      .from(productVariants)
      .where(inArray(productVariants.productId, productIds));

    // Group by productId
    for (const v of existingVariants) {
      const list = existingVariantsByProductId.get(v.productId) || [];
      list.push({ id: v.id, upid: v.upid });
      existingVariantsByProductId.set(v.productId, list);
    }
  }

  return { existingProductsByHandle, existingVariantsByProductId };
}

// ============================================================================
// Auto-Create Entities (already batch-optimized)
// ============================================================================

/**
 * Auto-create missing entities in the database.
 * Categories are the ONLY exception - they must exist.
 */
async function autoCreateEntities(
  database: Database,
  brandId: string,
  parsedProducts: ParsedProduct[],
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

    // Product-level materials (from parent row)
    for (const material of product.materials) {
      uniqueMaterials.add(material.name.trim());
    }
    // Product-level eco claims (from parent row)
    for (const claim of product.ecoClaims) {
      uniqueEcoClaims.add(claim.trim());
    }
    // Product-level journey step facilities (from parent row)
    for (const facilityName of Object.values(product.journeySteps)) {
      uniqueFacilities.add(facilityName.trim());
    }

    for (const variant of product.variants) {
      // Variant-level material overrides (from child rows)
      for (const material of variant.materialsOverride) {
        uniqueMaterials.add(material.name.trim());
      }
      // Variant-level eco claim overrides (from child rows)
      for (const claim of variant.ecoClaimsOverride) {
        uniqueEcoClaims.add(claim.trim());
      }
      // Variant-level journey step facility overrides (from child rows)
      for (const facilityName of Object.values(variant.journeyStepsOverride)) {
        uniqueFacilities.add(facilityName.trim());
      }
      // Attributes (always variant-level)
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

  // Attributes - Match to taxonomy first, then create with taxonomy reference
  const missingAttributes = [...uniqueAttributes].filter(
    (name) => !catalog.attributes.has(normalizeKey(name)),
  );
  if (missingAttributes.length > 0) {
    // Build insert values with taxonomy references where possible
    const attributeInsertValues = missingAttributes.map((name) => {
      const normalizedName = normalizeKey(name);
      // Check if there's a matching taxonomy attribute
      const taxonomyAttr = catalog.taxonomyAttributes.get(normalizedName);
      return {
        brandId,
        name,
        taxonomyAttributeId: taxonomyAttr?.id ?? null,
      };
    });

    const inserted = await database
      .insert(brandAttributes)
      .values(attributeInsertValues)
      .returning({
        id: brandAttributes.id,
        name: brandAttributes.name,
        taxonomyAttributeId: brandAttributes.taxonomyAttributeId,
      });

    for (const a of inserted) {
      catalog.attributes.set(normalizeKey(a.name), a.id);
      // Also track the taxonomy link in the catalog
      if (a.taxonomyAttributeId) {
        catalog.attributeTaxonomyLinks.set(
          normalizeKey(a.name),
          a.taxonomyAttributeId,
        );
      }
    }
    logger.info("Auto-created attributes", {
      count: inserted.length,
      withTaxonomy: inserted.filter((a) => a.taxonomyAttributeId).length,
    });
  }

  // Attribute Values - Match to taxonomy first, then create with taxonomy reference
  const attributeValueInserts: Array<{
    brandId: string;
    attributeId: string;
    name: string;
    taxonomyValueId: string | null;
  }> = [];

  for (const [attrName, values] of uniqueAttributeValues) {
    const attributeId = catalog.attributes.get(normalizeKey(attrName));
    if (!attributeId) continue;

    // Get the taxonomy attribute ID for this brand attribute (if linked)
    const taxonomyAttributeId = catalog.attributeTaxonomyLinks.get(
      normalizeKey(attrName),
    );

    for (const valueName of values) {
      const key = `${attributeId}:${normalizeKey(valueName)}`;
      if (!catalog.attributeValues.has(key)) {
        // Try to find a matching taxonomy value if we have a taxonomy attribute
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
      .insert(brandAttributeValues)
      .values(attributeValueInserts)
      .returning({
        id: brandAttributeValues.id,
        name: brandAttributeValues.name,
        attributeId: brandAttributeValues.attributeId,
        taxonomyValueId: brandAttributeValues.taxonomyValueId,
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
    logger.info("Auto-created attribute values", {
      count: inserted.length,
      withTaxonomy: inserted.filter((av) => av.taxonomyValueId).length,
    });
  }

  return catalog;
}

// ============================================================================
// Pure Computation: Compute Staging Operations (NO DB CALLS)
// ============================================================================

/**
 * Compute staging operations for a single product.
 * This is a PURE FUNCTION - no database calls!
 * Uses pre-fetched data for all lookups.
 */
function computeProductStagingOps(
  product: ParsedProduct,
  catalog: BrandCatalog,
  brandId: string,
  jobId: string,
  mode: "CREATE" | "CREATE_AND_ENRICH",
  preFetched: PreFetchedData,
  duplicates: ReturnType<typeof findDuplicateIdentifiers>,
): ComputedProductResult {
  const errors: RowError[] = [];
  const normalizeKey = (s: string) => s.toLowerCase().trim();

  // Validate required fields
  if (!product.name || product.name.trim() === "") {
    errors.push({ field: "Product Title", message: "Required" });
  }

  // Validate status field
  if (product.status && product.status.trim() !== "") {
    const normalizedStatus = product.status.toLowerCase().trim();
    if (!VALID_STATUSES.includes(normalizedStatus as ValidStatus)) {
      errors.push({
        field: "Status",
        message: `Invalid status: "${product.status}". Must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }
  }

  // Validate category format (hierarchical with " > " delimiter)
  if (product.categoryPath && product.categoryPath.trim() !== "") {
    const trimmedPath = product.categoryPath.trim();
    if (trimmedPath.includes(">") && !trimmedPath.includes(" > ")) {
      errors.push({
        field: "Category",
        message: `Invalid category format: "${product.categoryPath}". Use " > " delimiter (e.g., "Clothing > T-shirts > Printed T-shirts")`,
      });
    }
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

  // Check for duplicate UPIDs within the file
  for (const variant of product.variants) {
    if (variant.upid) {
      const upidDup = duplicates.find(
        (d) =>
          d.field === "UPID" && d.value === variant.upid && d.rows.length > 1,
      );
      if (upidDup) {
        errors.push({
          field: "UPID",
          message: `Duplicate UPID: ${variant.upid}`,
        });
      }
    }
  }

  // If validation failed, don't stage
  if (errors.length > 0) {
    return {
      result: {
        productHandle: product.productHandle,
        rowNumber: product.rowNumber,
        success: false,
        action: "CREATE",
        errors,
      },
      ops: null,
    };
  }

  // Resolve entities from catalog (no DB calls!)
  const manufacturerId = product.manufacturerName
    ? catalog.manufacturers.get(normalizeKey(product.manufacturerName)) ?? null
    : null;
  const seasonId = product.seasonName
    ? catalog.seasons.get(normalizeKey(product.seasonName)) ?? null
    : null;

  // Determine action using PRE-FETCHED data (no DB query!)
  const existingProduct = preFetched.existingProductsByHandle.get(
    product.productHandle.toLowerCase(),
  );
  const existingProductId = existingProduct?.id || null;

  let productAction: ProductAction;
  if (existingProductId) {
    if (mode === "CREATE") {
      productAction = "SKIP";
    } else {
      productAction = "ENRICH";
    }
  } else {
    productAction = "CREATE";
  }

  // For SKIP action, return success without staging
  if (productAction === "SKIP") {
    return {
      result: {
        productHandle: product.productHandle,
        rowNumber: product.rowNumber,
        success: true,
        action: "SKIP",
        errors: [],
      },
      ops: null,
    };
  }

  // Look up existing variants from PRE-FETCHED data (no DB query!)
  const existingVariants = existingProductId
    ? preFetched.existingVariantsByProductId.get(existingProductId) || []
    : [];
  const existingVariantsByUpid = new Map<string, string>();
  for (const v of existingVariants) {
    if (v.upid) {
      existingVariantsByUpid.set(v.upid, v.id);
    }
  }

  // Collect UPIDs from the import sheet
  const importedUpids = new Set<string>();
  for (const variant of product.variants) {
    if (variant.upid) {
      importedUpids.add(variant.upid);
    }
  }

  // Find variants to delete: exist in DB but not in sheet (ENRICH mode only)
  const variantsToDelete: string[] = [];
  if (productAction === "ENRICH") {
    for (const [upid, variantId] of existingVariantsByUpid.entries()) {
      if (!importedUpids.has(upid)) {
        variantsToDelete.push(variantId);
      }
    }
  }

  // Generate IDs for staging
  const stagingProductId = randomUUID();
  const productId = existingProductId || randomUUID();
  const stagingAction = productAction === "ENRICH" ? "UPDATE" : "CREATE";

  // Build staging operations
  const ops: Partial<PendingStagingOps> = {
    products: [
      {
        stagingId: stagingProductId,
        jobId,
        rowNumber: product.rowNumber,
        action: stagingAction,
        existingProductId,
        id: productId,
        brandId,
        productHandle: product.productHandle,
        name: product.name,
        description: product.description ?? null,
        imagePath: product.imagePath ?? null,
        categoryId,
        seasonId,
        manufacturerId,
        status: product.status || "unpublished",
      },
    ],
    variants: [],
    productTags: [],
    productMaterials: [],
    productEcoClaims: [],
    productEnvironment: [],
    productJourneySteps: [],
    productWeight: [],
    variantAttributes: [],
    variantMaterials: [],
    variantEcoClaims: [],
    variantEnvironment: [],
    variantJourneySteps: [],
    variantWeight: [],
    variantsToDelete: [],
  };

  // Add tags
  for (const tagName of product.tags) {
    const tagId = catalog.tags.get(normalizeKey(tagName));
    if (tagId) {
      ops.productTags!.push({ stagingProductId, jobId, tagId });
    }
  }

  // Add product-level materials
  for (const material of product.materials) {
    const materialId = catalog.materials.get(normalizeKey(material.name));
    if (materialId) {
      ops.productMaterials!.push({
        stagingProductId,
        jobId,
        brandMaterialId: materialId,
        percentage: material.percentage?.toString() ?? null,
      });
    }
  }

  // Add product-level eco claims
  for (const claimName of product.ecoClaims) {
    const ecoClaimId = catalog.ecoClaims.get(normalizeKey(claimName));
    if (ecoClaimId) {
      ops.productEcoClaims!.push({ stagingProductId, jobId, ecoClaimId });
    }
  }

  // Add product-level environment
  if (product.carbonKg !== undefined || product.waterLiters !== undefined) {
    ops.productEnvironment!.push({
      stagingProductId,
      jobId,
      carbonKgCo2E: product.carbonKg?.toString() ?? null,
      waterLiters: product.waterLiters?.toString() ?? null,
    });
  }

  // Add product-level journey steps
  const journeyEntries = Object.entries(product.journeySteps);
  for (let i = 0; i < journeyEntries.length; i++) {
    const [stepType, facilityName] = journeyEntries[i] ?? [];
    if (!stepType || !facilityName) continue;

    const facilityId = catalog.operators.get(normalizeKey(facilityName));
    if (facilityId) {
      ops.productJourneySteps!.push({
        stagingProductId,
        jobId,
        stepType,
        sortIndex: i,
        facilityId,
      });
    }
  }

  // Add product-level weight
  if (product.weightGrams !== undefined) {
    ops.productWeight!.push({
      stagingProductId,
      jobId,
      weight: product.weightGrams.toString(),
      weightUnit: "g",
    });
  }

  // Process variants
  for (const variant of product.variants) {
    const stagingVariantId = randomUUID();

    // For ENRICH mode: match by UPID
    let existingVariantId: string | null = null;
    if (productAction === "ENRICH" && variant.upid) {
      existingVariantId = existingVariantsByUpid.get(variant.upid) || null;
    }

    const variantId = existingVariantId || randomUUID();
    const variantAction = existingVariantId ? "UPDATE" : "CREATE";

    ops.variants!.push({
      stagingId: stagingVariantId,
      stagingProductId,
      jobId,
      rowNumber: variant.rowNumber,
      action: variantAction,
      existingVariantId,
      id: variantId,
      productId,
      upid: variant.upid ?? null,
      barcode: variant.barcode ?? null,
      sku: variant.sku ?? null,
      nameOverride: variant.nameOverride ?? null,
      descriptionOverride: variant.descriptionOverride ?? null,
      imagePathOverride: variant.imagePathOverride ?? null,
    });

    // Add variant attributes
    for (const attr of variant.attributes) {
      const attributeId = catalog.attributes.get(normalizeKey(attr.name));
      if (!attributeId) continue;

      const key = `${attributeId}:${normalizeKey(attr.value)}`;
      const attrValue = catalog.attributeValues.get(key);
      if (!attrValue) continue;

      ops.variantAttributes!.push({
        stagingVariantId,
        jobId,
        attributeId,
        attributeValueId: attrValue.id,
        sortOrder: attr.sortOrder,
      });
    }

    // Add variant-level material overrides
    for (const material of variant.materialsOverride) {
      const materialId = catalog.materials.get(normalizeKey(material.name));
      if (materialId) {
        ops.variantMaterials!.push({
          stagingVariantId,
          jobId,
          brandMaterialId: materialId,
          percentage: material.percentage?.toString() ?? null,
        });
      }
    }

    // Add variant-level eco claim overrides
    for (const claimName of variant.ecoClaimsOverride) {
      const ecoClaimId = catalog.ecoClaims.get(normalizeKey(claimName));
      if (ecoClaimId) {
        ops.variantEcoClaims!.push({ stagingVariantId, jobId, ecoClaimId });
      }
    }

    // Add variant-level environment overrides
    if (
      variant.carbonKgOverride !== undefined ||
      variant.waterLitersOverride !== undefined
    ) {
      ops.variantEnvironment!.push({
        stagingVariantId,
        jobId,
        carbonKgCo2e: variant.carbonKgOverride?.toString() ?? null,
        waterLiters: variant.waterLitersOverride?.toString() ?? null,
      });
    }

    // Add variant-level journey step overrides
    const variantJourneyEntries = Object.entries(variant.journeyStepsOverride);
    for (let i = 0; i < variantJourneyEntries.length; i++) {
      const [stepType, facilityName] = variantJourneyEntries[i] ?? [];
      if (!stepType || !facilityName) continue;

      const facilityId = catalog.operators.get(normalizeKey(facilityName));
      if (facilityId) {
        ops.variantJourneySteps!.push({
          stagingVariantId,
          jobId,
          stepType,
          sortIndex: i,
          facilityId,
        });
      }
    }

    // Add variant-level weight override
    if (variant.weightGramsOverride !== undefined) {
      ops.variantWeight!.push({
        stagingVariantId,
        jobId,
        weight: variant.weightGramsOverride.toString(),
        weightUnit: "g",
      });
    }
  }

  // Add variants to delete (ENRICH mode only)
  for (const variantIdToDelete of variantsToDelete) {
    const stagingVariantId = randomUUID();
    ops.variantsToDelete!.push({
      stagingId: stagingVariantId,
      stagingProductId,
      jobId,
      rowNumber: product.rowNumber,
      action: "DELETE",
      existingVariantId: variantIdToDelete,
      id: variantIdToDelete,
      productId,
    });
  }

  return {
    result: {
      productHandle: product.productHandle,
      rowNumber: product.rowNumber,
      success: true,
      action: productAction,
      errors: [],
      stagingProductId,
    },
    ops,
  };
}

// ============================================================================
// Batch Insert Staging Data (for one batch of 250 products)
// ============================================================================

/**
 * Batch insert staging data for one batch.
 * With max 250 products and ~10 variants each, this is ~2500 rows max per table.
 */
async function batchInsertStagingData(
  database: Database,
  pendingOps: PendingStagingOps,
): Promise<void> {
  // Insert products first (order matters for foreign key constraints)
  if (pendingOps.products.length > 0) {
    await database.insert(stagingProducts).values(
      pendingOps.products.map((p) => ({
        stagingId: p.stagingId,
        jobId: p.jobId,
        rowNumber: p.rowNumber,
        action: p.action,
        existingProductId: p.existingProductId,
        id: p.id,
        brandId: p.brandId,
        productHandle: p.productHandle,
        name: p.name,
        description: p.description,
        imagePath: p.imagePath,
        categoryId: p.categoryId,
        seasonId: p.seasonId,
        manufacturerId: p.manufacturerId,
        status: p.status,
        rowStatus: "PENDING",
      })),
    );
  }

  // Insert variants (regular + to-delete)
  const allVariants = [
    ...pendingOps.variants.map((v) => ({
      stagingId: v.stagingId,
      stagingProductId: v.stagingProductId,
      jobId: v.jobId,
      rowNumber: v.rowNumber,
      action: v.action,
      existingVariantId: v.existingVariantId,
      id: v.id,
      productId: v.productId,
      upid: v.upid,
      barcode: v.barcode,
      sku: v.sku,
      nameOverride: v.nameOverride,
      descriptionOverride: v.descriptionOverride,
      imagePathOverride: v.imagePathOverride,
      rowStatus: "PENDING",
    })),
    ...pendingOps.variantsToDelete.map((v) => ({
      stagingId: v.stagingId,
      stagingProductId: v.stagingProductId,
      jobId: v.jobId,
      rowNumber: v.rowNumber,
      action: v.action,
      existingVariantId: v.existingVariantId,
      id: v.id,
      productId: v.productId,
      upid: null,
      barcode: null,
      sku: null,
      nameOverride: null,
      descriptionOverride: null,
      imagePathOverride: null,
      rowStatus: "PENDING",
    })),
  ];

  if (allVariants.length > 0) {
    await database.insert(stagingProductVariants).values(allVariants);
  }

  // Insert product-level relations
  if (pendingOps.productTags.length > 0) {
    await database.insert(stagingProductTags).values(pendingOps.productTags);
  }

  if (pendingOps.productMaterials.length > 0) {
    await database
      .insert(stagingProductMaterials)
      .values(pendingOps.productMaterials);
  }

  if (pendingOps.productEcoClaims.length > 0) {
    await database
      .insert(stagingProductEcoClaims)
      .values(pendingOps.productEcoClaims);
  }

  if (pendingOps.productEnvironment.length > 0) {
    await database
      .insert(stagingProductEnvironment)
      .values(pendingOps.productEnvironment);
  }

  if (pendingOps.productJourneySteps.length > 0) {
    await database
      .insert(stagingProductJourneySteps)
      .values(pendingOps.productJourneySteps);
  }

  if (pendingOps.productWeight.length > 0) {
    await database
      .insert(stagingProductWeight)
      .values(pendingOps.productWeight);
  }

  // Insert variant-level relations
  if (pendingOps.variantAttributes.length > 0) {
    await database
      .insert(stagingVariantAttributes)
      .values(pendingOps.variantAttributes);
  }

  if (pendingOps.variantMaterials.length > 0) {
    await database
      .insert(stagingVariantMaterials)
      .values(pendingOps.variantMaterials);
  }

  if (pendingOps.variantEcoClaims.length > 0) {
    await database
      .insert(stagingVariantEcoClaims)
      .values(pendingOps.variantEcoClaims);
  }

  if (pendingOps.variantEnvironment.length > 0) {
    await database
      .insert(stagingVariantEnvironment)
      .values(pendingOps.variantEnvironment);
  }

  if (pendingOps.variantJourneySteps.length > 0) {
    await database
      .insert(stagingVariantJourneySteps)
      .values(pendingOps.variantJourneySteps);
  }

  if (pendingOps.variantWeight.length > 0) {
    await database
      .insert(stagingVariantWeight)
      .values(pendingOps.variantWeight);
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create an empty pending ops structure
 */
function createEmptyPendingOps(): PendingStagingOps {
  return {
    products: [],
    variants: [],
    productTags: [],
    productMaterials: [],
    productEcoClaims: [],
    productEnvironment: [],
    productJourneySteps: [],
    productWeight: [],
    variantAttributes: [],
    variantMaterials: [],
    variantEcoClaims: [],
    variantEnvironment: [],
    variantJourneySteps: [],
    variantWeight: [],
    variantsToDelete: [],
  };
}

/**
 * Merge partial ops into the main ops structure
 */
function mergePendingOps(
  target: PendingStagingOps,
  source: Partial<PendingStagingOps>,
): void {
  if (source.products) target.products.push(...source.products);
  if (source.variants) target.variants.push(...source.variants);
  if (source.productTags) target.productTags.push(...source.productTags);
  if (source.productMaterials)
    target.productMaterials.push(...source.productMaterials);
  if (source.productEcoClaims)
    target.productEcoClaims.push(...source.productEcoClaims);
  if (source.productEnvironment)
    target.productEnvironment.push(...source.productEnvironment);
  if (source.productJourneySteps)
    target.productJourneySteps.push(...source.productJourneySteps);
  if (source.productWeight) target.productWeight.push(...source.productWeight);
  if (source.variantAttributes)
    target.variantAttributes.push(...source.variantAttributes);
  if (source.variantMaterials)
    target.variantMaterials.push(...source.variantMaterials);
  if (source.variantEcoClaims)
    target.variantEcoClaims.push(...source.variantEcoClaims);
  if (source.variantEnvironment)
    target.variantEnvironment.push(...source.variantEnvironment);
  if (source.variantJourneySteps)
    target.variantJourneySteps.push(...source.variantJourneySteps);
  if (source.variantWeight) target.variantWeight.push(...source.variantWeight);
  if (source.variantsToDelete)
    target.variantsToDelete.push(...source.variantsToDelete);
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
