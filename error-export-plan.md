# Error Export Implementation Plan

This plan implements the bulk import error report feature, allowing users to download an Excel file containing failed products with highlighted error cells.

## Progress Tracking

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Database Schema Changes |
| Phase 2 | ✅ Complete | Database Query Updates |
| Phase 3 | ✅ Complete | Error Report Generation Job |
| Phase 4 | ✅ Complete | Email Template |
| Phase 5 | ✅ Complete | Trigger Error Report Generation |
| Phase 6 | ✅ Complete | API Router Updates |
| Phase 7 | ✅ Complete | Frontend Modal Updates |

---

## Overview

When a bulk import completes with failures, users need to:
1. See a notification in the import modal about failed products
2. Download an Excel error report with failed rows highlighted
3. Receive an email notification with a download link

### Key Design Decisions

- **Error Storage**: Use `staging_products.errors` jsonb column (Option A) to persist structured field-level errors
- **Error Report Generation**: Async background job similar to product export
- **File Storage**: Supabase Storage bucket `product-imports-corrections`
- **Email**: New template similar to `export-ready.tsx`

---

## Phase 1: Database Schema Changes

> **Note**: After modifying the schema, you must run DrizzleKit commands to generate the migration. The developer will handle migration generation.

### File: `packages/db/src/schema/data/import-jobs.ts`
**Action**: EDIT

Add the following columns to the `importJobs` table:

```typescript
/** Path to the generated correction Excel file in storage */
correctionFilePath: text("correction_file_path"),

/** Signed download URL for the correction file */
correctionDownloadUrl: text("correction_download_url"),

/** When the correction download URL expires */
correctionExpiresAt: timestamp("correction_expires_at", {
  withTimezone: true,
  mode: "string",
}),

/** User ID who started the import (for email notifications) */
userId: uuid("user_id"),

/** Email address for notifications */
userEmail: text("user_email"),
```

**Reason**: Need to store the generated error report location and track who to notify.

---

## Phase 2: Database Query Updates

### File: `packages/db/src/queries/bulk/import/types.ts`
**Action**: EDIT

Add new fields to `ImportJobStatus` interface:

```typescript
export interface ImportJobStatus {
  // ... existing fields ...
  
  /** Path to the generated correction Excel file */
  correctionFilePath: string | null;
  /** Signed download URL for the correction file */
  correctionDownloadUrl: string | null;
  /** When the correction download URL expires */
  correctionExpiresAt: string | null;
  /** User ID who started the import */
  userId: string | null;
  /** Email address for notifications */
  userEmail: string | null;
}
```

### File: `packages/db/src/queries/bulk/import/jobs.ts`
**Action**: EDIT

1. Update `getImportJobStatus()` to return new fields
2. Update `getRecentImportJobs()` to return new fields
3. Add new function:

```typescript
export async function updateImportJobCorrectionFile(
  db: Database,
  params: {
    jobId: string;
    correctionFilePath: string;
    correctionDownloadUrl: string;
    correctionExpiresAt: string;
  }
): Promise<void>
```

**Reason**: API needs access to correction file data.

---

## Phase 3: Error Report Generation Job

### File: `packages/jobs/src/trigger/bulk/generate-error-report.ts`
**Action**: CREATE

New Trigger.dev task with the following workflow:

1. **Load failed staging products** with their structured errors from `staging_products` where `rowStatus = 'FAILED'`
2. **Transform to ExportRow format** compatible with `generateErrorOnlyCorrectionExcel()`
3. **Generate Excel file** using existing `excel-export.ts` utilities
4. **Upload to Supabase Storage** bucket `product-imports-corrections`
5. **Generate signed URL** (7 days expiry)
6. **Update import job** with correction file info
7. **Send email notification** using new `ImportFailuresEmail` template

```typescript
interface GenerateErrorReportPayload {
  jobId: string;
  brandId: string;
  userEmail: string | null;
}

export const generateErrorReport = task({
  id: "generate-error-report",
  maxDuration: 300, // 5 minutes
  queue: { concurrencyLimit: 5 },
  retry: { maxAttempts: 2 },
  run: async (payload: GenerateErrorReportPayload) => {
    // Implementation
  },
});
```

**Reason**: Async generation of error reports, similar to how exports work.

---

## Phase 4: Email Template

### File: `packages/email/emails/import-failures.tsx`
**Action**: CREATE

New email template with:

```typescript
interface ImportFailuresEmailProps {
  failedProductCount: number;
  successfulProductCount: number;
  downloadUrl: string;
  expiresAt: string; // ISO string
  filename: string;
}
```

Content structure:
- **Subject**: "X products failed during your import"
- **Heading**: "Your import completed with errors"
- **Body**: Summary of successful vs failed products
- **CTA**: "Download Error Report" button
- **Footer**: Expiry notice

Design should match existing `export-ready.tsx` template styling.

**Reason**: Users need email notification with download link for error report.

---

## Phase 5: Trigger Error Report Generation

### File: `packages/jobs/src/trigger/bulk/commit-to-production.ts`
**Action**: EDIT

After the job completes with failures (`hasExportableFailures: true`), trigger the error report generation:

```typescript
// After updating job status with hasExportableFailures: true
if (hasFailures) {
  // Trigger error report generation
  await tasks.trigger("generate-error-report", {
    jobId,
    brandId,
    userEmail, // Pass from original job payload
  });
  
  logger.info("Triggered error report generation", { jobId });
}
```

