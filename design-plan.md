# Unified Theme Editor Implementation Plan

## Overview

This document outlines the plan to merge the Theme Styles (CSS/styling) and Theme Config (content) editing into a single live-preview environment within the theme editor.

### Key Changes
1. **Content moves into the theme editor** with live preview
2. **Eye icons in layout tree** control component visibility (show/hide sections)
3. **Tabs separate Styles/Content** in the component editor panel
4. **Modals handle complex configs** (menus, product carousel) - *deferred to later phase*
5. **Content editing grouped by logical sections** within components

---

## Progress Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Context & Types Foundation | ✅ **COMPLETE** | All type definitions, defaults, and context state management implemented |
| Phase 2: Registry Updates | ✅ **COMPLETE** | Content field types, visibility keys, and config fields added to components |
| Phase 3: Layout Tree Eye Icons | ✅ **COMPLETE** | Eye icons for visibility toggles implemented in layout tree |
| Phase 4: Tabs & Content Section | ✅ **COMPLETE** | Tab system and content field renderers including image upload |
| Phase 5: Content Field Inputs | ✅ **COMPLETE** | All field types implemented in Phase 4's ContentSection |
| Phase 6: Integration & Testing | ⏳ Pending | Ready to start |
| Phase 7: Modal Implementation | 🔜 Deferred | Will implement after Phase 6 |
| Phase 8: Cleanup | 🔜 Deferred | Will implement after full testing |

---

## Current Architecture

### Saving Mechanisms (Two Separate Paths)

| What | Mechanism | Location |
|------|-----------|----------|
| **Theme Styles** | Server Action | `apps/app/src/actions/design/save-theme-action.ts` |
| **Theme Config** | tRPC Mutation | `apps/api/src/trpc/routers/workflow/theme.ts` → `updateConfig` |

**Note**: There is NO `updateStyles` tRPC route. Styles use a server action that:
1. Saves `theme_styles` JSONB to database
2. Generates CSS file and uploads to storage bucket
3. Updates `stylesheet_path` and `google_fonts_url`

### Current File Structure

```
apps/app/src/
├── contexts/
│   └── design-editor-provider.tsx      # Manages styles state only
├── components/
│   ├── theme-editor/
│   │   ├── design-page-client.tsx      # Main editor wrapper
│   │   ├── design-preview.tsx          # Live preview
│   │   ├── save-bar.tsx                # Unsaved changes bar
│   │   ├── panel/
│   │   │   ├── design-panel.tsx        # Left sidebar panel
│   │   │   ├── panel-header.tsx        # Header with back button
│   │   │   ├── sections/
│   │   │   │   ├── component-section.tsx    # Styles editor (TO RENAME)
│   │   │   │   ├── layout-tree.tsx          # Component tree
│   │   │   │   ├── typography-editor.tsx    # Typography section
│   │   │   │   └── colors-editor.tsx        # Colors section
│   │   │   └── inputs/
│   │   │       └── ... (color, pixel, radius, etc.)
│   │   └── registry/
│   │       └── component-registry.ts   # Component definitions
│   └── design/
│       └── content/                    # Current content form (KEEP FOR NOW)
│           ├── theme-content-form.tsx
│           ├── set-header.tsx
│           ├── set-menu.tsx
│           ├── set-banner.tsx
│           ├── set-carousel.tsx
│           └── set-footer.tsx
└── app/(dashboard)/(main)/(sidebar)/design/
    ├── page.tsx                        # Theme selection page
    ├── content/page.tsx                # Content form page (KEEP FOR NOW)
    └── layout.tsx                      # Has Design/Content tabs
```

---

## Target Configuration Per Component

### Header
| Field | Type | ThemeConfig Path |
|-------|------|------------------|
| Logo upload | image | `branding.headerLogoUrl` |

### Primary Menu
| Field | Type | ThemeConfig Path |
|-------|------|------------------|
| Configure buttons | modal | `menus.primary` |

**Modal functionality** (deferred):
- Add/delete/edit buttons
- Re-order buttons via drag-and-drop

### Secondary Menu
| Field | Type | ThemeConfig Path |
|-------|------|------------------|
| Configure buttons | modal | `menus.secondary` |

**Modal functionality** (deferred):
- Add/delete/edit buttons
- Re-order buttons via drag-and-drop

