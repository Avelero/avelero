# Code Refactoring Guide

## Overview

This guide documents the refactoring of duplicated code into the new `@v1/import-utils` shared package.

## Package Structure

```
packages/import-utils/
├── package.json
├── tsconfig.json
└── src/
    ├── value-mapper.ts      # Shared ValueMapper class
    ├── csv-parser.ts        # Shared CSV parsing utilities (TBD)
    └── validation.ts        # Shared validation utilities (TBD)
```

## Completed Refactoring

### 1. ValueMapper Class Migration

**Status**: ✅ File copied to shared package

**Before**:
- `apps/api/src/lib/value-mapper.ts` (1,191 lines)
- `packages/jobs/src/lib/value-mapper.ts` (1,191 lines)
- **Total duplication**: 2,382 lines

**After**:
- `packages/import-utils/src/value-mapper.ts` (single source of truth)
- Both packages will import from `@v1/import-utils/value-mapper`

**Next Steps**:
1. Update `apps/api/src/lib/value-mapper.ts` to re-export from shared package
2. Update `packages/jobs/src/lib/value-mapper.ts` to re-export from shared package
3. Run tests to verify behavior unchanged
4. (Optional) Delete old files after imports updated

## Pending Refactoring

### 2. CSV Parser Utilities

**Duplication**:
- `apps/api/src/lib/csv-parser.ts`
- `packages/jobs/src/lib/csv-parser.ts`

**Plan**:
1. Extract common parsing logic to `packages/import-utils/src/csv-parser.ts`
2. Keep package-specific wrappers if needed
3. Ensure both packages use shared implementation

### 3. Job Validation Logic

**Duplication**:
- Job ownership checks in `apps/api/src/trpc/routers/bulk/values.ts:50`
- Similar logic in `apps/api/src/trpc/routers/bulk/import.ts`
- Similar logic in `apps/api/src/trpc/routers/bulk/staging.ts`

**Plan**:
1. Extract to `packages/import-utils/src/validation.ts`
2. Export utilities like:
   - `validateJobOwnership(db, jobId, brandId)`
   - `validateJobStatus(job, allowedStatuses)`
3. Use in all bulk routers

### 4. User Authentication Logic

**Duplication**:
- `apps/api/src/lib/websocket-manager.ts:130`
- `apps/api/src/trpc/init.ts:130-151`

**Plan**:
1. Extract to shared utility in `apps/api/src/utils/auth.ts`
2. Export `getUserAndBrandFromToken(token)` function
3. Use in both WebSocket manager and tRPC context

## Migration Strategy

### Phase 1: Create Shared Package (✅ Complete)
- [x] Create `packages/import-utils` structure
- [x] Add package.json with proper exports
- [x] Add TypeScript configuration
- [x] Copy ValueMapper to shared location

### Phase 2: Update Imports (In Progress)

For each duplicated file, we'll use a phased approach:

1. **Re-export Pattern** (Safe, zero downtime):
   ```typescript
   // apps/api/src/lib/value-mapper.ts
   export * from '@v1/import-utils/value-mapper';
   export { valueMapper } from '@v1/import-utils/value-mapper';
   ```

2. **Update Consumers** (Gradual):
   - Update imports one file at a time
   - Test after each change
   - Use TypeScript to catch any breaking changes

3. **Remove Duplicates** (Final cleanup):
   - Once all imports updated, remove old files
   - Verify no references remain

### Phase 3: Testing

For each refactored module:

1. **Unit Tests**:
   - Run existing tests against new imports
   - Add tests for shared package if missing

2. **Integration Tests**:
   - Test API endpoints that use refactored code
   - Test background jobs that use refactored code

3. **Type Checking**:
   ```bash
   npm run typecheck
   ```

4. **Build Verification**:
   ```bash
   npm run build
   ```

## Usage Examples

### Using Shared ValueMapper

```typescript
// In apps/api or packages/jobs
import { ValueMapper, EntityType } from '@v1/import-utils/value-mapper';

const mapper = new ValueMapper(db);
const result = await mapper.mapColorName(brandId, "Blue", "color_name");
```

### Using Shared CSV Parser (Future)

```typescript
// In apps/api or packages/jobs
import { parseCSV, normalizeHeaders } from '@v1/import-utils/csv-parser';

const result = await parseCSV(filePath, {
  requiredHeaders: ['product_name', 'sku'],
  optionalHeaders: ['color_name', 'size_name'],
});
```

### Using Shared Validation (Future)

```typescript
// In tRPC routers
import { validateJobOwnership } from '@v1/import-utils/validation';

await validateJobOwnership(ctx.db, input.jobId, ctx.brandId);
```

## Benefits

### Code Deduplication
- **Before**: 2,382+ lines of duplicated ValueMapper code
- **After**: 1,191 lines in shared package
- **Savings**: 50% reduction in ValueMapper code

### Maintenance
- Single source of truth for import utilities
- Bug fixes apply to all consumers automatically
- Easier to add new features

### Testing
- Test once, use everywhere
- Shared test utilities for import operations
- Better test coverage

### Type Safety
- Shared types ensure consistency
- TypeScript catches breaking changes
- Better IDE support

## Rollback Plan

If issues arise after refactoring:

1. **Immediate**:
   - Revert to using local copies via git
   - All original files still in history

2. **Gradual**:
   - Re-export pattern allows fallback
   - Can selectively revert individual consumers

3. **Testing**:
   - Keep comprehensive tests for shared package
   - Monitor for regressions in CI/CD

## Next Steps

1. ✅ Create shared package structure
2. ✅ Copy ValueMapper to shared package
3. ⏳ Update ValueMapper imports in api and jobs
4. ⏳ Extract CSV parser to shared package
5. ⏳ Extract validation utilities
6. ⏳ Extract auth utilities
7. ⏳ Run comprehensive tests
8. ⏳ Update documentation

## Dependencies

The `@v1/import-utils` package depends on:
- `@v1/db` - For database types and queries
- `papaparse` - For CSV parsing

Consumers need to:
- Add `@v1/import-utils` to their dependencies
- Ensure `@v1/db` is available (already present)

## Timeline

- **Phase 1** (Completed): Create package structure
- **Phase 2** (Next): Update imports and test ValueMapper
- **Phase 3** (Future): Extract remaining duplicated code
- **Phase 4** (Future): Remove old files and final cleanup

## Questions?

See the main `FIXES_SUMMARY.md` for context on why this refactoring was needed.
