# Variant Add/Delete Feature Implementation Plan

## Completed Changes

### 1. ✅ Hydration Bug Fix (`use-variant-form.ts`)
**Issue**: Form fields were empty on client-side navigation but correct on refresh.
**Fix**: Added tracking for `initialDataKey` to re-sync form when data becomes available.

### 2. ✅ Removed Toggle from Variants Overview (`variants-overview.tsx`)
- Removed `VariantToggle` component
- Removed `isEnabled` and `onVariantToggle` props
- Simplified to just show variants with override indicators

### 3. ✅ Updated Variant Actions (`variant-actions.tsx`)
- Removed chevron from Back button
- Added `mode` prop for create/edit
- Added three-dot menu with "Delete variant" option
- Added delete confirmation dialog
- Button shows "Create" vs "Save" based on mode

### 4. ✅ Updated Delete API (`apps/api/src/trpc/routers/products/variants.ts`)
- Added support for `productHandle` + `variantUpid` deletion
- Added `deleteVariantByUpid` function

### 5. ✅ Updated Delete Schema (`apps/api/src/schemas/products.ts`)
- Added new union member: `{ productHandle, variantUpid }`

---

## Remaining Tasks

### 1. Update Variant Form to Handle Create/Edit Modes

**File**: `apps/app/src/components/forms/passport/variant-form.tsx`

Changes needed:
- Accept `mode: "create" | "edit"` prop (like ProductForm)
- Show "Create variant" breadcrumb when mode is create
- Hide disclaimer block in create mode
- Show Attributes Select Block in create mode
- Pass `mode` to `VariantFormActions`
- Handle create submission differently (create variant, redirect to edit)

### 2. Create Attributes Select Block

**File**: `apps/app/src/components/forms/passport/blocks/attributes-select-block.tsx`

Purpose: Block for selecting attribute values when creating a variant
- Shows one single-select dropdown per attribute dimension
- Validates that combination doesn't already exist
- Used only in create mode

### 3. Create New Page Route

**File**: `apps/app/src/app/(dashboard)/(app)/passports/edit/[handle]/variant/new/page.tsx`

Purpose: Page for creating new variants
- Renders VariantForm in create mode
- Prefetches product data

### 4. Update Variants Overview for Create Mode

**File**: `apps/app/src/components/forms/passport/sidebars/variants-overview.tsx`

Changes:
- When `selectedUpid === "new"`, don't highlight any variant

### 5. Add "Add variant" Button to Variant Block

**File**: `apps/app/src/components/forms/passport/blocks/variant-block/index.tsx`

Changes:
- Add "Add variant" button in header (right side)
- Navigates to `/passports/edit/[handle]/variant/new`

### 6. Create Variant API

May need to add or verify:
- `trpc.products.variants.create` mutation for creating single variant
- Or repurpose existing `upsert` with mode

---

## Architecture Overview

```
/passports/edit/[handle]                    -> ProductForm (edit mode)
/passports/edit/[handle]/variant/new        -> VariantForm (create mode)
/passports/edit/[handle]/variant/[upid]     -> VariantForm (edit mode)
```

### VariantForm Component Structure

```tsx
// Create mode:
- Breadcrumb: "Product Name / Create variant"
- Sidebar: VariantsOverview (no selection)
- Content: AttributesSelectBlock only

// Edit mode:
- Breadcrumb: "Product Name / Variants"  
- Sidebar: VariantsOverview (current variant selected)
- Content: Disclaimer + BasicInfo + Environment + Materials + Journey
- Actions: Back + ... menu (delete) + Save
```

---

## Next Steps (Priority Order)

1. Create `attributes-select-block.tsx`
2. Update `variant-form.tsx` to handle both modes
3. Create `/variant/new/page.tsx`
4. Update `variants-overview.tsx` for "new" selection
5. Add "Add variant" button to variant block header
6. Test full flow