### Product Carousel
| Field | Type | ThemeConfig Path |
|-------|------|------------------|
| Product count | number | `carousel.productCount` |
| Show price | toggle | `carousel.showPrice` |
| Show title | toggle | `carousel.showTitle` |
| Configure products | modal | `carousel.filter` + `includeIds` + `excludeIds` |

**Modal functionality** (deferred):
- Product selection with filter logic (like passports table)
- Select all / select specific
- includeIds, excludeIds, filter query saved

### Banner
| Section | Field | Type | ThemeConfig Path |
|---------|-------|------|------------------|
| Visibility | Show headline | toggle | `cta.showHeadline` |
| Visibility | Show subheadline | toggle | `cta.showSubline` |
| Visibility | Show button | toggle | `cta.showButton` |
| Headline | Text | text | `cta.bannerHeadline` |
| Subheadline | Text | text | `cta.bannerSubline` |
| Button | Label | text | `cta.bannerCTAText` |
| Button | URL | url | `cta.bannerCTAUrl` |
| Background | Image | image | `cta.bannerBackgroundImage` |

### Footer
| Section | Field | Type | ThemeConfig Path |
|---------|-------|------|------------------|
| Social Links | Instagram | url | `social.instagramUrl` |
| Social Links | Facebook | url | `social.facebookUrl` |
| Social Links | Pinterest | url | `social.pinterestUrl` |
| Social Links | X | url | `social.twitterUrl` |
| Social Links | TikTok | url | `social.tiktokUrl` |
| Social Links | LinkedIn | url | `social.linkedinUrl` |

---

## Implementation Phases

### Phase 1: Context & Types Foundation ✅ **COMPLETE**

**Goal**: Add config state management to the design editor context.

**Status**: ✅ All tasks completed

#### Files Modified

1. **`apps/app/src/contexts/design-editor-provider.tsx`** ✅
   - ✅ Added `themeConfigDraft` state (alongside existing `themeStylesDraft`)
   - ✅ Added `savedThemeConfig` to track unsaved changes
   - ✅ Added helper methods:
     - ✅ `updateConfigValue(path: string, value: unknown)` - Generic path-based updater
     - ✅ `getConfigValue(path: string)` - Get config value by path
     - ✅ `toggleSectionVisibility(key: keyof ThemeConfig['sections'])` - For eye icons
   - ✅ Modified `hasUnsavedChanges` to check BOTH styles AND config
   - ✅ Modified `saveDrafts` to save BOTH:
     - ✅ Call existing `saveThemeAction` for styles
     - ✅ Call `workflow.theme.updateConfig` mutation for config (parallel execution)
   - ✅ Modified `resetDrafts` to reset both
   - ✅ Updated `design-preview.tsx` to use `themeConfigDraft` for live preview

2. **`packages/dpp-components/src/types/theme-config.ts`** ✅
   - ✅ Added new fields to `cta`:
     ```typescript
     showHeadline: boolean;
     showSubline: boolean;
     showButton: boolean;
     ```
   - ✅ Added new `carousel` section:
     ```typescript
     carousel: {
       productCount: number;
       showPrice: boolean;
       showTitle: boolean;
       filter?: Record<string, unknown>;
       includeIds?: string[];
       excludeIds?: string[];
     };
     ```

3. **`packages/db/src/defaults/theme-defaults.ts`** ✅
   - ✅ Added defaults for new `cta` visibility fields (`showHeadline: true`, `showSubline: true`, `showButton: true`)
   - ✅ Added defaults for new `carousel` section (`productCount: 4`, `showPrice: true`, `showTitle: true`)

---

### Phase 2: Registry Updates ✅ **COMPLETE**

**Goal**: Define content fields and visibility keys in the component registry.

**Status**: ✅ All tasks completed

#### Files Modified

