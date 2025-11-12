# Batch Creation Implementation Guide
## Deferred Entity Creation for Bulk Import Unmapped Values

---

## 🎯 Goal

Transform the unmapped values section from **immediate creation** to **deferred batch creation**:

- User fills out entity details for all unmapped values
- No immediate database creation
- "Approve & Import" button becomes clickable when ALL values are defined
- On approve: Create ALL entities in a batch → Map them → Approve import

---

## 📊 Current State Analysis

### What Works:
- ✅ EntityValueCombobox opens correct sheets/modals
- ✅ MaterialSheet, SizeModal, SeasonModal, OperatorSheet, ShowcaseBrandSheet all work
- ✅ Direct creation buttons (no more confusing dropdowns)

### Current Issues:
1. ❌ **Colors showing as grey**: Database has hex values but UI shows grey
2. ❌ **Materials showing "Select materials"**: Left-side label is outdated
3. ❌ **Categories not functioning**: CategorySelect needs investigation
4. ❌ **Immediate creation**: Entities are created the moment the sheet/modal closes
5. ❌ **No batch coordination**: Each entity creates independently
6. ❌ **Confusing checkboxes**: Batch selection UI is for old system

---

## 🏗️ New Architecture Design

### Component Hierarchy:

```
ImportProgressProvider
  └── ImportReviewDialog
      └── PendingEntitiesProvider (NEW)
          └── UnmappedValuesSection
              └── EntityValueCombobox (for each unmapped value)
                  └── MaterialSheet / SizeModal / SeasonModal / etc.
```

### Data Flow:

```
1. User clicks "Create Material"
   ↓
2. MaterialSheet opens (pre-filled with rawValue)
   ↓
3. User fills additional details (country, recyclable, etc.)
   ↓
4. User clicks "Save"
   ↓
5. Sheet closes, data stored in PendingEntitiesProvider (NO database call)
   ↓
6. EntityValueCombobox shows "Defined ✓" status
   ↓
7. Repeat for all unmapped values
   ↓
8. When ALL values defined → "Approve & Import" becomes enabled
   ↓
9. User clicks "Approve & Import"
   ↓
10. Batch create ALL entities from PendingEntitiesProvider
    ↓
11. Batch map ALL created entities to CSV values
    ↓
12. Approve import (existing logic)
```

---

## 📁 Files to Create/Modify

### 1. ✅ **CREATE: `pending-entities-context.tsx`** (DONE)
**Purpose**: Store entity data locally before creation

**Key Features**:
- Map<string, PendingEntity> for O(1) lookup
- Key format: `"MATERIAL:Cotton"`, `"SIZE:XL"`, `"SEASON:Spring 2025"`
- Stores all data needed to create entity later
- Provides hooks: `setPendingEntity`, `hasPendingEntity`, `getPendingCount`

**Already Created**: ✅ `/apps/app/src/contexts/pending-entities-context.tsx`

---

### 2. 🔄 **MODIFY: `import-review-dialog.tsx`**

#### Changes Needed:

**A. Wrap with PendingEntitiesProvider:**
```tsx
import { PendingEntitiesProvider } from "@/contexts/pending-entities-context";

// Inside ImportReviewDialog return:
return (
  <Sheet open={reviewDialogOpen} onOpenChange={closeReviewDialog}>
    <PendingEntitiesProvider>
      <SheetContent>
        {/* existing content */}
      </SheetContent>
    </PendingEntitiesProvider>
  </Sheet>
);
```

