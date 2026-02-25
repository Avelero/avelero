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
 * 7. Update job state and dispatch completion notifications
 */

import "../configure-trigger";
import { render } from "@react-email/render";
import { createClient } from "@supabase/supabase-js";
import { logger, metadata, task } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import {
  getQrExportJobStatus,
  updateQrExportJobStatus,
} from "@v1/db/queries/bulk";
import { publishNotificationEvent } from "@v1/db/queries/notifications";
import {
  type ListFilters,
  getQrExportSelectionSummary,
  getQrExportVariantRows,
  resolveQrExportProductIds,
} from "@v1/db/queries/products";
import QrExportReadyEmail from "@v1/email/emails/qr-export-ready";
import {
  type GenerateQrPngOptions,
  type QrExportCsvRow,
  type QrImageQuality,
  buildGs1DigitalLink,
  buildQrPngCacheFilename,
  generateQrExportCsv,
  getQrWidthForQuality,
} from "../../lib/qr-export";
import { createQrPngGenerator } from "../../lib/qr-worker-pool";
import { getResend } from "../../utils/resend";

interface ExportQrCodesPayload {
  jobId: string;
  brandId: string;
}

interface FailedVariant {
  variantId: string;
  barcode: string;
  error: string;
}

interface QrExportTimingSummary {
  resolveSelectionMs: number;
  selectionSummaryMs: number;
  eligibleVariantQueryMs: number;
  cacheIndexLoadMs: number;
  variantProcessingMs: number;
  csvGenerationMs: number;
  csvUploadMs: number;
  signedUrlMs: number;
  emailNotificationMs: number;
  realtimeNotificationMs: number;
  totalMs: number;
}

type TimedMetric = Exclude<keyof QrExportTimingSummary, "totalMs">;

const QR_IMAGES_BUCKET = "product-qr-codes";
const QR_EXPORTS_BUCKET = "qr-code-exports";
const QR_CACHE_NAMESPACE = "00000000-0000-0000-0000-000000000000";
const QR_VARIANT_WORKER_CONCURRENCY = 20;
const PROGRESS_DB_UPDATE_BATCH_SIZE = 100;
const PROGRESS_UPDATE_INTERVAL_MS = 1000;
const MAX_CONSECUTIVE_PROGRESS_FLUSH_FAILURES = 3;
const QR_GENERATION_MAX_THREADS = 6;
const DOWNLOAD_EXPIRY_DAYS = 7;
const EMAIL_FROM = "Avelero <noreply@welcome.avelero.com>";

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

type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

function resolveQrImageQuality(): QrImageQuality {
  const configuredQuality = process.env.QR_EXPORT_IMAGE_QUALITY?.toLowerCase();
  return configuredQuality === "print" ? "print" : "standard";
}

function getQrCachePath(
  brandId: string,
  domain: string,
  barcode: string,
  options: GenerateQrPngOptions,
): string {
  const filename = buildQrPngCacheFilename(domain, barcode, options);
  return `${brandId}/${QR_CACHE_NAMESPACE}/${filename}`;
}

async function listExistingQrCachePaths(
  supabase: SupabaseServiceClient,
  brandId: string,
): Promise<Set<string>> {
  const prefix = `${brandId}/${QR_CACHE_NAMESPACE}`;
  const existingPaths = new Set<string>();
  const PAGE_SIZE = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage
      .from(QR_IMAGES_BUCKET)
      .list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      logger.warn(
        "Failed to pre-load QR cache index; continuing without index",
        {
          brandId,
          error: error.message,
        },
      );
      return new Set<string>();
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const entry of data) {
      if (entry.name) {
        existingPaths.add(`${prefix}/${entry.name}`);
      }
    }

    if (data.length < PAGE_SIZE) {
      break;
    }

    offset += PAGE_SIZE;
  }

  return existingPaths;
}