1. **`apps/app/src/components/theme-editor/registry/component-registry.ts`** ✅
   
   Added new types:
   - ✅ `ContentFieldType` - Union type for field types (`text`, `textarea`, `url`, `image`, `toggle`, `number`, `modal`)
   - ✅ `ContentField` - Interface for content field definitions with `type`, `path`, `label`, `placeholder`, `section`, `modalType`, `min`, `max`
   - ✅ `SectionVisibilityKey` - Type-safe union of all visibility toggle keys

   Updated `ComponentDefinition` interface:
   - ✅ Added `visibilityKey?: SectionVisibilityKey` - For eye icon toggles in layout tree
   - ✅ Added `configFields?: ContentField[]` - For Content tab editing

   Added visibility keys to components:
   - ✅ `product-details` → `showProductDetails`
   - ✅ `menu-primary` → `showPrimaryMenu`
   - ✅ `menu-secondary` → `showSecondaryMenu`
   - ✅ `impact-section` → `showImpact`
   - ✅ `materials-section` → `showMaterials`
   - ✅ `journey-section` → `showJourney`
   - ✅ `carousel` → `showSimilarProducts`
   - ✅ `banner` → `showCTABanner`

   Added config fields to components:
   - ✅ `header`: Logo image upload (`branding.headerLogoUrl`)
   - ✅ `menu-primary`: Modal placeholder for button configuration
   - ✅ `menu-secondary`: Modal placeholder for button configuration
   - ✅ `carousel`: Product count, show title/price toggles, modal placeholder for product selection (grouped by "Display" and "Products" sections)
   - ✅ `banner`: All content fields grouped by sections (Visibility, Headline, Subheadline, Button, Background)
   - ✅ `footer`: Social link URLs (Instagram, Facebook, Pinterest, X, TikTok, LinkedIn) grouped under "Social Links"

   Added utility functions:
   - ✅ `hasConfigContent(component)` - Returns true if component has config fields
   - ✅ `hasVisibilityToggle(component)` - Returns true if component has visibility key

### Next Steps

Ready to proceed with **Phase 3: Layout Tree Eye Icons** to implement visibility toggle icons in the layout tree.

---

### Phase 3: Layout Tree Eye Icons ✅ **COMPLETE**

**Goal**: Add visibility toggle icons to the layout tree for toggleable sections.

**Status**: ✅ All tasks completed (with refinements)

#### Files Modified

1. **`apps/app/src/components/theme-editor/panel/sections/layout-tree.tsx`** ✅
   - ✅ Created `VisibilityToggle` component that:
     - Uses `themeConfigDraft.sections[visibilityKey]` to read visibility state
     - Uses `toggleSectionVisibility` from context to toggle
     - Shows `Icons.Eye` when visible, `Icons.EyeOff` when hidden
     - **Refinement**: Eye is hidden by default (opacity-0) and shows on hover
     - **Refinement**: Eye is ALWAYS visible (opacity-100) if the section is hidden (so user remembers)
     - Uses `e.stopPropagation()` to prevent navigation when clicking the eye
   - ✅ Integrated into `LayoutTreeItem`:
     - Eye icon appears before the navigation chevron
     - **Refinement**: Added spacer to maintain alignment when navigation chevron is missing
     - Only renders for components with a valid `visibilityKey`

#### Refinements Applied
- Restructed `SectionVisibilityKey` to ONLY include hideable sections:
  - `showPrimaryMenu`
  - `showSecondaryMenu`
  - `showSimilarProducts` (Carousel)
  - `showCTABanner`
- Removed visibility toggles from always-visible sections:
  - Product Details
  - Impact
  - Materials
  - Journey

### Next Steps

Ready to proceed with **Phase 5: Content Field Inputs** (mostly complete via Phase 4).

---

### Phase 4: Tabs & Content Section Components ✅ **COMPLETE**

**Goal**: Create the tab system and content section renderer.

**Status**: ✅ All tasks completed

#### Files Created

1. **`apps/app/src/components/theme-editor/panel/sections/style-content-tabs.tsx`** ✅
   - Two tabs: "Styles" and "Content"
   - Props: `activeTab`, `onTabChange`, `showContentTab`
   - Tabs only shown when component has both styles AND content
   - Clean underline styling for active tab

2. **`apps/app/src/components/theme-editor/panel/sections/content-section.tsx`** ✅
   - Renders content fields for a component
   - Groups fields by `section` property (like styles)
   - Field renderers implemented:
     - ✅ `text` → Input component
     - ✅ `textarea` → Multiline textarea
     - ✅ `url` → Input with URL placeholder
     - ✅ `toggle` → Switch component
     - ✅ `number` → Input with type="number" and min/max
     - ✅ `image` → **Uses existing ImageUploader component** with:
       - Supabase `dpp-assets` bucket integration
       - Auto-deletion of old images when replaced
       - Path structure: `[brandId]/[folder]/[timestamp]-[filename]`
       - Appropriate dimensions based on field type (logo vs banner)
     - ✅ `modal` → Disabled button placeholder (for Phase 7)
   - Uses `updateConfigValue` and `getConfigValue` from context

