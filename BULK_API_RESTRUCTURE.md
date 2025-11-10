# Bulk API Restructure - Option 1 Implementation

## Overview
Restructured bulk import API endpoints into a nested router structure following the existing patterns in the codebase (similar to `passports.templates.*`).

## New Structure

### Import Lifecycle (`bulk.import.*`)
- `bulk.import.validate` - Quick pre-validation of file headers
- `bulk.import.start` - Start async validation job
- `bulk.import.status` - Get job status and progress
- `bulk.import.approve` - Trigger Phase 2 commit to production
- `bulk.import.cancel` - Cancel job and discard staging data

### Staging Operations (`bulk.staging.*`)
- `bulk.staging.preview` - View validated staging data
- `bulk.staging.errors` - Get paginated error list
- `bulk.staging.export` - Export failed rows as CSV

### Value Mapping (`bulk.values.*`)
- `bulk.values.unmapped` - Get unmapped values needing definition
- `bulk.values.define` - Create single catalog entity inline
- `bulk.values.batchDefine` - Create multiple catalog entities

### Legacy Endpoints (Backwards Compatibility)
- `bulk.importLegacy` - Synchronous product import (deprecated)
- `bulk.update` - Passport bulk updates (different domain)

## Migration Map

```
OLD ENDPOINT                  → NEW ENDPOINT
─────────────────────────────────────────────────
bulk.validateImport           → bulk.import.validate
bulk.startImport              → bulk.import.start
bulk.getImportStatus          → bulk.import.status
bulk.approveImport            → bulk.import.approve
bulk.cancelImport             → bulk.import.cancel
bulk.getStagingPreview        → bulk.staging.preview
bulk.getImportErrors          → bulk.staging.errors
bulk.exportFailedRows         → bulk.staging.export
bulk.getUnmappedValues        → bulk.values.unmapped
bulk.defineValue              → bulk.values.define
bulk.batchDefineValues        → bulk.values.batchDefine
```

## Files Changed

### Backend (API)
1. **`apps/api/src/trpc/routers/bulk/import.ts`** (NEW)
   - Import lifecycle operations
   - 5 endpoints: validate, start, status, approve, cancel

2. **`apps/api/src/trpc/routers/bulk/staging.ts`** (NEW)
   - Staging data operations
   - 3 endpoints: preview, errors, export

3. **`apps/api/src/trpc/routers/bulk/values.ts`** (NEW)
   - Value mapping operations
   - 3 endpoints: unmapped, define, batchDefine

4. **`apps/api/src/trpc/routers/bulk/index.ts`** (UPDATED)
   - Mounts nested routers
   - Keeps legacy endpoints for backwards compatibility
   - Reduced from ~1160 lines to ~169 lines

### Frontend (App)
1. **`apps/app/src/contexts/import-progress-context.tsx`**
   - Updated `bulk.getImportStatus` → `bulk.import.status`

2. **`apps/app/src/components/passports/upload-sheet.tsx`**
   - Updated `bulk.validateImport` → `bulk.import.validate`
   - Updated `bulk.startImport` → `bulk.import.start`

3. **`apps/app/src/components/import/import-review-dialog.tsx`**
   - Updated `bulk.getImportStatus` → `bulk.import.status`
   - Updated `bulk.getUnmappedValues` → `bulk.values.unmapped`
   - Updated `bulk.approveImport` → `bulk.import.approve`
   - Updated `bulk.cancelImport` → `bulk.import.cancel`
   - Updated query keys (2 occurrences)

4. **`apps/app/src/components/import/staging-preview-table.tsx`**
   - Updated `bulk.getStagingPreview` → `bulk.staging.preview`
   - Updated JSDoc comment

5. **`apps/app/src/components/import/error-list-section.tsx`**
   - Updated `bulk.getImportErrors` → `bulk.staging.errors`
   - Updated JSDoc comment

6. **`apps/app/src/components/import/unmapped-values-section.tsx`**
   - Updated `bulk.getUnmappedValues` → `bulk.values.unmapped`
   - Updated `bulk.defineValue` → `bulk.values.define`
   - Updated query key

## Benefits

1. **Better Organization**: Clear separation of concerns
   - Import lifecycle vs staging operations vs value mapping

2. **Scalability**: Easy to add new endpoints within each category
   - Example: `bulk.import.retry`, `bulk.staging.rollback`

3. **Consistency**: Matches existing patterns (`passports.templates.*`)

4. **Maintainability**: Smaller, focused files instead of 1160-line monolith

5. **Type Safety**: Full tRPC type inference maintained

6. **Backwards Compatible**: Legacy endpoints preserved

## Testing

### Verify API Structure
```bash
# Check type exports work
cd apps/api
bun run typecheck
```

### Verify Client Usage
```bash
# Check all client references updated
cd apps/app
bun run typecheck
```

### Manual Testing Checklist
- [ ] File upload and validation
- [ ] Import job creation
- [ ] Real-time progress updates (WebSocket)
- [ ] Staging data preview
- [ ] Error list display
- [ ] Unmapped values definition
- [ ] Import approval
- [ ] Import cancellation

## Rollback Plan

If issues arise, the old structure can be restored from git:
```bash
git checkout HEAD~1 apps/api/src/trpc/routers/bulk/index.ts
```

The frontend changes are find/replace reversible.

## Next Steps

1. Update API documentation
2. Update client SDK if auto-generated
3. Consider deprecation warnings for old structure (if it existed)
4. Monitor production for any missed references

## Notes

- No database migrations required
- No schema changes required
- All existing functionality preserved
- WebSocket implementation remains intact
