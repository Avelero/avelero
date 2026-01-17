/**
 * Validate and Stage Job (Simplified Architecture)
 *
 * Phase 1 of the bulk import process:
 * 1. Downloads and parses the uploaded Excel file
 * 2. Auto-creates missing entities (manufacturers, tags, seasons, etc.)
 * 3. Validates each product row (only category must exist)
 * 4. Stores validated data directly as NormalizedRowData in import_rows
 * 5. Auto-triggers the commit-to-production job
 *
 * Key optimizations:
 * - Processes products in batches of 250 (same as integrations)
 * - Each batch goes through complete cycle: prefetch → compute → insert
 * - Memory-efficient: only 250 products in memory at a time
 * - Builds NormalizedRowData directly (no intermediate staging structures)
 *
 * @module validate-and-stage
 */

import "../configure-trigger";
import { randomUUID } from "node:crypto";
import { logger, task, tasks } from "@trigger.dev/sdk/v3";
import { type Database, serviceDb as db } from "@v1/db/client";
import { and, eq, inArray, sql } from "@v1/db/queries";
import type {
  NormalizedRowData,
  RowStatus as NormalizedRowStatus,
  NormalizedVariant,
  RowError,
} from "@v1/db/queries/bulk";
import { createNotification } from "@v1/db/queries/notifications";
import * as schema from "@v1/db/schema";
import { type BrandCatalog, loadBrandCatalog } from "../../lib/catalog-loader";
import {
  type ParsedProduct,
  findDuplicateIdentifiers,
  parseExcelFile,
  parseSemicolonSeparated,
  validateTemplateMatch,
} from "../../lib/excel";

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
  /** User ID who initiated the import (for notifications) */
  userId?: string | null;
  /** User email for error report notifications (optional) */
  userEmail?: string | null;
}

/**
 * Product action determined by mode and existence
 */
type ProductAction = "CREATE" | "ENRICH" | "SKIP";

/**
 * Staging row status
 * - PENDING: No errors, ready for commit
 * - PENDING_WITH_WARNINGS: Has non-blocking field errors, product will still be created
 * - BLOCKED: Has blocking errors (missing Product Title), cannot create product
 */
type StagingRowStatus = "PENDING" | "PENDING_WITH_WARNINGS" | "BLOCKED";

/**
 * Result of validating and staging a product
 */
