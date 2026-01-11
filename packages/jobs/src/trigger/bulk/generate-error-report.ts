/**
 * Generate Error Report Background Job
 *
 * Trigger.dev task for generating error report Excel files for failed imports.
 *
 * Workflow:
 * 1. Load failed staging products with their errors
 * 2. Load raw data from import_rows for those products
 * 3. Generate Excel file with error highlighting
 * 4. Upload to Supabase storage
 * 5. Generate signed download URL (7 days expiry)
 * 6. Update import job with correction file info
 * 7. Send email notification if user email is available
 *
 * @module generate-error-report
 */

import "../configure-trigger";
import { render } from "@react-email/render";
import { createClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import {
  getImportJobStatus,
  updateImportJobCorrectionFile,
} from "@v1/db/queries/bulk";
import * as schema from "@v1/db/schema";
import ImportFailuresEmail from "@v1/email/emails/import-failures";
import { and, asc, eq } from "drizzle-orm";
import {
  DEFAULT_IMPORT_COLUMN_ORDER,
  type ExportRow,
  generateCorrectionExcel,
} from "../../lib/excel-export";
import { getResend } from "../../utils/resend";

// ============================================================================
// Types
// ============================================================================

interface GenerateErrorReportPayload {
  jobId: string;
  brandId: string;
  userEmail: string | null;
}

interface FailedProductRow {
  rowNumber: number;
  errors: Array<{ field: string; message: string }>;
  rawData: Record<string, string>;
}

// ============================================================================
// Constants
// ============================================================================

/** Download URL expiry in days */
const DOWNLOAD_EXPIRY_DAYS = 7;

/** Email from address */
const EMAIL_FROM = "Avelero <noreply@welcome.avelero.com>";

/** Storage bucket for correction files */
const STORAGE_BUCKET = "product-imports";

// ============================================================================
// Main Task
// ============================================================================

export const generateErrorReport = task({
  id: "generate-error-report",
  maxDuration: 300, // 5 minutes
  queue: { concurrencyLimit: 5 },
  retry: { maxAttempts: 2 },

  run: async (payload: GenerateErrorReportPayload) => {
    const { jobId, brandId, userEmail } = payload;

    logger.info("Starting error report generation", { jobId, brandId });

    try {
      // 1. Get job info to verify it has exportable failures
      const job = await getImportJobStatus(db, jobId);

      if (!job) {
        throw new Error(`Import job not found: ${jobId}`);
      }

      if (!job.hasExportableFailures) {
        logger.warn("Job has no exportable failures", { jobId });
        return;
      }

      // 2. Load failed staging products with their errors
      const failedProducts = await db
        .select({
          rowNumber: schema.stagingProducts.rowNumber,
          errors: schema.stagingProducts.errors,
        })
        .from(schema.stagingProducts)
        .where(
          and(
            eq(schema.stagingProducts.jobId, jobId),
            eq(schema.stagingProducts.rowStatus, "FAILED"),
          ),
        )
        .orderBy(asc(schema.stagingProducts.rowNumber));

      logger.info("Loaded failed staging products", {
        count: failedProducts.length,
      });

      if (failedProducts.length === 0) {
        logger.warn("No failed products found in staging", { jobId });
        return;
      }

      // 3. Load raw data from import_rows for the failed row numbers
      const failedRowNumbers = failedProducts.map((p) => p.rowNumber);
      const rawRows = await db
        .select({
          rowNumber: schema.importRows.rowNumber,
          raw: schema.importRows.raw,
        })
        .from(schema.importRows)
        .where(eq(schema.importRows.jobId, jobId))
        .orderBy(asc(schema.importRows.rowNumber));

      // Create a map of rowNumber -> raw data
      const rawDataByRow = new Map<number, Record<string, unknown>>();
      for (const row of rawRows) {
        rawDataByRow.set(row.rowNumber, row.raw as Record<string, unknown>);
      }

      // 4. Build ExportRow array for Excel generation
      const exportRows: ExportRow[] = failedProducts
        .filter((p) => rawDataByRow.has(p.rowNumber))
        .map((p) => {
          const rawData = rawDataByRow.get(p.rowNumber) ?? {};
          // Convert raw data values to strings for the Excel export
          const data: Record<string, string> = {};
          for (const [key, value] of Object.entries(rawData)) {
            data[key] = value != null ? String(value) : "";
          }

          return {
            rowNumber: p.rowNumber,
            data,
            errors: p.errors ?? [],
          };
        });

      logger.info("Prepared export rows", {
        count: exportRows.length,
        sampleErrors: exportRows[0]?.errors.slice(0, 3),
      });

      // 5. Generate Excel file with error highlighting
      const excelBuffer = await generateCorrectionExcel(exportRows, {
        columnOrder: DEFAULT_IMPORT_COLUMN_ORDER,
        worksheetName: "Failed Products",
      });

      logger.info("Generated Excel file", {
        size: excelBuffer.length,
      });

      // 6. Upload to Supabase storage
      const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      const timestamp = Date.now();
      const filename = `error-report-${timestamp}.xlsx`;
      const storagePath = `${brandId}/${jobId}/corrections/${filename}`;

      logger.info("Uploading to storage", { path: storagePath });

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, excelBuffer, {
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          upsert: true, // Allow overwriting if regenerated
        });

      if (uploadError) {
        throw new Error(
          `Failed to upload error report file: ${uploadError.message}`,
        );
      }

      // 7. Generate signed download URL (7 days expiry)
      const expiresIn = DOWNLOAD_EXPIRY_DAYS * 24 * 60 * 60; // seconds
      const { data: signedData, error: signedError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(storagePath, expiresIn);

      if (signedError || !signedData?.signedUrl) {
        throw new Error(
          `Failed to generate download URL: ${signedError?.message}`,
        );
      }

      const downloadUrl = signedData.signedUrl;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      // 8. Update import job with correction file info
      await updateImportJobCorrectionFile(db, {
        jobId,
        correctionFilePath: storagePath,
        correctionDownloadUrl: downloadUrl,
        correctionExpiresAt: expiresAt,
      });

      logger.info("Updated job with correction file info", {
        jobId,
        downloadUrl: `${downloadUrl.substring(0, 50)}...`,
      });

      // 9. Send email notification if user email is available
      if (userEmail) {
        try {
          // Get success count from job summary
          const summary = job.summary as Record<string, number> | null;
          const successfulProductCount =
            summary?.committed ?? summary?.totalProducts ?? 0;
          const failedProductCount = exportRows.length;

          const html = await render(
            ImportFailuresEmail({
              failedProductCount,
              successfulProductCount,
              downloadUrl,
              expiresAt,
              filename: job.filename,
            }),
          );

          const resend = getResend();
          await resend.emails.send({
            from: EMAIL_FROM,
            to: [userEmail],
            subject: `${failedProductCount} products failed during your import`,
            html,
          });

          logger.info("Error report notification email sent", {
            to: userEmail,
          });
        } catch (emailError) {
          // Don't fail the job if email fails - file is still available
          logger.error("Failed to send error report notification email", {
            error:
              emailError instanceof Error
                ? emailError.message
                : String(emailError),
          });
        }
      } else {
        logger.info("No user email provided, skipping notification", { jobId });
      }

      logger.info("Error report generation completed", {
        jobId,
        failedProducts: exportRows.length,
        storagePath,
      });
    } catch (error) {
      logger.error("Error report generation failed", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  },
});
