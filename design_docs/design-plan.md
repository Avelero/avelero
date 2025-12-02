## Design Editor & DPP Theming – Architecture Plan

This document describes how to architect the new design editor, live DPP preview, and theme storage model. It focuses on major structural decisions rather than implementation details so it can be used as guidance when working with LLMs.

---

## 1. High-Level Goals

- **Single theme per brand**: Each brand has one canonical theme (no templates) that controls:
  - Visual styles (colors, typography, component styles).
  - Non-style config (logos, menus, CTA, social links, section toggles, image behavior).
- **Static, cacheable runtime**: Public DPP pages are rendered server-side with a simple HTML+CSS output:
  - DPP HTML is rendered from `DppData` and `ThemeConfig`.
  - Brand styles are loaded via a **single stylesheet URL** per brand (stored in Supabase storage).
- **Interactive design editor**:
  - **Two-panel layout** (left panel with navigation, center live preview).
  - Live preview updates **instantly** on local changes (before save).
  - Hover/select on preview highlights components and navigates to their editor in the left panel.
  - Single global **"You have unsaved changes" pill** with Save / Cancel (below the preview).
- **Avoid duplication & complexity**:
  - Reuse the existing DPP layout and component classes where possible.
  - Replace the current "CSS variables generated at runtime" complexity with a simpler "theme JSON → CSS file" pipeline, while still using the existing component class names.

---

## 2. Data Model & Storage Architecture

### 2.1 Core Concepts

- **DppData** (`apps/dpp/src/types/dpp-data.ts`):
  - Per-product data (title, materials, journey, impact, similar products, etc.).
  - Fetched by `upid`.
- **ThemeConfig** (`apps/dpp/src/types/theme-config.ts`):
  - Non-style configuration (logos, menus, CTA banner, social links, visibility toggles, image behavior).
- **ThemeStyles** (`apps/dpp/src/types/theme-styles.ts`):
  - Styles for design tokens (colors, typography) and component class overrides (e.g. `product__title`, `impact-card`).

We will keep these three conceptual layers, but simplify how they are stored and used.

### 2.2 Canonical Sources of Truth

- **Database**
  - **`brand` table** (existing): one row per brand.
  - **`brand_theme` table** (new – 1:1 with brand):
    - `brand_id` (PK + FK to `brand`).
    - `theme_styles` (JSONB) – stores a `ThemeStyles`-shaped object (overrides only).
    - `theme_config` (JSONB) – stores a `ThemeConfig`-shaped object.
    - `stylesheet_path` (string) – Supabase storage path to the generated CSS overrides file.
    - `google_fonts_url` (string, nullable) – URL for Google Fonts for this theme, derived from `theme_styles.typography` on save.
    - `updated_at` (timestamp).
  - **`products` and `product_variants` tables** (existing):
    - `products` holds brand-level product data; `product_variants` holds variant-level UPIDs (color/size) and links back to `products`.
    - Public DPP routes resolve primarily from `product_variants.upid`, then join to `products` for shared fields and `brand_id`.
  - Rationale:
    - Keeping **structured JSON** in the DB makes it easy to query, migrate, and partially update.
    - The stylesheet is a **derived artifact**, not the source of truth (we never have to parse CSS back into data).

- **Supabase Storage**
  - Bucket: `dpp-themes` (name TBD).
  - Files: one CSS file per brand, e.g.:
    - `brand-{brandId}/theme.css`
  - Optionally versioned or timestamped internally, but the **database row** exposes the current logical URL.

#### 2.2.1 Templates deprecation

- Existing tables `passport_templates` and `passport_template_modules` model multiple templates per brand.
- With the **single-theme-per-brand** approach:
  - `brand_theme` becomes the canonical place for theme-related data.
  - Over time we can:
    - Migrate any relevant template data into `brand_theme`.
    - Drop `passport_templates`, `passport_template_modules`, and the `products.templateId` column.
  - New features should depend only on `brand_theme`; template tables are treated as legacy during migration.

### 2.3 Theme Creation & Lifecycle

- **On brand creation**
  - Insert a `brand_theme` row with:
    - `theme_styles = {}` (no overrides; rely entirely on the defaults from `globals.css`).
    - `theme_config = {}` or a minimal scaffold that the editor can progressively fill.
    - `stylesheet_path = NULL` (no overrides file yet).
    - `google_fonts_url = NULL`.
  - This keeps brand creation simple and avoids generating CSS until a brand actually customizes its theme.

