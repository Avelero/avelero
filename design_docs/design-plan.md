# DPP Theme Editor – Architecture & Implementation

This document describes the architecture of the DPP theme editor, what has been implemented, how it works, and what remains to be done.

---

## 1. Overview

The theme editor allows brands to customize the visual appearance of their Digital Product Passport (DPP) pages. The system supports:

- **Visual styles** (colors, typography, component-level overrides)
- **Content configuration** (logos, menus, CTA banners, social links, section visibility)
- **Live preview** with instant updates
- **Hover/click selection** to navigate to component editors
- **Persistent storage** in PostgreSQL + Supabase Storage

---

## 2. Architecture

### 2.1 Data Model

| Concept | Description | Storage |
|---------|-------------|---------|
| **ThemeConfig** | Content & layout configuration (logos, menus, CTAs, toggles) | `brand_theme.theme_config` (JSONB) |
| **ThemeStyles** | Visual styles (colors, typography, component overrides) | `brand_theme.theme_styles` (JSONB) |
| **DppData** | Product data (title, materials, journey, etc.) | `products`, `product_variants` tables |
| **Generated CSS** | Compiled stylesheet from ThemeStyles | Supabase Storage: `dpp-themes/brand-{id}/theme.css` |

### 2.2 Database Schema

**`brand_theme` table** (1:1 with `brands`):

```sql
CREATE TABLE brand_theme (
  brand_id UUID PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  theme_styles JSONB DEFAULT '{}',
  theme_config JSONB DEFAULT '{}',
  stylesheet_path TEXT,           -- Supabase storage path
  google_fonts_url TEXT,          -- Computed Google Fonts URL
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 Key Files & Packages

```
packages/dpp-components/
├── src/
│   ├── components/         # Shared DPP UI components
│   │   ├── layout/         # Header, Footer, ContentFrame
│   │   ├── product/        # ProductDetails, ProductDescription
│   │   ├── navigation/     # MenuFrame, MenuButton
│   │   ├── impact/         # ImpactFrame, ImpactCards
│   │   ├── materials/      # MaterialsFrame
│   │   ├── journey/        # JourneyFrame
│   │   ├── carousel/       # ProductCarousel, ProductCard
│   │   ├── cta/            # CTABanner
│   │   └── theme/          # ThemeInjector
│   ├── lib/
│   │   ├── css-generator.ts      # Generates CSS from ThemeStyles
│   │   └── google-fonts.ts       # Generates Google Fonts URLs
│   ├── styles/
│   │   └── globals.css           # Base DPP styles with CSS variables
│   └── types/
│       ├── theme-config.ts       # ThemeConfig interface
│       ├── theme-styles.ts       # ThemeStyles interface
│       └── dpp-data.ts           # DppData interface

apps/app/src/
├── components/theme-editor/
│   ├── design-page-client.tsx    # Main editor layout
│   ├── design-preview.tsx        # Live preview container
│   ├── preview-theme-injector.tsx # Injects draft CSS
│   ├── save-bar.tsx              # Save/Cancel buttons
│   ├── theme-editor-loader.tsx   # Fetches theme data
│   ├── panel/
│   │   ├── design-panel.tsx      # Left panel container
│   │   ├── panel-header.tsx      # Navigation header
│   │   ├── sections/
│   │   │   ├── layout-tree.tsx       # Component hierarchy tree
│   │   │   ├── component-section.tsx # Component-specific fields
│   │   │   ├── typography-editor.tsx # Typography scales
│   │   │   └── colors-editor.tsx     # Color tokens
│   │   └── inputs/                   # Field input components
│   └── registry/
│       └── component-registry.ts # Component definitions & fields
├── contexts/
│   └── design-editor-provider.tsx # Central state management
├── hooks/
│   ├── use-selectable-detection.ts # Preview hover/click detection
│   └── use-theme.ts                # Theme data fetching hook
├── actions/design/
│   └── save-theme-action.ts        # Server action for saving
└── lib/
    └── demo-data.ts                # Demo DPP data for preview

packages/db/src/
├── schema/brands/
│   └── brand-theme.ts        # Drizzle schema
├── defaults/
│   └── theme-defaults.ts     # Default ThemeStyles & ThemeConfig
└── queries/
    └── brands.ts             # getBrandTheme, createBrand (seeds defaults)

apps/api/src/trpc/routers/workflow/
└── base.ts                   # workflowGetThemeProcedure
```

---

## 3. How It Works

### 3.1 Theme Loading Flow

```
1. User navigates to /theme-editor
2. ThemeEditorPage (server component) renders ThemeEditorLoader in Suspense
3. ThemeEditorLoader calls useThemeQuery() → tRPC workflow.getTheme
4. tRPC procedure calls getBrandTheme(db, brandId)
5. Returns { themeStyles, themeConfig } from brand_theme table
6. DesignPageClient receives data and initializes DesignEditorProvider
7. Provider sets up draft state with initial values
```

### 3.2 Live Preview Flow

```
1. User edits a field (color, font, etc.)
2. updateColor/updateComponentStyle/updateConfigValue updates draft state
3. PreviewThemeInjector generates CSS from themeStylesDraft
4. CSS is injected via <style> tag scoped to .dpp-root
5. Preview updates instantly (no server round-trip)
```

### 3.3 Save Flow

```
1. User clicks "Save" (visible when hasUnsavedChanges is true)
2. saveDrafts() calls saveThemeAction server action
3. Server action:
   a. Generates CSS stylesheet from themeStyles
   b. Uploads to Supabase Storage: dpp-themes/brand-{id}/theme.css
   c. Computes Google Fonts URL from typography
   d. Upserts brand_theme row with JSON + derived paths