interface ProductResult {
  productHandle: string;
  rowNumber: number;
  /** Whether the product can be committed (PENDING or PENDING_WITH_WARNINGS) */
  canCommit: boolean;
  action: ProductAction;
  /** Row status for staging table */
  rowStatus: StagingRowStatus;
  /** Field-level errors */
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
 * Computed result for a single product (pure computation, no DB)
 */
interface ComputedProductResult {
  result: ProductResult;
  /** Normalized data ready for insertion, or null for SKIP */
  normalized: NormalizedRowData | null;
  /** Raw data for error reporting */
  raw: Record<string, string>;
}

// ============================================================================
// Schema References
// ============================================================================

const {
  importJobs,
  importRows,
  // Brand entity tables
  brandAttributes,
  brandAttributeValues,
  brandMaterials,
  brandSeasons,
  brandTags,
  brandOperators,
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
 * Valid status values for products (new publishing model)
 * - 'unpublished': Draft, never been published (default)
 * - 'published': Has been published at least once
 */
const VALID_STATUSES = ["unpublished", "published"] as const;
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
      let pendingCount = 0;
      let warningsCount = 0;
      let blockedCount = 0;
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
        const batchRows: Array<{
          jobId: string;
          rowNumber: number;
          raw: Record<string, string>;
          normalized: NormalizedRowData;
          status: string;
        }> = [];
        const batchResults: ProductResult[] = [];
        let batchPending = 0;
        let batchWarnings = 0;
        let batchBlocked = 0;
        let batchVariantCount = 0;

        for (const product of batch) {
          // Skip duplicate product handles (keep first, reject subsequent)
          if (seenHandles.has(product.productHandle)) {
            // Duplicate handles are BLOCKED - we stage them but won't commit
            const stagingProductId = randomUUID();
            const duplicateErrors: RowError[] = [
              {
                field: "Product Handle",
                message: `Duplicate product handle: "${product.productHandle}". Only the first occurrence will be processed.`,
              },
            ];

            batchResults.push({
              productHandle: product.productHandle,
              rowNumber: product.rowNumber,
              canCommit: false,
              action: "SKIP",
              rowStatus: "BLOCKED",
              errors: duplicateErrors,
              stagingProductId,
            });

            // Create normalized data for the duplicate (for error report)
            const normalizedDuplicate: NormalizedRowData = {
              stagingId: stagingProductId,
              rowNumber: product.rowNumber,
              action: "SKIP",
              existingProductId: null,
              id: randomUUID(),
              brandId,
              productHandle: product.productHandle,
              name: product.name || "",
              description: product.description ?? null,
              imagePath: product.imagePath ?? null,
              categoryId: null,
              seasonId: null,
              manufacturerId: null,
              status: product.status || "unpublished",
              rowStatus: "BLOCKED",
              errors: duplicateErrors,
              variants: [],
              tags: [],
              materials: [],
              environment: null,
              journeySteps: [],
              weight: null,
            };

            batchRows.push({
              jobId,
              rowNumber: product.rowNumber,
              raw: product.rawData,
              normalized: normalizedDuplicate,
              status: "BLOCKED",
            });

            batchBlocked++;
            continue;
          }
          seenHandles.add(product.productHandle);

          // Pure computation - no DB calls!
          const computed = computeNormalizedRowData(
            product,
            catalog,
            brandId,
            mode,
            preFetched,
            duplicates,
          );

          batchResults.push(computed.result);

          // ALL products get stored (including with errors) for error reporting
          if (computed.normalized) {
            batchRows.push({
              jobId,
              rowNumber: product.rowNumber,
              raw: computed.raw,
              normalized: computed.normalized,
              status: computed.normalized.rowStatus,
            });
            batchVariantCount += computed.normalized.variants.length;
          }

          // Track by status
          if (computed.result.rowStatus === "PENDING") {
            batchPending++;
          } else if (computed.result.rowStatus === "PENDING_WITH_WARNINGS") {
            batchWarnings++;
          } else if (computed.result.rowStatus === "BLOCKED") {
            batchBlocked++;
          }
        }

        // PHASE 3: Insert ALL rows into import_rows with normalized JSONB data
        if (batchRows.length > 0) {
          await db.insert(importRows).values(batchRows);
          logger.info(
            `Batch ${batchNumber}: Stored ${batchRows.length} rows with normalized data`,
          );
        }

        // Accumulate results
        results.push(...batchResults);
        pendingCount += batchPending;
        warningsCount += batchWarnings;
        blockedCount += batchBlocked;

        const batchDuration = Date.now() - batchStartTime;
        logger.info(`Batch ${batchNumber}/${totalBatches}: Complete`, {
          pending: batchPending,
          warnings: batchWarnings,
          blocked: batchBlocked,
          variants: batchVariantCount,
          duration: `${batchDuration}ms`,
        });
      }

      // 8. Determine final status and summary
      const hasErrors = warningsCount > 0 || blockedCount > 0;
      const canCommitCount = pendingCount + warningsCount; // Products that can be committed
      const hasCommittableProducts = canCommitCount > 0;

      // Count by action type (only for committable products)
      const createdCount = results.filter(
        (r) => r.canCommit && r.action === "CREATE",
      ).length;
      const enrichedCount = results.filter(
        (r) => r.canCommit && r.action === "ENRICH",
      ).length;
      const skippedCount = results.filter(
        (r) => r.canCommit && r.action === "SKIP",
      ).length;

      // Count total field errors
      const totalFieldErrors = results.reduce(
        (sum, r) => sum + r.errors.length,
        0,
      );