#### Files Renamed

1. **`component-section.tsx` → `styles-section.tsx`** ✅
   - Export renamed from `ComponentSection` to `StylesSection`

#### Files Modified

1. **`apps/app/src/components/theme-editor/panel/design-panel.tsx`** ✅
   - Imports new components: `StylesSection`, `ContentSection`, `StyleContentTabs`
   - Uses `hasEditableContent` and `hasConfigContent` from registry
   - Local state for active tab: `useState<TabType>("styles")`
   - Conditional rendering:
     - Both styles + content → Show tabs
     - Only styles → Show StylesSection (no tabs)
     - Only content → Show ContentSection (no tabs)

2. **`apps/app/src/components/theme-editor/panel/sections/index.ts`** ✅
   - Updated exports for new components

---

### Phase 5: Content Field Inputs

**Goal**: Create input components for content fields.

#### Files to Create (if not reusable from existing)

1. **`apps/app/src/components/theme-editor/panel/inputs/text-input.tsx`**
   - Simple text input wrapper with label
   - May just use existing `FieldWrapper` + `Input` pattern

2. **`apps/app/src/components/theme-editor/panel/inputs/url-input.tsx`**
   - URL input with validation indicator
   - May just use `Input` with URL-specific placeholder

3. **`apps/app/src/components/theme-editor/panel/inputs/toggle-input.tsx`**
   - Toggle with label wrapper
   - Uses existing `Switch` component

4. **`apps/app/src/components/theme-editor/panel/inputs/image-input.tsx`**
   - Wrapper around existing `ImageUploader` for panel context
   - Handles path building and change callbacks

#### Files to Reuse

- `@apps/app/src/components/image-upload.tsx` - For image fields
- `@v1/ui/input` - For text/url fields
- `@v1/ui/switch` - For toggle fields
- Existing `PixelInput` - For number fields (or adapt)

---

### Phase 6: Integration & Testing

**Goal**: Connect all pieces and test the integrated editor.

#### Files to Modify

1. **`apps/app/src/actions/design/save-theme-action.ts`**
   - No changes needed (styles save unchanged)

2. **Context save logic**
   - Ensure both styles and config save on `saveDrafts()`
   - Test unsaved changes detection for both

3. **`apps/app/src/app/(dashboard)/(main)/(sidebar)/design/layout.tsx`**
   - Keep "Content" tab for now (legacy form still available)
   - Can remove later after testing

#### Testing Checklist

- [ ] Eye icons toggle visibility correctly
- [ ] Visibility changes show in live preview
- [ ] Tabs switch between Styles and Content
- [ ] Content fields update themeConfigDraft
- [ ] Image uploads work in content section
- [ ] Save button saves both styles AND config
- [ ] Unsaved changes detected for both styles AND config
- [ ] Reset reverts both styles AND config

---

### Phase 7: Modal Implementation (DEFERRED)

**Goal**: Create modals for complex configurations.

#### Files to Create (Future)

1. **`apps/app/src/components/theme-editor/modals/menu-editor-modal.tsx`**
   - Reuse DnD logic from `set-menu.tsx`
   - Add/delete/edit/reorder menu items

2. **`apps/app/src/components/theme-editor/modals/carousel-editor-modal.tsx`**
   - Product selection with filter logic
   - includeIds/excludeIds management

#### Context Updates (Future)

- Add modal state: `openModal`, `setOpenModal`
- Modal types: `"menu-primary" | "menu-secondary" | "carousel" | null`

---

### Phase 8: Cleanup (DEFERRED)

**Goal**: Remove legacy content page after full testing.

#### Files to Delete (Future)

1. `apps/app/src/app/(dashboard)/(main)/(sidebar)/design/content/page.tsx`
2. `apps/app/src/components/design/content/theme-content-form.tsx`
3. `apps/app/src/components/design/content/set-header.tsx`
4. `apps/app/src/components/design/content/set-menu.tsx`
5. `apps/app/src/components/design/content/set-banner.tsx`
6. `apps/app/src/components/design/content/set-carousel.tsx`
7. `apps/app/src/components/design/content/set-footer.tsx`