**B. Add batch creation logic:**
```tsx
import { usePendingEntities } from "@/contexts/pending-entities-context";

const { getAllPendingEntities, clearPendingEntities } = usePendingEntities();

// New mutation for batch creation
const batchCreateAndMapMutation = useMutation({
  mutationFn: async () => {
    const pending = getAllPendingEntities();

    // Group by entity type
    const grouped = groupPendingEntitiesByType(pending);

    // Create all entities in parallel by type
    const createdEntities = await Promise.all([
      createMaterials(grouped.MATERIAL),
      createColors(grouped.COLOR),
      createSizes(grouped.SIZE),
      createSeasons(grouped.SEASON),
      // ... etc
    ]);

    // Map all created entities to CSV values
    await Promise.all(
      createdEntities.flat().map(entity =>
        trpc.bulk.values.mapToExisting.mutate({
          jobId,
          entityType: entity.type,
          entityId: entity.id,
          rawValue: entity.rawValue,
          sourceColumn: entity.sourceColumn,
        })
      )
    );

    return createdEntities;
  }
});
```

**C. Modify handleApprove:**
```tsx
const handleApprove = async () => {
  if (!jobId) return;

  // Check if all unmapped values have pending entities
  if (!allValuesDefined) {
    toast.error("Please define all unmapped values before approving");
    return;
  }

  try {
    setIsApproving(true);

    // STEP 1: Batch create all entities and map them
    await batchCreateAndMapMutation.mutateAsync();

    // STEP 2: Clear pending entities
    clearPendingEntities();

    // STEP 3: Approve the import (existing logic)
    await approveImportMutation.mutateAsync({ jobId });

    toast.success("Import approved! Committing to production...");
    closeReviewDialog();

  } catch (err) {
    const error = err as Error;
    toast.error(error.message || "Failed to approve import");
    console.error("Approve error:", err);
  } finally {
    setIsApproving(false);
  }
};
```

**D. Update canApprove logic:**
```tsx
// Instead of checking totalUnmapped === 0
// Check if all unmapped values have pending entities
const canApprove = allValuesDefined; // Set by UnmappedValuesSection
```

---

### 3. 🔄 **MODIFY: `unmapped-values-section.tsx`**

#### Changes Needed:

**A. Remove batch selection UI:**
```diff
- const [selectedValues, setSelectedValues] = React.useState<Map<EntityType, Set<string>>>(new Map());
- const [batchProcessing, setBatchProcessing] = React.useState(false);
- const [batchProgress, setBatchProgress] = React.useState({...});

// Remove all checkbox-related code
// Remove batch create buttons
// Remove UnmappedBatchProgressModal
```

**B. Add PendingEntities integration:**
```tsx
import { usePendingEntities, generatePendingEntityKey } from "@/contexts/pending-entities-context";

const { getPendingCount, hasPendingEntity } = usePendingEntities();

// Check if all unmapped values have pending entities
React.useEffect(() => {
  const allDefined = unmappedGroups.every(group =>
    group.values.every(value => {
      const key = generatePendingEntityKey(group.entityType, value.rawValue);
      return hasPendingEntity(key);
    })
  );

  onAllValuesDefined(allDefined);
}, [unmappedGroups, hasPendingEntity, onAllValuesDefined]);
```

**C. Simplify the UI - remove checkboxes:**
```tsx
// In the entity groups render:
<div className="divide-y divide-border">
  {group.values.map((value, idx) => {
    const key = generatePendingEntityKey(group.entityType, value.rawValue);
    const isDefined = hasPendingEntity(key);

    return (
      <div key={`${value.rawValue}-${idx}`} className="flex items-center gap-3 px-4 py-3">
        {/* Remove checkbox */}

        {/* Status indicator */}
        {isDefined && (
          <Icons.CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
        )}

        {/* Value name */}
        <div className="flex-1">
          <p className="type-p text-primary">{value.rawValue}</p>
          <p className="type-small text-tertiary">{value.affectedRows} rows</p>
        </div>

        {/* EntityValueCombobox */}
        <div className="w-full max-w-[280px]">
          <EntityValueCombobox
            entityType={group.entityType}
            rawValue={value.rawValue}
            sourceColumn={value.sourceColumn}
            jobId={jobId}
            isDefined={isDefined}
          />
        </div>
      </div>
    );
  })}
</div>
```