      const finalStatus = hasErrors ? "COMPLETED_WITH_FAILURES" : "COMPLETED";

      await db
        .update(importJobs)
        .set({
          status: finalStatus,
          finishedAt: new Date().toISOString(),
          hasExportableFailures: hasErrors,
          summary: {
            totalProducts: results.length,
            pendingProducts: pendingCount,
            warningProducts: warningsCount,
            blockedProducts: blockedCount,
            productsCreated: createdCount,
            productsEnriched: enrichedCount,
            productsSkipped: skippedCount,
            totalFieldErrors,
          },
        })
        .where(eq(importJobs.id, jobId));

      // 9. Log comprehensive summary
      logger.info("Validate-and-stage summary", {
        jobId,
        totalProducts: results.length,
        pending: pendingCount,
        pendingWithWarnings: warningsCount,
        blocked: blockedCount,
        totalFieldErrors,
        canCommit: canCommitCount,
        errorReportNeeded: hasErrors,
      });

      // 10. Generate error report SYNCHRONOUSLY if ANY products have errors
      // IMPORTANT: Must use triggerAndWait so the report is generated BEFORE
      // commit-to-production runs (which changes rowStatus and deletes staging data)
      if (hasErrors) {
        logger.info("Generating error report (synchronous)", {
          jobId,
          warningsCount,
          blockedCount,
        });

        await tasks.triggerAndWait("generate-error-report", {
          jobId,
          brandId,
          userEmail: payload.userEmail ?? null,
        });

        logger.info("Error report generation completed", {
          jobId,
          warningsCount,
          blockedCount,
        });

        // 10b. Create user notification for import failure
        if (payload.userId) {
          const notificationTitle =
            blockedCount > 0 && warningsCount > 0
              ? `${blockedCount} products failed and ${warningsCount} had warnings`
              : blockedCount > 0
                ? `${blockedCount} products failed during import`
                : `${warningsCount} products had warnings during import`;

          await createNotification(db, {
            userId: payload.userId,
            brandId,
            type: "import_failure",
            title: notificationTitle,
            message:
              "Download the error report to see which products need corrections.",
            resourceType: "import_job",
            resourceId: jobId,
            actionUrl: "/products",
            actionData: {
              blockedCount,
              warningsCount,
              jobId,
            },
            expiresInMs: 24 * 60 * 60 * 1000, // 24 hours
          });

          logger.info("Created import failure notification", {
            jobId,
            userId: payload.userId,
            blockedCount,
            warningsCount,
          });
        }
      }

      // 11. Auto-trigger commit-to-production job (only if we have committable products)
      if (hasCommittableProducts) {
        await tasks.trigger("commit-to-production", {
          jobId,
          brandId,
          userEmail: payload.userEmail ?? null,
          // Pass validation errors flag so commit-to-production can preserve it
          hasValidationErrors: hasErrors,
        });

        logger.info("Triggered commit-to-production job", {
          jobId,
          productsToCommit: canCommitCount,
          hasValidationErrors: hasErrors,
        });
      }