4. On success, savedThemeConfig/savedThemeStyles update to match drafts
5. hasUnsavedChanges becomes false
```

### 3.4 Public DPP Rendering Flow

```
1. Request to /[brand]/[upid]
2. Lookup product_variant by UPID → get product_id
3. Lookup product → get brand_id
4. Lookup brand_theme → get theme_config, theme_styles, stylesheet_path
5. Server-render DPP HTML using shared components
6. Include <link> to stylesheet_path (Supabase) + google_fonts_url
7. Return fully rendered HTML (no client-side ThemeInjector needed)
```

### 3.5 Component Selection Flow

```
1. User hovers over preview
2. useSelectableDetection hook:
   a. Traverses DOM from event target
   b. Matches class names against component registry
   c. Sets hoveredComponentId in context
3. CSS applies outline via [data-hover-selection="true"]
4. User clicks → selectedComponentId set
5. navigateToComponent(id) → panel shows component fields
```

---

## 4. Component Registry

The component registry (`component-registry.ts`) is the single source of truth for:

- **Component hierarchy** (nesting structure)
- **Display names** (UI labels)
- **Style fields** (which ThemeStyles properties are editable)
- **Config fields** (which ThemeConfig properties are editable)
- **Visibility toggles** (which components can be shown/hidden)

### 4.1 Style Field Types

| Type | Component | Description |
|------|-----------|-------------|
| `color` | ColorInput | Color picker with hex input |
| `number` | PixelInput | Numeric input with units |
| `typescale` | TypescaleSelect | Dropdown for H1-H6, Body scales |
| `select` | SelectField | Dropdown for options (capitalization, etc.) |
| `radius` | RadiusInput | Border radius with per-corner control |
| `spacing` | SpacingInput | Padding/margin inputs |

### 4.2 Config Field Types

| Type | Component | Description |
|------|-----------|-------------|
| `text` | TextInput | Single-line text |
| `url` | UrlInput | URL with validation |
| `image` | ImageInput | URL with preview thumbnail |
| `toggle` | Switch | Boolean toggle |
| `menu-items` | MenuItemsField | List with add/remove/reorder |

---

## 5. Default Theme Values

New brands receive default theme values seeded on creation:

**ThemeStyles defaults** (`packages/db/src/defaults/theme-defaults.ts`):
- Colors: white background, dark foreground, blue highlight
- Typography: 9 scales (H1-H6, Body, Body-sm, Body-xs) with defaults

**ThemeConfig defaults**:
- Empty branding/menus/CTA/social
- Sections: Product Details, Impact, Materials, Journey enabled
- Sections: Primary Menu, Secondary Menu, Product Carousel, CTA Banner **disabled**

---

## 6. Current Implementation Status

### ✅ Completed

| Feature | Status |
|---------|--------|
| **Data Layer** | |
| `brand_theme` table schema | ✅ Done |
| Default theme seeding on brand creation | ✅ Done |
| `getBrandTheme` query | ✅ Done |
| `workflow.getTheme` tRPC procedure | ✅ Done |
| `saveThemeAction` server action | ✅ Done |
| CSS generation (`buildThemeStylesheet`) | ✅ Done |
| Google Fonts URL generation | ✅ Done |
| Supabase storage upload | ✅ Done |
| **Theme Editor UI** | |
| Two-panel layout (panel + preview) | ✅ Done |
| Theme data loading via tRPC | ✅ Done |
| DesignEditorProvider state management | ✅ Done |
| Draft tracking (hasUnsavedChanges) | ✅ Done |
| Save/Cancel bar | ✅ Done |
| Post-save state reset | ✅ Done |
| **Left Panel** | |
| Three-level navigation (root/section/component) | ✅ Done |
| Layout tree with hierarchy | ✅ Done |
| Expand/collapse tree items | ✅ Done |
| Typography editor (all 9 scales) | ✅ Done |
| Colors editor (all 10 tokens) | ✅ Done |
| Component-specific style fields | ✅ Done |
| Component-specific config fields | ✅ Done |
| Visibility toggles (UI working) | ✅ Done |
| **Live Preview** | |
| Shared DPP components from `@v1/dpp-components` | ✅ Done |
| PreviewThemeInjector (draft CSS injection) | ✅ Done |
| Demo data fallback for preview | ✅ Done |
| Hover detection with visual feedback | ✅ Done |
| Click selection → navigate to component | ✅ Done |
| **Field Components** | |
| ColorInput | ✅ Done |
| PixelInput | ✅ Done |
| RadiusInput | ✅ Done |
| SpacingInput | ✅ Done |
| TypescaleSelect | ✅ Done |
| SelectField | ✅ Done |
| FontSelect (virtualized, 1900+ fonts) | ✅ Done |
| ToggleField | ✅ Done |
| TextField | ✅ Done |
| UrlField | ✅ Done |
| ImageField | ✅ Done |
| MenuItemsField | ✅ Done |
| **Public DPP** | |
| Fetch theme from DB | ✅ Done |
| Link to Supabase stylesheet | ✅ Done |
| Google Fonts integration | ✅ Done |
| Custom font (@font-face) support | ✅ Done |
| Brand name from DppData (not ThemeConfig) | ✅ Done |

---

## 7. Remaining Tasks

### 7.1 High Priority

| Task | Description | Files |
|------|-------------|-------|
| **User feedback on save** | Show toast notification on save success/error | `save-bar.tsx`, add toast |
| **Error handling** | Handle API errors gracefully, show error states | `design-page-client.tsx`, `save-bar.tsx` |
| **Loading states** | Show skeleton while theme loads | `theme-editor-loader.tsx` |

### 7.2 Medium Priority

| Task | Description | Files |
|------|-------------|-------|
| **Real product data in preview** | Fetch user's actual product for preview instead of demo data | `theme-editor-loader.tsx`, new query |
| **Image upload** | Allow uploading images instead of just URLs | `ImageField`, server action |
| **Font preview in editor** | Load selected fonts in typography editor | `typography-editor.tsx` |

### 7.3 Low Priority (Polish)

| Task | Description | Files |
|------|-------------|-------|
| **Undo/Redo** | Track edit history for undo/redo | `design-editor-provider.tsx` |
| **Keyboard shortcuts** | Cmd+S to save, Cmd+Z to undo | Hook in provider |
| **Mobile preview mode** | Toggle between desktop/mobile viewport | `design-preview.tsx` |
| **Theme versioning** | Save history of theme changes | New table, UI |
| **Drag-drop menu items** | Replace up/down buttons with drag handles | `MenuItemsField` |

---

## 8. CSS Variable Mapping

The CSS generator maps ThemeStyles to CSS custom properties:

### 8.1 Design Tokens

```css
/* Colors */
--color-background: #FFFFFF;
--color-foreground: #1E2040;
--color-primary: #1E2040;
--color-secondary: #62637A;
/* ... */