**D. Remove mutations:**
```diff
- const createColorMutation = useMutation(trpc.brand.colors.create.mutationOptions());
- const createMaterialMutation = useMutation(trpc.brand.materials.create.mutationOptions());
- const defineValueMutation = useMutation(trpc.bulk.values.define.mutationOptions());
```

**E. Remove batch create handler:**
```diff
- const handleBatchCreate = async (group: UnmappedValueGroup) => { ... }
```

---

### 4. 🔄 **MODIFY: `entity-value-combobox.tsx`**

#### Changes Needed:

**A. Add PendingEntities integration:**
```tsx
import { usePendingEntities, generatePendingEntityKey } from "@/contexts/pending-entities-context";

interface EntityValueComboboxProps {
  entityType: EntityType;
  rawValue: string;
  sourceColumn: string;
  jobId: string;
  isDefined?: boolean; // NEW: Indicates if entity data is already stored
  className?: string;
}

const { setPendingEntity, getPendingEntity } = usePendingEntities();
const key = generatePendingEntityKey(entityType, rawValue);
```

**B. Modify sheet/modal callbacks to STORE instead of CREATE:**

**For MaterialSheet:**
```tsx
<MaterialSheet
  open={sheetOpen}
  onOpenChange={setSheetOpen}
  initialName={rawValue}
  onMaterialCreated={(materialData) => {
    // DON'T create in database
    // Instead, store in PendingEntitiesProvider
    setPendingEntity({
      key,
      entityType: "MATERIAL",
      rawValue,
      sourceColumn,
      jobId,
      entityData: {
        name: materialData.name,
        countryOfOrigin: materialData.countryOfOrigin,
        recyclable: materialData.recyclable,
        certificationId: materialData.certificationId,
      },
    });

    setSheetOpen(false);
    toast.success(`Material "${rawValue}" defined`);
  }}
/>
```

**For SizeModal:**
```tsx
<SizeModal
  open={sizeModalOpen}
  onOpenChange={setSizeModalOpen}
  prefillSize={rawValue}
  onSave={(sizeData) => {
    setPendingEntity({
      key,
      entityType: "SIZE",
      rawValue,
      sourceColumn,
      jobId,
      entityData: {
        name: sizeData.name,
        measurements: sizeData.measurements,
      },
    });

    setSizeModalOpen(false);
    toast.success(`Size "${rawValue}" defined`);
  }}
/>
```

**C. Update button label based on isDefined:**
```tsx
const buttonLabel = isDefined
  ? `Edit "${rawValue}"`  // Show checkmark or "Edit"
  : `Create "${rawValue}"`; // Show plus icon
```

**D. Remove mapping logic:**
```diff
- const mapToExistingMutation = useMutation(trpc.bulk.values.mapToExisting.mutationOptions());
- const handleMapEntity = async (entityId: string, entityName: string) => { ... }
- const handleEntityCreated = async (entityData: { id: string; name: string }) => { ... }
```

---

### 5. 🔄 **MODIFY: Sheet/Modal Components**

Need to modify these components to accept `mode` prop:

**Components to modify:**
- `material-sheet.tsx`
- `size-modal.tsx`
- `season-modal.tsx`
- `operator-sheet.tsx`
- `showcase-brand-sheet.tsx`

**Change required:**
```tsx
interface SheetProps {
  mode?: 'create' | 'define'; // NEW
  onMaterialCreated: (material: MaterialData) => void; // Returns data, doesn't create
}

// Inside the sheet:
const handleSave = () => {
  if (mode === 'define') {
    // Just return the data via callback
    onMaterialCreated(formData);
  } else {
    // Normal creation flow
    createMutation.mutate(formData, {
      onSuccess: (data) => onMaterialCreated(data),
    });
  }
};
```

**OR** (simpler approach):
Keep components as-is, but add a `skipDatabaseCreation` prop that makes them return data without calling mutations.

---

## 🐛 Fixing Current Issues

### Issue 1: Colors Showing as Grey

