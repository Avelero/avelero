/**
 * Generate Error Report Background Job
 *
 * Trigger.dev task for generating error report Excel files for failed imports.
 *
 * Workflow:
 * 1. Load data from import_rows.normalized (contains raw data + errors)
 * 2. Generate Excel file with error highlighting (using bulk export template)
 * 3. Upload to Supabase storage
 * 4. Generate signed download URL (7 days expiry)
 * 5. Update import job with correction file info
 * 6. Send email notification if user email is available
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
import type { NormalizedRowData } from "@v1/db/queries/bulk";
import * as schema from "@v1/db/schema";
import ImportFailuresEmail from "@v1/email/emails/import-failures";
import { asc, eq } from "drizzle-orm";
import { type ErrorReportRow, generateErrorReportExcel } from "../../lib/excel";
import { getResend } from "../../utils/resend";

// ============================================================================
// Types
// ============================================================================

interface GenerateErrorReportPayload {
  jobId: string;
  brandId: string;
  userEmail: string | null;
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

      // 2. Load data from import_rows.normalized
      const importRowsData = await db
        .select({
          rowNumber: schema.importRows.rowNumber,
          raw: schema.importRows.raw,
          normalized: schema.importRows.normalized,
        })
        .from(schema.importRows)
        .where(eq(schema.importRows.jobId, jobId))
        .orderBy(asc(schema.importRows.rowNumber));

      logger.info("Loaded rows from import_rows", {
        count: importRowsData.length,
      });

      if (importRowsData.length === 0) {
        logger.warn("No rows found in import_rows", { jobId });
        return;
      }

      // 3. Process rows to extract error data
      // We expand each product's variants into separate Excel rows to preserve parent/child structure
      let blockedCount = 0;
      let warningsCount = 0;
      const excelRows: ErrorReportRow[] = [];

      for (const row of importRowsData) {
        const normalized = row.normalized as NormalizedRowData | null;
        if (!normalized) continue;

        // Check product-level status for counts
        if (normalized.rowStatus === "BLOCKED") {
          blockedCount++;
        } else if (normalized.rowStatus === "PENDING_WITH_WARNINGS") {
          warningsCount++;
        }

        // Collect product-level errors (apply to first variant / parent row)
        const productErrors = normalized.errors ?? [];

        // Expand each variant into its own Excel row
        for (
          let variantIdx = 0;
          variantIdx < (normalized.variants ?? []).length;
          variantIdx++
        ) {
          const variant = normalized.variants[variantIdx];
          if (!variant) continue;

          // First variant (parent row) gets product-level errors + its own errors
          // Child variants get only their own errors
          const isParentRow = variantIdx === 0;
          const variantErrors = variant.errors ?? [];
          const rowErrors = isParentRow
            ? [...productErrors, ...variantErrors]
            : variantErrors;

          // Use the variant's rawData (original Excel row data)
          const rawData = variant.rawData ?? {};

          // Include ALL variants when product has any errors
          // This gives users complete product context for corrections
          const productHasErrors =
            normalized.rowStatus === "BLOCKED" ||
            normalized.rowStatus === "PENDING_WITH_WARNINGS";

          if (productHasErrors) {
            excelRows.push({
              rowNumber: variant.rowNumber,
              raw: rawData,
              errors: rowErrors,
            });
          }
        }
      }

      logger.info("Processed rows with errors from normalized data", {
        blocked: blockedCount,
        warnings: warningsCount,
        rowsWithErrors: excelRows.length,
      });

      if (excelRows.length === 0) {
        logger.warn("No rows with errors found", { jobId });
        return;
      }

      // 4. Generate Excel file using consolidated excel utility
      const excelBuffer = await generateErrorReportExcel(excelRows);

      logger.info("Generated Excel file", {
        size: excelBuffer.length,
      });

      // 5. Upload to Supabase storage
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
          upsert: true,
        });

      if (uploadError) {
        throw new Error(
          `Failed to upload error report file: ${uploadError.message}`,
        );
      }

      // 6. Generate signed download URL (7 days expiry)
      const expiresIn = DOWNLOAD_EXPIRY_DAYS * 24 * 60 * 60;
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

      // 7. Update import job with correction file info
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

      // 8. Send email notification if user email is available
      if (userEmail) {
        try {
          const summary = job.summary as Record<string, number> | null;
          const totalProducts = summary?.totalProducts ?? 0;
          const issueProductCount = blockedCount + warningsCount;
          const successfulProductCount = totalProducts - issueProductCount;

          const html = await render(
            ImportFailuresEmail({
              issueProductCount,
              successfulProductCount: Math.max(0, successfulProductCount),
              downloadUrl,
              expiresAt,
              filename: job.filename,
            }),
          );

          const resend = getResend();
          const subject = `${issueProductCount} product${issueProductCount !== 1 ? "s" : ""} had issues during your import`;

          await resend.emails.send({
            from: EMAIL_FROM,
            to: [userEmail],
            subject,
            html,
          });

          logger.info("Error report notification email sent", {
            to: userEmail,
          });
        } catch (emailError) {
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
        issueProducts: blockedCount + warningsCount,
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
