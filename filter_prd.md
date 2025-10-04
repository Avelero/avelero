# Passport Filtering Feature - Product Requirements Document

**Version:** 1.0  
**Last Updated:** October 4, 2025  
**Status:** In Development (UI Only - Backend Integration Pending)

---

## Table of Contents
1. [Feature Overview](#feature-overview)
2. [Implementation Plan](#implementation-plan)
3. [Complete Schema Reference](#complete-schema-reference)
4. [Task List](#task-list)

---

## Feature Overview

### Purpose
Provide users with comprehensive filtering capabilities for the passports table, supporting both quick access to common filters and advanced multi-condition filtering with nested logic.

### Key Design Principles
- ❌ **No filter saving** - Filters reset on page refresh
- ✅ **Two-tier system** - Quick filters for common cases, advanced builder for complex queries
- ✅ **Progressive disclosure** - Simple by default, powerful when needed
- ✅ **Type-safe** - Full TypeScript coverage with proper types
- ✅ **UI-only for now** - No backend changes to avoid merge conflicts
- ✅ **Reuse existing components** - Leverage current UI package components
- ✅ **Flat file structure** - No excessive sub-folder nesting

### User Flows

#### Quick Filter Flow
```
1. User clicks "Filter" button in passport-controls.tsx
   ↓
2. Quick Filters Popover opens showing Tier 1 filters:
   - Status
   - Completion %
   - Category
   - Color
   - Size
   - Season
   ↓
3. User hovers over any filter (e.g., "Status")
   → Secondary popover appears with selection options
   ↓
4. User makes selections
   ↓
5. Filter applied, when we hook this up to backend, the filter would be sent to backend with API, for now don't do that.
```

#### Advanced Filter Flow
```
1. From Quick Filters Popover, user clicks "Advanced filter" button
   ↓
2. Sheet slides in from right (1/3 screen width, dark overlay)
   ↓
3. Advanced Filter Panel shows:
   - Empty filter group ready for input
   - Field selector (categorized)
   - Operator selector (contextual)
   - Value input (dynamic based on field type)
   ↓
4. User builds complex filters:
   - Multiple AND groups
   - OR conditions within groups
   - Nested filters for Materials/Facilities
   ↓
5. User clicks "Apply"
   → Sheet closes
   → Filter state stored, when we hook this up to backend, the filter would be sent to backend with API, for now don't do that.
```

### UI Components Hierarchy

```
PassportControls
└─ Filter Button
   └─ QuickFiltersPopover (NEW)
      ├─ Quick filter items (with hover popovers)
      └─ "Advanced filter" button
         └─ Sheet (EXISTING - from Shadcn)
            └─ AdvancedFilterPanel (NEW)
               ├─ Header ("Advanced Filters" + Close)
               ├─ Scrollable Area
               │  └─ FilterGroup (NEW - multiple, AND logic)
               │     └─ FilterRow (NEW - multiple, OR logic)
               │        ├─ Field Select
               │        ├─ Operator Select
               │        └─ FilterValueInput (NEW - router)
               │           ├─ Input (existing)
               │           ├─ MultiSelect (NEW)
               │           ├─ Command (existing)
               │           ├─ Boolean Toggle (custom)
               │           ├─ CategoryHierarchicalSelect (NEW)
               │           └─ NestedFilterInput (NEW)
               │              ├─ Primary Selection
               │              └─ WHERE Conditions
               │                 └─ FilterRow (REUSED!)
               └─ Footer
                  ├─ "Clear All" button
                  └─ "Apply" button
```

---

## Implementation Plan

### File Organization

```
avelero-v2/
├── apps/app/src/
│   ├── config/
│   │   └── filters.ts                           # NEW - All filter configs & operators
│   │
│   ├── hooks/
│   │   ├── use-filter-state.ts                  # NEW - Filter state management
│   │   ├── use-field-options.ts                 # NEW - Dynamic options loading
│   │   └── [existing hooks...]
│   │
│   ├── utils/
│   │   ├── filter-query-builder.ts              # NEW - Query builder (not connected)
│   │   └── [existing utils...]
│   │
│   └── components/
│       └── passports/
│           ├── filter-types.ts                  # NEW - TypeScript types
│           ├── quick-filters-popover.tsx        # NEW
│           ├── advanced-filter-panel.tsx        # NEW
│           ├── filter-group.tsx                 # NEW
│           ├── filter-row.tsx                   # NEW
│           ├── filter-value-input.tsx           # NEW
│           ├── nested-filter-input.tsx          # NEW
│           ├── category-hierarchical-select.tsx # NEW
│           ├── passport-controls.tsx            # MODIFY
│           ├── table-section.tsx                # MODIFY
│           └── [existing files...]
│
├── packages/ui/src/components/
│   ├── Multi select and comboboxz don't need their own component, you can create a combobox and mutli select using existing popover and command components.
│   ├── sheet.tsx                                # MODIFY - Adjust styling
│   └── [existing components...]
│
└── packages/db/src/queries/
    └── [NO CHANGES - Backend integration later]
```

### New Files to Create

#### 1. Config Files
- **`/apps/app/src/config/filters.ts`** (~400 lines)
  - Complete filter field definitions
  - Operator configurations by type
  - Field categories for UI organization
  - tRPC endpoint mappings for dynamic options

#### 2. Hooks
- **`/apps/app/src/hooks/use-filter-state.ts`** (~150 lines)
  - Filter state management
  - Add/update/remove filter logic
  - Clear all functionality

- **`/apps/app/src/hooks/use-field-options.ts`** (~100 lines)
  - Dynamic loading of dropdown options
  - Integration with tRPC endpoints
  - Caching and loading states

#### 3. Utils
- **`/apps/app/src/utils/filter-query-builder.ts`** (~200 lines)
  - Convert FilterState to query format
  - Structured for future backend integration
  - Not connected to actual queries yet

#### 4. UI Package Components
- **`/packages/ui/src/components/multi-select.tsx`** (~150 lines)
  - Reusable multi-select with checkboxes
  - Search/filter functionality
  - Custom checkbox styling (matches existing pattern)

- **`/packages/ui/src/components/combobox.tsx`** (~100 lines)
  - Single-select searchable dropdown
  - Based on Command component pattern
  - If not already exists

#### 5. Passport Filter Components
- **`/apps/app/src/components/passports/filter-types.ts`** (~150 lines)
  - TypeScript type definitions
  - FilterState, FilterCondition, FilterGroup interfaces
  - Input type enums and operator types

- **`/apps/app/src/components/passports/quick-filters-popover.tsx`** (~180 lines)
  - Main popover for Tier 1 filters
  - Hover-triggered secondary popovers
  - "Advanced filter" button trigger

- **`/apps/app/src/components/passports/advanced-filter-panel.tsx`** (~150 lines)
  - Sheet content container
  - Header, scrollable area, footer
  - Manages filter groups

- **`/apps/app/src/components/passports/filter-group.tsx`** (~100 lines)
  - AND group wrapper
  - Contains multiple FilterRow components
  - "[+ OR]" button to add conditions

- **`/apps/app/src/components/passports/filter-row.tsx`** (~200 lines)
  - Core reusable row component
  - Field → Operator → Value pattern
  - Used for both top-level and nested filters

- **`/apps/app/src/components/passports/filter-value-input.tsx`** (~80 lines)
  - Smart router component
  - Renders correct input type based on field config
  - Handles all input type variations

- **`/apps/app/src/components/passports/nested-filter-input.tsx`** (~180 lines)
  - Handles Materials and Facilities nested filters
  - Primary selection + collapsible WHERE conditions
  - Reuses FilterRow for nested conditions

- **`/apps/app/src/components/passports/category-hierarchical-select.tsx`** (~120 lines)
  - Tree-select for category filtering
  - "is descendant of" operator support
  - Breadcrumb display

### Files to Modify

#### 1. Passport Controls
**`/apps/app/src/components/passports/passport-controls.tsx`**
- Replace placeholder Filter button with QuickFiltersPopover
- Import and integrate filter state
- Pass filter props to popover
- ~15 lines changed/added

#### 2. Table Section
**`/apps/app/src/components/passports/table-section.tsx`**
- Add useFilterState hook
- Manage filter state alongside selection state
- Pass filters to controls and data table
- ~25 lines added

#### 3. Passport Data Table
**`/apps/app/src/components/tables/passports/data-table.tsx`**
- Accept filters prop (typed but not used in query yet)
- Structure for future backend connection
- ~10 lines changed

#### 4. Passport Table Types
**`/apps/app/src/components/tables/passports/types.ts`**
- Import filter types
- Re-export for convenience
- ~5 lines added

#### 5. Sheet Component Styling
**`/packages/ui/src/components/sheet.tsx`**
- Adjust right variant width to ~33% of screen
- Update from `sm:max-w-sm` to `sm:w-[480px] lg:w-[560px]`
- Ensure border/shadow matches design system
- ~5 lines changed

### Component Reuse Strategy

#### From Existing UI Package:
✅ **Input** - Text and number inputs  
✅ **Button** - All button variations  
✅ **Popover** - Quick filters container  
✅ **Command** - Searchable select base  
✅ **DropdownMenu** - Operator selectors  
✅ **Icons** - All icons  
✅ **Sheet** - Advanced panel container  
✅ **Tooltip** - Hover hints  

#### Custom Checkbox Pattern:
Reuse pattern from `PassportTableHeader` and `DisplayPopover`:
```tsx
<div className="relative inline-flex h-4 w-4 items-center justify-center">
  <input
    type="checkbox"
    className="block h-4 w-4 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand cursor-pointer"
    checked={checked}
    onChange={(e) => onChange(e.target.checked)}
  />
  {checked && (
    <div className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center pointer-events-none">
      <div className="w-[10px] h-[10px] bg-brand" />
    </div>
  )}
</div>
```

### State Management Pattern

```typescript
// In table-section.tsx
const [filterState, filterActions] = useFilterState();

// FilterState structure:
interface FilterState {
  groups: FilterGroup[]; // AND between groups
}

interface FilterGroup {
  id: string;
  conditions: FilterCondition[]; // OR within group
}

interface FilterCondition {
  id: string;
  fieldId: string;
  operator: string;
  value: any;
  nestedConditions?: FilterCondition[]; // For Materials/Facilities
}

// Actions available:
filterActions = {
  addGroup: () => void,
  removeGroup: (groupId: string) => void,
  addCondition: (groupId: string) => void,
  updateCondition: (groupId: string, conditionId: string, updates: Partial<FilterCondition>) => void,
  removeCondition: (groupId: string, conditionId: string) => void,
  clearAll: () => void,
}
```

### Filter Configuration Structure

```typescript
// config/filters.ts

export interface FilterFieldConfig {
  id: string;
  label: string;
  tier: 1 | 2 | 3; // Quick, Advanced, Power User
  category: 'product' | 'sustainability' | 'variants' | 'manufacturing' | 'metadata';
  inputType: FilterInputType;
  operators: string[];
  options?: { value: string; label: string; }[]; // Static options
  optionsSource?: {
    type: 'trpc';
    endpoint: string; // e.g., "productAttributes.colors"
  };
  nested?: NestedFilterConfig;
  unit?: string; // For numeric fields (kg, L, %)
}

export const FILTER_FIELDS: Record<string, FilterFieldConfig> = {
  status: {
    id: "status",
    label: "Status",
    tier: 1,
    category: 'metadata',
    inputType: "multi-select",
    operators: ["is any of", "is none of"],
    options: [
      { value: "published", label: "Published" },
      { value: "scheduled", label: "Scheduled" },
      { value: "unpublished", label: "Unpublished" },
      { value: "archived", label: "Archived" },
    ],
  },
  // ... all other fields
};

export const OPERATORS = {
  text: ["contains", "does not contain", "is", "is not", "starts with", "ends with", "is empty", "is not empty"],
  number: ["=", "≠", ">", "≥", "<", "≤", "between"],
  multiSelect: ["is any of", "is none of", "is empty", "is not empty"],
  relational: ["contains any of", "contains all of", "does not contain", "is empty", "is not empty"],
  hierarchical: ["is", "is not", "is any of", "is descendant of"],
  date: ["is", "is before", "is after", "is between", "relative"],
  boolean: ["is true", "is false"],
};
```

### Query Builder Structure (For Future Backend Integration)

```typescript
// utils/filter-query-builder.ts

export function buildFilterQuery(filterState: FilterState): PassportFilterQuery {
  // Convert FilterState to backend-compatible format
  return {
    groups: filterState.groups.map(group => ({
      operator: 'OR',
      conditions: group.conditions.map(buildCondition)
    })),
    groupOperator: 'AND'
  };
}

function buildCondition(condition: FilterCondition): QueryCondition {
  const fieldConfig = FILTER_FIELDS[condition.fieldId];
  
  // Delegate to field-specific builders
  switch (fieldConfig.inputType) {
    case 'nested':
      return buildNestedCondition(condition);
    case 'hierarchical':
      return buildHierarchicalCondition(condition);
    default:
      return buildSimpleCondition(condition);
  }
}

// Individual builders for special cases
function buildMaterialQuery(condition: FilterCondition): QueryCondition { /* ... */ }
function buildFacilityQuery(condition: FilterCondition): QueryCondition { /* ... */ }
function buildCategoryQuery(condition: FilterCondition): QueryCondition { /* ... */ }
```

### Implementation Phases

#### Phase 1: Foundation (Days 1-2)
- ✅ Sheet component (already done via Shadcn)
- Create filter config file
- Create filter types file
- Create `useFilterState` hook
- Adjust Sheet styling for filter panel

#### Phase 2: UI Package Components (Days 2-3)
- Create `<MultiSelect />` component
- Create `<Combobox />` component (if needed)
- Test in isolation

#### Phase 3: Core Filter Components (Days 3-5)
- Create `FilterRow` component
- Create `FilterValueInput` router
- Create `FilterGroup` component
- Create `AdvancedFilterPanel`
- Wire up basic functionality

#### Phase 4: Quick Filters (Days 5-6)
- Create `QuickFiltersPopover`
- Integrate with `PassportControls`
- Implement Tier 1 filters
- Test all quick filter interactions

#### Phase 5: Advanced Features (Days 6-7)
- Create `NestedFilterInput` for Materials/Facilities
- Create `CategoryHierarchicalSelect`
- Hook up `useFieldOptions` for dynamic data
- Test complex filter scenarios

#### Phase 6: Integration & Polish (Day 7)
- Connect everything to `TableSection`
- Test all filter interactions
- Polish UI transitions and animations
- Create query builder utils (structure only)
- Documentation

### Technical Notes

#### No Backend Connection
- All filter state managed in UI only
- Query builder created but not executed
- No changes to tRPC routers or database queries
- Ready for easy integration when backend is rebuilt

#### Future Backend Integration
When backend is ready, integration will be straightforward:

```typescript
// In data-table.tsx - just uncomment:
const { data, isLoading } = useQuery(
  trpc.passports.list.queryOptions({ 
    page,
    filters: buildFilterQuery(filters) // Already exists in utils
  })
);
```

---

## Complete Schema Reference

### Passport Core Fields (passports table)

| Field | Type | Priority | Operators | Input Type | Notes |
|-------|------|----------|-----------|------------|-------|
| `status` | varchar | HIGH | `is`, `is not`, `is any of`, `is none of` | multi-select | Values: published, scheduled, unpublished, archived |
| `slug` | text | LOW | `is`, `contains` | text | Technical field, rarely filtered |
| `createdAt` | timestamp | MEDIUM | `is`, `is before`, `is after`, `is on or before`, `is on or after`, `is between`, `relative` | date + relative | "Created in last 30 days" |
| `updatedAt` | timestamp | MEDIUM | `is`, `is before`, `is after`, `is on or before`, `is on or after`, `is between`, `relative` | date + relative | "Recently updated" |

### Product Fields (products table)

| Field | Type | Priority | Operators | Input Type | Notes |
|-------|------|----------|-----------|------------|-------|
| `name` | text | HIGH | `contains`, `does not contain`, `is`, `is not`, `starts with`, `ends with` | text | "Find products with 'hoodie' in name" |
| `description` | text | LOW | `contains`, `does not contain`, `is empty`, `is not empty` | text | Full-text search candidate |
| `season` | text | HIGH | `is`, `is not`, `is any of`, `is none of`, `is empty`, `is not empty` | multi-select | SS24, AW25, etc. |
| `primaryImageUrl` | text | LOW | `is empty`, `is not empty` | boolean | "Products missing images" |
| `categoryId` | uuid (FK) | VERY HIGH | `is`, `is not`, `is any of`, `is descendant of`, `is ancestor of` | hierarchical-select | **Key filter** - supports tree navigation |
| `showcaseBrandId` | uuid (FK) | MEDIUM | `is`, `is not`, `is any of`, `is empty`, `is not empty` | select | For multi-brand products |
| `brandCertificationId` | uuid (FK) | MEDIUM | `is`, `is not`, `is any of`, `is empty`, `is not empty` | select | Filter by certification |

### Variant Fields (product_variants table)

| Field | Type | Priority | Operators | Input Type | Notes |
|-------|------|----------|-----------|------------|-------|
| `sku` | text | HIGH | `contains`, `is`, `is not`, `starts with`, `is empty`, `is not empty` | text | Search by SKU |
| `upid` | text | MEDIUM | `contains`, `is`, `is not`, `starts with` | text | Unique product ID |
| `colorId` | uuid (FK) | VERY HIGH | `is`, `is not`, `is any of`, `is empty`, `is not empty` | multi-select | **Key filter** - popular use case |
| `sizeId` | uuid (FK) | VERY HIGH | `is`, `is not`, `is any of`, `is empty`, `is not empty` | multi-select | **Key filter** - popular use case |
| `productImageUrl` | text | LOW | `is empty`, `is not empty` | boolean | Variant has image? |

### Environmental Data (product_environment table)

| Field | Type | Priority | Operators | Input Type | Notes |
|-------|------|----------|-----------|------------|-------|
| `carbonKgCo2e` | numeric(6,4) | VERY HIGH | `=`, `≠`, `>`, `≥`, `<`, `≤`, `between`, `is empty`, `is not empty` | number | **Sustainability filter** - "Carbon < 5kg" |
| `waterLiters` | numeric(6,4) | VERY HIGH | `=`, `≠`, `>`, `≥`, `<`, `≤`, `between`, `is empty`, `is not empty` | number | **Sustainability filter** - "Water < 50L" |

### Materials (product_materials + brand_materials)

| Field | Type | Priority | Operators | Input Type | Notes |
|-------|------|----------|-----------|------------|-------|
| `brandMaterialId` | uuid (FK) | HIGH | `contains`, `does not contain`, `contains all of`, `contains any of` | multi-select | "Products with cotton" |
| `percentage` | numeric(6,2) | MEDIUM | `>`, `≥`, `<`, `≤`, `between` | number | "Cotton > 80%" (nested filter - requires material selection) |
| `material.recyclable` | boolean | HIGH | `is true`, `is false`, `is empty` | boolean | "Only recyclable materials" (nested) |
| `material.countryOfOrigin` | text | MEDIUM | `is`, `is not`, `is any of`, `is empty`, `is not empty` | country-select | "Materials from EU" (nested) |
| `material.certificationId` | uuid (FK) | HIGH | `is`, `is any of`, `is empty`, `is not empty` | multi-select | "GOTS certified materials" (nested) |

### Journey & Facilities (product_journey_steps + brand_facilities)

| Field | Type | Priority | Operators | Input Type | Notes |
|-------|------|----------|-----------|------------|-------|
| `facilityId` | uuid (FK) | MEDIUM | `contains`, `does not contain`, `contains all of`, `contains any of` | multi-select | "Products made in specific factory" |
| `stepType` | text | MEDIUM | `contains`, `does not contain`, `contains any of` | multi-select | Manufacturing, Assembly, etc. |
| `facility.countryCode` | text | HIGH | `is`, `is not`, `is any of` | country-select | **Popular**: "Made in Portugal" (nested) |
| `facility.city` | text | LOW | `is`, `is not`, `contains` | text | Granular location filter (nested) |

### Eco Claims (product_eco_claims + brand_eco_claims)

| Field | Type | Priority | Operators | Input Type | Notes |
|-------|------|----------|-----------|------------|-------|
| `ecoClaimId` | uuid (FK) | HIGH | `contains`, `does not contain`, `contains all of`, `contains any of`, `is empty` | multi-select | "Products with 'vegan' claim" |

### Care Codes (product_care_codes + care_codes)

| Field | Type | Priority | Operators | Input Type | Notes |
|-------|------|----------|-----------|------------|-------|
| `careCodeId` | uuid (FK) | MEDIUM | `contains`, `does not contain`, `contains all of`, `contains any of` | multi-select | "Machine washable products" |

### Template & Completion (passport_templates + computed)

| Field | Type | Priority | Operators | Input Type | Notes |
|-------|------|----------|-----------|------------|-------|
| `templateId` | uuid (FK) | HIGH | `is`, `is not`, `is any of` | select | "All passports using Template X" |
| `completionPercentage` | computed | VERY HIGH | `=`, `>`, `≥`, `<`, `≤`, `between` | percentage | **Key filter** - "Completion > 75%" |
| `completedSections` | computed | HIGH | `=`, `>`, `≥`, `<`, `≤` | number | "Completed at least 4 sections" |
| `moduleKey.completed` | computed | MEDIUM | `is true`, `is false` | module-picker | "Products missing 'materials' module" |

### Brand Reference Data

#### Colors (brand_colors)
| Field | Type | Priority | Operators | Input Type |
|-------|------|----------|-----------|------------|
| `name` | text | HIGH | `is`, `is not`, `is any of` | multi-select |

#### Sizes (brand_sizes)
| Field | Type | Priority | Operators | Input Type |
|-------|------|----------|-----------|------------|
| `name` | text | HIGH | `is`, `is not`, `is any of` | multi-select |
| `categoryId` | uuid (FK) | LOW | `is`, `is any of` | select |

#### Categories (categories)
| Field | Type | Priority | Operators | Input Type |
|-------|------|----------|-----------|------------|
| `name` | text | VERY HIGH | hierarchical operators | tree-select |
| `parentId` | uuid (FK) | MEDIUM | `is`, `is not`, `is empty` | computed |

#### Certifications (brand_certifications)
| Field | Type | Priority | Operators | Input Type |
|-------|------|----------|-----------|------------|
| `title` | text | HIGH | `is`, `is any of` | multi-select |
| `certificationCode` | text | MEDIUM | `is`, `contains` | text |
| `issueDate` | timestamp | LOW | date operators | date |
| `expiryDate` | timestamp | MEDIUM | `is before`, `is after`, `is expired`, `expires soon` | date + relative |

#### Collections (brand_collections)
| Field | Type | Priority | Operators | Input Type |
|-------|------|----------|-----------|------------|
| `name` | text | MEDIUM | `is`, `is any of` | select |

### Field Priority Tiers

#### Tier 1: Quick Filters (Must-Have)
1. **Status** - Published/Unpublished/Scheduled/Archived
2. **Completion %** - Progress ranges (0-25%, 25-50%, 50-75%, 75-100%)
3. **Category** - Hierarchical tree selection
4. **Color** - Multi-select from brand colors
5. **Size** - Multi-select from brand sizes
6. **Season** - Multi-select seasons (SS24, AW25, etc.)

#### Tier 2: Advanced Filters
7. **Product name** - Text search with operators
8. **Carbon footprint** - Numeric with kg CO₂e unit
9. **Water usage** - Numeric with Liters unit
10. **Materials** - Multi-select with nested conditions
11. **Eco claims** - Multi-select eco claims
12. **Template** - Select passport template
13. **Country of manufacture** - Country picker (nested in facilities)
14. **Certifications** - Multi-select certifications
15. **Created/Updated dates** - Date range with relative options

#### Tier 3: Power User Filters
16. **Module completion** - Per-module status (core, materials, journey, etc.)
17. **SKU/UPID** - Text search for identifiers
18. **Facility** - Multi-select facilities
19. **Journey step type** - Multi-select manufacturing steps
20. **Care codes** - Multi-select care instructions
21. **Material recyclability** - Boolean filter
22. **Has image** - Boolean filter for products with/without images
23. **Showcase brand** - Select for multi-brand products

### Special Operator Types

#### Relational Operators (for junction tables)
Used when filtering by related entities:
```typescript
type RelationalOperator = 
  | "contains any of"    // Has at least one (OR logic)
  | "contains all of"    // Has every selected item (AND logic)
  | "does not contain"   // Has none of the selected items
  | "is empty"           // No relationships exist
  | "is not empty";      // At least one relationship exists
```

**Example:**
```
Materials [contains any of] [☑ Cotton] [☑ Polyester]
→ Products that have either Cotton OR Polyester
```

#### Hierarchical Operators (for categories)
Used for tree-structured data:
```typescript
type HierarchicalOperator = 
  | "is"                 // Exact category match
  | "is not"             // Not this category
  | "is any of"          // Any of selected categories
  | "is descendant of"   // Category or any child category
  | "is ancestor of";    // Parent categories only
```

**Example:**
```
Category [is descendant of] [Apparel > Outerwear]
→ Matches: Coats, Jackets, Parkas (all under Outerwear)
```

#### Relative Date Operators
For time-based filtering:
```typescript
type RelativeDateOperator = 
  | "today"
  | "yesterday"
  | "last 7 days"
  | "last 30 days"
  | "this month"
  | "last month"
  | "this quarter"
  | "this year"
  | "more than X days ago";
```

#### Numeric with Units
Display contextual units:
- **Carbon:** kg CO₂e
- **Water:** Liters
- **Material %:** %
- **Completion:** %

### Computed Fields Implementation Notes

#### Completion Percentage
- **Source:** `passportModuleCompletion` table
- **Calculation:** (completed modules / total enabled modules) × 100
- **Backend aggregation required**

#### Completed Sections
- **Source:** Count from `passportModuleCompletion` where `completed = true`
- **Backend aggregation required**

#### Module-specific Completion
- **Source:** `passportModuleCompletion.moduleKey` and `completed` fields
- **Filter by specific module:** "Products missing 'materials' module"

### Join Complexity Examples

#### Example 1: "Products with GOTS certified materials"
```sql
FROM passports
JOIN products ON passports.product_id = products.id
JOIN product_materials ON product_materials.product_id = products.id
JOIN brand_materials ON brand_materials.id = product_materials.brand_material_id
JOIN brand_certifications ON brand_certifications.id = brand_materials.certification_id
WHERE brand_certifications.code = 'GOTS'
```

#### Example 2: "Products manufactured in Portugal with >50% cotton"
```sql
FROM passports
JOIN products ON passports.product_id = products.id
JOIN product_journey_steps ON product_journey_steps.product_id = products.id
JOIN brand_facilities ON brand_facilities.id = product_journey_steps.facility_id
JOIN product_materials ON product_materials.product_id = products.id
JOIN brand_materials ON brand_materials.id = product_materials.brand_material_id
WHERE brand_facilities.country_code = 'PT'
AND brand_materials.name = 'Cotton'
AND product_materials.percentage > 50
```

### Performance Considerations

#### Indexing Strategy
- Add indexes on frequently filtered columns:
  - `passports.status`
  - `products.category_id`
  - `product_variants.color_id`
  - `product_variants.size_id`
  - `products.season`
  - `passports.created_at`
  - `passports.updated_at`

#### Query Optimization
- Limit concurrent filter conditions (max 10 groups recommended)
- Use pagination with filters
- Consider materialized views for computed fields
- Implement query result caching for common filters

#### Backend Implementation Notes (for future)
- Use prepared statements for filter queries
- Batch similar filter operations
- Implement query timeout limits
- Monitor slow query logs for optimization

### 📝 Notes & Conventions

#### Code Style
- Use functional components with hooks
- Follow existing naming conventions
- Use custom checkbox pattern (not native checkboxes)
- Maintain flat file structure (no excessive nesting)

#### State Management
- Filter state managed with `useFilterState` hook
- No Redux or external state management
- State lifted to `table-section.tsx`

#### Component Patterns
- Reuse existing UI components where possible
- Follow Radix UI patterns for primitives
- Match existing styling with Tailwind classes
- Use `cn()` utility for conditional classes

#### Backend Integration
- NO backend changes during UI development
- Query builder created but not executed
- Structure ready for easy future integration
- Document expected query format

---

**End of PRD**