- **On theme edit & save**
  - Editor works on in-memory **drafts** of:
    - `themeStylesDraft: ThemeStyles`
    - `themeConfigDraft: ThemeConfig`
  - When Save is clicked:
    - Send the drafts to a server action `saveBrandTheme`.
    - Within the action:
      - Validate + normalize drafts.
      - Persist `theme_styles` + `theme_config` JSONB to `brand_theme`.
      - Generate a **CSS overrides file** from `theme_styles` and upload to Supabase, overriding `theme.css`.
      - Recompute `google_fonts_url` from `theme_styles.typography` and update `brand_theme`.
    - Return the new canonical values to the client and clear the "dirty" flag.

- **On Cancel**
  - Discard the local drafts and reset to the last persisted `theme_styles`/`theme_config` from `brand_theme`.

### 2.4 Public DPP Fetch Flow

- Input: `upid` (variant level).
- Flow:
  1. Query `product_variants` by `upid` → returns `variant` with `product_id`.
  2. Query `products` by `product_id` → returns product data including `brand_id`.
  3. Query `brand_theme` by `brand_id` → returns `theme_config`, `theme_styles`, `stylesheet_path`, `google_fonts_url`.
  4. Render the DPP page (`apps/dpp`) entirely on the server using:
     - `products` + `product_variants` (+ any other tables) → `DppData`.
     - `theme_config` → `ThemeConfig`.
  5. In layout/head:
     - Always include the static DPP base stylesheet (compiled from `globals.css`).
     - If `stylesheet_path` is set, add `<link rel="stylesheet" href={publicUrlFor(stylesheet_path)} />` after the base CSS so overrides win.
     - If `google_fonts_url` is set, add `<link rel="stylesheet" href={google_fonts_url} />`.
  6. Response is fully server-rendered HTML + static CSS.

This keeps the runtime fast and simple: **no ThemeInjector is needed in the public DPP** after the migration (it can stay temporarily for backwards compatibility if desired).

---

## 3. Theme → CSS Generation

We keep the **idea** of `css-generator.ts` and `google-fonts.ts`, but change where they are used.

### 3.1 Generator Responsibilities

- Inputs:
  - `ThemeStyles` object (may be partial; only overrides).
- Outputs:
  - `css: string` – a CSS **overrides** stylesheet that:
    - Defines only the design token variables (colors, typography) and component CSS custom properties that differ from the defaults in `globals.css`.
    - Optionally includes an `@import` for the Google Fonts URL at the top (if you prefer font loading via CSS instead of `<link>`).

- Implementation notes:
  - Refactor `generateThemeCSS` to walk `ThemeStyles` and emit CSS variables only for defined properties.
  - Static styling:
    - `globals.css` remains the single source of truth for base styles and defaults.
    - The generated overrides file is **only additive/overriding**, never redefining the whole system.

### 3.2 Google Fonts URL Generation

- `google-fonts.ts` already computes ideal CSS2 URLs given typography.
- In the new architecture:
  - The server action `saveBrandTheme`:
    - Reads `themeStyles.typography`.
    - Uses `generateGoogleFontsUrlFromTypography` to compute a `google_fonts_url`.
    - Stores it in `brand_theme.google_fonts_url` (derived once per save, reused on every request).
  - Public DPP:
    - Pulls `google_fonts_url` from DB and renders a `<link>` tag in `<head>`.
  - The editor preview:
    - Can still use `ThemeInjector` (or a minimal equivalent) to inject the fonts into the dashboard context.

---

## 4. Live Preview Architecture (Inside `@app`)

### 4.1 Reusing vs. Rebuilding DPP UI

We want the live preview to **match the public DPP** visually but also be highly interactive (hover/select, highlight, instant updates).

**Decision: extract a shared DPP components package (`packages/dpp-components`) and use it from both apps.**

- Create `packages/dpp-components` containing:
  - Pure React components: `Header`, `ContentFrame`, `Footer`, all frames/cards.
  - Shared types: `DppData`, `ThemeConfig`, and (optionally) a runtime `ThemeStyles` alias.
  - A CSS entry file that imports the DPP styling (refactored `globals.css`, e.g. `dpp.css`).
- Both `apps/dpp` and `apps/app` import from this package:
  - Public DPP uses it from server components.
  - The design editor renders it inside a preview wrapper.
