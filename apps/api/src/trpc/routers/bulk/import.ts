import { tasks } from "@trigger.dev/sdk/v3";
/**
 * Bulk import lifecycle router.
 *
 * Handles the fire-and-forget import workflow:
 * - preview: Parse Excel file and return summary + first product preview
 * - start: Create job and trigger background processing
 * - status: Get real-time job progress
 * - getRecentImports: Get recent import jobs for the brand
 * - dismiss: Clean up staging data for failed imports
 * - exportCorrections: Generate Excel file with failed rows for correction
 */
import {
  createImportJob,
  deleteStagingDataForJob,
  getImportJobStatus,
  getRecentImportJobs,
  updateImportJobStatus,
} from "@v1/db/queries/bulk";
import { parseExcelFile } from "@v1/jobs/lib/excel-parser";

import {
  dismissFailedImportSchema,
  exportCorrectionsSchema,
  getImportStatusSchema,
  getRecentImportsSchema,
  previewImportSchema,
  startImportSchema,
} from "../../../schemas/bulk.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };

function ensureBrand(
  ctx: AuthenticatedTRPCContext,
): asserts ctx is BrandContext {
  if (!ctx.brandId) {
    throw badRequest("Active brand context required");
  }
}

function assertBrandScope(
  ctx: AuthenticatedTRPCContext,
  requestedBrandId?: string | null,
): string {
  ensureBrand(ctx);
  const activeBrandId = ctx.brandId;
  if (requestedBrandId && requestedBrandId !== activeBrandId) {
    throw badRequest("Active brand does not match the requested brand_id");
  }
  return activeBrandId;
}

interface ResolvedImportFilePath {
  path: string;
  filename: string;
}

/**
 * Validates and resolves the import file path.
 * 
 * Expected format: brandId/timestamp-filename
 * Example: ac262c8a-c742-4fa9-91f7-31d0833129ae/1768059882771-template.xlsx
 */
function resolveImportFilePath(params: {
  fileId: string;
  brandId: string;
  filename: string;
}): ResolvedImportFilePath {
  const sanitizedPath = params.fileId.replace(/^\/+|\/+$/g, "");
  const segments = sanitizedPath.split("/");

  // Expect at least 2 segments: brandId and filename
  if (segments.length < 2) {
    throw badRequest(
      `Invalid file reference provided. Expected format: brandId/filename, got: ${sanitizedPath}`,
    );
  }

  const [pathBrandId, ...fileSegments] = segments;

  if (pathBrandId !== params.brandId) {
    throw badRequest(
      `File does not belong to the active brand context. Expected: ${params.brandId}, got: ${pathBrandId}`,
    );
  }

  if (fileSegments.length === 0) {
    throw badRequest("Incomplete file reference provided - missing filename");
  }

  const resolvedFilename = fileSegments.join("/");

  // The uploaded filename includes a timestamp prefix, 
  // so we check if it ends with the original filename
  if (!resolvedFilename.endsWith(params.filename)) {
    throw badRequest(
      `Filename does not match the provided file reference. Expected to end with: ${params.filename}, got: ${resolvedFilename}`,
    );
  }

  return {
    path: sanitizedPath,
    filename: resolvedFilename,
  };
}

function calculatePercentage(processed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((processed / total) * 100);
}

