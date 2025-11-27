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
  - Three-panel layout (left navigation, center live preview, right editor).
  - Live preview updates **instantly** on local changes (before save).
  - Hover/select on preview highlights components and drives the right-side panel.
  - Single global **“You have unsaved changes” pill** with Save / Cancel.
- **Avoid duplication & complexity**:
  - Reuse the existing DPP layout and component classes where possible.
  - Replace the current “CSS variables generated at runtime” complexity with a simpler “theme JSON → CSS file” pipeline, while still using the existing component class names.

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
    - Return the new canonical values to the client and clear the “dirty” flag.

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

- Wrap each customizable piece of UI in a thin `Selectable` wrapper:
  - Responsibilities:
    - Adds data attributes: `data-dpp-component-id`, `data-dpp-field`, etc.
    - Handles `onMouseEnter`, `onMouseLeave`, `onClick` to update shared editor state:
      - `hoveredComponentId`
      - `selectedComponentId`
    - Applies blue highlight styles based on hover/selection state.
  - This can be a generic component used across all cards:

```tsx
<Selectable id="journey-card">
  <JourneyCard ... />
</Selectable>
```

- Highlight behavior:
  - **Hover**: blue outline or background (using a single shared CSS class that wraps the component).
  - **Selected**: stronger blue outline or overlay; persists until another component is clicked.

### 4.3 Applying Draft Styles in Preview

- The preview uses the **draft `ThemeStyles`** object, not the persisted one.
- Two implementation options:
  - **Option 1 – Local ThemeInjector**:
    - Keep `css-generator.ts` in a shared place.
    - In the preview, generate CSS from the current `themeStylesDraft` on each change (debounced).
    - Inject it via a `PreviewThemeInjector` client component that:
      - Manages a `<style>` tag scoped to the preview container (e.g. by prefixing selectors with `.dpp-root`).
  - **Option 2 – Inline style props**:
    - Pass styles as props into each component and apply them inline or via Tailwind class composition.
    - Much more work and diverges from the public DPP styling model.

**Decision**: Use **Option 1** to stay aligned with the existing variable-based theming, but switch to generating the CSS **entirely client-side in the editor** using the draft state. This minimizes changes to the DPP visual system while moving the heavy lifting to the save pipeline for production use.

---

## 5. Left Panel – Navigation & Nested Menus

### 5.1 Functional Requirements

- Structured like the mockups:
  - Root category: “Content”.
  - Sub-items: Logo, First menu, Second menu, Product carousel, Banner, Socials, etc.
- When entering a sub-section:
  - The left panel header label changes and shows a back chevron.
  - Clicking the header navigates back, similar to `CategorySelect`’s breadcrumb.
- Should not require separate route files for each sub-panel; it should be **data-driven**.

### 5.2 Data-Driven Nav Model

- Define a static nav tree object:

```ts
type DesignNavItem = {
  id: string;                    // e.g. "logo", "primaryMenu"
  label: string;
  icon?: ReactNode;
  children?: DesignNavItem[];
  panelType?: 'theme-config' | 'component' | 'typography';
  panelKey?: string;             // e.g. "branding.headerLogoUrl"
};
```

- Store this in a config module used by the left panel and right panel.

### 5.3 Component Structure

- `DesignLeftPanel` (client component):
  - State:
    - `navPath: string[]` – array of nav item IDs from root to current.
  - Derived:
    - `currentItems` – children of last item in `navPath` (or root list).
    - `headerLabel` – label of last item in `navPath` (or “Content”).
  - Renders:
    - Header button with back chevron if `navPath.length > 0`.
    - List of items for the current level.
  - On item click:
    - If item has `children`, push it to `navPath`.
    - If item is leaf, set `selectedNavItemId` in global editor state (for right panel) and keep `navPath` for context.

This gives you one generic left panel implementation with no copy-pasted code per menu.

---

## 6. Right Panel – Editor UI

### 6.1 Default Typography Mode (No Selection)

- When **no component is selected in the preview** and no specific nav item is active:
  - Show the default **typography accordions**:
    - Heading 1–6
    - Body
    - Small
  - Show a **Colors** accordion for design tokens:
    - Background, foreground, primary, secondary, accent, highlight, success, border, etc.
  - Each accordion expands to a set of shared controls:
    - Font family (with font selector tied to Google Fonts utilities).
    - Size, weight, line-height.
    - Tracking / letter-spacing.
  - Typography fields are bound to `themeStylesDraft.typography[scaleKey]`.
  - Color fields are bound to `themeStylesDraft.colors`.