- To avoid Tailwind/global clashes:
  - Scope DPP CSS under a root class, e.g. `.dpp-root`.
  - In both apps, wrap the DPP content in `<div className="dpp-root">…</div>`.
- This ensures the editor, preview, and live DPP always share a single implementation and type surface.

### 4.2 Selectable Components & Highlighting

**Implementation (CSS-driven data attributes):**

Instead of wrapping components with a `Selectable` wrapper (which would require modifying the shared DPP components), we use a **CSS-driven approach** with data attributes:

1. **Detection Hook** (`apps/app/src/hooks/use-selectable-detection.ts`):
   - Listens to mouse events on the preview container.
   - Traverses the event target's DOM ancestry to find elements with class names matching component IDs in the registry.
   - Uses `requestAnimationFrame` for smooth 60fps updates.
   - Sets `hoveredComponentId` and `selectedComponentId` in context.

2. **Styling via Data Attributes**:
   - When a component is hovered/selected, the hook adds `data-hover-selection="true"` or `data-selected-selection="true"` to all elements with that component's class name.
   - CSS in `packages/ui/src/globals.css` handles the visual styling:
     ```css
     [data-hover-selection="true"],
     [data-selected-selection="true"] {
       outline: 2px solid hsl(var(--brand));
       outline-offset: -2px;
     }
     ```

3. **Behavior**:
   - **Hover**: Shows blue outline on component (visual feedback only).
   - **Click**: Selects the component and will navigate to its editor in the left panel (to be implemented).

This approach:
- Doesn't modify the DPP components (they remain pure and reusable).
- Uses GPU-accelerated CSS rendering for smooth highlights.
- Handles nested elements elegantly (deepest selectable component is detected).

### 4.3 Applying Draft Styles in Preview

- The preview uses the **draft `ThemeStyles`** object, not the persisted one.
- **Implementation (Option 1 – Local ThemeInjector)**:
  - Keep `css-generator.ts` in a shared place.
  - In the preview, generate CSS from the current `themeStylesDraft` on each change (debounced).
  - Inject it via a `PreviewThemeInjector` client component that:
    - Manages a `<style>` tag scoped to the preview container (e.g. by prefixing selectors with `.dpp-root`).

---

## 5. Single-Panel Design Editor Architecture

> **Major Architecture Change**: The original three-panel design (left navigation, center preview, right editor) has been replaced with a **two-panel design** (left panel with integrated navigation + editing, center preview). This provides more screen space for the preview on smaller screens (especially MacBooks) and creates a more intuitive editing flow.

### 5.1 Panel Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│ Dashboard Header                                                     │
├───────────────┬─────────────────────────────────────────────────────┤
│               │                                                      │
│  Left Panel   │              Live Preview                            │
│  (300px)      │              (flex-1)                                │
│               │                                                      │
│  - Navigation │              ┌────────────────────────────┐          │
│  - Editors    │              │  .dpp-root container       │          │
│               │              │  (DPP components render)   │          │
│               │              │                            │          │
│               │              └────────────────────────────┘          │
│               │                                                      │
│               │              ┌────────────────────────────┐          │
│               │              │  Save/Cancel Pill          │          │
│               │              └────────────────────────────┘          │
└───────────────┴─────────────────────────────────────────────────────┘
```

### 5.2 Left Panel Navigation Structure

The left panel has a **three-level navigation** system:

```
Level 0 (Root)           Level 1 (Section)           Level 2 (Component)
─────────────────────    ─────────────────────       ─────────────────────
Header: "Passport"       Header: "Layout"            Header: "Product Details"
                         (with back button)          (with back button)

┌─────────────────┐      ┌─────────────────┐        ┌─────────────────┐
│ 🔲 Layout    >  │      │ ▶ Header        │        │ Border Color    │
│ T  Typography > │      │ ▶ Product Image │        │ Border Radius   │
│ 🎨 Colors    >  │      │ ▶ Product Info  │        │ ...             │
└─────────────────┘      │ ▶ Product Detls │        └─────────────────┘
                         │   ├─ Details Row│
                         │   └─ Row Label  │
                         │ ▶ Primary Menu 👁│
                         │ ...             │
                         └─────────────────┘
