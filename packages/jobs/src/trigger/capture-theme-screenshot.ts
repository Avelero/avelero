import "./configure-trigger";
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import { updateBrandThemeScreenshots } from "@v1/db/queries";
import { brands } from "@v1/db/schema";

const BROWSERLESS_URL =
  process.env.BROWSERLESS_URL || "https://production-sfo.browserless.io";
const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
const DPP_URL = process.env.DPP_URL || "https://passport.avelero.com";

const BUCKET_NAME = "theme-screenshots";

// Viewport configurations matching the SetTheme preview design
const VIEWPORTS = {
  desktop: { width: 1440, height: 1024 },
  mobile: { width: 393, height: 852 },
} as const;

interface CaptureThemeScreenshotPayload {
  brandId: string;
}

/**
 * Capture theme screenshots for a brand.
 *
 * This job:
 * 1. Always uses the /ahw_preview_jja/ route with demo data for consistent screenshots
 * 2. Captures desktop and mobile screenshots via Browserless.io
 * 3. Uploads screenshots to Supabase Storage
 * 4. Updates brand_theme with screenshot paths
 * 5. Cleans up old screenshots
 */
export const captureThemeScreenshot = task({
  id: "capture-theme-screenshot",
  maxDuration: 120, // 2 minutes max
  queue: {
    concurrencyLimit: 5, // Limit concurrent screenshot jobs
  },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
    factor: 2,
    randomize: true,
  },
  run: async (
    payload: CaptureThemeScreenshotPayload,
  ): Promise<{
    success: boolean;
    desktopPath?: string;
    mobilePath?: string;
    error?: string;
  }> => {
    const { brandId } = payload;

    if (!BROWSERLESS_API_KEY) {
      logger.error("BROWSERLESS_API_KEY not configured");
      return { success: false, error: "BROWSERLESS_API_KEY not configured" };
    }

    logger.info("Starting theme screenshot capture", { brandId });

    try {
      // 1. Get brand slug
      const [brand] = await db
        .select({ slug: brands.slug, name: brands.name })
        .from(brands)
        .where(eq(brands.id, brandId))
        .limit(1);

      if (!brand?.slug) {
        throw new Error(`Brand ${brandId} not found or has no slug`);
      }

      // 2. Always use preview route with demo data for consistent screenshots
      const screenshotUrl = `${DPP_URL}/${brand.slug}/ahw_preview_jja/`;

      logger.info("Screenshot URL determined", {
        brandId,
        brandSlug: brand.slug,
        screenshotUrl,
      });

      // 3. Capture screenshots
      const desktopBuffer = await captureScreenshot(
        screenshotUrl,
        VIEWPORTS.desktop,
      );
      const mobileBuffer = await captureScreenshot(
        screenshotUrl,
        VIEWPORTS.mobile,
      );

      logger.info("Screenshots captured", {
        brandId,
        desktopSize: desktopBuffer.length,
        mobileSize: mobileBuffer.length,
      });

      // 4. Upload to Supabase Storage
      const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      const timestamp = Date.now();
      const desktopPath = `${brandId}/desktop_${timestamp}.webp`;
      const mobilePath = `${brandId}/mobile_${timestamp}.webp`;

      // Upload desktop screenshot
      const { error: desktopError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(desktopPath, desktopBuffer, {
          upsert: true,
          contentType: "image/webp",
        });

      if (desktopError) {
        throw new Error(`Desktop upload failed: ${desktopError.message}`);
      }

      // Upload mobile screenshot
      const { error: mobileError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(mobilePath, mobileBuffer, {
          upsert: true,
          contentType: "image/webp",
        });

      if (mobileError) {
        throw new Error(`Mobile upload failed: ${mobileError.message}`);
      }

      logger.info("Screenshots uploaded to storage", {
        brandId,
        desktopPath,
        mobilePath,
      });

      // 5. Update brand_theme with paths
      await updateBrandThemeScreenshots(db, brandId, {
        screenshotDesktopPath: desktopPath,
        screenshotMobilePath: mobilePath,
      });

      // 6. Cleanup old screenshots (fire-and-forget)
      cleanupOldScreenshots(supabase, brandId, [desktopPath, mobilePath]).catch(
        (err) => {
          logger.warn("Failed to cleanup old screenshots", {
            brandId,
            error: err.message,
          });
        },
      );

      logger.info("Theme screenshot capture completed", { brandId });

      return {
        success: true,
        desktopPath,
        mobilePath,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error("Theme screenshot capture failed", {
        brandId,
        error: errorMessage,
      });

      return { success: false, error: errorMessage };
    }
  },
});

/**
 * Capture a single screenshot using Browserless.io REST API.
 */
async function captureScreenshot(
  url: string,
  viewport: { width: number; height: number },
): Promise<Buffer> {
  const apiUrl = `${BROWSERLESS_URL}/screenshot?token=${BROWSERLESS_API_KEY}`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    body: JSON.stringify({
      url,
      viewport,
      options: {
        type: "webp",
        quality: 85,
        clip: {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height,
        },
      },
      waitForTimeout: 2000, // Wait for fonts/images
      gotoOptions: {
        waitUntil: "networkidle0",
        timeout: 30000,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Browserless API error: ${response.status} - ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Remove old screenshots for a brand, keeping only the current ones.
 */
async function cleanupOldScreenshots(
  supabase: SupabaseClient,
  brandId: string,
  keepPaths: string[],
): Promise<void> {
  const { data: files, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list(brandId);

  if (error || !files) {
    return;
  }

  const keepFilenames = new Set(keepPaths.map((p) => p.split("/").pop()));

  const toDelete = files
    .filter((f) => !keepFilenames.has(f.name))
    .map((f) => `${brandId}/${f.name}`);

  if (toDelete.length > 0) {
    await supabase.storage.from(BUCKET_NAME).remove(toDelete);
  }
}