### 6.2 Component-Specific Mode (Selection or Nav)

- When a component is selected (hover/click) or a nav item maps to a component:
  - Right panel switches from accordion view to a **focused form**:
    - E.g. for `journey-card`, fields might be:
      - Background color, border radius, stroke color, spacing, etc.
  - This mapping is driven by a central **component schema registry**:

```ts
type StyleField =
  | { type: 'color'; path: string; label: string }
  | { type: 'number'; path: string; label: string; unit?: 'px' | '%' }
  | { type: 'four-sides'; basePath: string; label: string } // for spacing, border radius, etc.
  | { type: 'select'; path: string; label: string; options: ... }
  | { type: 'toggle'; path: string; label: string };

type ComponentEditorSchema = {
  id: string; // "journey-card"
  displayName: string;
  fields: StyleField[];
};
```

- The right panel looks up the schema by `selectedComponentId` or `selectedNavItemId` and renders the appropriate fields.

**Schema location / single source of truth**

- Maintain a central registry (ideally in `packages/dpp-components` or a sibling `theme` module) that exports:

```ts
type ComponentKey = keyof ThemeStyles;

type ComponentEditorRegistry = Record<ComponentKey, ComponentEditorSchema>;
```

- Because the keys are typed as `keyof ThemeStyles`, any change to the `ThemeStyles` interface will surface as type errors in the registry, keeping it as the single runtime source of truth for:
  - Which components are editable.
  - How each style property maps to concrete UI fields in the editor.

### 6.3 Shared Field Components

Implement shared UI building blocks (using `@v1/ui`) so fields are not duplicated:

- `ColorField` (swatch + hex input + optional alpha).
- `NumberFieldWithUnit`.
- `FourSideInput` (for top/right/bottom/left groups).
- `TypographyFieldGroup`.
- `ToggleField` / `SwitchField`.

Each field:
- Reads its current value from `themeStylesDraft` or `themeConfigDraft` via a helper (e.g. using `dot-prop` semantics for paths).
- Updates the draft and sets the editor state `dirty` flag on change.

---

## 7. State Management & Save Flow

### 7.1 Central Editor Store

- Use a dedicated client-side store (e.g. Zustand or a custom React context) in `@app`:

```ts
type DesignEditorState = {
  themeStylesDraft: ThemeStyles;
  themeConfigDraft: ThemeConfig;
  initialThemeStyles: ThemeStyles;
  initialThemeConfig: ThemeConfig;
  hoveredComponentId: string | null;
  selectedComponentId: string | null;
  selectedNavItemId: string | null;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  // actions: setters & resetters
};
```

- `DesignEditorProvider`:
  - Server component parent fetches:
    - `ThemeStyles` + `ThemeConfig` from `brand_theme`.
    - Demo `DppData` (or a selected product) for preview.
  - Wraps the whole design page in this provider.

### 7.2 Save / Cancel Pill

- `SaveBar` component:
  - Fixed positioned pill under the preview (as in the mock).
  - Shows only when `hasUnsavedChanges` is true.
  - Buttons:
    - **Cancel**:
      - Resets drafts to `initialThemeStyles` / `initialThemeConfig`.
      - Clears `hasUnsavedChanges`.
    - **Save**:
      - Calls a server action with the current drafts.
      - Shows loading state (`isSaving`).
      - On success, updates `initial*` to current drafts and clears `hasUnsavedChanges`.

---

## 8. Hydrating the Editor from Storage

### 8.1 Loading Existing Themes

- Editor load:
  - Server:
    - Fetch `brand_theme` row.
    - Deserialize `theme_styles` into `ThemeStyles` and `theme_config` into `ThemeConfig`.
  - Client:
    - Initialize `initialThemeStyles`, `initialThemeConfig`, and corresponding drafts.
  - No need to fetch or parse the CSS from Supabase – the JSON is canonical.

### 8.2 Migration Strategy from Current System

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

## 9. DPP Data & Theme-Config Fetching Performance

### 9.1 Public DPP Endpoint

