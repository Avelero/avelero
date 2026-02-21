/**
 * Export Products Background Job
 *
 * Trigger.dev task for exporting products to Excel.
 *
 * Workflow:
 * 1. Resolve product IDs from selection + filters
 * 2. Batch-load complete product data
 * 3. Generate Excel file from template
 * 4. Upload to Supabase storage
 * 5. Generate signed download URL (7 days expiry)
 * 6. Send email notification
 *
 * @module export-products
 */

import "../configure-trigger";
import { render } from "@react-email/render";
import { createClient } from "@supabase/supabase-js";
import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import { updateExportJobStatus } from "@v1/db/queries/bulk";
import { publishNotificationEvent } from "@v1/db/queries/notifications";
import {
  type ListFilters,
  getProductsForExport,
  listProductIds,
} from "@v1/db/queries/products";
import ExportReadyEmail from "@v1/email/emails/export-ready";
import { generateProductExportExcel } from "../../lib/excel";
import { getResend } from "../../utils/resend";

// ============================================================================
// Types
// ============================================================================

interface ExportProductsPayload {
  jobId: string;
  brandId: string;
  userId: string;
  userEmail: string;
  selectionMode: "all" | "explicit";
  includeIds: string[];
  excludeIds: string[];
  filterState: unknown;
  searchQuery: string | null;
}

// ============================================================================
// Constants
// ============================================================================

/** Batch size for loading products */
const BATCH_SIZE = 100;

/** Download URL expiry in days */
const DOWNLOAD_EXPIRY_DAYS = 7;

/** Email from address */
const EMAIL_FROM = "Avelero <noreply@welcome.avelero.com>";

// ============================================================================
// Main Task
// ============================================================================

export const exportProducts = task({
  id: "export-products",
  maxDuration: 1800, // 30 minutes for large exports
  queue: { concurrencyLimit: 3 },
  retry: { maxAttempts: 2 },

  run: async (payload: ExportProductsPayload) => {
    const { jobId, brandId, userEmail, userId } = payload;

    logger.info("Starting product export", { jobId, brandId });

    const exportStartedAt = new Date().toISOString();

    // Helper to update progress via Trigger.dev metadata (native realtime)
    const updateProgress = (data: {
      status: "running" | "completed" | "failed";
      processed: number;
      total: number | null;
      downloadUrl?: string | null;
      errorMessage?: string | null;
    }) => {
      metadata.set("exportProgress", {
        ...data,
        startedAt: exportStartedAt,
        context: { exportJobId: jobId },
      });
    };

    try {
      // 1. Update job status to PROCESSING
      await updateExportJobStatus(db, {
        jobId,
        status: "PROCESSING",
      });

      // Initial progress update
      updateProgress({
        status: "running",
        processed: 0,
        total: null,
      });

      // 2. Resolve product IDs based on selection + filters
      let productIds: string[];

      if (payload.selectionMode === "explicit") {
        productIds = payload.includeIds;
      } else {
        // "all" mode - query all matching products, exclude specified IDs
        productIds = await listProductIds(
          db,
          brandId,
          {
            filterState: payload.filterState as ListFilters["filterState"],
            search: payload.searchQuery ?? undefined,
          },
          payload.excludeIds,
        );
      }

      logger.info("Resolved product IDs", {
        count: productIds.length,
        mode: payload.selectionMode,
      });

      // Update total count
      await updateExportJobStatus(db, {
        jobId,
        totalProducts: productIds.length,
      });

      // Update progress with total
      updateProgress({
        status: "running",
        processed: 0,
        total: productIds.length,
      });

      if (productIds.length === 0) {
        throw new Error("No products to export");
      }

      // 3. Batch-load complete product data
      const allProductData: Awaited<ReturnType<typeof getProductsForExport>> =
        [];
      let processed = 0;

      for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
        const batchIds = productIds.slice(i, i + BATCH_SIZE);
        const batchData = await getProductsForExport(db, brandId, batchIds);
        allProductData.push(...batchData);

        processed += batchIds.length;
        await updateExportJobStatus(db, {
          jobId,
          productsProcessed: processed,
        });

        // Update progress during batch loading
        updateProgress({
          status: "running",
          processed,
          total: productIds.length,
        });

        logger.info("Loaded product batch", {
          batch: Math.floor(i / BATCH_SIZE) + 1,
          processed,
          total: productIds.length,
        });
      }

      // 4. Generate Excel file
      logger.info("Generating Excel file", {
        productCount: allProductData.length,
      });
      const excelBuffer = await generateProductExportExcel(allProductData);

      // 5. Upload to Supabase storage
      const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      const timestamp = Date.now();
      const filename = `product-export-${timestamp}.xlsx`;
      const storagePath = `${brandId}/${jobId}/${filename}`;

      logger.info("Uploading to storage", { path: storagePath });

      const { error: uploadError } = await supabase.storage
        .from("product-exports")
        .upload(storagePath, excelBuffer, {
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload export file: ${uploadError.message}`);
      }

      // 6. Generate signed download URL (7 days expiry)
      const expiresIn = DOWNLOAD_EXPIRY_DAYS * 24 * 60 * 60; // seconds
      const { data: signedData, error: signedError } = await supabase.storage
        .from("product-exports")
        .createSignedUrl(storagePath, expiresIn);

      if (signedError || !signedData?.signedUrl) {
        throw new Error(
          `Failed to generate download URL: ${signedError?.message}`,
        );
      }

      const downloadUrl = signedData.signedUrl;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // 7. Update job with results
      await updateExportJobStatus(db, {
        jobId,
        status: "COMPLETED",
        filePath: storagePath,
        downloadUrl,
        expiresAt,
        finishedAt: new Date().toISOString(),
        summary: {
          productsExported: allProductData.length,
          fileSize: excelBuffer.length,
        },
      });

      // Update progress with completion and download URL
      updateProgress({
        status: "completed",
        processed: allProductData.length,
        total: allProductData.length,
        downloadUrl,
      });

      // 8. Send email notification
      logger.info("Sending notification email", { to: userEmail });

      try {
        const html = await render(
          ExportReadyEmail({
            productCount: allProductData.length,
            downloadUrl,
            expiresAt,
          }),
        );

        const resend = getResend();
        await resend.emails.send({
          from: EMAIL_FROM,
          to: [userEmail],
          subject: "Your product export is ready",
          html,
        });

        logger.info("Export notification email sent", { to: userEmail });
      } catch (emailError) {
        // Don't fail the job if email fails - file is still available
        logger.error("Failed to send export notification email", {
          error:
            emailError instanceof Error
              ? emailError.message
              : String(emailError),
        });
      }

      try {
        await publishNotificationEvent(db, {
          event: "export_ready",
          brandId,
          actorUserId: userId,
          payload: {
            jobId,
            productsExported: allProductData.length,
            downloadUrl,
            expiresAt,
            filename,
          },
        });
      } catch (notificationError) {
        logger.warn("Failed to publish export notification", {
          error:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
        });
      }

      logger.info("Product export completed", {
        jobId,
        productsExported: allProductData.length,
      });
    } catch (error) {
      logger.error("Product export failed", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      await updateExportJobStatus(db, {
        jobId,
        status: "FAILED",
        finishedAt: new Date().toISOString(),
        summary: {
          error: error instanceof Error ? error.message : String(error),
        },
      });

      // Update progress with failure
      updateProgress({
        status: "failed",
        processed: 0,
        total: null,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  },
});