      const duration = Date.now() - startTime;
      logger.info("Validate-and-stage completed", {
        jobId,
        pending: pendingCount,
        warnings: warningsCount,
        blocked: blockedCount,
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
    // Product-level journey step operators (from parent row)
    // Support semicolon-separated multiple operators per step: "Factory A; Factory B"
    for (const operatorValue of Object.values(product.journeySteps)) {
      const operatorNames = parseSemicolonSeparated(operatorValue);
      for (const operatorName of operatorNames) {
        uniqueFacilities.add(operatorName.trim());
      }
    }

    for (const variant of product.variants) {
      // Variant-level material overrides (from child rows)
      for (const material of variant.materialsOverride) {
        uniqueMaterials.add(material.name.trim());
      }
      // Variant-level journey step operator overrides (from child rows)
      // Support semicolon-separated multiple operators per step
      for (const operatorValue of Object.values(variant.journeyStepsOverride)) {
        const operatorNames = parseSemicolonSeparated(operatorValue);
        for (const operatorName of operatorNames) {
          uniqueFacilities.add(operatorName.trim());
        }
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

  // Facilities
  const missingFacilities = [...uniqueFacilities].filter(
    (name) => !catalog.operators.has(normalizeKey(name)),
  );
  if (missingFacilities.length > 0) {
    const inserted = await database
      .insert(brandOperators)
      .values(
        missingFacilities.map((name) => ({
          brandId,
          displayName: name,
          type: "MANUFACTURER" as const,
        })),
      )
      .returning({
        id: brandOperators.id,
        displayName: brandOperators.displayName,
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
// Pure Computation: Build NormalizedRowData Directly (NO DB CALLS)
// ============================================================================

/**
 * Compute NormalizedRowData for a single product.
 * This is a PURE FUNCTION - no database calls!
 * Uses pre-fetched data for all lookups.
 */
function computeNormalizedRowData(
  product: ParsedProduct,
  catalog: BrandCatalog,
  brandId: string,
  mode: "CREATE" | "CREATE_AND_ENRICH",
  preFetched: PreFetchedData,
  duplicates: ReturnType<typeof findDuplicateIdentifiers>,
): ComputedProductResult {
  const blockingErrors: RowError[] = [];
  const warningErrors: RowError[] = [];
  const normalizeKey = (s: string) => s.toLowerCase().trim();

  // ========================================================================
  // BLOCKING VALIDATION: Missing Product Title = cannot create product
  // ========================================================================
  if (!product.name || product.name.trim() === "") {
    blockingErrors.push({ field: "Product Title", message: "Required" });
  }

  // ========================================================================
  // NON-BLOCKING VALIDATION: Field errors that don't prevent product creation
  // ========================================================================

  // Validate status field
  let validatedStatus = product.status || "unpublished";
  if (product.status && product.status.trim() !== "") {
    const normalizedStatus = product.status.toLowerCase().trim();
    if (!VALID_STATUSES.includes(normalizedStatus as ValidStatus)) {
      warningErrors.push({
        field: "Status",
        message: `Invalid status: "${product.status}". Must be one of: ${VALID_STATUSES.join(", ")}. Defaulting to "unpublished".`,
      });
      validatedStatus = "unpublished"; // Default to unpublished on error
    }
  }

  // Validate category format (hierarchical with " > " delimiter)
  let categoryId: string | null = null;
  if (product.categoryPath && product.categoryPath.trim() !== "") {
    const trimmedPath = product.categoryPath.trim();
    if (trimmedPath.includes(">") && !trimmedPath.includes(" > ")) {
      warningErrors.push({
        field: "Category",
        message: `Invalid category format: "${product.categoryPath}". Use " > " delimiter (e.g., "Clothing > T-shirts"). Field skipped.`,
      });
    } else {
      // Try to match category by name (using the last segment of the path)
      const categoryName = product.categoryPath.split(">").pop()?.trim() || "";
      categoryId = catalog.categories.get(normalizeKey(categoryName)) || null;

      if (!categoryId) {
        warningErrors.push({
          field: "Category",
          message: `Category not found: "${product.categoryPath}". Field skipped.`,
        });
      }
    }
  }

  // Validate numeric fields
  if (
    product.carbonKg === undefined &&
    product.rawData["Kilograms CO2"]?.trim()
  ) {
    warningErrors.push({
      field: "kgCO2e Carbon Footprint",
      message: `Invalid number: "${product.rawData["Kilograms CO2"]}". Field skipped.`,
    });
  }

  if (
    product.waterLiters === undefined &&
    product.rawData["Liters Water Used"]?.trim()
  ) {
    warningErrors.push({
      field: "Liters Water Used",
      message: `Invalid number: "${product.rawData["Liters Water Used"]}". Field skipped.`,
    });
  }

  if (
    product.weightGrams === undefined &&
    product.rawData["Grams Weight"]?.trim()
  ) {
    warningErrors.push({
      field: "Grams Weight",
      message: `Invalid number: "${product.rawData["Grams Weight"]}". Field skipped.`,
    });
  }

  // Track errors per variant (by row number) for error reporting
  const variantErrorsByRow = new Map<number, RowError[]>();
  let hasVariantErrors = false; // Track if any variant has errors (for product status)

  // Check for duplicate UPIDs within the file and validate variant-level fields
  for (const variant of product.variants) {
    const variantErrors: RowError[] = [];

    if (variant.upid) {
      const upidDup = duplicates.find(
        (d) =>
          d.field === "UPID" && d.value === variant.upid && d.rows.length > 1,
      );
      if (upidDup) {
        variantErrors.push({
          field: "UPID",
          message: `Duplicate UPID: ${variant.upid}. Variant will be skipped.`,
        });
      }
    }

    // Validate attribute pairs - both must be present
    for (let i = 1; i <= 3; i++) {
      const attrName = variant.rawData[`Attribute ${i}`]?.trim();
      const attrValue = variant.rawData[`Attribute Value ${i}`]?.trim();
      if ((attrName && !attrValue) || (!attrName && attrValue)) {
        // Mark both as error since pair is incomplete
        const errorField1 = `Attribute ${i}`;
        const errorField2 = `Attribute Value ${i}`;
        const message = `Incomplete attribute pair: both Attribute ${i} and Attribute Value ${i} must be provided. Pair skipped.`;

        variantErrors.push({ field: errorField1, message });
        variantErrors.push({ field: errorField2, message });
      }
    }

    // Validate variant-level numeric overrides (child rows only)
    // Check if raw data has values but parsed override is undefined
    if (
      variant.carbonKgOverride === undefined &&
      variant.rawData["Kilograms CO2"]?.trim()
    ) {
      variantErrors.push({
        field: "kgCO2e Carbon Footprint",
        message: `Invalid number: "${variant.rawData["Kilograms CO2"]}". Field skipped.`,
      });
    }

    if (
      variant.waterLitersOverride === undefined &&
      variant.rawData["Liters Water Used"]?.trim()
    ) {
      variantErrors.push({
        field: "Liters Water Used",
        message: `Invalid number: "${variant.rawData["Liters Water Used"]}". Field skipped.`,
      });
    }

    if (
      variant.weightGramsOverride === undefined &&
      variant.rawData["Grams Weight"]?.trim()
    ) {
      variantErrors.push({
        field: "Grams Weight",
        message: `Invalid number: "${variant.rawData["Grams Weight"]}". Field skipped.`,
      });
    }

    // Validate percentages column (semicolon-delimited numbers)
    const rawPercentages = variant.rawData.Percentages?.trim();
    if (rawPercentages) {
      const percentageValues = rawPercentages.split(";").map((v) => v.trim());
      const invalidPercentages = percentageValues.filter((v) => {
        if (!v) return false; // Empty is OK
        const num = Number.parseFloat(v);
        return Number.isNaN(num);
      });
      if (invalidPercentages.length > 0) {
        variantErrors.push({
          field: "Percentages",
          message: `Invalid percentage values: "${invalidPercentages.join(", ")}". Must be semicolon-separated numbers.`,
        });
      }
    }

    // Store variant errors if any
    if (variantErrors.length > 0) {
      variantErrorsByRow.set(variant.rowNumber, variantErrors);
      hasVariantErrors = true;
    }
  }

  // Product-only errors for storage (exclude variant errors)
  const productOnlyErrors = [...blockingErrors, ...warningErrors];

  // All errors (product + all variants) for result/summary tracking
  const variantErrors = Array.from(variantErrorsByRow.values()).flat();
  const allErrors = [...productOnlyErrors, ...variantErrors];

  // Determine row status (considers both product and variant errors)
  let rowStatus: StagingRowStatus;
  let canCommit: boolean;
  if (blockingErrors.length > 0) {
    rowStatus = "BLOCKED";
    canCommit = false;
  } else if (warningErrors.length > 0 || hasVariantErrors) {
    rowStatus = "PENDING_WITH_WARNINGS";
    canCommit = true;
  } else {
    rowStatus = "PENDING";
    canCommit = true;
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

  // For SKIP action in CREATE mode, return success without normalized data
  if (productAction === "SKIP") {
    return {
      result: {
        productHandle: product.productHandle,
        rowNumber: product.rowNumber,
        canCommit: true,
        action: "SKIP",
        rowStatus: "PENDING",
        errors: [],
      },
      normalized: null,
      raw: product.rawData,
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

  // Generate IDs
  const stagingProductId = randomUUID();
  const productId = existingProductId || randomUUID();
  const normalizedAction = productAction === "ENRICH" ? "UPDATE" : "CREATE";

  // Build normalized variants
  const normalizedVariants: NormalizedVariant[] = [];

  for (const variant of product.variants) {
    const stagingVariantId = randomUUID();

    // For ENRICH mode: match by UPID
    let existingVariantId: string | null = null;
    if (productAction === "ENRICH" && variant.upid) {
      existingVariantId = existingVariantsByUpid.get(variant.upid) || null;
    }

    const variantId = existingVariantId || randomUUID();
    const variantAction = existingVariantId ? "UPDATE" : "CREATE";

    // Get errors specific to this variant row (mutable copy)
    const variantRowErrors = [
      ...(variantErrorsByRow.get(variant.rowNumber) ?? []),
    ];

    // Validate UPID: if provided but doesn't exist in database, it's an error
    // This only applies in ENRICH mode where we expect UPIDs to match existing variants
    if (productAction === "ENRICH" && variant.upid && !existingVariantId) {
      variantRowErrors.push({
        field: "UPID",
        message: `UPID not found in database: "${variant.upid}". UPID must match an existing variant.`,
      });
    }

    const variantRowStatus: NormalizedRowStatus =
      variantRowErrors.length > 0 ? "PENDING_WITH_WARNINGS" : "PENDING";

    // Build variant attributes
    const attributes: NormalizedVariant["attributes"] = [];
    for (const attr of variant.attributes) {
      const attributeId = catalog.attributes.get(normalizeKey(attr.name));
      if (!attributeId) continue;

      const key = `${attributeId}:${normalizeKey(attr.value)}`;
      const attrValue = catalog.attributeValues.get(key);
      if (!attrValue) continue;

      attributes.push({
        attributeId,
        attributeValueId: attrValue.id,
        sortOrder: attr.sortOrder,
      });
    }

    // Build variant materials
    const materials: NormalizedVariant["materials"] = [];
    for (const material of variant.materialsOverride) {
      const materialId = catalog.materials.get(normalizeKey(material.name));
      if (materialId) {
        materials.push({
          brandMaterialId: materialId,
          percentage: material.percentage?.toString() ?? null,
        });
      }
    }

    // Build variant environment
    const environment: NormalizedVariant["environment"] =
      variant.carbonKgOverride !== undefined ||
      variant.waterLitersOverride !== undefined
        ? {
            carbonKgCo2e: variant.carbonKgOverride?.toString() ?? null,
            waterLiters: variant.waterLitersOverride?.toString() ?? null,
          }
        : null;

    // Build variant journey steps
    // Support semicolon-separated multiple operators per step: "Factory A; Factory B"
    const journeySteps: NormalizedVariant["journeySteps"] = [];
    const variantJourneyEntries = Object.entries(variant.journeyStepsOverride);
    for (let i = 0; i < variantJourneyEntries.length; i++) {
      const [stepType, operatorValue] = variantJourneyEntries[i] ?? [];
      if (!stepType || !operatorValue) continue;

      // Parse semicolon-separated operator names and look up each
      const operatorNames = parseSemicolonSeparated(operatorValue);
      const operatorIds: string[] = [];
      for (const operatorName of operatorNames) {
        const operatorId = catalog.operators.get(normalizeKey(operatorName));
        if (operatorId) {
          operatorIds.push(operatorId);
        }
      }

      if (operatorIds.length > 0) {
        journeySteps.push({
          sortIndex: i,
          stepType,
          operatorIds,
        });
      }
    }

    // Build variant weight
    const weight: NormalizedVariant["weight"] =
      variant.weightGramsOverride !== undefined
        ? {
            weight: variant.weightGramsOverride.toString(),
            weightUnit: "g",
          }
        : null;

    normalizedVariants.push({
      stagingId: stagingVariantId,
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
      rowStatus: variantRowStatus,
      errors: variantRowErrors,
      attributes,
      materials,
      environment,
      journeySteps,
      weight,
      rawData: variant.rawData,
    });
  }

  // Recalculate product rowStatus after all variant validation (including UPID validation)
  // This ensures products with UPID-only errors get PENDING_WITH_WARNINGS status
  const hasAnyVariantErrors = normalizedVariants.some(
    (v) => v.errors.length > 0,
  );
  if (rowStatus === "PENDING" && hasAnyVariantErrors) {
    rowStatus = "PENDING_WITH_WARNINGS";
  }

  // Build product-level tags
  const tags: string[] = [];
  for (const tagName of product.tags) {
    const tagId = catalog.tags.get(normalizeKey(tagName));
    if (tagId) {
      tags.push(tagId);
    }
  }

  // Build product-level materials
  const productMaterials: NormalizedRowData["materials"] = [];
  for (const material of product.materials) {
    const materialId = catalog.materials.get(normalizeKey(material.name));
    if (materialId) {
      productMaterials.push({
        brandMaterialId: materialId,
        percentage: material.percentage?.toString() ?? null,
      });
    }
  }

  // Build product-level environment
  const productEnvironment: NormalizedRowData["environment"] =
    product.carbonKg !== undefined || product.waterLiters !== undefined
      ? {
          carbonKgCo2e: product.carbonKg?.toString() ?? null,
          waterLiters: product.waterLiters?.toString() ?? null,
        }
      : null;

  // Build product-level journey steps
  // Support semicolon-separated multiple operators per step: "Factory A; Factory B"
  const productJourneySteps: NormalizedRowData["journeySteps"] = [];
  const journeyEntries = Object.entries(product.journeySteps);
  for (let i = 0; i < journeyEntries.length; i++) {
    const [stepType, operatorValue] = journeyEntries[i] ?? [];
    if (!stepType || !operatorValue) continue;

    // Parse semicolon-separated operator names and look up each
    const operatorNames = parseSemicolonSeparated(operatorValue);
    const operatorIds: string[] = [];
    for (const operatorName of operatorNames) {
      const operatorId = catalog.operators.get(normalizeKey(operatorName));
      if (operatorId) {
        operatorIds.push(operatorId);
      }
    }

    if (operatorIds.length > 0) {
      productJourneySteps.push({
        sortIndex: i,
        stepType,
        operatorIds,
      });
    }
  }

  // Build product-level weight
  const productWeight: NormalizedRowData["weight"] =
    product.weightGrams !== undefined
      ? {
          weight: product.weightGrams.toString(),
          weightUnit: "g",
        }
      : null;

  // Build final NormalizedRowData
  const normalized: NormalizedRowData = {
    stagingId: stagingProductId,
    rowNumber: product.rowNumber,
    action: normalizedAction,
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
    status: validatedStatus,
    rowStatus: rowStatus as NormalizedRowStatus,
    errors: productOnlyErrors,
    variants: normalizedVariants,
    tags,
    materials: productMaterials,
    environment: productEnvironment,
    journeySteps: productJourneySteps,
    weight: productWeight,
  };

  return {
    result: {
      productHandle: product.productHandle,
      rowNumber: product.rowNumber,
      canCommit,
      action: productAction,
      rowStatus,
      errors: allErrors,
      stagingProductId,
    },
    normalized,
    raw: product.rawData,
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