#### Layout Update (Future)

- Remove "Content" tab from design layout

---

## File Change Summary

### Files to Create
| File | Phase | Description |
|------|-------|-------------|
| `panel/sections/style-content-tabs.tsx` | 4 | Tab switcher component |
| `panel/sections/content-section.tsx` | 4 | Content fields renderer |
| `panel/inputs/text-input.tsx` | 5 | Text input wrapper (if needed) |
| `panel/inputs/url-input.tsx` | 5 | URL input wrapper (if needed) |
| `panel/inputs/toggle-input.tsx` | 5 | Toggle input wrapper (if needed) |
| `panel/inputs/image-input.tsx` | 5 | Image upload wrapper |

### Files to Modify
| File | Phase | Changes |
|------|-------|---------|
| `design-editor-provider.tsx` | 1 | Add config state, update save logic |
| `theme-config.ts` | 1 | Add new fields |
| `theme-defaults.ts` | 1 | Add defaults for new fields |
| `component-registry.ts` | 2 | Add config fields, visibility keys |
| `layout-tree.tsx` | 3 | Add eye icon toggles |
| `component-section.tsx` | 4 | Rename to `styles-section.tsx` |
| `design-panel.tsx` | 4 | Add tab logic, import new sections |

### Files to Keep (For Now)
| File | Reason |
|------|--------|
| `design/content/page.tsx` | Legacy form for testing |
| `theme-content-form.tsx` | Legacy form for testing |
| `set-*.tsx` components | Legacy form for testing |

### Files to Delete (Future - Phase 8)
- All files in `components/design/content/`
- `design/content/page.tsx`

---

## Phase 1 Completion Summary

**Completed**: All foundation work for config state management

### What Was Implemented

1. **Type System Updates**
   - Extended `ThemeConfig` interface with banner visibility toggles (`showHeadline`, `showSubline`, `showButton`)
   - Added new `carousel` configuration section with product selection fields
   - Updated default values to include all new fields

2. **Context State Management**
   - Added `themeConfigDraft` state for editable config
   - Added `savedThemeConfig` state for change detection
   - Implemented `updateConfigValue()` for path-based updates (e.g., `"cta.bannerHeadline"`)
   - Implemented `getConfigValue()` for path-based retrieval
   - Implemented `toggleSectionVisibility()` for section visibility toggles
   - Updated `hasUnsavedChanges` to detect changes in both styles AND config
   - Updated `saveDrafts()` to save both styles and config in parallel
   - Updated `resetDrafts()` to reset both styles and config

3. **Preview Integration**
   - Updated `design-preview.tsx` to use `themeConfigDraft` instead of read-only `themeConfig`
   - Live preview now reflects config changes immediately

### Key Technical Decisions

- **Parallel Saving**: Styles and config save in parallel using `Promise.all()` for better performance
- **Deep Cloning**: Config updates use JSON parse/stringify for safe immutable updates
- **Path-Based Updates**: Using dot-notation paths (`"cta.bannerHeadline"`) for flexible nested updates
- **Type Safety**: All new fields are properly typed in `ThemeConfig` interface

### Phase 2 Completion Summary

All registry updates have been implemented. The component registry now has:
- Full type definitions for content fields alongside style fields
- Visibility keys for all toggleable sections
- Config fields for header, menus, carousel, banner, and footer
- Utility functions for checking component capabilities

---

## Notes

### Saving Behavior
- **Styles**: Use existing `saveThemeAction` server action
- **Config**: Use existing `workflow.theme.updateConfig` tRPC mutation
- Both called from `saveDrafts()` in context

### Visibility Toggles
Components with visibility toggles (via eye icon in layout tree):
- Primary Menu (`sections.showPrimaryMenu`)
- Secondary Menu (`sections.showSecondaryMenu`)
- Product Carousel (`sections.showSimilarProducts`)
- Banner (`sections.showCTABanner`)

### Content Section Organization
Content fields use `section` property for grouping, similar to styles:
- Banner: "Visibility", "Headline", "Subheadline", "Button", "Background"
- Footer: "Social Links"
- Carousel: "Display", "Products"

