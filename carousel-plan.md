# Product Carousel Configuration Plan

## Overview

This document outlines the implementation plan for the Product Carousel configuration feature within the Theme Editor. The carousel displays "similar products" on DPP pages, linking to external webshop URLs where products can be purchased.

### Key Features
1. **Configure Products modal** - Select which products appear in carousels
2. **Display options** - Product count, show/hide price and title (already implemented)
3. **Selection modes** - Explicit selection or filter-based with exclusions
4. **Live preview** - See carousel changes in real-time

---

## Current State

### Already Implemented
- `ThemeConfig.carousel` structure with `productCount`, `showPrice`, `showTitle`, `filter`, `includeIds`, `excludeIds`
- Carousel component rendering (but receives empty `similarProducts[]`)
- Theme editor Content tab with modal placeholder button

### Schema Updates (Completed)
New columns added to `products` table:
- `webshop_url` - External link to purchase page
- `price` - Numeric price for display
- `currency` - ISO 4217 currency code (EUR, USD, etc.)
- `sales_status` - For future Shopify integration (active, inactive, discontinued)

---

## Architecture

### Selection Logic

The carousel config uses an *implicit mode* based on which fields are populated:

```typescript
// ThemeConfig.carousel
{
  productCount: number;     // Max 12
  showPrice: boolean;
  showTitle: boolean;
  filter?: Record<string, unknown>;  // FilterState for query
  includeIds?: string[];             // Explicit selection
  excludeIds?: string[];             // Exclusions from "all"
}
```

**Mode Detection:**
- `includeIds.length > 0` → **Explicit mode**: Only show these specific products
- Otherwise → **All mode**: Apply filter, exclude `excludeIds`

### DPP Fetch Query Logic

```sql
-- Explicit mode (includeIds present)
SELECT id, name, primary_image_url, price, currency, webshop_url
FROM products 
WHERE id IN (:includeIds) 
  AND id != :currentProductId
  AND brand_id = :brandId
LIMIT :productCount;

-- All mode (filter-based)
SELECT id, name, primary_image_url, price, currency, webshop_url
FROM products 
WHERE brand_id = :brandId
  AND matches_filter(:filter)
  AND id NOT IN (:excludeIds)
  AND id != :currentProductId
ORDER BY RANDOM()
LIMIT :productCount;
```

The query is efficient because:
- Always scoped to `brand_id` (indexed)
- Uses `LIMIT 12` max - stops after finding matches
- Simple filters (category, season) hit existing indexes

---

## Implementation Phases

### Phase 1: Product Selection Query ✅ **COMPLETE**

**Goal**: Create a query to list products for the selection modal.

**Files modified:**
- `packages/db/src/queries/products.ts`

**Implementation:**
- Added `CarouselProductRow` interface with fields: `id`, `name`, `productIdentifier`, `primaryImageUrl`, `categoryName`, `seasonName`
- Added `listProductsForCarouselSelection()` function:
  - Supports search (name, productIdentifier, category, season)
  - Supports FilterState for advanced filtering
  - Supports sorting by name, category, season
  - Cursor-based pagination with configurable limit
  - Returns simplified product data for selection UI

---

### Phase 2: tRPC Router Endpoint ✅ **COMPLETE**

**Goal**: Expose the selection query via tRPC.

**Files modified:**
- `apps/api/src/trpc/routers/workflow/theme.ts`

**Implementation:**
- Added `listCarouselProductsProcedure` to the theme router
- Endpoint: `workflow.theme.listCarouselProducts`
- Input schema with:
  - `search: string` (optional)
  - `filterState: FilterState` (optional, with full condition/group structure)
  - `sort: { field: 'name' | 'category' | 'season', direction: 'asc' | 'desc' }` (optional)
  - `cursor: string` (optional)
  - `limit: number` (1-100, default 50)
- Returns paginated `CarouselProductRow[]` with metadata

---

### Phase 3: Product Selection Modal ✅ **COMPLETE** (Refactored)

**Goal**: Create the modal component for selecting products.

**Files created:**
- `apps/app/src/components/modals/carousel-products-modal.tsx`

**Implementation (following passport-controls pattern):**
- Full modal component with Dialog from `@v1/ui`
- Header: "Configure Carousel Products" with close button
- Controls section following `passport-controls.tsx` pattern:
  - Search input with expanding width on focus
  - `SortPopover` component reused from `@/components/select/sort-select`
  - (Future: QuickFiltersPopover for Category/Season filters)
- Table section renders `CarouselProductsDataTable`
- Footer with selection count, Cancel, and "Set Products" buttons
- Uses `workflow.theme.listCarouselProducts` tRPC query with `enabled: open`
- Debounced search (300ms)
- Pagination via "Load more" button
- Selection state starts in "explicit" mode (no products selected)
- Props: `open`, `onOpenChange`, `initialSelection`, `onSave`

---

### Phase 4: Simplified Product Table ✅ **COMPLETE** (Refactored)

**Goal**: Create a minimal table component for product selection.

**Files created:**
- `apps/app/src/components/tables/carousel-products/`
  - `index.tsx` - Main exports
  - `columns.tsx` - Column definitions (checkbox inline in product column)
  - `data-table.tsx` - Main table with optimistic selection updates
  - `table-header.tsx` - Header with IndeterminateCheckbox for Select All
  - `empty-state.tsx` - Empty state component
  - `types.ts` - Type definitions

