# Theme Screenshot Preview Implementation Plan

## Overview

This document outlines the implementation plan for capturing and displaying theme preview screenshots in the `SetTheme` component. When a brand saves their theme, we capture screenshots of their DPP (Digital Product Passport) in both desktop and mobile viewports, store them in Supabase, and display them as a visual preview.

---

## Architecture

### High-Level Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Theme Editor   │────▶│  Save Theme      │────▶│  Trigger.dev    │
│  (User saves)   │     │  (Server Action) │     │  Background Job │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  SetTheme       │◀────│  Supabase        │◀────│  Browserless.io │
│  (Display)      │     │  Storage         │     │  Screenshot API │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Screenshot Capture | [Browserless.io REST API](https://docs.browserless.io/rest-apis/screenshot-api) | Capture screenshots via HTTP POST |
| Background Jobs | Trigger.dev | Async processing, retry logic |
| Storage | Supabase Storage | Store screenshot images |
| Database | Supabase/Postgres | Store screenshot paths + metadata |

---

## Implementation Phases

### Phase 1: Database Schema Updates

**Goal:** Add columns to store screenshot paths in `brand_theme` table.

#### Schema Update

**File:** `packages/db/src/schema/brand/brand-theme.ts`

Add these two fields to the `brandTheme` table definition:

```typescript
screenshotDesktopPath: text("screenshot_desktop_path"),
screenshotMobilePath: text("screenshot_mobile_path"),
```

#### Migration Generation

After updating the schema file, run these commands to generate and apply the migration:

```bash
# Generate migration
npx drizzle-kit generate

# Review the generated migration, then push
npx drizzle-kit push
```

**Note:** We use Drizzle-Kit for migrations, not manual SQL. The migration will be auto-generated based on the schema changes.

#### Query Updates

**File:** `packages/db/src/queries/brands.ts`

```typescript
// Update BrandThemeRow type
export type BrandThemeRow = {
  brandId: string;
  themeStyles: unknown;
  themeConfig: unknown;
  stylesheetPath: string | null;
  googleFontsUrl: string | null;
  screenshotDesktopPath: string | null;  // NEW
  screenshotMobilePath: string | null;   // NEW
  createdAt: string;
  updatedAt: string;
};

// Update getBrandTheme to include new columns
export async function getBrandTheme(
  db: Database,
  brandId: string,
): Promise<BrandThemeRow | null> {
  const [row] = await db
    .select({
      brandId: brandTheme.brandId,
      themeStyles: brandTheme.themeStyles,
      themeConfig: brandTheme.themeConfig,
      stylesheetPath: brandTheme.stylesheetPath,
      googleFontsUrl: brandTheme.googleFontsUrl,
      screenshotDesktopPath: brandTheme.screenshotDesktopPath,  // NEW
      screenshotMobilePath: brandTheme.screenshotMobilePath,    // NEW
      createdAt: brandTheme.createdAt,
      updatedAt: brandTheme.updatedAt,
    })
    .from(brandTheme)
    .where(eq(brandTheme.brandId, brandId))
    .limit(1);

  return row ?? null;
}

// Add new update function for screenshots
export async function updateBrandThemeScreenshots(
  db: Database,
  brandId: string,
  paths: {
    screenshotDesktopPath: string;
    screenshotMobilePath: string;
  },
): Promise<void> {
  await db
    .update(brandTheme)
    .set({
      screenshotDesktopPath: paths.screenshotDesktopPath,
      screenshotMobilePath: paths.screenshotMobilePath,
    })
    .where(eq(brandTheme.brandId, brandId));
}
```

---

### Phase 2: Supabase Storage Setup

**Goal:** Create storage bucket and utility functions for theme screenshots.

#### Bucket Configuration (Manual Setup Required)

Create the bucket manually in Supabase Dashboard with these exact settings:

- **Bucket name:** `theme-screenshots` (must match exactly)
- **Public bucket:** `Yes` (screenshots are not sensitive, simplifies URL access)
- **File size limit:** `1MB` (screenshots are ~30-60KB, well within limit)
- **Allowed MIME types:** `image/webp` (or leave empty to allow all)

**RLS Policies:** No RLS policies needed since the bucket is public. All authenticated users can upload, and anyone can view (public bucket).

**Storage Policies (if needed):**
- **Upload policy:** Allow authenticated users to upload
- **View policy:** Public read access (default for public buckets)

#### Storage Utilities

**File:** `packages/supabase/src/utils/theme-screenshots.ts`

```typescript
/**
 * Theme Screenshot Storage Utilities
 * 
 * Manages screenshot storage for theme previews.
 * Path structure: {brand_id}/{device}_{timestamp}.webp
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

const THEME_SCREENSHOTS_BUCKET = "theme-screenshots" as const;

type DeviceType = "desktop" | "mobile";

/**
 * Generate the storage path for a theme screenshot.
 */
export function getThemeScreenshotPath(
  brandId: string,
  deviceType: DeviceType,
): string {
  const timestamp = Date.now();
  return `${brandId}/${deviceType}_${timestamp}.webp`;
}

/**
 * Upload a theme screenshot to Supabase Storage.
 * 
 * @param client - Supabase client
 * @param brandId - Brand UUID
 * @param deviceType - "desktop" or "mobile"
 * @param imageBuffer - WebP image buffer from Browserless
 * @returns Object with path and public URL
 */
export async function uploadThemeScreenshot(
  client: Pick<SupabaseClient<Database>, "storage">,
  brandId: string,
  deviceType: DeviceType,
  imageBuffer: Buffer,
): Promise<{ path: string; publicUrl: string }> {
  const path = getThemeScreenshotPath(brandId, deviceType);
  
  const storage = client.storage.from(THEME_SCREENSHOTS_BUCKET);
  
  const { error } = await storage.upload(path, imageBuffer, {
    upsert: true,
    contentType: "image/webp",
    cacheControl: "31536000", // 1 year cache
  });
  
  if (error) {
    throw new Error(`Failed to upload theme screenshot: ${error.message}`);
  }
  
  const { data } = storage.getPublicUrl(path);
  
  return {
    path,
    publicUrl: data.publicUrl,
  };
}

/**
 * Delete old screenshots for a brand (cleanup after new upload).
 * 
 * @param client - Supabase client
 * @param brandId - Brand UUID
 * @param excludePath - Path to exclude from deletion (the new screenshot)
 */
export async function cleanupOldScreenshots(
  client: Pick<SupabaseClient<Database>, "storage">,
  brandId: string,
  excludePaths: string[],
): Promise<void> {
  const storage = client.storage.from(THEME_SCREENSHOTS_BUCKET);
  
  // List all files for this brand
  const { data: files, error } = await storage.list(brandId);
  
  if (error || !files) return;
  
  // Filter out the new screenshots and delete old ones
  const toDelete = files
    .map((f) => `${brandId}/${f.name}`)
    .filter((path) => !excludePaths.includes(path));
  
  if (toDelete.length > 0) {
    await storage.remove(toDelete);
  }
}

/**
 * Get the public URL for a stored screenshot.
 */
export function getThemeScreenshotUrl(
  client: Pick<SupabaseClient<Database>, "storage">,
  path: string,
): string {
  const { data } = client.storage
    .from(THEME_SCREENSHOTS_BUCKET)
    .getPublicUrl(path);
  
  return data.publicUrl;
}
```

#### Export from package

**File:** `packages/supabase/src/index.ts`

```typescript
// Add export
export * from "./utils/theme-screenshots";
```

---

### Phase 3: DPP Preview Route

**Goal:** Create a special preview route that renders the theme with demo data for brands without products.

#### Security Consideration

**Question:** Is a public preview route a security risk?

**Analysis:**
- The preview route only displays the brand's theme (colors, fonts, layout) with demo product data
- It does not expose any sensitive information (no real product data, no user data, no API keys)
- The theme is already public (it's what customers see on live DPP pages)
- The demo product data is static and generic

**Conclusion:** The preview route is **not a security risk**. It's essentially a public-facing page that shows how the theme looks. However, if you want to add an extra layer of protection, we could:

1. **Option A (Recommended):** Keep it public - it's safe and simpler
2. **Option B:** Add a query parameter token that's validated server-side (e.g., `?token=<temporary-token>`)
3. **Option C:** Use robots.txt to prevent indexing, but allow access

**Recommendation:** Option A is sufficient. The route is functionally identical to a public DPP page, just with demo data. No sensitive information is exposed.

#### Preview Page

**File:** `apps/dpp/src/app/[brand]/__preview__/page.tsx`

```typescript
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demoProductData } from "@/demo-data/data";
import { demoThemeConfig } from "@/demo-data/config";
import {
  Header,
  ContentFrame,
  Footer,
  generateFontFaceCSS,
  type ThemeConfig,
  type ThemeStyles,
} from "@v1/dpp-components";
import { getBrandTheme } from "@v1/db/queries";
import { db } from "@v1/db/client";
import { brands } from "@v1/db/schema";
import { eq } from "@v1/db/index";
import { getPublicUrl } from "@v1/supabase/utils/storage-urls";
import { createClient } from "@supabase/supabase-js";

interface PageProps {
  params: Promise<{ brand: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return {
    title: "Theme Preview",
    robots: { index: false, follow: false }, // Don't index preview pages
  };
}

/**
 * Theme preview page for screenshot capture.
 * 
 * Renders the brand's theme with demo product data.
 * Used by Browserless to capture theme screenshots.
 * 
 * This route is public but safe - it only shows theme styling with generic demo data.
 */
export default async function ThemePreviewPage({ params }: PageProps) {
  const { brand: brandSlug } = await params;
  
  // Get brand ID from slug
  const [brand] = await db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .where(eq(brands.slug, brandSlug))
    .limit(1);
  
  if (!brand) {
    notFound();
  }
  
  // Fetch brand theme directly from database
  const brandTheme = await getBrandTheme(db, brand.id);
  
  if (!brandTheme) {
    notFound();
  }
  
  // Use demo product data from apps/dpp/src/demo-data/data.ts
  // Override brand name with actual brand name
  const productData = {
    ...demoProductData,
    brandName: brand.name,
  };
  
  // Extract theme configuration
  const themeConfig: ThemeConfig = (brandTheme.themeConfig as ThemeConfig) ?? demoThemeConfig;
  const themeStyles: ThemeStyles | undefined = brandTheme.themeStyles as ThemeStyles | undefined;
  
  // Google Fonts URL from stored theme
  const googleFontsUrl = brandTheme.googleFontsUrl ?? "";
  
  // Generate @font-face CSS from custom fonts
  const fontFaceCSS = generateFontFaceCSS(themeStyles?.customFonts);
  
  // Resolve stylesheet URL
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const stylesheetUrl = brandTheme.stylesheetPath
    ? getPublicUrl(supabase, "dpp-themes", brandTheme.stylesheetPath)
    : undefined;
  
  return (
    <>
      {googleFontsUrl && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link rel="stylesheet" href={googleFontsUrl} />
        </>
      )}
      
      {fontFaceCSS && <style dangerouslySetInnerHTML={{ __html: fontFaceCSS }} />}
      {stylesheetUrl && <link rel="stylesheet" href={stylesheetUrl} />}
      
      <div className="dpp-root min-h-screen flex flex-col @container">
        <div style={{ height: "var(--header-height)" }} />
        <Header themeConfig={themeConfig} brandName={productData.brandName} />
        <ContentFrame data={productData} themeConfig={themeConfig} />
        <Footer themeConfig={themeConfig} brandName={productData.brandName} />
      </div>
    </>
  );
}
```

**Note:** We query the database directly in this server component rather than creating a new API endpoint. The preview route has access to the database via `@v1/db/client`, and this avoids unnecessary API calls.

---

### Phase 4: Trigger.dev Background Job

**Goal:** Create a background job that captures screenshots using Browserless.io.

#### Environment Variables

Add to Trigger.dev environments (local, preview, production):

```bash
# Browserless.io API
BROWSERLESS_API_KEY=your_api_key_here
BROWSERLESS_URL=https://production-sfo.browserless.io

# DPP URL for screenshots
DPP_URL=https://passport.avelero.com

# Supabase (for storage uploads)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Note:** Trigger.dev has three environments: `local`, `preview`, and `production`. Configure these variables in each environment as needed.

#### Screenshot Job

**File:** `packages/jobs/src/trigger/capture-theme-screenshot.ts`

```typescript
import "./configure-trigger";
import { logger, task } from "@trigger.dev/sdk/v3";
import { db } from "@v1/db/client";
import { eq } from "@v1/db/index";
import { products, brands } from "@v1/db/schema";
import { createClient } from "@supabase/supabase-js";
import { uploadThemeScreenshot, cleanupOldScreenshots } from "@v1/supabase/utils/theme-screenshots";
import { updateBrandThemeScreenshots } from "@v1/db/queries";

const BROWSERLESS_URL = process.env.BROWSERLESS_URL || "https://production-sfo.browserless.io";
const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
const DPP_URL = process.env.DPP_URL || "https://passport.avelero.com";

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
 * 1. Determines the best URL to screenshot (real product or preview route)
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
  run: async (payload: CaptureThemeScreenshotPayload): Promise<{
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
      
      // 2. Find a product to screenshot (or use preview route)
      const [product] = await db
        .select({ upid: products.upid })
        .from(products)
        .where(eq(products.brandId, brandId))
        .limit(1);
      
      // 3. Determine screenshot URL
      const screenshotUrl = product?.upid
        ? `${DPP_URL}/${brand.slug}/${product.upid}/`
        : `${DPP_URL}/${brand.slug}/__preview__/`;
      
      logger.info("Screenshot URL determined", { 
        brandId, 
        screenshotUrl,
        hasProduct: !!product?.upid,
      });
      
      // 4. Capture screenshots
      const desktopBuffer = await captureScreenshot(screenshotUrl, VIEWPORTS.desktop);
      const mobileBuffer = await captureScreenshot(screenshotUrl, VIEWPORTS.mobile);
      
      logger.info("Screenshots captured", {
        brandId,
        desktopSize: desktopBuffer.length,
        mobileSize: mobileBuffer.length,
      });
      
      // 5. Upload to Supabase Storage
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      
      const [desktopResult, mobileResult] = await Promise.all([
        uploadThemeScreenshot(supabase, brandId, "desktop", desktopBuffer),
        uploadThemeScreenshot(supabase, brandId, "mobile", mobileBuffer),
      ]);
      
      logger.info("Screenshots uploaded to storage", {
        brandId,
        desktopPath: desktopResult.path,
        mobilePath: mobileResult.path,
      });
      
      // 6. Update brand_theme with paths
      await updateBrandThemeScreenshots(db, brandId, {
        screenshotDesktopPath: desktopResult.path,
        screenshotMobilePath: mobileResult.path,
      });
      
      // 7. Cleanup old screenshots (fire-and-forget)
      cleanupOldScreenshots(supabase, brandId, [
        desktopResult.path,
        mobileResult.path,
      ]).catch((err) => {
        logger.warn("Failed to cleanup old screenshots", { 
          brandId, 
          error: err.message 
        });
      });
      
      logger.info("Theme screenshot capture completed", { brandId });
      
      return {
        success: true,
        desktopPath: desktopResult.path,
        mobilePath: mobileResult.path,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error("Theme screenshot capture failed", { brandId, error: errorMessage });
      
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
```

#### Export Job

**File:** `packages/jobs/src/trigger/index.ts`

```typescript
// Add to existing exports
export { captureThemeScreenshot } from "./capture-theme-screenshot";
```

---

### Phase 5: Trigger Screenshot on Theme Save

**Goal:** Trigger the screenshot job when a brand saves their theme.

#### Update saveThemeAction

**File:** `apps/app/src/actions/design/save-theme-action.ts`

```typescript
// Add import at top
import { captureThemeScreenshot } from "@v1/jobs/trigger/capture-theme-screenshot";

// At the end of the action, after successful save:
export const saveThemeAction = authActionClient
  .schema(schema)
  .metadata({ name: "design.save-theme" })
  .action(async ({ parsedInput, ctx }) => {
    const { brandId, themeStyles } = parsedInput;
    const supabase = ctx.supabase;

    // ... existing theme save logic ...

    // Trigger screenshot capture (fire-and-forget)
    // Wrapped in try-catch to not fail the save if screenshot fails to trigger
    try {
      await captureThemeScreenshot.trigger({ brandId });
    } catch (error) {
      console.error("Failed to trigger screenshot capture:", error);
      // Don't throw - screenshot is optional enhancement
    }

    return {
      brandId,
      stylesheetPath,
      googleFontsUrl,
      updatedAt: now,
    };
  });
```

#### Update updateConfig tRPC procedure

**File:** `apps/api/src/trpc/routers/workflow/theme.ts`

```typescript
// Add import
import { captureThemeScreenshot } from "@v1/jobs/trigger/capture-theme-screenshot";

// In the updateConfig procedure, after successful update:
.mutation(async ({ ctx, input }) => {
  const { brandId } = ctx;
  
  // ... existing update logic ...
  
  // Trigger screenshot capture (fire-and-forget)
  try {
    await captureThemeScreenshot.trigger({ brandId });
  } catch (error) {
    console.error("Failed to trigger screenshot capture:", error);
  }
  
  return result;
});
```

---

### Phase 6: Update SetTheme Component

**Goal:** Display the theme preview screenshots with the new design.

#### Updated Component

**File:** `apps/app/src/components/design/set-theme.tsx`

```typescript
"use client";

import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import Link from "next/link";

interface SetThemeProps {
  updatedAt: string;
  screenshotDesktopUrl?: string | null;
  screenshotMobileUrl?: string | null;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function SetTheme({ 
  updatedAt, 
  screenshotDesktopUrl, 
  screenshotMobileUrl 
}: SetThemeProps) {
  const hasScreenshots = screenshotDesktopUrl && screenshotMobileUrl;
  
  return (
    <div className="border border-border bg-background flex flex-col">
      {/* Preview Block */}
      <div className="bg-accent p-6 relative overflow-hidden min-h-[240px]">
        {hasScreenshots ? (
          <>
            {/* Desktop frame - positioned left */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 w-[320px] rounded-lg border border-border/30 shadow-xl overflow-hidden bg-white">
              <img 
                src={screenshotDesktopUrl} 
                alt="Desktop theme preview" 
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
            
            {/* Mobile frame - positioned right, overlapping */}
            <div className="absolute right-8 top-1/2 -translate-y-1/2 w-[100px] rounded-xl border border-border/30 shadow-xl overflow-hidden bg-white">
              <img 
                src={screenshotMobileUrl} 
                alt="Mobile theme preview" 
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </>
        ) : (
          /* Placeholder when no screenshots */
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-muted-foreground text-sm">
              Preview will appear after saving theme
            </div>
          </div>
        )}
      </div>
      
      {/* Info + Button Row */}
      <div className="p-4 flex flex-row justify-between items-center gap-3">
        {/* Left: Thumbnail + Text */}
        <div className="flex flex-row items-center gap-3">
          {/* Thumbnail */}
          <div className="w-16 h-16 rounded border border-border overflow-hidden flex-shrink-0 bg-muted">
            {screenshotDesktopUrl ? (
              <img 
                src={screenshotDesktopUrl} 
                alt="Theme thumbnail" 
                className="w-full h-full object-cover object-top"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Icons.Image className="w-6 h-6 text-muted-foreground/50" />
              </div>
            )}
          </div>
          
          {/* Text */}
          <div className="flex flex-col gap-1.5">
            <p className="type-p !font-medium text-primary">Theme</p>
            <p className="type-small text-muted-foreground">
              Last edited on {formatDate(updatedAt)}
            </p>
          </div>
        </div>
        
        {/* Right: Button */}
        <Button asChild variant="outline" size="sm">
          <Link href="/theme-editor" prefetch>
            <span>Open</span>
            <Icons.ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
```

---

### Phase 7: Fetch Theme Data in Parent Component

**Goal:** Pass the theme data (including screenshot URLs) to the SetTheme component.

The parent component (`apps/app/src/app/(dashboard)/(main)/(sidebar)/design/page.tsx`) is a server component that needs to fetch the brand theme data and generate public URLs for the screenshots.

#### Update Design Page

**File:** `apps/app/src/app/(dashboard)/(main)/(sidebar)/design/page.tsx`

```typescript
import { SetTheme } from "@/components/design/set-theme";
import { Skeleton } from "@v1/ui/skeleton";
import { Suspense } from "react";
import { getBrandTheme } from "@v1/db/queries";
import { db } from "@v1/db/client";
import { getThemeScreenshotUrl } from "@v1/supabase/utils/theme-screenshots";
import { createClient } from "@supabase/supabase-js";
import { getBrandIdFromContext } from "@/lib/auth"; // Adjust import path as needed

async function SetThemeWithData() {
  // Get brand ID from auth context (adjust based on your auth setup)
  const brandId = await getBrandIdFromContext();
  
  if (!brandId) {
    return <SetTheme updatedAt={new Date().toISOString()} />;
  }
  
  // Fetch brand theme
  const brandTheme = await getBrandTheme(db, brandId);
  
  // Generate screenshot URLs
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  
  const screenshotDesktopUrl = brandTheme?.screenshotDesktopPath
    ? getThemeScreenshotUrl(supabase, brandTheme.screenshotDesktopPath)
    : null;
  
  const screenshotMobileUrl = brandTheme?.screenshotMobilePath
    ? getThemeScreenshotUrl(supabase, brandTheme.screenshotMobilePath)
    : null;
  
  return (
    <SetTheme
      updatedAt={brandTheme?.updatedAt ?? new Date().toISOString()}
      screenshotDesktopUrl={screenshotDesktopUrl}
      screenshotMobileUrl={screenshotMobileUrl}
    />
  );
}

export default async function DesignPage() {
  return (
    <div className="w-[500px]">
      <div className="flex flex-col gap-12">
        <Suspense fallback={<Skeleton className="h-[102px] w-full" />}>
          <SetThemeWithData />
        </Suspense>
      </div>
    </div>
  );
}
```

**Note:** Adjust `getBrandIdFromContext()` based on your actual auth implementation. This is a placeholder - use whatever method you currently use to get the brand ID in server components.

---

## File Summary

### New Files

| File | Description |
|------|-------------|
| `apps/api/supabase/migrations/XXXXX_add_theme_screenshot_columns.sql` | Database migration |
| `packages/supabase/src/utils/theme-screenshots.ts` | Storage utilities |
| `packages/jobs/src/trigger/capture-theme-screenshot.ts` | Background job |
| `apps/dpp/src/app/[brand]/__preview__/page.tsx` | Preview route for brands without products (uses demo data from `apps/dpp/src/demo-data/data.ts`) |

### Modified Files

| File | Changes |
|------|---------|
| `packages/db/src/schema/brand/brand-theme.ts` | Add screenshot columns |
| `packages/db/src/queries/brands.ts` | Update types and add query functions |
| `packages/supabase/src/index.ts` | Export new utilities |
| `packages/jobs/src/trigger/index.ts` | Export new job |
| `apps/app/src/actions/design/save-theme-action.ts` | Trigger screenshot job |
| `apps/api/src/trpc/routers/workflow/theme.ts` | Trigger screenshot job |
| `apps/app/src/components/design/set-theme.tsx` | New preview UI |
| `apps/app/src/app/(dashboard)/(main)/(sidebar)/design/page.tsx` | Fetch theme data and pass to SetTheme |

### Environment Variables

| Variable | Description | Required In |
|----------|-------------|-------------|
| `BROWSERLESS_API_KEY` | Browserless.io API token | Trigger.dev (local, preview, production) |
| `BROWSERLESS_URL` | Browserless.io API base URL | Trigger.dev (local, preview, production) |
| `DPP_URL` | DPP app base URL | Trigger.dev (local, preview, production) |
| `SUPABASE_URL` | Supabase project URL | Trigger.dev (local, preview, production) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | Trigger.dev (local, preview, production) |

---

## Edge Cases Handled

### 1. Brand has no products

**Solution:** Use the `/__preview__/` route which renders the brand's theme with demo product data.

### 2. Brand has no slug

**Solution:** Skip screenshot capture. The job logs a warning and returns early.

### 3. Screenshot capture fails

**Solution:** 
- Retry up to 3 times with exponential backoff
- Theme save still succeeds (screenshot is fire-and-forget)
- Old screenshots remain in place until successful capture

### 4. Old screenshots accumulate

**Solution:** `cleanupOldScreenshots` function removes previous screenshots after successful new upload.

### 5. First-time theme save (no screenshots yet)

**Solution:** `SetTheme` component shows a placeholder message: "Preview will appear after saving theme"

---

## Cost Estimate

**Browserless.io Pricing:**
- Free tier: 1,000 units/month
- Each screenshot ≈ 2-3 units (navigation + render + screenshot)
- Desktop + mobile = ~5 units per theme save

**Expected usage:**
- ~500 theme saves/month = ~2,500 units
- Free tier covers ~400 theme saves
- Additional usage: ~$0.002 per screenshot ($1 per 500 theme saves)

**Supabase Storage:**
- Screenshots: ~40-60KB each
- 2 screenshots per brand × 1000 brands = ~100MB
- Well within free tier limits

---

## Testing Checklist

### Unit Tests
- [ ] `uploadThemeScreenshot` uploads correctly
- [ ] `getThemeScreenshotUrl` returns valid URL
- [ ] `cleanupOldScreenshots` removes old files
- [ ] `updateBrandThemeScreenshots` updates DB correctly

### Integration Tests
- [ ] Screenshot job captures both viewports
- [ ] Job handles missing brand gracefully
- [ ] Job handles missing product (uses preview route)
- [ ] Screenshots appear in SetTheme component

### Manual Testing
- [ ] Save theme → screenshots appear in SetTheme
- [ ] Screenshots update on subsequent saves
- [ ] Preview route renders correctly for brand without products
- [ ] Mobile and desktop previews display at correct sizes

---

## Implementation Order

1. **Phase 1:** Database schema (migration + code) — *15 min*
2. **Phase 2:** Supabase storage utilities — *20 min*
3. **Phase 3:** DPP preview route — *30 min*
4. **Phase 4:** Trigger.dev background job — *45 min*
5. **Phase 5:** Wire up save actions to trigger job — *15 min*
6. **Phase 6:** Update SetTheme component — *30 min*
7. **Phase 7:** Wire up data fetching in parent — *20 min*
8. **Testing & Polish** — *30 min*

**Total estimated time:** ~3-4 hours