### File: `packages/jobs/src/trigger/bulk/validate-and-stage.ts`
**Action**: EDIT

When validation completes with failures but no products succeeded (so commit won't run):

```typescript
// If all products failed (successCount === 0), trigger error report directly
if (successCount === 0 && failureCount > 0) {
  await tasks.trigger("generate-error-report", {
    jobId,
    brandId,
    userEmail, // Need to add this to ValidateAndStagePayload
  });
}
```

Also update `ValidateAndStagePayload` to include `userEmail`.

**Reason**: Error reports should be generated automatically when import completes with failures.

---

## Phase 6: API Router Updates

### File: `apps/api/src/schemas/bulk.ts`
**Action**: EDIT

Update `startImportSchema` to include optional userEmail:

```typescript
export const startImportSchema = z.object({
  fileId: z.string(),
  filename: z.string(),
  mode: z.enum(["CREATE", "CREATE_AND_ENRICH"]).default("CREATE"),
  // New field - will be populated from session if not provided
});
```

### File: `apps/api/src/trpc/routers/bulk/import.ts`
**Action**: EDIT

1. **Update `start` mutation**:
   - Get user email from session/context
   - Pass to job creation and background task payload

2. **Update `getRecentImports` query**:
   - Return correction file info in response

3. **Implement `exportCorrections` endpoint**:
   ```typescript
   exportCorrections: brandRequiredProcedure
     .input(exportCorrectionsSchema)
     .mutation(async ({ ctx, input }) => {
       // Check if correction file already exists and not expired
       if (job.correctionDownloadUrl && job.correctionExpiresAt) {
         const expiresAt = new Date(job.correctionExpiresAt);
         if (expiresAt > new Date()) {
           // Return existing URL
           return {
             jobId: input.jobId,
             status: "ready" as const,
             downloadUrl: job.correctionDownloadUrl,
             expiresAt: job.correctionExpiresAt,
           };
         }
       }
       
       // Trigger generation if not exists or expired
       await tasks.trigger("generate-error-report", {
         jobId: input.jobId,
         brandId,
         userEmail: ctx.user.email,
       });
       
       return {
         jobId: input.jobId,
         status: "generating" as const,
         message: "Error report is being generated. Check back shortly.",
         downloadUrl: null,
       };
     }),
   ```

**Reason**: Frontend needs access to correction file data and ability to trigger report generation.

---

## Phase 7: Frontend Modal Updates

### File: `apps/app/src/components/modals/import-products-modal.tsx`
**Action**: EDIT

Add a new section in the `step === "method"` view, below the method selection options:

```tsx
{/* Recent Import Failures Banner */}
{recentFailedImport && (
  <div className="mt-6 pt-6 border-t border-border">
    <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20">
      <Icons.AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="type-p text-foreground font-medium">
          {recentFailedImport.summary?.failedProducts || 0} products failed during your most recent import
        </p>
        <p className="type-small text-secondary mt-1">
          Download the error report to see which products need corrections.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={handleDownloadErrorReport}
          disabled={isDownloadingReport}
        >
          {isDownloadingReport ? (
            <>
              <Icons.Loader className="w-4 h-4 animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Icons.Download className="w-4 h-4 mr-2" />
              Download Error Report
            </>
          )}
        </Button>
      </div>
    </div>
  </div>
)}
```

Implementation details:
1. Query `getRecentImports` with limit 1
2. Check if most recent job has `hasExportableFailures === true`
3. If `correctionDownloadUrl` exists and not expired, download directly
4. Otherwise, call `exportCorrections` mutation and poll for completion

**Reason**: Users need to see import failures and download error reports from the UI.

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `packages/db/src/schema/data/import-jobs.ts` | EDIT | Add correction file fields, userId, userEmail |
| `packages/db/src/queries/bulk/import/types.ts` | EDIT | Update TypeScript interfaces |
| `packages/db/src/queries/bulk/import/jobs.ts` | EDIT | Update queries to return new fields, add update function |
| `packages/jobs/src/trigger/bulk/generate-error-report.ts` | CREATE | New background job for error report generation |
| `packages/email/emails/import-failures.tsx` | CREATE | New email template for import failures |
| `packages/jobs/src/trigger/bulk/commit-to-production.ts` | EDIT | Trigger error report on completion with failures |
| `packages/jobs/src/trigger/bulk/validate-and-stage.ts` | EDIT | Pass user info, trigger report if all fail |
| `apps/api/src/trpc/routers/bulk/import.ts` | EDIT | Accept userEmail, return correction info, implement exportCorrections |
| `apps/api/src/schemas/bulk.ts` | EDIT | Update schemas for new fields |
| `apps/app/src/components/modals/import-products-modal.tsx` | EDIT | Add failure banner with download button |

---

## Testing Checklist

- [ ] Schema migration generates and applies correctly
- [ ] Error report generates for imports with failures
- [ ] Excel file contains only failed rows with red highlighting
- [ ] Download URL is valid and accessible
- [ ] Email notification is sent to user
- [ ] Modal shows failure banner for recent failed imports
- [ ] Download button works (direct download if URL exists, trigger generation otherwise)
- [ ] Expired URLs trigger regeneration

---

## Dependencies

- Existing `packages/jobs/src/lib/excel-export.ts` - Uses `generateErrorOnlyCorrectionExcel()`
- Existing `packages/email/` - Uses Resend for email sending
- Supabase Storage - New bucket `product-imports-corrections` (or reuse existing)