/* Typography */
--type-h1-size: 32px;
--type-h1-weight: 500;
--type-h1-line-height: 1;
--type-h1-letter-spacing: -0.02em;
/* ... */
```

### 8.2 Component Overrides

```css
/* Component-specific variables */
--product-details-border-color: #E9E9EC;
--product-details-background-color: #FFFFFF;
--journey-card-font-family: var(--type-body-family);
--footer-legal-name-color: var(--color-secondary);
/* ... */
```

---

## 9. Type Definitions

### 9.1 ThemeConfig

```typescript
interface ThemeConfig {
  branding: { headerLogoUrl: string };
  menus: {
    primary: Array<{ label: string; url: string }>;
    secondary: Array<{ label: string; url: string }>;
  };
  cta: {
    bannerBackgroundImage: string;
    bannerHeadline: string;
    bannerSubline: string;
    bannerCTAText: string;
    bannerCTAUrl: string;
  };
  social: {
    showInstagram: boolean;
    showFacebook: boolean;
    // ... other platforms
    instagramUrl: string;
    // ... other URLs
  };
  sections: {
    showProductDetails: boolean;
    showPrimaryMenu: boolean;
    showSecondaryMenu: boolean;
    showImpact: boolean;
    showMaterials: boolean;
    showJourney: boolean;
    showSimilarProducts: boolean;
    showCTABanner: boolean;
  };
  images: {
    carouselImageZoom: number;
    carouselImagePosition: "top" | "center" | "bottom";
  };
  materials: {
    showCertificationCheckIcon: boolean;
  };
}
```

### 9.2 ThemeStyles

```typescript
interface ThemeStyles extends DesignTokens {
  customFonts?: CustomFont[];
  // Component overrides (all optional)
  header?: ComponentStyleOverride;
  footer?: ComponentStyleOverride;
  "product-details"?: ComponentStyleOverride;
  "journey-card"?: ComponentStyleOverride;
  // ... ~50 more component keys
}

interface DesignTokens {
  colors?: ColorTokens;
  typography?: TypographyTokens;
}
```

---

## 10. Testing Checklist

Before shipping, verify:

- [ ] New brand gets default theme seeded
- [ ] Theme editor loads existing theme data
- [ ] All color changes reflect in preview instantly
- [ ] All typography changes reflect in preview instantly
- [ ] Component style changes reflect in preview
- [ ] Visibility toggles hide/show sections
- [ ] Save persists changes to database
- [ ] Save uploads CSS to Supabase
- [ ] Cancel resets to last saved state
- [ ] Public DPP loads saved theme correctly
- [ ] Google Fonts are loaded on public DPP
- [ ] Custom fonts render correctly
- [ ] Preview hover highlights correct component
- [ ] Click navigates to component editor