**Problem**: Line 219 in entity-value-combobox.tsx
```tsx
hex: c.hex || "808080", // Use actual hex from database
```

**Root Cause**: Need to check what `colorsData?.data` actually contains

**Fix**:
```tsx
// First, verify the data structure
console.log('Colors data:', colorsData?.data);

// The issue might be that colors are fetched from catalog API
// which might not include hex values. Need to check:
const { data: colorsData } = useQuery({
  ...trpc.brand.colors.list.queryOptions(undefined),
  enabled: entityType === "COLOR",
});

// Solution: Ensure the colors.list endpoint returns hex values
// Check: apps/api/src/trpc/routers/brand/colors.ts
```

**Verification Steps**:
1. Check `apps/api/src/trpc/routers/brand/colors.ts` - does `list` query select `hex`?
2. Check database schema - does `brand_colors` table have `hex` column?
3. If not, need to update the query to include hex

---

### Issue 2: Materials Showing "Select materials"

**Problem**: Old UI labels not updated

**Fix**: Search for "Select materials" text and update labels
```bash
grep -r "Select materials" apps/app/src/components/import/
```

**Expected locations**:
- unmapped-values-section.tsx header labels
- Entity group headers

**Update to**: "Materials" or "Define materials"

---

### Issue 3: Categories Not Functioning

**Problem**: CategorySelect integration issue

**Investigation needed**:
1. Check if CategorySelect has correct props
2. Verify onChange callback signature
3. Check if categories are being fetched

**Current code** (entity-value-combobox.tsx:300-320):
```tsx
if (entityType === "CATEGORY") {
  return (
    <div className={cn("w-full", className)}>
      <CategorySelect
        value=""
        onChange={async (categoryPath) => {
          if (categoryPath && categoryPath !== "Select category") {
            await handleMapEntity(categoryPath, categoryPath);
          }
        }}
        label=""
        className="h-9"
      />
    </div>
  );
}
```

**Possible fixes**:
1. Check CategorySelect component signature - might need different prop names
2. Debug: Add console.log to see if onChange is being called
3. Check if categoryPath format is correct

**Alternative approach**:
Replace CategorySelect with a simple Combobox that calls the bulk API directly:
```tsx
// Fetch categories from catalog
const { data: categoriesData } = useQuery({
  ...trpc.bulk.values.catalogData.queryOptions({ jobId }),
  select: (data) => data.categories,
});

// Render as simple dropdown
<Popover>
  <PopoverTrigger>Select category</PopoverTrigger>
  <PopoverContent>
    {categoriesData?.map(cat => (
      <CommandItem
        key={cat.id}
        onSelect={() => handleMapEntity(cat.id, cat.name)}
      >
        {cat.name}
      </CommandItem>
    ))}
  </PopoverContent>
</Popover>
```

---

## 🧪 Testing Strategy

### Unit Testing:
1. **PendingEntitiesProvider**:
   - ✅ Add entity
   - ✅ Remove entity
   - ✅ Check if entity exists
   - ✅ Get all entities
   - ✅ Clear all

2. **EntityValueCombobox**:
   - ✅ Stores data in PendingEntitiesProvider
   - ✅ Shows "Defined" status correctly
   - ✅ Opens correct sheet/modal

3. **UnmappedValuesSection**:
   - ✅ Tracks which values are defined
   - ✅ Notifies parent when all defined
   - ✅ Displays pending entities correctly

### Integration Testing:
1. **End-to-End Flow**:
   ```
   1. Upload CSV with unmapped materials, colors, sizes
   2. Click "Create Material" → Fill form → Save
   3. Verify "Defined ✓" appears
   4. Repeat for all unmapped values
   5. Verify "Approve & Import" becomes enabled
   6. Click "Approve & Import"
   7. Verify ALL entities created in database
   8. Verify ALL mappings created
   9. Verify import proceeds successfully
   ```

