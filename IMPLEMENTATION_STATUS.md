# Batch Creation Implementation Status

## ✅ Completed

### 1. Performance Optimizations
- ✅ Created `pending-entities-context.tsx` - Core state management
- ✅ Optimized catalogData endpoint (removed redundant unmapped query)
- ✅ Fixed frontend parallel loading (catalogData loads immediately)
- ✅ Added early prefetching in ImportProgressContext (prefetch on VALIDATED status)
- ✅ Created database indexes for all entity tables
- ✅ Fixed colors showing grey - Now uses static color selections package

### 2. EntityValueCombobox Improvements
- ✅ Removed infinite loop (added seasonsData dependency)
- ✅ Fixed seasons modal state bug
- ✅ Changed to direct creation buttons (no confusing dropdowns)
- ✅ Simplified for materials, sizes, seasons, facilities, showcase brands

### 3. Documentation
- ✅ Created comprehensive implementation guide (BATCH_CREATION_IMPLEMENTATION_GUIDE.md)
- ✅ Documented architecture, data flow, and testing strategy

## 🚧 In Progress / Remaining

### Critical Remaining Work

#### 1. Complete Batch Creation System

**File: `apps/app/src/components/import/import-review-dialog.tsx`**

Need to add:
```typescript
import { PendingEntitiesProvider, usePendingEntities } from "@/contexts/pending-entities-context";

// Wrap content with provider
<Sheet>
  <PendingEntitiesProvider>
    <SheetContent>
      {/* existing content */}
    </SheetContent>
  </PendingEntitiesProvider>
</Sheet>

// Add batch creation mutation
const { getAllPendingEntities, clearPendingEntities } = usePendingEntities();

const batchCreateMutation = useMutation({
  mutationFn: async () => {
    const pending = getAllPendingEntities();

    // Group by entity type
    const grouped = {
      MATERIAL: pending.filter(p => p.entityType === "MATERIAL"),
      SIZE: pending.filter(p => p.entityType === "SIZE"),
      SEASON: pending.filter(p => p.entityType === "SEASON"),
      FACILITY: pending.filter(p => p.entityType === "FACILITY"),
      SHOWCASE_BRAND: pending.filter(p => p.entityType === "SHOWCASE_BRAND"),
    };

    // Create all entities in parallel
    const results = await Promise.allSettled([
      ...grouped.MATERIAL.map(p =>
        trpc.brand.materials.create.mutate(p.entityData)
      ),
      ...grouped.SIZE.map(p =>
        trpc.brand.sizes.create.mutate(p.entityData)
      ),
      // ... etc for other types
    ]);

    // Map created entities to CSV values
    const mappings = results
      .filter(r => r.status === 'fulfilled')
      .map((r, idx) => {
        const entity = r.value.data;
        const pendingEntity = pending[idx];
        return trpc.bulk.values.mapToExisting.mutate({
          jobId,
          entityType: pendingEntity.entityType,
          entityId: entity.id,
          rawValue: pendingEntity.rawValue,
          sourceColumn: pendingEntity.sourceColumn,
        });
      });

    await Promise.all(mappings);

    return results;
  }
});

// Modify handleApprove
const handleApprove = async () => {
  if (!jobId) return;

  try {
    setIsApproving(true);

    // STEP 1: Batch create all entities
    await batchCreateMutation.mutateAsync();

    // STEP 2: Clear pending entities
    clearPendingEntities();

    // STEP 3: Approve import
    await approveImportMutation.mutateAsync({ jobId });

    toast.success("Import approved! Committing to production...");
    closeReviewDialog();

  } catch (err) {
    toast.error(err.message || "Failed to approve import");
  } finally {
    setIsApproving(false);
  }
};
```

#### 2. Update UnmappedValuesSection

**File: `apps/app/src/components/import/unmapped-values-section.tsx`**

Need to:
- Remove batch selection UI (checkboxes, selectedValues state)
- Remove batch create buttons
- Remove UnmappedBatchProgressModal
- Add PendingEntities integration
- Add "Defined ✓" indicators

```typescript
import { usePendingEntities, generatePendingEntityKey } from "@/contexts/pending-entities-context";

const { hasPendingEntity } = usePendingEntities();

// Check if all values defined
React.useEffect(() => {
  const allDefined = unmappedGroups.every(group =>
    group.values.every(value => {
      const key = generatePendingEntityKey(group.entityType, value.rawValue);
      return hasPendingEntity(key);
    })
  );
  onAllValuesDefined(allDefined);
}, [unmappedGroups, hasPendingEntity]);

// In render, show checkmark for defined values
{hasPendingEntity(key) && (
  <Icons.CheckCircle2 className="h-4 w-4 text-green-600" />
)}
```