**Columns implemented (following passports pattern):**
1. **Product** - Checkbox + Image + Name/Identifier (combined column)
2. **Category** - Category name
3. **Season** - Season chip

**Key features:**
- Uses `@tanstack/react-table` for table logic
- **Select All checkbox in Product column header** (not separate button)
- Optimistic UI updates with `useTransition`
- Selection state syncs with parent via props
- Handles "all" vs "explicit" mode selection logic
- "Load more" pagination
- Loading skeleton state
- Empty state when no products found

---

### Phase 5: Selection Controls ✅ **COMPLETE** (Refactored)

**Goal**: Create control bar for the modal.

**Implementation (no separate Select All button):**
- Controls embedded directly in `carousel-products-modal.tsx`
- Search input following passport-controls pattern (expanding width)
- Reuses `SortPopover` from `@/components/select/sort-select`
- **Selection is handled via table header checkbox** (like passports table)
- Future: QuickFiltersPopover for Category and Season filters

---

### Phase 6: Modal Integration ✅ **COMPLETE**

**Goal**: Wire modal to theme editor.

**Files modified:**
- `apps/app/src/components/theme-editor/panel/sections/content-section.tsx`

**Implementation:**
- Added `CarouselProductsField` component that manages modal state
- Imports `CarouselProductsModal` and `FilterState` types
- Button shows current selection count or "Configure..." when empty
- Modal opens when button clicked
- On save, updates `themeConfig.carousel` with:
  - `filter` - FilterState for query (future use)
  - `includeIds` - Explicit selection
  - `excludeIds` - Exclusions from "all" mode
- Preserves other carousel settings (productCount, showTitle, showPrice)
- Handles `modalType: "carousel-products"` in ContentFieldRenderer

---

### Phase 7: DPP Query Update ⏳

**Goal**: Fetch similar products based on carousel config.

**Files to modify:**
- `packages/db/src/queries/dpp-public.ts`

**New function:**
```typescript
/**
 * Fetch similar products for carousel based on ThemeConfig.
 * Excludes the current product being viewed.
 */
async function fetchSimilarProducts(
  db: Database,
  brandId: string,
  currentProductId: string,
  carouselConfig: ThemeConfig["carousel"]
): Promise<SimilarProduct[]>
```

**Logic:**
1. Check if `includeIds` has items → Explicit mode
2. Otherwise → All mode with filter
3. Query products with appropriate WHERE clause
4. Map to `SimilarProduct` format
5. Return max `productCount` items

**Files to modify:**
- `apps/api/src/trpc/routers/dpp-public/index.ts`

**Changes:**
- Call `fetchSimilarProducts` in `getByProductUpid` and `getByVariantUpid`
- Pass result to `transformToDppData` (update to accept similar products)

---

### Phase 8: Live Preview ⏳

**Goal**: Show carousel updates in theme editor preview.

**Current state:**
- Preview uses `previewData` from context
- `previewData.similarProducts` is currently empty

**Changes needed:**
- When modal saves, update `themeConfigDraft.carousel`
- Preview needs to fetch products based on draft config
- May need a separate preview-only query that runs on config change

**Approach:**
- Add `useEffect` in preview that fetches products when carousel config changes
- Or use mock/placeholder data in preview, only real data on live DPP

---

## Testing Checklist

### Modal Functionality
- [ ] Modal opens from "Configure Products" button
- [ ] Search filters products in real-time
- [ ] Category filter works
- [ ] Season filter works
- [ ] Sort by name/category/season works
- [ ] "Select All" selects all (mode: all)
- [ ] Individual selection works (mode: explicit)
- [ ] Deselecting from "all" adds to excludeIds
- [ ] Selection count updates correctly
- [ ] "Set Products" saves to config
- [ ] Cancel discards changes

### DPP Integration
- [ ] Carousel shows products from explicit selection
- [ ] Carousel shows products from filter (all mode)
- [ ] Carousel excludes current product
- [ ] Carousel respects productCount limit
- [ ] Carousel shows price when configured
- [ ] Carousel shows title when configured
- [ ] Products link to webshop URLs

### Edge Cases
- [ ] Empty selection shows empty carousel (or hides it)
- [ ] Deleted products gracefully excluded
- [ ] Large catalogs (100k+) perform acceptably
- [ ] Filter with no matches shows empty state

---

## Future Considerations

### Shopify Integration
When Shopify integration is implemented:
- Filter carousel products by `sales_status = 'active'`
- Ensure `webshop_url`, `price`, `currency` are synced from Shopify
- May add "Sync from Shopify" button in modal

### Performance Optimization
If filter queries become slow:
- Consider materialized view for carousel-eligible products
- Add composite index on filter columns
- Cache filtered product IDs with TTL

---

## Progress Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Selection Query | ✅ **COMPLETE** | `listProductsForCarouselSelection` in products.ts |
| Phase 2: tRPC Endpoint | ✅ **COMPLETE** | `workflow.theme.listCarouselProducts` |
| Phase 3: Modal Component | ✅ **COMPLETE** | `carousel-products-modal.tsx` |
| Phase 4: Product Table | ✅ **COMPLETE** | `tables/carousel-products/` directory |
| Phase 5: Controls | ✅ **COMPLETE** | Embedded in modal (search, sort, select all) |
| Phase 6: Modal Integration | ✅ **COMPLETE** | `CarouselProductsField` in content-section.tsx |
| Phase 7: DPP Query | ⏳ Pending | Fetch similar products for carousel |
| Phase 8: Live Preview | ⏳ Pending | Show carousel in theme editor preview |