export const importRouter = createTRPCRouter({
  /**
   * Preview import file contents
   *
   * Parses the uploaded Excel file and returns:
   * - Summary statistics (product count, variant count, image count)
   * - First product preview data (title, handle, manufacturer, description, status, category)
   * - First product's variants preview (title, SKU, barcode)
   *
   * Used in the confirmation step of the import modal.
   */
  preview: brandRequiredProcedure
    .input(previewImportSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // Validate file path belongs to brand
        const sanitizedPath = input.fileId.replace(/^\/+|\/+$/g, "");
        const segments = sanitizedPath.split("/");

        if (segments.length < 2) {
          throw badRequest("Invalid file reference");
        }

        const [pathBrandId] = segments;
        if (pathBrandId !== brandId) {
          throw badRequest("File does not belong to the active brand");
        }

        // Download and parse the Excel file
        const fileBuffer = await downloadFileFromSupabase(sanitizedPath);
        const parseResult = await parseExcelFile(fileBuffer);

        if (parseResult.errors.length > 0) {
          throw badRequest(
            `Excel parsing failed: ${parseResult.errors[0]?.message}`,
          );
        }

        const products = parseResult.products;
        if (products.length === 0) {
          throw badRequest("No products found in the Excel file");
        }

        // Calculate summary statistics
        const totalProducts = products.length;
        const totalVariants = products.reduce(
          (acc, p) => acc + p.variants.length,
          0,
        );
        const totalImages = products.filter((p) => p.imagePath).length;

        // Get the first product for preview
        // Safe non-null assertion: we already checked products.length > 0 above
        const firstProduct = products[0]!;

        // Build variant titles from attributes (like variants-overview.tsx does)
        const variantPreviews = firstProduct.variants.map((variant, index) => {
          // Build variant title from attributes
          const attributeValues = variant.attributes
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((attr) => attr.value);

          const title =
            attributeValues.length > 0
              ? attributeValues.join(" / ")
              : `Variant ${index + 1}`;

          return {
            title,
            sku: variant.sku || "",
            barcode: variant.barcode || "",
          };
        });

        return {
          summary: {
            totalProducts,
            totalVariants,
            totalImages,
          },
          firstProduct: {
            title: firstProduct.name || "",
            handle: firstProduct.productHandle || "",
            manufacturer: firstProduct.manufacturerName || "",
            description: firstProduct.description || "",
            status: "Draft", // Default status for new products
            category: firstProduct.categoryPath || "",
          },
          variants: variantPreviews,
        };
      } catch (error) {
        throw wrapError(error, "Failed to preview import file");
      }
    }),

  /**
   * Start async import job (Phase 1 - Validation & Staging)
   *
   * Creates import job record and triggers background validation task.
   * Returns immediately with job_id for progress tracking.
   *
   * Flow:
   * 1. Create import_jobs record (status: PENDING)
   * 2. Validate the uploaded file path belongs to the active brand
   * 3. Trigger validate-and-stage background job
   * 4. Return job_id immediately
   */
  start: brandRequiredProcedure
    .input(startImportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      const resolvedFile = resolveImportFilePath({
        fileId: input.fileId,
        brandId,
        filename: input.filename,
      });

      try {
        // Create import job record with mode
        const job = await createImportJob(brandCtx.db, {
          brandId,
          filename: input.filename,
          status: "PENDING",
          mode: input.mode,
        });

        try {
          const runHandle = await tasks.trigger("validate-and-stage", {
            jobId: job.id,
            brandId,
            filePath: resolvedFile.path,
            mode: input.mode,
          });
        } catch (triggerError) {
          // Update job status to FAILED immediately
          await updateImportJobStatus(brandCtx.db, {
            jobId: job.id,
            status: "FAILED",
            summary: {
              error: `Failed to start background job: ${triggerError instanceof Error ? triggerError.message : String(triggerError)}`,
            },
          });

          throw new Error(
            `Failed to start background import job. Please ensure Trigger.dev dev server is running. Error: ${triggerError instanceof Error
              ? triggerError.message
              : String(triggerError)
            }`,
          );
        }

        return {
          jobId: job.id,
          status: job.status,
          createdAt: job.startedAt,
        };
      } catch (error) {
        throw wrapError(error, "Failed to start import job");
      }
    }),

  /**
   * Get import job status
   *
   * Query current status and progress of an import job.
   * Used for polling or to display status on import dashboard.
   */
  status: brandRequiredProcedure
    .input(getImportStatusSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        // Verify brand ownership
        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Extract progress from summary
        const summary = job.summary as Record<string, unknown> | null;
        const progress = {
          phase:
            job.status === "VALIDATING" || job.status === "VALIDATED"
              ? "validation"
              : "commit",
          total: (summary?.total as number) ?? 0,
          processed: (summary?.processed as number) ?? 0,
          created: (summary?.created as number) ?? 0,
          updated: (summary?.updated as number) ?? 0,
          failed: (summary?.failed as number) ?? 0,
          percentage: calculatePercentage(
            (summary?.processed as number) ?? 0,
            (summary?.total as number) ?? 0,
          ),
        };

        return {
          jobId: job.id,
          filename: job.filename,
          status: job.status,
          startedAt: job.startedAt,
          finishedAt: job.finishedAt,
          progress,
          summary: job.summary,
        };
      } catch (error) {
        throw wrapError(error, "Failed to get import status");
      }
    }),

  /**
   * Get recent import jobs
   *
   * Returns the most recent import jobs for the active brand.
   * Used to display import history in the import modal.
   */
  getRecentImports: brandRequiredProcedure
    .input(getRecentImportsSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        const jobs = await getRecentImportJobs(brandCtx.db, brandId, input.limit);

        return {
          jobs: jobs.map((job) => ({
            id: job.id,
            filename: job.filename,
            mode: job.mode,
            status: job.status,
            startedAt: job.startedAt,
            finishedAt: job.finishedAt,
            hasExportableFailures: job.hasExportableFailures,
            summary: job.summary,
          })),
        };
      } catch (error) {
        throw wrapError(error, "Failed to get recent imports");
      }
    }),

  /**
   * Dismiss a failed import
   *
   * Cleans up staging data for a failed import and removes it
   * from the actionable imports list. Use this when the user
   * doesn't want to fix and re-import the failed rows.
   */
  dismiss: brandRequiredProcedure
    .input(dismissFailedImportSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // Verify job ownership
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Only allow dismissing jobs with failures or failed jobs
        const dismissableStatuses = ["COMPLETED_WITH_FAILURES", "FAILED"];
        if (!dismissableStatuses.includes(job.status)) {
          throw badRequest(
            `Cannot dismiss job with status ${job.status}. Only jobs with failures can be dismissed.`,
          );
        }

        // Delete staging data for this job
        await deleteStagingDataForJob(brandCtx.db, input.jobId);

        // Update job to mark as dismissed (clear the exportable failures flag)
        await updateImportJobStatus(brandCtx.db, {
          jobId: input.jobId,
          status: job.status, // Keep the same status
          summary: {
            ...(job.summary ?? {}),
            dismissed: true,
            dismissedAt: new Date().toISOString(),
          },
        });

        return {
          jobId: input.jobId,
          success: true,
          message: "Import dismissed - staging data cleaned up",
        };
      } catch (error) {
        throw wrapError(error, "Failed to dismiss import");
      }
    }),

  /**
   * Export corrections Excel file
   *
   * Generates an Excel file containing failed rows with error cells
   * highlighted in red. Users can correct the data and re-import.
   *
   * Note: The actual Excel generation is handled by a background job.
   * This endpoint triggers the generation and returns a download URL.
   */
  exportCorrections: brandRequiredProcedure
    .input(exportCorrectionsSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      const brandId = brandCtx.brandId;

      try {
        // Verify job ownership
        const job = await getImportJobStatus(brandCtx.db, input.jobId);

        if (!job) {
          throw badRequest("Import job not found");
        }

        if (job.brandId !== brandId) {
          throw badRequest("Access denied: job belongs to different brand");
        }

        // Check that job has exportable failures
        if (!job.hasExportableFailures) {
          throw badRequest(
            "No failed rows to export. This job completed successfully or has no exportable failures.",
          );
        }

        // TODO: Phase 3 will implement the actual Excel generation
        // For now, return a placeholder indicating the feature is not yet implemented
        return {
          jobId: input.jobId,
          status: "pending" as const,
          message: "Excel export will be implemented in Phase 3",
          downloadUrl: null,
        };
      } catch (error) {
        throw wrapError(error, "Failed to export corrections");
      }
    }),
});

export type ImportRouter = typeof importRouter;

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