```

**Navigation Sections:**

1. **Layout**: Hierarchical tree view of all DPP components
   - Expand/collapse chevrons for items with children
   - Click item label → navigates to component editor
   - Visibility toggles (eye icon) for: Banner, Product Carousel, Primary Menu, Secondary Menu
   
2. **Typography**: Accordion editors for typography scales
   - Heading 1–6, Body, Small
   - Each with: Font family, size, weight, line height, letter spacing
   
3. **Colors**: Direct list of color token editors
   - Background, Foreground, Primary, Secondary, Accent, Highlight, Success, Border

### 5.3 Component Registry

A central registry (`apps/app/src/components/design/layout/component-registry.ts`) defines:

- **Component hierarchy**: Which components are nested in which
- **Display names**: Human-readable labels for the UI
- **Style fields**: Which `ThemeStyles` properties are editable per component
- **Config fields**: Which `ThemeConfig` properties are editable per component
- **Visibility toggles**: Which components can be shown/hidden

```typescript
export interface ComponentDefinition {
  id: string;                    // CSS class name, e.g. "product-details"
  displayName: string;           // UI label, e.g. "Product Details"
  children?: ComponentDefinition[];
  canToggleVisibility?: boolean;
  visibilityPath?: string;       // e.g. "sections.showCTABanner"
  styleFields?: StyleField[];    // Design token fields
  configFields?: ConfigField[];  // Content/config fields
}
```

This registry is the **single source of truth** for:
- What components exist and their nesting structure
- What's editable for each component
- What the layout tree renders
- What fields the component editor shows

### 5.4 Files Structure

```
apps/app/src/
├── components/design/
│   ├── design-left-panel.tsx      # Main left panel with navigation
│   ├── design-preview.tsx         # Preview container with selection hooks
│   ├── save-bar.tsx               # Save/Cancel pill
│   ├── preview-theme-injector.tsx # Injects draft CSS into preview
│   │
│   ├── navigation/
│   │   └── panel-header.tsx       # Header with title and back button
│   │
│   ├── layout/
│   │   ├── component-registry.ts  # Component hierarchy & field definitions
│   │   └── layout-tree.tsx        # Recursive tree view component
│   │
│   ├── editors/
│   │   ├── typography-editor.tsx  # Typography section (accordions)
│   │   ├── colors-editor.tsx      # Colors section (direct list)
│   │   └── index.ts               # Barrel export
│   │
│   └── fields/
│       ├── color-field.tsx
│       ├── font-family-select.tsx
│       ├── number-field.tsx
│       ├── select-field.tsx
│       ├── typography-scale-editor.tsx
│       └── index.ts
│
├── contexts/
│   └── design-editor-provider.tsx # Central state: drafts, navigation, selection
│
└── hooks/
    └── use-selectable-detection.ts # Mouse event handling for preview
