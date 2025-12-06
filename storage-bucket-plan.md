# Supabase Storage Bucket Refactor Plan

## Overview

This document outlines the plan to consolidate and standardize Supabase storage bucket usage across the codebase. The goal is to establish consistent patterns for uploads, access, updates, and deletions.

**Note:** We are in active development, so no data migration/backfilling scripts are needed.

---

## Key Decision: Path-Only Storage

### The Problem

The codebase currently has **inconsistent** storage reference patterns:

| Table | Column | Current Format | Bucket |
|-------|--------|----------------|--------|
| `products` | `primary_image_url` | Full URL | products |
| `staging_products` | `primary_image_url` | Full URL | products |
| `users` | `avatar_path` | Path only | avatars |
| `brands` | `logo_path` | Path only | brand-avatars |
| `brand_theme` | `stylesheet_path` | Path only | dpp-themes |

### The Decision

**Store paths only, construct URLs at read time.**

**Rationale:**
- More portable (URLs don't break if Supabase project changes)
- Consistent pattern across all buckets
- Easier to switch access methods (public URL vs signed URL vs proxy)
- Column names already use `_path` suffix in most places

### Database Changes Required

Rename columns to reflect path-only storage:

| Table | Old Column | New Column |
|-------|------------|------------|
| `products` | `primary_image_url` | `primary_image_path` |
| `staging_products` | `primary_image_url` | `primary_image_path` |

**Note:** Since we're in development, this is a simple column rename with no data migration needed.

---

## Current State Analysis

### Buckets

| Bucket | Public? | Purpose | Current Utils |
|--------|---------|---------|---------------|
| `avatars` | Private | User profile pictures | None (inline) |
| `brand-avatars` | Private | Brand logos in dashboard | None (inline) |
| `product-imports` | Private | Excel/CSV files for bulk import | `product-imports.ts` |
| `products` | **Public** | Product images for DPP pages | None (was dead code) |
| `dpp-themes` | **Public** | CSS stylesheets for DPP | None (inline) |
| `dpp-assets` | **Public** | Header logos, banner images for DPP | None (inline) |

### Utility Files

| File | Status | Notes |
|------|--------|-------|
| `packages/supabase/src/utils/storage.ts` | ✅ Used | Generic upload/remove/download |
| `packages/supabase/src/utils/storage-urls.ts` | ✅ Used | getPublicUrl/getSignedUrl helpers |
| `packages/supabase/src/utils/product-imports.ts` | ✅ Used | Import file handling |

### Access Patterns

| Pattern | Used For | Implementation |
|---------|----------|----------------|
| **Public URL** | `products`, `dpp-themes`, `dpp-assets` | `getPublicUrl()` - construct from path |
| **Proxy Route** | `avatars`, `brand-avatars` | `/api/storage/[bucket]/[...path]` route |
| **Signed URL** | `product-imports` | `createSignedUrl()` for downloads |

### Current Upload Implementations

| Component | Bucket | Pattern | Location |
|-----------|--------|---------|----------|
| `AvatarUpload` | `avatars`, `brand-avatars` | Private + proxy | `apps/app/src/components/avatar-upload.tsx` |
| `ImageUploader` | Any (configurable) | Public or private | `apps/app/src/components/image-upload.tsx` |
| `ImageInput` (theme editor) | `dpp-assets` | Public | `apps/app/src/components/theme-editor/panel/inputs/image-input.tsx` |
| `BasicInfoSection` | `products` | Public | `apps/app/src/components/forms/passport/blocks/basic-info-block.tsx` |
| `saveThemeAction` | `dpp-themes` | Public | `apps/app/src/actions/design/save-theme-action.ts` |
| Bulk import | `product-imports` | Private | `packages/supabase/src/utils/product-imports.ts` |

---

## Desired State

### Bucket Configuration

| Bucket | Public? | RLS | Access Method |
|--------|---------|-----|---------------|
| `avatars` | Private | ✅ | Proxy route (`/api/storage/...`) |
| `brand-avatars` | Private | ✅ | Proxy route |
| `product-imports` | Private | ✅ | Signed URLs |
| `products` | **Public** | ✅ | `getPublicUrl()` |
| `dpp-themes` | **Public** | ✅ | `getPublicUrl()` |
| `dpp-assets` | **Public** | ✅ | `getPublicUrl()` |
| `theme-screenshots` | **Public** | ✅ | `getPublicUrl()` (NEW) |

### Consolidated Utility Structure

```
packages/supabase/src/utils/
├── storage.ts              # Generic upload/remove/download (KEEP)
├── storage-urls.ts         # getPublicUrl/getSignedUrl helpers (KEEP)
├── product-imports.ts      # Import-specific logic (KEEP)
└── dpp-storage.ts          # NEW: All DPP-related storage (products, themes, assets, screenshots)
```

### Standardized Patterns

1. **Public buckets**: Use `getPublicUrl()` - no signed URLs needed
2. **Private buckets (UI display)**: Use proxy route pattern
3. **Private buckets (downloads)**: Use signed URLs
4. **All uploads**: Consistent validation, path generation, and error handling

---

## Files to Modify

### Files DELETED (Phase 1 Complete)

| File | Reason |
|------|--------|
| ~~`packages/supabase/src/utils/product-images.ts`~~ | ✅ Deleted - was dead code |
| ~~`apps/app/src/hooks/use-signed-url.ts`~~ | ✅ Deleted - was dead code |

### Files to CREATE

| File | Purpose |
|------|---------|
| `packages/supabase/src/utils/dpp-storage.ts` | Consolidated DPP storage utilities |

### Files to EDIT

| File | Changes |
|------|---------|
| `apps/app/src/components/image-upload.tsx` | Use consolidated utils, consistent validation |
| `apps/app/src/components/avatar-upload.tsx` | Reference centralized constants |
| `apps/app/src/actions/design/save-theme-action.ts` | Use `dpp-storage.ts` utilities |
| `apps/app/src/components/theme-editor/panel/inputs/image-input.tsx` | Use `dpp-storage.ts` utilities |
| `apps/app/src/components/forms/passport/blocks/basic-info-block.tsx` | Use `dpp-storage.ts` utilities |
| `apps/app/src/utils/image-upload.ts` | Add bucket-specific constants |

---

## Implementation Phases

### Phase 1: Cleanup Dead Code ✅ COMPLETE

**Goal:** Remove unused files to reduce confusion.

**Tasks:**
1. ✅ Delete `packages/supabase/src/utils/product-images.ts`
2. ✅ Delete `apps/app/src/hooks/use-signed-url.ts`
3. ✅ Remove export from `packages/supabase/package.json`

**Verification:** Confirmed no imports remain via grep.

---

### Phase 2: Create Consolidated DPP Storage Utils ✅ COMPLETE

**Goal:** Create `dpp-storage.ts` with standardized utilities for all DPP-related buckets, using path-only storage pattern.

#### 2.1 Database Schema Updates ✅

Renamed columns to use `_path` suffix (paths only, not full URLs):

- ✅ `packages/db/src/schema/products/products.ts` - `primaryImageUrl` → `primaryImagePath`
- ✅ `packages/db/src/schema/staging/staging-products.ts` - `primaryImageUrl` → `primaryImagePath`

**Action Required:** Run `npx drizzle-kit generate` and `npx drizzle-kit push` to apply migration.

#### 2.2 Create dpp-storage.ts ✅

**File:** `packages/supabase/src/utils/dpp-storage.ts` (616 lines)

**Bucket Constants:**
- `DPP_BUCKETS` - bucket name constants
- `DPP_BUCKET_CONFIGS` - configurations per bucket
- `DPP_ASSET_TYPE_CONFIGS` - separate configs for logos vs banners

**Upload Utilities (return paths, not URLs):**
- ✅ `uploadProductImage()` - for products bucket
- ✅ `uploadDppAsset()` - for dpp-assets bucket (auto-detects logo vs banner)
- ✅ `uploadThemeStylesheet()` - for dpp-themes bucket
- ✅ `uploadThemeScreenshot()` - for theme-screenshots bucket

**URL Utilities (construct URL from path):**
- ✅ `getProductImageUrl(client, path)` - public URL for product images
- ✅ `getDppAssetUrl(client, path)` - public URL for DPP assets
- ✅ `getDppThemeUrl(client, path)` - public URL for theme stylesheets
- ✅ `getThemeScreenshotUrl(client, path)` - public URL for theme screenshots

**Delete Utilities:**
- ✅ `deleteProductImage(client, path)` - delete single product image
- ✅ `deleteDppAsset(client, path)` - delete DPP asset
- ✅ `deleteThemeScreenshot(client, path)` - delete theme screenshot
- ✅ `cleanupOldScreenshots(client, { brandId, keepPaths })` - remove old screenshots

**Validation Utilities:**
- ✅ `validateProductImage(file)` - JPEG, PNG, WebP, AVIF (no SVG)
- ✅ `validateLogoAsset(file)` - JPEG, PNG, WebP, **SVG allowed**
- ✅ `validateBannerAsset(file)` - JPEG, PNG, WebP (no SVG)

**Utility Functions:**
- ✅ `extractPathFromUrl(url, bucket)` - extract path from full Supabase URL

#### 2.3 Update Package Exports ✅

Added to `packages/supabase/package.json`:
```json
"./utils/dpp-storage": "./src/utils/dpp-storage.ts"
```

---

### Phase 3: Update Upload Components

**Goal:** Standardize upload logic across all components to use path-only storage.

#### 3.1 Update `use-image-upload.ts` hook

- Return `{ path, displayUrl }` instead of just URL
- `path` = storage path for database
- `displayUrl` = constructed public URL for preview

#### 3.2 Update `image-upload.tsx`

- Import validation from centralized location
- Use bucket-specific configurations
- Pass both path and URL to `onChange` callback

#### 3.3 Update `avatar-upload.tsx`

- Reference centralized avatar bucket constants
- Already stores paths (no change needed)

#### 3.4 Update `basic-info-block.tsx`

- Use `uploadProductImage()` from `dpp-storage.ts`
- Store path in `primaryImagePath` (not URL)
- Display using `getProductImageUrl(path)`

#### 3.5 Update `image-input.tsx` (theme editor)

- Use `uploadDppAsset()` from `dpp-storage.ts`
- Use `deleteDppAsset()` for cleanup
- Store paths in theme config, display using URL helpers

#### 3.6 Update `save-theme-action.ts`

- Use `uploadThemeStylesheet()` from `dpp-storage.ts`
- Trigger screenshot capture (from screenshot-theme-plan.md)

#### 3.7 Update API & Form Logic

- Update `use-passport-form.ts` to store path instead of URL
- Update TRPC routers to handle path-based storage
- Update bulk import to store paths

---

### Phase 4: Add Storage Constants Export ✅ MERGED INTO PHASE 2

Constants are now part of `dpp-storage.ts`:
- `DPP_BUCKETS` - bucket names
- `DPP_BUCKET_CONFIGS` - bucket configurations
- `DPP_ASSET_TYPE_CONFIGS` - logo vs banner configs

---

### Phase 5: Create theme-screenshots Bucket

**Goal:** Set up the new bucket for theme preview screenshots.

**Supabase Dashboard Configuration:**
- **Name:** `theme-screenshots`
- **Public:** Yes
- **File size limit:** 1 MB
- **Allowed MIME types:** `image/webp`

**RLS Policies:**
| Policy | Operation | Roles | Expression |
|--------|-----------|-------|------------|
| Allow brand members upload | INSERT | authenticated, service_role | `is_brand_member((storage.foldername(name))[1]::uuid)` |
| Allow brand members update | UPDATE | authenticated, service_role | `is_brand_member((storage.foldername(name))[1]::uuid)` |
| Allow brand members delete | DELETE | authenticated, service_role | `is_brand_member((storage.foldername(name))[1]::uuid)` |
| Allow everyone read | SELECT | public | `true` |

---

### Phase 6: Documentation & Testing

**Goal:** Ensure all changes work correctly.

**Tasks:**
1. Update any relevant documentation
2. Test avatar upload (user + brand)
3. Test product image upload
4. Test DPP asset upload (header logo, banner)
5. Test theme stylesheet save
6. Test bulk import file upload/download

---

## Appendix: Related Files Reference

### Upload Components

- `apps/app/src/components/avatar-upload.tsx` - User/brand avatar upload
- `apps/app/src/components/image-upload.tsx` - Generic image uploader
- `apps/app/src/components/theme-editor/panel/inputs/image-input.tsx` - Theme editor image fields
- `apps/app/src/components/forms/passport/blocks/basic-info-block.tsx` - Product passport form

### Display Components

- `apps/app/src/components/signed-avatar.tsx` - Avatar display with proxy URL
- `apps/app/src/components/account/set-avatar.tsx` - User avatar settings
- `apps/app/src/components/settings/set-logo.tsx` - Brand logo settings
- `packages/dpp-components/src/components/layout/product-image.tsx` - DPP product image

### Server Actions

- `apps/app/src/actions/design/save-theme-action.ts` - Theme stylesheet upload

### Utility Files

- `apps/app/src/utils/image-upload.ts` - Client-side upload utilities
- `apps/app/src/hooks/use-image-upload.ts` - Upload hook
- `packages/supabase/src/utils/storage.ts` - Generic storage utils
- `packages/supabase/src/utils/storage-urls.ts` - URL generation
- `packages/supabase/src/utils/product-imports.ts` - Import file utils

### API Routes

- `apps/app/src/app/api/storage/[bucket]/[...path]/route.ts` - Proxy route for private buckets

---

## Progress Checklist

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Cleanup Dead Code | ✅ Complete | Deleted `product-images.ts`, `use-signed-url.ts`, removed export |
| Phase 2: Create dpp-storage.ts | ✅ Complete | Schema updated, utils created, export added. **Run Drizzle migration!** |
| Phase 3: Update Upload Components | ⏳ Pending | Next up |
| Phase 4: Add Storage Constants | ✅ Complete | Merged into Phase 2 (`DPP_BUCKETS`, `DPP_BUCKET_CONFIGS`) |
| Phase 5: Create theme-screenshots Bucket | ⏳ Pending | Manual in Supabase |
| Phase 6: Documentation & Testing | ⏳ Pending | |