2. **Error Handling**:
   - ✅ One entity creation fails → Show which failed, allow retry
   - ✅ User closes sheet without saving → No pending entity stored
   - ✅ User edits already-defined entity → Updates pending entity

3. **Edge Cases**:
   - ✅ User cancels import → Clear pending entities
   - ✅ User refreshes page → Pending entities lost (expected)
   - ✅ Multiple unmapped values with same name → Each gets unique key

---

## 📋 Implementation Checklist

### Phase 1: Setup
- [x] Create `pending-entities-context.tsx`
- [ ] Wrap ImportReviewDialog with PendingEntitiesProvider
- [ ] Add usePendingEntities to UnmappedValuesSection

### Phase 2: Remove Old Batch System
- [ ] Remove checkbox selection UI from unmapped-values-section.tsx
- [ ] Remove batch create buttons
- [ ] Remove batch progress modal
- [ ] Remove batch mutations

### Phase 3: Modify EntityValueCombobox
- [ ] Add PendingEntities integration
- [ ] Update sheet/modal callbacks to store instead of create
- [ ] Update button labels based on isDefined
- [ ] Remove mapping logic

### Phase 4: Modify Sheets/Modals
- [ ] Add mode prop to MaterialSheet
- [ ] Add mode prop to SizeModal
- [ ] Add mode prop to SeasonModal
- [ ] Add mode prop to OperatorSheet
- [ ] Add mode prop to ShowcaseBrandSheet

### Phase 5: Implement Batch Creation
- [ ] Add batch creation helper functions
- [ ] Add batch creation mutation to import-review-dialog
- [ ] Hook into handleApprove
- [ ] Add error handling and progress tracking

### Phase 6: Fix Immediate Issues
- [ ] Fix colors showing as grey (check DB query)
- [ ] Fix materials "Select materials" label
- [ ] Fix categories not functioning (debug CategorySelect)

### Phase 7: Testing
- [ ] Unit tests for PendingEntitiesProvider
- [ ] Integration test: Create entities workflow
- [ ] End-to-end test: Full import with unmapped values
- [ ] Error handling tests

---

## 🚀 Rollout Plan

### Step 1: Fix Immediate Issues (Quick Wins)
Estimated time: 30 minutes
- Fix colors grey issue
- Fix "Select materials" label
- Fix categories not working

### Step 2: Implement Core Architecture
Estimated time: 2-3 hours
- Setup PendingEntitiesProvider
- Modify EntityValueCombobox
- Update UnmappedValuesSection

### Step 3: Implement Batch Creation
Estimated time: 2-3 hours
- Add batch creation logic
- Hook into Approve button
- Add progress tracking

### Step 4: Testing & Refinement
Estimated time: 1-2 hours
- End-to-end testing
- Bug fixes
- UX improvements

**Total Estimated Time**: 6-9 hours

---

## ❓ Questions for Review

1. **Entity Creation API**: Do all entity types have batch creation endpoints? Or should we create them one-by-one in parallel?

2. **Error Handling**: If one entity fails to create, should we:
   - Stop and show error
   - Continue and collect all errors
   - Retry failed entities

3. **Data Persistence**: Should pending entities survive page refresh? (Would need localStorage)

4. **Edit Functionality**: Should users be able to edit already-defined entities? Or just re-open the sheet?

5. **Visual Feedback**: What should the "Defined ✓" indicator look like? Green checkmark? Badge?

6. **Categories**: Should categories also be "defined" or just selected? (They can't be created)

---

## 📝 Notes

- This is a **major architectural change** - expect significant testing time
- The current checkbox system can be completely removed
- All sheet/modal components need slight modifications
- The batch creation logic needs careful error handling
- Consider adding a progress modal during batch creation
- May want to add "Define All as Default" buttons for simple entities

---

**Ready to proceed?** Review this guide and let me know:
1. Which approach you prefer for sheet/modal modifications
2. Any concerns about the architecture
3. Whether to proceed with implementation

