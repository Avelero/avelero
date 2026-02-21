/**
 * Export QR Codes Background Job
 *
 * Trigger.dev task for exporting GS1 QR code metadata to CSV.
 *
 * Workflow:
 * 1. Resolve selected products from persisted job selection
 * 2. Resolve eligible variants (non-ghost + non-empty barcode)
 * 3. Generate QR PNG per eligible variant
 * 4. Upload QR PNGs to public storage bucket
 * 5. Build CSV with GS1 links + PNG URLs
 * 6. Upload CSV to private bucket and sign download URL
 * 7. Update job state and trigger completion email task
 */

import "../configure-trigger";
import { createClient } from "@supabase/supabase-js";
import { logger, metadata, task, tasks } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import {
  getQrExportJobStatus,
  updateQrExportJobStatus,
} from "@v1/db/queries/bulk";
import {
  type ListFilters,
  getQrExportSelectionSummary,
  getQrExportVariantRows,
  resolveQrExportProductIds,
} from "@v1/db/queries/products";
import {
  type QrExportCsvRow,
  buildGs1DigitalLink,
  generateQrExportCsv,
  generateQrPng,
} from "../../lib/qr-export";

interface ExportQrCodesPayload {
  jobId: string;
  brandId: string;
}

interface FailedVariant {
  variantId: string;
  barcode: string;
  error: string;
}

const QR_IMAGES_BUCKET = "product-qr-codes";
const QR_EXPORTS_BUCKET = "qr-code-exports";
const DOWNLOAD_EXPIRY_DAYS = 7;

function createSupabaseServiceClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase service credentials are required for QR export");
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export const exportQrCodes = task({
  id: "export-qr-codes",
  maxDuration: 1800, // 30 minutes
  queue: { concurrencyLimit: 3 },
  retry: { maxAttempts: 2 },

  run: async (payload: ExportQrCodesPayload) => {
    const { jobId, brandId } = payload;
    const startedAt = new Date().toISOString();

    let terminalStatusWritten = false;
    let processed = 0;
    let totalEligible: number | null = null;

    const updateProgress = (data: {
      status: "running" | "completed" | "failed";
      processed: number;
      total: number | null;
      downloadUrl?: string | null;
      errorMessage?: string | null;
    }) => {
      metadata.set("qrExportProgress", {
        ...data,
        startedAt,
        context: { qrExportJobId: jobId },
      });
    };

    logger.info("Starting QR export", { jobId, brandId });

    try {
      const job = await getQrExportJobStatus(db, jobId);
      if (!job) {
        throw new Error(`QR export job not found: ${jobId}`);
      }

      if (job.brandId !== brandId) {
        throw new Error("QR export job brand mismatch");
      }

      const selectionMode =
        job.selectionMode === "explicit" ? "explicit" : "all";
      const includeIds = job.includeIds ?? [];
      const excludeIds = job.excludeIds ?? [];
      const customDomain = job.customDomain;

      await updateQrExportJobStatus(db, {
        jobId,
        status: "PROCESSING",
      });

      updateProgress({
        status: "running",
        processed: 0,
        total: null,
      });

      const productIds = await resolveQrExportProductIds(db, brandId, {
        selectionMode,
        includeIds,
        excludeIds,
        filterState:
          (job.filterState as ListFilters["filterState"] | null) ?? null,
        searchQuery: job.searchQuery ?? null,
      });

      const summary = await getQrExportSelectionSummary(
        db,
        brandId,
        productIds,
      );
      const variantRows = await getQrExportVariantRows(db, brandId, productIds);
      totalEligible = variantRows.length;

      await updateQrExportJobStatus(db, {
        jobId,
        totalProducts: summary.selectedProducts,
        totalVariants: summary.selectedVariants,
        eligibleVariants: totalEligible,
        variantsProcessed: 0,
      });

      updateProgress({
        status: "running",
        processed: 0,
        total: totalEligible,
      });

      if (totalEligible === 0) {
        throw new Error("No eligible variants found for QR export");
      }

      const supabase = createSupabaseServiceClient();
      const csvRows: QrExportCsvRow[] = [];
      const failedVariants: FailedVariant[] = [];

      for (const row of variantRows) {
        try {
          const gs1DigitalLinkUrl = buildGs1DigitalLink(
            customDomain,
            row.barcode,
          );
          const qrPngBuffer = await generateQrPng(gs1DigitalLinkUrl);

          const qrPngPath = `${brandId}/${jobId}/${row.variantId}.png`;
          const { error: uploadPngError } = await supabase.storage
            .from(QR_IMAGES_BUCKET)
            .upload(qrPngPath, qrPngBuffer, {
              contentType: "image/png",
              upsert: true,
            });

          if (uploadPngError) {
            throw new Error(uploadPngError.message);
          }

          const { data: publicData } = supabase.storage
            .from(QR_IMAGES_BUCKET)
            .getPublicUrl(qrPngPath);

          csvRows.push({
            productTitle: row.productTitle,
            variantUpid: row.variantUpid,
            barcode: row.barcode,
            gs1DigitalLinkUrl,
            qrPngUrl: publicData.publicUrl,
          });
        } catch (error) {
          failedVariants.push({
            variantId: row.variantId,
            barcode: row.barcode,
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          processed += 1;
          await updateQrExportJobStatus(db, {
            jobId,
            variantsProcessed: processed,
          });

          updateProgress({
            status: "running",
            processed,
            total: totalEligible,
          });
        }
      }

      if (csvRows.length === 0) {
        terminalStatusWritten = true;

        const errorMessage =
          "Failed to generate QR codes for all eligible variants";
        await updateQrExportJobStatus(db, {
          jobId,
          status: "FAILED",
          finishedAt: new Date().toISOString(),
          variantsProcessed: processed,
          summary: {
            error: errorMessage,
            selectedProducts: summary.selectedProducts,
            selectedVariants: summary.selectedVariants,
            eligibleVariants: totalEligible,
            successfulVariants: 0,
            failedVariantsCount: failedVariants.length,
            failedVariants,
          },
        });

        updateProgress({
          status: "failed",
          processed,
          total: totalEligible,
          errorMessage,
        });

        throw new Error(errorMessage);
      }

      const csv = generateQrExportCsv(csvRows);
      const csvFilename = `qr-code-export-${Date.now()}.csv`;
      const csvPath = `${brandId}/${jobId}/${csvFilename}`;

      const { error: uploadCsvError } = await supabase.storage
        .from(QR_EXPORTS_BUCKET)
        .upload(csvPath, Buffer.from(csv, "utf-8"), {
          contentType: "text/csv",
          upsert: false,
        });

      if (uploadCsvError) {
        throw new Error(`Failed to upload CSV: ${uploadCsvError.message}`);
      }

      const expiresIn = DOWNLOAD_EXPIRY_DAYS * 24 * 60 * 60;
      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage
          .from(QR_EXPORTS_BUCKET)
          .createSignedUrl(csvPath, expiresIn);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(
          `Failed to generate QR export download URL: ${signedUrlError?.message ?? "Unknown error"}`,
        );
      }

      const downloadUrl = signedUrlData.signedUrl;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      await updateQrExportJobStatus(db, {
        jobId,
        status: "COMPLETED",
        filePath: csvPath,
        downloadUrl,
        expiresAt,
        finishedAt: new Date().toISOString(),
        variantsProcessed: processed,
        summary: {
          selectedProducts: summary.selectedProducts,
          selectedVariants: summary.selectedVariants,
          eligibleVariants: totalEligible,
          successfulVariants: csvRows.length,
          failedVariantsCount: failedVariants.length,
          failedVariants,
          customDomain,
        },
      });
      terminalStatusWritten = true;

      updateProgress({
        status: "completed",
        processed,
        total: totalEligible,
        downloadUrl,
      });

      try {
        await tasks.trigger("send-qr-export-ready-email", {
          jobId,
          brandId,
          userEmail: job.userEmail,
          downloadUrl,
          expiresAt,
          exportedVariants: csvRows.length,
        });
      } catch (emailTriggerError) {
        logger.error("Failed to trigger QR export ready email task", {
          jobId,
          error:
            emailTriggerError instanceof Error
              ? emailTriggerError.message
              : String(emailTriggerError),
        });
      }

      logger.info("QR export completed", {
        jobId,
        selectedProducts: summary.selectedProducts,
        eligibleVariants: totalEligible,
        successfulVariants: csvRows.length,
        failedVariants: failedVariants.length,
      });
    } catch (error) {
      logger.error("QR export failed", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (!terminalStatusWritten) {
        await updateQrExportJobStatus(db, {
          jobId,
          status: "FAILED",
          finishedAt: new Date().toISOString(),
          variantsProcessed: processed,
          summary: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }

      updateProgress({
        status: "failed",
        processed,
        total: totalEligible,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  },
});