export const exportQrCodes = task({
  id: "export-qr-codes",
  maxDuration: 1800, // 30 minutes
  queue: { concurrencyLimit: 3 },
  retry: { maxAttempts: 2 },

  run: async (payload: ExportQrCodesPayload) => {
    const { jobId, brandId } = payload;
    const startedAt = new Date().toISOString();
    const runStartMs = Date.now();

    let terminalStatusWritten = false;
    let processed = 0;
    let totalEligible: number | null = null;
    const timings: QrExportTimingSummary = {
      resolveSelectionMs: 0,
      selectionSummaryMs: 0,
      eligibleVariantQueryMs: 0,
      cacheIndexLoadMs: 0,
      variantProcessingMs: 0,
      csvGenerationMs: 0,
      csvUploadMs: 0,
      signedUrlMs: 0,
      emailNotificationMs: 0,
      realtimeNotificationMs: 0,
      totalMs: 0,
    };

    const withTiming = async <T>(
      metric: TimedMetric,
      operation: () => Promise<T>,
    ): Promise<T> => {
      const phaseStart = Date.now();
      try {
        return await operation();
      } finally {
        timings[metric] += Date.now() - phaseStart;
      }
    };

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

      const productIds = await withTiming("resolveSelectionMs", () =>
        resolveQrExportProductIds(db, brandId, {
          selectionMode,
          includeIds,
          excludeIds,
          filterState:
            (job.filterState as ListFilters["filterState"] | null) ?? null,
          searchQuery: job.searchQuery ?? null,
        }),
      );

      const summary = await withTiming("selectionSummaryMs", () =>
        getQrExportSelectionSummary(db, brandId, productIds),
      );
      const variantRows = await withTiming("eligibleVariantQueryMs", () =>
        getQrExportVariantRows(db, brandId, productIds),
      );
      const eligibleVariantCount = variantRows.length;
      totalEligible = eligibleVariantCount;

      await updateQrExportJobStatus(db, {
        jobId,
        totalProducts: summary.selectedProducts,
        totalVariants: summary.selectedVariants,
        eligibleVariants: eligibleVariantCount,
        variantsProcessed: 0,
      });

      updateProgress({
        status: "running",
        processed: 0,
        total: eligibleVariantCount,
      });

      if (eligibleVariantCount === 0) {
        throw new Error("No eligible variants found for QR export");
      }

      const supabase = createSupabaseServiceClient();
      const qrImageQuality = resolveQrImageQuality();
      const qrPngOptions: GenerateQrPngOptions = {
        width: getQrWidthForQuality(qrImageQuality),
      };
      const existingQrPaths = await withTiming("cacheIndexLoadMs", () =>
        listExistingQrCachePaths(supabase, brandId),
      );
      const configuredWorkerThreads = Number.parseInt(
        process.env.QR_EXPORT_MAX_THREADS ?? "",
        10,
      );
      const qrPngGenerator = await createQrPngGenerator(
        Number.isFinite(configuredWorkerThreads)
          ? configuredWorkerThreads
          : QR_GENERATION_MAX_THREADS,
      );
      const csvRowsByIndex = new Array<QrExportCsvRow | null>(
        eligibleVariantCount,
      ).fill(null);
      const failedVariants: FailedVariant[] = [];
      const qrGenerationByPath = new Map<
        string,
        Promise<"generated" | "cached">
      >();
      let cacheHitCount = 0;
      let generatedQrCount = 0;
      let persistedProcessed = 0;
      let lastProgressUpdateAt = Date.now();
      let progressFlushInFlight: Promise<void> | null = null;
      let consecutiveProgressFlushFailures = 0;
      let progressFlushFailure: Error | null = null;

      const flushProgress = async (force: boolean): Promise<void> => {
        const now = Date.now();
        const reachedCountBatch =
          processed - persistedProcessed >= PROGRESS_DB_UPDATE_BATCH_SIZE;
        const reachedInterval =
          now - lastProgressUpdateAt >= PROGRESS_UPDATE_INTERVAL_MS;

        if (!force && !reachedCountBatch && !reachedInterval) {
          return;
        }

        if (processed !== persistedProcessed) {
          await updateQrExportJobStatus(db, {
            jobId,
            variantsProcessed: processed,
          });
          persistedProcessed = processed;
        }

        updateProgress({
          status: "running",
          processed,
          total: eligibleVariantCount,
        });

        lastProgressUpdateAt = now;
      };

      const maybeFlushProgress = async (force = false): Promise<void> => {
        if (progressFlushFailure) {
          throw progressFlushFailure;
        }

        if (progressFlushInFlight) {
          if (!force) {
            return;
          }
          await progressFlushInFlight;
        }

        progressFlushInFlight = flushProgress(force).finally(() => {
          progressFlushInFlight = null;
        });
        try {
          await progressFlushInFlight;
          consecutiveProgressFlushFailures = 0;
        } catch (error) {
          const flushError =
            error instanceof Error ? error : new Error(String(error));
          consecutiveProgressFlushFailures += 1;

          if (
            consecutiveProgressFlushFailures >=
            MAX_CONSECUTIVE_PROGRESS_FLUSH_FAILURES
          ) {
            progressFlushFailure = new Error(
              `Failed to flush QR export progress ${consecutiveProgressFlushFailures} times consecutively: ${flushError.message}`,
            );
            throw progressFlushFailure;
          }

          throw flushError;
        }
      };

      const ensureCachedQrPng = async (
        gs1DigitalLinkUrl: string,
        qrPngPath: string,
      ): Promise<"generated" | "cached"> => {
        if (existingQrPaths.has(qrPngPath)) {
          return "cached";
        }

        const inFlight = qrGenerationByPath.get(qrPngPath);
        if (inFlight) {
          return inFlight;
        }

        const generationPromise = (async (): Promise<
          "generated" | "cached"
        > => {
          const qrPngBuffer = await qrPngGenerator.generate(
            gs1DigitalLinkUrl,
            qrPngOptions,
          );
          const { error: uploadPngError } = await supabase.storage
            .from(QR_IMAGES_BUCKET)
            .upload(qrPngPath, qrPngBuffer, {
              contentType: "image/png",
              upsert: true,
            });

          if (uploadPngError) {
            throw new Error(uploadPngError.message);
          }

          existingQrPaths.add(qrPngPath);
          return "generated";
        })();

        qrGenerationByPath.set(qrPngPath, generationPromise);

        try {
          return await generationPromise;
        } finally {
          qrGenerationByPath.delete(qrPngPath);
        }
      };

      const workerCount = Math.min(
        QR_VARIANT_WORKER_CONCURRENCY,
        eligibleVariantCount,
      );
      const processingStart = Date.now();
      try {
        let nextIndex = 0;
        const workers = Array.from({ length: workerCount }, async () => {
          while (true) {
            if (progressFlushFailure) {
              throw progressFlushFailure;
            }

            const index = nextIndex;
            if (index >= eligibleVariantCount) {
              return;
            }
            nextIndex += 1;

            const row = variantRows[index]!;

            try {
              const gs1DigitalLinkUrl = buildGs1DigitalLink(
                customDomain,
                row.barcode,
              );
              const qrPngPath = getQrCachePath(
                brandId,
                customDomain,
                row.barcode,
                qrPngOptions,
              );
              const cacheResult = await ensureCachedQrPng(
                gs1DigitalLinkUrl,
                qrPngPath,
              );
              if (cacheResult === "generated") {
                generatedQrCount += 1;
              } else {
                cacheHitCount += 1;
              }

              const { data: publicData } = supabase.storage
                .from(QR_IMAGES_BUCKET)
                .getPublicUrl(qrPngPath);

              csvRowsByIndex[index] = {
                productTitle: row.productTitle,
                variantUpid: row.variantUpid,
                barcode: row.barcode,
                gs1DigitalLinkUrl,
                qrPngUrl: publicData.publicUrl,
              };
            } catch (error) {
              failedVariants.push({
                variantId: row.variantId,
                barcode: row.barcode,
                error: error instanceof Error ? error.message : String(error),
              });
            } finally {
              processed += 1;
              void maybeFlushProgress(false).catch((flushError) => {
                logger.warn("Failed to flush QR export progress", {
                  jobId,
                  consecutiveFailures: consecutiveProgressFlushFailures,
                  error:
                    flushError instanceof Error
                      ? flushError.message
                      : String(flushError),
                });
              });
            }
          }
        });

        await Promise.all(workers);
        await maybeFlushProgress(true);
      } finally {
        timings.variantProcessingMs += Date.now() - processingStart;
        await qrPngGenerator.dispose();
      }

      const csvRows = csvRowsByIndex.filter(
        (row): row is QrExportCsvRow => row !== null,
      );

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

      const csv = await withTiming("csvGenerationMs", async () =>
        generateQrExportCsv(csvRows),
      );
      const csvFilename = `qr-code-export-${Date.now()}.csv`;
      const csvPath = `${brandId}/${jobId}/${csvFilename}`;

      const { error: uploadCsvError } = await withTiming("csvUploadMs", () =>
        supabase.storage
          .from(QR_EXPORTS_BUCKET)
          .upload(csvPath, Buffer.from(csv, "utf-8"), {
            contentType: "text/csv",
            upsert: false,
          }),
      );

      if (uploadCsvError) {
        throw new Error(`Failed to upload CSV: ${uploadCsvError.message}`);
      }

      const expiresIn = DOWNLOAD_EXPIRY_DAYS * 24 * 60 * 60;
      const { data: signedUrlData, error: signedUrlError } = await withTiming(
        "signedUrlMs",
        () =>
          supabase.storage
            .from(QR_EXPORTS_BUCKET)
            .createSignedUrl(csvPath, expiresIn),
      );

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error(
          `Failed to generate QR export download URL: ${signedUrlError?.message ?? "Unknown error"}`,
        );
      }

      const downloadUrl = signedUrlData.signedUrl;
      const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

      const throughputVariantsPerSecond =
        timings.variantProcessingMs > 0
          ? Number(
              (processed / (timings.variantProcessingMs / 1000)).toFixed(2),
            )
          : null;
      timings.totalMs = Date.now() - runStartMs;

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
          qrImageQuality,
          qrWidth: qrPngOptions.width,
          generatedQrCount,
          cacheHitCount,
          qrGenerationMode: qrPngGenerator.mode,
          qrGenerationThreads: qrPngGenerator.workerCount,
          variantWorkerConcurrency: workerCount,
          throughputVariantsPerSecond,
          timingsMs: timings,
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
        const emailStart = Date.now();
        const html = await render(
          QrExportReadyEmail({
            exportedVariants: csvRows.length,
            downloadUrl,
            expiresAt,
          }),
        );

        const resend = getResend();
        await resend.emails.send({
          from: EMAIL_FROM,
          to: [job.userEmail],
          subject: "Your QR code export is ready",
          html,
        });
        timings.emailNotificationMs += Date.now() - emailStart;
      } catch (emailError) {
        timings.emailNotificationMs += 0;
        logger.error("Failed to send QR export ready email", {
          jobId,
          error:
            emailError instanceof Error
              ? emailError.message
              : String(emailError),
        });
      }

      try {
        const notificationStart = Date.now();
        await publishNotificationEvent(db, {
          event: "qr_export_ready",
          brandId,
          actorUserId: job.userId,
          payload: {
            jobId,
            exportedVariants: csvRows.length,
            downloadUrl,
            expiresAt,
            filename: csvFilename,
          },
        });
        timings.realtimeNotificationMs += Date.now() - notificationStart;
      } catch (notificationError) {
        logger.warn("Failed to publish QR export notification", {
          jobId,
          error:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
        });
      }

      logger.info("QR export completed", {
        jobId,
        selectedProducts: summary.selectedProducts,
        eligibleVariants: totalEligible,
        successfulVariants: csvRows.length,
        failedVariants: failedVariants.length,
        qrImageQuality,
        qrWidth: qrPngOptions.width,
        generatedQrCount,
        cacheHitCount,
        qrGenerationMode: qrPngGenerator.mode,
        qrGenerationThreads: qrPngGenerator.workerCount,
        variantWorkerConcurrency: workerCount,
        throughputVariantsPerSecond,
        timingsMs: timings,
      });
    } catch (error) {
      timings.totalMs = Date.now() - runStartMs;
      logger.error("QR export failed", {
        jobId,
        error: error instanceof Error ? error.message : String(error),
        timingsMs: timings,
      });

      if (!terminalStatusWritten) {
        await updateQrExportJobStatus(db, {
          jobId,
          status: "FAILED",
          finishedAt: new Date().toISOString(),
          variantsProcessed: processed,
          summary: {
            error: error instanceof Error ? error.message : String(error),
            timingsMs: timings,
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