- Primary query plan:
  - `SELECT * FROM product_variants WHERE upid = $1` (indexed on `upid`).
  - `SELECT * FROM products WHERE id = $productId` (indexed on `id`, `brand_id`).
  - `SELECT theme_config, theme_styles, stylesheet_path, google_fonts_url FROM brand_theme WHERE brand_id = $brandId`.
- With proper indices:
  - Both queries are O(1) lookups and very fast.
  - They can be wrapped in a single RPC or a small server helper to keep the DPP page clean.
  - The CSS overrides file is served via Supabase + CDN and benefits from HTTP caching; regeneration happens only on theme save, not per request.

### 9.2 Editor Data Fetch

- Editor typically operates on **one brand** (and one or a few products for preview).
- On editor page load:
  - Fetch `brand_theme` and either:
    - A demo `DppData` per brand.
    - Or a selected product’s `DppData` from `dpp_product`.
  - This is cheap and can be done in a single TRPC or server action call.

---

## 10. Phased Implementation Plan

### Phase 0 – Prep & Shared Types

- Extract or centralize types:
  - Ensure `ThemeConfig`, `ThemeStyles`, and `DppData` types are exported from `packages/dpp-components` (or a dedicated `dpp-types` module) and consumed by both `apps/dpp` and `apps/app`.
- Document current visual structure of the DPP (components and class names) for reference while rebuilding the preview.

### Phase 1 – Data & Storage Layer

- Design and create the `brand_theme` table.
- Implement Supabase bucket `dpp-themes` and utility functions for reading/writing CSS files.
- Implement a pure Node/server version of `generateThemeCSS` that:
  - Accepts `ThemeStyles`.
  - Returns a CSS overrides string (only variables/custom properties for defined overrides).
- Implement a server helper:
  - `saveBrandTheme(brandId, themeStyles, themeConfig)`.
  - Uses the generator + Supabase + DB update.

### Phase 2 – Wire Up Public DPP to New Theme Model

- Replace `mockThemeConfigs`/`mockThemeStyles` in `apps/dpp` with DB-backed fetches.
- For now, keep using `ThemeInjector` to inject the generated CSS variables, but:
  - Generate the CSS **once per request** from DB-backed `ThemeStyles` instead of mocks.
  - Add support for consuming the Supabase stylesheet once it’s ready.
- Once stable:
  - Switch the public DPP fully to `<link rel="stylesheet">` pointing to Supabase CSS.
  - Reduce `ThemeInjector` to preview-only usage.

### Phase 3 – Design Editor Shell & State

- Build the dashboard design page layout:
  - Left panel stub.
  - Center preview container.
  - Right panel stub.
  - Bottom Save/Cancel pill.
- Implement `DesignEditorProvider` with:
  - Draft theme state.
  - Selection/hover state.
  - `hasUnsavedChanges` and save/cancel control logic (stub server action).

### Phase 4 – Basic Live Preview & Typography Editor

- Rebuild a **non-interactive** copy of the DPP UI inside `@app` as `DesignPreviewDpp`:
  - Use the same structure and classes as `apps/dpp` but with static demo data.
- Integrate a minimal `PreviewThemeInjector` that:
  - Generates CSS from `themeStylesDraft`.
  - Injects a `<style>` tag inside the preview container.
- Implement the right panel’s **typography accordions** and hook them to `themeStylesDraft`.
- Confirm that typography edits update the preview instantly.

### Phase 5 – Component Selection & Highlighting

- Introduce the `Selectable` wrapper across the preview DPP components.
- Wire hover + click to `hoveredComponentId` and `selectedComponentId`.
- Add the blue highlight behavior based on state.
- Connect the right panel to `selectedComponentId` and render component-specific schemas for a few key components (e.g. journey frame, materials card) as proof of concept.

### Phase 6 – Left Panel & ThemeConfig Editing

- Implement `DesignLeftPanel` with data-driven nav tree and dynamic header/back behavior (modeled on `CategorySelect`).
- Add editor schemas for:
  - `branding.headerLogoUrl` / `branding.bannerLogoUrl`.
  - Menus (primary/secondary).
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

## 11. Future Extensions (Out of Scope for First Version)

- Theme versioning / rollback per brand.
- Multi-product previews and viewports (mobile/desktop toggles).
- Template-level presets (even if the brand only uses one at a time).
- Audit log of style/config changes.

These can be layered on top of the architecture above without major structural changes, as long as the **DB `brand_theme` JSON and stylesheet pipeline** remain the canonical path for creating and serving themes.