```

---

## 6. State Management & Save Flow

### 6.1 Central Editor Store

Using a React context (`DesignEditorProvider`) in `@app`:

```typescript
type DesignEditorContextValue = {
  // Theme drafts
  themeStylesDraft: ThemeStyles;
  themeConfigDraft: ThemeConfig;
  initialThemeStyles: ThemeStyles;
  initialThemeConfig: ThemeConfig;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  
  // Draft update helpers
  updateTypographyScale: (scale: string, value: TypographyScale) => void;
  updateColor: (colorKey: string, value: string) => void;
  
  // Navigation state
  navigation: NavigationState;  // { level, section?, componentId? }
  navigateToSection: (section: NavigationSection) => void;
  navigateToComponent: (componentId: string) => void;
  navigateBack: () => void;
  navigateToRoot: () => void;
  
  // Layout tree expand/collapse
  expandedItems: Set<string>;
  toggleExpanded: (componentId: string) => void;
  
  // Preview selection
  hoveredComponentId: string | null;
  selectedComponentId: string | null;
  setHoveredComponentId: (id: string | null) => void;
  setSelectedComponentId: (id: string | null) => void;
  
  // Actions
  resetDrafts: () => void;
  saveDrafts: () => Promise<void>;
};
```

### 6.2 Save / Cancel Pill

- `SaveBar` component:
  - Fixed positioned pill below the preview.
  - Shows only when `hasUnsavedChanges` is true.
  - Buttons:
    - **Cancel**: Resets drafts to initial values.
    - **Save**: Calls server action with drafts, shows loading state.

---

## 7. Hydrating the Editor from Storage

### 7.1 Loading Existing Themes

- Editor load:
  - Server:
    - Fetch `brand_theme` row.
    - Deserialize `theme_styles` into `ThemeStyles` and `theme_config` into `ThemeConfig`.
  - Client:
    - Initialize `initialThemeStyles`, `initialThemeConfig`, and corresponding drafts.
  - No need to fetch or parse the CSS from Supabase – the JSON is canonical.

### 7.2 Migration Strategy from Current System

- Current state:
  - `apps/dpp` uses `mockThemeConfigs` and `mockThemeStyles` with `ThemeInjector` + `generateThemeCSS`.
  - Styles are applied at runtime via CSS variables.
- Migration:
  1. Create `brand_theme` entries for existing demo brands using `mockThemeConfigs` and `mockThemeStyles`.
  2. Implement the server-side generation pipeline to create CSS files in Supabase based on those mocks.
  3. Update the DPP app to:
     - Fetch from DB instead of `mock-*`.
     - Include `<link>` tags for the CSS file and Google Fonts.
  4. Remove or minimize the usage of `ThemeInjector` in the public DPP (keep it only for the editor preview if needed).

---

## 8. DPP Data & Theme-Config Fetching Performance

### 8.1 Public DPP Endpoint

- Primary query plan:
  - `SELECT * FROM product_variants WHERE upid = $1` (indexed on `upid`).
  - `SELECT * FROM products WHERE id = $productId` (indexed on `id`, `brand_id`).
  - `SELECT theme_config, theme_styles, stylesheet_path, google_fonts_url FROM brand_theme WHERE brand_id = $brandId`.
- With proper indices:
  - Both queries are O(1) lookups and very fast.
  - They can be wrapped in a single RPC or a small server helper to keep the DPP page clean.
  - The CSS overrides file is served via Supabase + CDN and benefits from HTTP caching; regeneration happens only on theme save, not per request.

### 8.2 Editor Data Fetch

- Editor typically operates on **one brand** (and one or a few products for preview).
- On editor page load:
  - Fetch `brand_theme` and either:
    - A demo `DppData` per brand.
    - Or a selected product's `DppData` from `dpp_product`.
  - This is cheap and can be done in a single TRPC or server action call.

---

## 9. Phased Implementation Plan

### Phase 0 – Prep & Shared Types

- Extract or centralize types:
  - Ensure `ThemeConfig`, `ThemeStyles`, and `DppData` types are exported from `packages/dpp-components` (or a dedicated `dpp-types` module) and consumed by both `apps/dpp` and `apps/app`.
- Document current visual structure of the DPP (components and class names) for reference while rebuilding the preview.
  - **Status (done):** Types are centralized in `packages/dpp-components` and referenced from both apps; DPP visual structure documented in `design_docs/dpp-structure.md`.

### Phase 1 – Data & Storage Layer

- Design and create the `brand_theme` table.
- Implement Supabase bucket `dpp-themes` and utility functions for reading/writing CSS files.
- Implement a pure Node/server version of `generateThemeCSS` that:
  - Accepts `ThemeStyles`.
  - Returns a CSS overrides string (only variables/custom properties for defined overrides).
- Implement a server helper:
  - `saveBrandTheme(brandId, themeStyles, themeConfig)`.
  - Uses the generator + Supabase + DB update.
  - **Status (done):** `brand_theme` schema added (`packages/db/src/schema/brand/brand-theme.ts`), bucket RLS policies created remotely, server-safe CSS/font generators added to `packages/dpp-components/src/lib`, and `apps/app/src/actions/design/save-theme-action.ts` stubs the save flow (upload + DB upsert).

### Phase 2 – Wire Up Public DPP to New Theme Model

- Replace `mockThemeConfigs`/`mockThemeStyles` in `apps/dpp` with DB-backed fetches.
- For now, keep using `ThemeInjector` to inject the generated CSS variables, but:
  - Generate the CSS **once per request** from DB-backed `ThemeStyles` instead of mocks.
  - Add support for consuming the Supabase stylesheet once it's ready.
- Once stable:
  - Switch the public DPP fully to `<link rel="stylesheet">` pointing to Supabase CSS.
  - Reduce `ThemeInjector` to preview-only usage.
  - **Status (done):** Brand routes now fetch product + brand + `brand_theme` from Supabase (no mock fallback); demo remains at `/` using `demo-data`. Supabase `stylesheet_path` is linked when present; inline CSS generation is used only when missing. Google Fonts prefers stored URL with fallback derived from typography.

### Phase 3 – Design Editor Shell & State

- Build the dashboard design page layout:
  - Left panel stub.
  - Center preview container.
  - ~~Right panel stub.~~ (Removed in restructuring)
  - Bottom Save/Cancel pill.
- Implement `DesignEditorProvider` with:
  - Draft theme state.
  - Selection/hover state.
  - `hasUnsavedChanges` and save/cancel control logic (stub server action).
  - **Status (done):** Dashboard design page scaffolded; preview uses shared DPP components and scoped CSS; provider holds draft state, navigation state, and save/reset hooks; styling is scoped to avoid conflicts with the dashboard app.

### Phase 4 – Basic Live Preview & Typography Editor

- Rebuild a **non-interactive** copy of the DPP UI inside `@app` as `DesignPreviewDpp`:
  - Use the same structure and classes as `apps/dpp` but with static demo data.
- Integrate a minimal `PreviewThemeInjector` that:
  - Generates CSS from `themeStylesDraft`.
  - Injects a `<style>` tag inside the preview container.
- Implement typography and color editors (originally in right panel, now in left panel).
- Confirm that typography edits update the preview instantly.
  - **Status (done):** 
    - `DesignPreview` component rebuilt using shared `@v1/dpp-components` package.
    - `PreviewThemeInjector` generates and injects CSS from draft state, scoped to `.dpp-root`.
    - Typography editor (`TypographyEditor`) with accordions for H1-H6, Body, Small.
    - Colors editor (`ColorsEditor`) with direct color field list.
    - Field components: `ColorField`, `FontFamilySelect`, `NumberField`, `SelectField`, `TypographyScaleEditor`.

### Phase 5 – Component Selection & Highlighting

- ~~Introduce the `Selectable` wrapper across the preview DPP components.~~ (Changed approach)
- Wire hover + click to `hoveredComponentId` and `selectedComponentId` using CSS data attributes.
- Add the blue highlight behavior based on state.
- **Status (done):**
  - Created `use-selectable-detection.ts` hook that:
    - Detects selectable components on mouse move using class name matching against the component registry.
    - Uses `requestAnimationFrame` throttling for smooth 60fps updates.
    - Applies `data-hover-selection` and `data-selected-selection` attributes to elements.
  - Added CSS rules in `packages/ui/src/globals.css` for selection highlighting:
    - Blue outline (2px solid brand color) on hover and selected states.
    - Special handling for components with internal absolute content (pseudo-element borders).
  - Preview now responds to hover/click without modifying DPP components.

### Phase 5.5 – Panel Restructuring (NEW)

- **Major architecture change**: Removed the right panel entirely.
- Restructured the left panel with three-level navigation:
  - Root: Layout, Typography, Colors buttons
  - Section: Section-specific content (tree, accordions, color fields)
  - Component: Component-specific editor fields (to be implemented)
- Created the Layout tree (`layout-tree.tsx`) with:
  - Hierarchical rendering of components from `COMPONENT_TREE`
  - Expand/collapse functionality
  - Visibility toggle icons for appropriate components
  - Hover states and navigation chevrons
- Created comprehensive component registry (`component-registry.ts`) with:
  - Full hierarchy of all DPP components
  - Style fields and config fields per component
  - Visibility toggle configuration
  - Utility functions: `findComponentById`, `getComponentAncestry`, `getAllComponentIds`, `isSelectableComponent`
- **Status (done):**
  - Left panel navigation working with back button
  - Typography section with all typography scale accordions
  - Colors section with all color token fields
  - Layout tree with expand/collapse and visibility toggles (UI only)
  - Component registry fully defined

### Phase 6 – Component Editor & ThemeConfig Editing

- Connect click in preview → navigate to component in Layout tree
- Implement component-specific editor rendering based on `selectedComponentId`
- Add editor schemas for:
  - `branding.headerLogoUrl` / `branding.bannerLogoUrl`.
  - Menus (primary/secondary) with add/remove/edit functionality.
  - CTA banner fields.
  - Social links and toggles.
  - Section visibility flags.
- Hook these schemas to `themeConfigDraft` and verify Save/Cancel behavior.

### Phase 7 – Polishing, Error Handling, and Migration

- UX improvements:
  - Disable Save when nothing changed.
  - Show toast feedback on successful save / error.
  - Handle missing fonts or invalid values gracefully.
- Performance:
  - Debounce CSS generation in the preview.
  - Avoid re-rendering the whole preview tree on small style changes when possible.
- Migration:
  - Populate `brand_theme` for existing demo brands.
  - Gradually remove mock data and old ThemeInjector paths in the DPP app.

---

## 9.1 Remaining Work – Style Fields & Config Fields Implementation

This section documents which editor features and field types still need to be created in `component-editor.tsx` and related files.

### 9.1.1 Field Type Implementations

| Field Type | Status | Notes |
|------------|--------|-------|
| `color` | ✅ Done | `ColorField` component working |
| `number` | ✅ Done | `NumberField` component with units (px, %, em, rem) |
| `typescale` | ✅ Done | `TypescaleField` dropdown for H1-H6, Body, Body-sm, Body-xs |
| `select` | ✅ Done | `SelectField` dropdown for options like capitalization |
| `toggle` | ✅ Done | `ToggleField` component using Switch from @v1/ui |
| `text` | ✅ Done | `TextField` component for text input |
| `url` | ✅ Done | `UrlField` component with validation hint and external link icon |
| `image` | ✅ Done | `ImageField` component with preview thumbnail |
| `menu-items` | ✅ Done | `MenuItemsField` with add/remove/reorder functionality |

### 9.1.2 Config Field Implementations by Component

All config field types are now implemented. The `ComponentEditor` component renders config fields using the new field components:

| Component | Config Fields | Status |
|-----------|---------------|--------|
| **Header** | `branding.headerLogoUrl` (image) | ✅ Done |
| **Product Image** | (no config fields) | ✅ Done |
| **Primary Menu** | `menus.primary` (menu-items) | ✅ Done |
| **Secondary Menu** | `menus.secondary` (menu-items) | ✅ Done |
| **Carousel** | `images.carouselImageZoom` (number), `images.carouselImagePosition` (select) | ✅ Done |
| **Banner** | `cta.bannerBackgroundImage` (image), `branding.bannerLogoUrl` (image), `branding.bannerLogoHeight` (number) | ✅ Done |
| **Banner Subheadline** | `cta.bannerShowSubline` (toggle), `cta.bannerSubline` (text) | ✅ Done |
| **Banner Button** | `cta.bannerCTAText` (text), `cta.bannerCTAUrl` (url) | ✅ Done |
| **Footer** | `social.legalName` (text), `social.useIcons` (toggle), social platform toggles + URLs | ✅ Done |

**Implementation Details:**
- `design-editor-provider.tsx` now includes `updateConfigValue` and `getConfigValue` helpers for nested config paths
- `component-editor.tsx` includes `ConfigFieldRenderer` which renders the appropriate field component based on `ConfigField.type`
- All config fields are rendered under a "Content" section in the component editor

### 9.1.3 Missing Style Properties

| Component | Missing Style Property | Notes |
|-----------|------------------------|-------|
| **Product Details** | `direction` (select: row/column) | Missing from registry, needs CSS variable |
| **Journey Card** | `direction` (select: horizontal/vertical) | If timeline direction is customizable |
| **All text components** | `letterSpacing`, `lineHeight` | Currently handled via typescale, but may need fine-tuning |

### 9.1.4 CSS Generator Updates Needed

The following CSS variable mappings may need verification/updates:
- Menu button icon sizing (`menu-primary-button-icon-size`, `menu-secondary-button-icon-size`)
- Impact card icon sizing and color
- Materials certification tag styling
- Product details direction support

### 9.1.5 Remaining Work

All core field types are now implemented. Remaining items:

1. **Low Priority (Polish)**
   - Direction select for product details layout
   - Fine-grained typography controls (if not using typescale)
   - Image upload (currently URL-only)
   - Drag-and-drop reordering for menu items (currently uses up/down buttons)

---

## 10. Future Extensions (Out of Scope for First Version)

- Theme versioning / rollback per brand.
- Multi-product previews and viewports (mobile/desktop toggles).
- Template-level presets (even if the brand only uses one at a time).
- Audit log of style/config changes.

These can be layered on top of the architecture above without major structural changes, as long as the **DB `brand_theme` JSON and stylesheet pipeline** remain the canonical path for creating and serving themes.