#### 3. Modify EntityValueCombobox

**File: `apps/app/src/components/import/entity-value-combobox.tsx`**

Need to store instead of create:

```typescript
import { usePendingEntities, generatePendingEntityKey } from "@/contexts/pending-entities-context";

const { setPendingEntity } = usePendingEntities();
const key = generatePendingEntityKey(entityType, rawValue);

// For MaterialSheet callback:
onMaterialCreated={(materialData) => {
  setPendingEntity({
    key,
    entityType: "MATERIAL",
    rawValue,
    sourceColumn,
    jobId,
    entityData: materialData,
  });
  setSheetOpen(false);
  toast.success(`Material "${rawValue}" defined`);
}}
```

#### 4. Update Sheet/Modal Components

Need to modify these components to support "define mode":
- `material-sheet.tsx`
- `size-modal.tsx`
- `season-modal.tsx`
- `operator-sheet.tsx`
- `showcase-brand-sheet.tsx`

Add `mode` prop:
```typescript
interface SheetProps {
  mode?: 'create' | 'define';
  onEntityCreated: (data: EntityData) => void;
}

// In handleSave:
if (mode === 'define') {
  // Just return data, don't create in DB
  onEntityCreated(formData);
} else {
  // Normal creation flow
  createMutation.mutate(formData);
}
```

#### 5. Fix Categories

Categories are not creating entities, just mapping. Need to debug CategorySelect integration.

Investigate:
- Check CategorySelect props
- Verify onChange signature
- Test with console.logs

## 📊 Implementation Progress

- [x] Performance optimizations (100%)
- [x] Colors fix (100%)
- [x] Remove confusing dropdowns (100%)
- [x] Documentation (100%)
- [ ] PendingEntitiesProvider integration (10%)
- [ ] EntityValueCombobox deferred creation (10%)
- [ ] Sheet/Modal modifications (0%)
- [ ] Batch creation logic (0%)
- [ ] Categories fix (0%)
- [ ] Testing (0%)

**Overall Progress: ~35%**

## 🎯 Next Steps (Priority Order)

1. **HIGH**: Integrate PendingEntitiesProvider into ImportReviewDialog
2. **HIGH**: Update EntityValueCombobox to store instead of create
3. **HIGH**: Implement batch creation mutation in handleApprove
4. **MEDIUM**: Modify sheet/modal components for define mode
5. **MEDIUM**: Update UnmappedValuesSection UI
6. **LOW**: Fix categories
7. **LOW**: End-to-end testing

## ⏱️ Time Estimates

- Steps 1-3 (Core batch system): 2-3 hours
- Step 4 (Sheet modifications): 1-2 hours
- Step 5 (UI updates): 1 hour
- Steps 6-7 (Categories + testing): 1-2 hours

**Total Remaining: 5-8 hours**

## 🐛 Known Issues

1. ⚠️ Categories not functioning - needs investigation
2. ⚠️ Colors work but need testing with actual data
3. ⚠️ "Select materials" label mentioned by user but not found in code
4. ⚠️ Batch creation progress tracking not implemented yet

## 📝 Notes

- All changes are backwards compatible
- Pending entities are stored in React state (cleared on refresh)
- Batch creation happens in parallel for performance
- Error handling needs to be comprehensive (partial failures)
- Consider adding progress modal during batch creation

## 🧪 Testing Checklist

- [ ] Upload CSV with unmapped materials
- [ ] Click "Create Material" → Fill form → Verify stores in pending
- [ ] Verify "Defined ✓" appears
- [ ] Repeat for all unmapped values
- [ ] Verify "Approve & Import" enables when all defined
- [ ] Click approve → Verify all entities created
- [ ] Verify all mappings created
- [ ] Verify import proceeds successfully
- [ ] Test error cases (creation failure, partial success)
- [ ] Test edit functionality (re-open sheet for defined value)

## 📚 References

- Implementation Guide: `BATCH_CREATION_IMPLEMENTATION_GUIDE.md`
- Pending Entities Context: `apps/app/src/contexts/pending-entities-context.tsx`
- Colors Package: `packages/selections/src/colors.ts`

