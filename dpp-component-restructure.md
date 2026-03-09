# DPP Components Package Restructure

## Overview

This document describes a restructure of `packages/dpp-components` to resolve five architectural issues:

1. **"Default" means four different things.** Style defaults, template content, seeded passport data, and demo content are tangled in one file (`lib/default-passport.ts`).
2. **Editor types are duplicated.** `ComponentDefinition`, `StyleField`, `ContentField` are defined in both `packages/dpp-components/src/sections/registry.ts` and `apps/app/src/components/theme-editor/registry/types.ts`, drifting apart.
3. **Fixed component schemas live in the wrong package.** Header, footer, and product image editor schemas are defined in `apps/app`, while section schemas are in `packages/dpp-components`. Same concept, split across packages.
4. **Modal styles are duplicated per-section.** Every section that opens a modal carries its own copy of the six `modal.*` style keys and its own `createModalSchemaGroup()` editor subtree. Modal styling should be passport-level, not section-level.
5. **`dpp-content.ts` exists for a deprecated feature.** Its sole type (`SimilarProduct`) supports the carousel similar-products feature, which is behind a feature flag and being deprecated.

---

## Core Concepts

### Component Taxonomy

Every editable element in the passport falls into one of these categories:

| Category | Movable | Editable styles | Editable content | Examples |
|----------|---------|-----------------|------------------|----------|
| **Movable section (content)** | Yes | Yes | Yes | buttons, description, details, impact, materials, journey, banner, carousel |
| **Movable section (style-only)** | Yes | Yes | No | hero |
| **Fixed component (content)** | No | Yes | Yes | header (logo), footer (social links) |
| **Fixed component (style-only)** | No | Yes | No | productImage, modal |

The proposed structure treats sections and fixed components symmetrically: both have a `schema.ts` (editor tree + defaults) and a renderer (`index.tsx`). The difference is only in how the editor presents them (draggable vs pinned).

### Three-Tier Default System

There are three distinct use cases for defaults, sharing the same styles but differing in content and layout:

| Use case | Styles | Content | Layout |
|----------|--------|---------|--------|
| **Section template** (user adds a new section) | Default | Placeholder ("Button 1", "Button 2") | N/A — single section |
| **Brand passport** (new brand created) | Default | Placeholder (same as template) | Default layout (hero, description, details, ...) |
| **Demo passport** (public demo page) | Default | Realistic mock data ("Warranty", "Care Instructions") | Demo-specific layout |

This means:
- **Default styles** are defined once per section/component, in their `schema.ts`.
- **Template content** is also defined once per section/component, in the same `schema.ts`.
- **Brand passport** assembles sections from schema defaults and only defines layout order.
- **Demo passport** is fully self-contained with inline demo content and its own layout.

### Data vs Presentation Types

The package has two distinct type domains:

- **Product data** (`types/data.ts`): EU compliance data that the passport renders — product identifiers, environmental metrics, materials, supply chain. This is the *input* to section components.
- **Passport** (`types/passport.ts`): The JSON document stored per-brand that defines layout, styles, tokens, and content configuration. This is the *theme* that controls how product data is presented.

These are intentionally separate. The compliance data can be submitted to EU registries unchanged; the passport is presentation-only.

`types/content.ts` (currently `dpp-content.ts`) exists solely for `SimilarProduct` used by the carousel. Since the similar-products feature is deprecated and behind a feature flag, this file should be removed when the carousel feature is fully removed. For now, it remains but is marked deprecated.

---

## Type System Changes

### New: `types/editor.ts`

All editor-related types move to a single canonical file in the shared package. This eliminates the duplication between `sections/registry.ts` and `apps/app/.../registry/types.ts`.

```typescript
// types/editor.ts — canonical editor type definitions

import type { DppContent } from "./content";
import type { DppData } from "./data";
import type { Passport, Section, SectionType, Styles, ZoneId } from "./passport";

// ─── Style Fields ─────────────────────────────────────────────────────────────

export type StyleFieldType =
  | "color"
  | "number"
  | "radius"
  | "border"
  | "select"
  | "typescale"
  | "toggle";

export type StyleFieldValue =
  | string
  | number
  | boolean
  | Record<string, number>;

export interface StyleField {
  type: StyleFieldType;
  /** Path into styles, e.g. "card.borderColor". First segment = style key, rest = property. */
  path: string;
  label: string;
  unit?: "px" | "%" | "em" | "rem";
  options?: Array<{ value: string; label: string }>;
  /** Groups fields under a collapsible header in the editor. */
  section?: string;
  /** Values written when a toggle is enabled/disabled. */
  enabledValue?: StyleFieldValue;
  disabledValue?: StyleFieldValue;
}

// ─── Content Fields ───────────────────────────────────────────────────────────

export type ContentFieldType =
  | "text"
  | "textarea"
  | "url"
  | "image"
  | "toggle"
  | "number"
  | "modal";

export interface ContentField {
  type: ContentFieldType;
  /** Path into content, e.g. "menuItems" or "social.instagram". */
  path: string;
  label: string;
  placeholder?: string;
  section?: string;
  modalType?: "menu-primary" | "menu-secondary" | "carousel-products";
  min?: number;
  max?: number;
}

// ─── Component Definition ─────────────────────────────────────────────────────

export type SectionVisibilityKey =
  | "showPrimaryMenu"
  | "showSecondaryMenu"
  | "showSimilarProducts"
  | "showCTABanner";

export interface ComponentDefinition {
  id: string;
  displayName: string;
  children?: ComponentDefinition[];
  visibilityKey?: SectionVisibilityKey;
  styleFields?: StyleField[];
  configFields?: ContentField[];
  isGrouping?: boolean;
  hidden?: boolean;
}

// ─── Section Schema ───────────────────────────────────────────────────────────

export interface SectionDefaults {
  styles: Styles;
  content: Record<string, unknown>;
}

export interface SectionSchema {
  type: SectionType;
  displayName: string;
  allowedZones: ZoneId[];
  editorTree: ComponentDefinition;
  defaults: SectionDefaults;
}

export interface SectionRegistryEntry {
  schema: SectionSchema;
  component: React.ComponentType<SectionProps>;
}

// ─── Fixed Component Schema ──────────────────────────────────────────────────

export interface FixedComponentDefaults {
  styles: Styles;
  content: Record<string, unknown>;
}

export interface FixedComponentSchema {
  id: string;
  displayName: string;
  editorTree: ComponentDefinition;
  defaults: FixedComponentDefaults;
}

export interface FixedComponentRegistryEntry {
  schema: FixedComponentSchema;
  component: React.ComponentType<unknown>;
}

// ─── Section Props ────────────────────────────────────────────────────────────

export interface SectionProps {
  section: Section;
  tokens: Passport["tokens"];
  data: DppData;
  zoneId: ZoneId;
  content?: DppContent;
  wrapperClassName?: string;
}
```

### Files deleted

- `apps/app/src/components/theme-editor/registry/types.ts` — all types now come from `@dpp-components/types/editor`.

### Files modified

- `sections/registry.ts` — remove all type definitions, import from `../types/editor`.
- `apps/app/src/components/theme-editor/registry/utils.ts` — import types from `@dpp-components`.

### Files renamed

| Current | New | Reason |
|---------|-----|--------|
| `types/dpp-data.ts` | `types/data.ts` | `dpp-` prefix redundant inside `dpp-components` package |
| `types/dpp-content.ts` | `types/content.ts` | Same reason |
| `sections/_transforms.ts` | `sections/transforms.ts` | Drop non-standard underscore convention |

---

## Passport Type Changes

### Modal elevation to passport level

Currently, modal styles are embedded inside each section's `styles` object (keys like `modal.container`, `modal.title`, etc.). This means five sections each carry six identical modal style entries.

**Change:** Add a top-level `modal` field to the `Passport` type. Modal styles are defined once, applied everywhere.

```typescript
// types/passport.ts — updated Passport interface

export interface Passport {
  version: 2;
  tokens: {
    colors: ColorTokens;
    typography: Record<TypeScale, TypographyScale>;
    fonts?: CustomFont[];
  };
  header: {
    logoUrl: string;
    styles: Styles;
  };
  productImage?: {
    styles: Styles;
  };
  modal?: {
    styles: Styles;
  };
  footer: {
    social: SocialLinks;
    styles: Styles;
  };
  sidebar: Section[];
  canvas: Section[];
}
```

### What changes for sections

Sections that currently spread `...DEFAULT_MODAL_STYLES` into their styles (description, details, impact, materials, journey) **lose** all `modal.*` keys from their section styles. Their schema `defaults.styles` no longer contain modal entries.

Section renderers that currently pass `styles={s}` to modal implementations will instead receive the passport-level modal styles. The layout renderer (or section props) can provide the resolved modal styles to sections that need them.

**Updated `SectionProps`:**

```typescript
export interface SectionProps {
  section: Section;
  tokens: Passport["tokens"];
  data: DppData;
  zoneId: ZoneId;
  content?: DppContent;
  wrapperClassName?: string;
  /** Resolved passport-level modal styles, passed by the layout renderer. */
  modalStyles?: ModalStyles;
}
```

**Updated section renderer** (example: impact/index.tsx):

```typescript
// Before:
<ImpactModal styles={s} ... />

// After:
<ImpactModal styles={modalStyles ?? {}} ... />
```

The section no longer resolves modal styles itself. It receives them from the layout renderer, which resolves them once from `passport.modal.styles`.

---

## Modal Directory Change

Currently `components/modal.tsx` is a single file. It becomes a directory to hold the schema alongside the primitives:

### Before
```
components/
  modal.tsx               ← primitives + building blocks
  modals/                 ← domain-specific implementations
    certification-modal.tsx
    description-modal.tsx
    impact-modal.tsx
    manufacturer-modal.tsx
    operator-modal.tsx
    index.ts
```

### After
```
components/
  modal/
    index.tsx             ← primitives + building blocks (was modal.tsx)
    schema.ts             ← editor tree + default styles for modal building blocks
  modals/                 ← domain-specific implementations (unchanged)
    certification-modal.tsx
    description-modal.tsx
    impact-modal.tsx
    manufacturer-modal.tsx
    operator-modal.tsx
    index.ts
```

### `components/modal/schema.ts`

Defines the editor tree for the modal as a fixed component. Each building block (container, title, subtitle, description, label, value) is independently stylable:

```typescript
import type { FixedComponentSchema } from "../../types/editor";

const SURFACE_CARD_SHADOW =
  "0px 0px 2px rgba(0,0,0,0.15), 0px 2px 5px rgba(0,0,0,0.05), 0px 8px 40px rgba(0,0,0,0.04)";

export const MODAL_SCHEMA: FixedComponentSchema = {
  id: "modal",
  displayName: "Modal",
  editorTree: {
    id: "modal",
    displayName: "Modal",
    children: [
      {
        id: "modal.container",
        displayName: "Container",
        styleFields: [
          { type: "color", path: "modal.container.backgroundColor", label: "Background" },
          { type: "toggle", path: "modal.container.boxShadow", label: "Shadow" },
          { type: "toggle", path: "modal.container.borderWidth", label: "Border", enabledValue: 1, disabledValue: 0 },
          { type: "color", path: "modal.container.borderColor", label: "Border Color" },
          { type: "radius", path: "modal.container.borderRadius", label: "Border Radius" },
        ],
      },
      {
        id: "modal.title",
        displayName: "Title",
        styleFields: [
          { type: "color", path: "modal.title.color", label: "Color" },
          { type: "typescale", path: "modal.title.typescale", label: "Typography" },
          { type: "select", path: "modal.title.textTransform", label: "Capitalization", options: CAPITALIZATION_OPTIONS },
        ],
      },
      {
        id: "modal.subtitle",
        displayName: "Subtitle",
        styleFields: [/* same pattern: color, typescale, textTransform */],
      },
      {
        id: "modal.description",
        displayName: "Description",
        styleFields: [/* color, typescale, textTransform */],
      },
      {
        id: "modal.label",
        displayName: "Label",
        styleFields: [/* color, typescale, textTransform */],
      },
      {
        id: "modal.value",
        displayName: "Value",
        styleFields: [/* color, typescale, textTransform */],
      },
    ],
  },
  defaults: {
    styles: {
      "modal.container": {
        backgroundColor: "$card",
        boxShadow: SURFACE_CARD_SHADOW,
        borderColor: "$border",
        borderRadius: 8,
        borderWidth: 0,
      },
      "modal.title": { typescale: "h2", color: "$foreground", textTransform: "none" },
      "modal.subtitle": { typescale: "h6", color: "$mutedLightForeground", textTransform: "none" },
      "modal.description": { typescale: "body", color: "$mutedDarkForeground", textTransform: "none" },
      "modal.label": { typescale: "body", typographyDetached: true, fontWeight: 500, color: "$mutedLightForeground", textTransform: "none" },
      "modal.value": { typescale: "body", color: "$foreground", textTransform: "none" },
    },
    content: {},
  },
};
```

### Files deleted

- `sections/modal-schema.ts` — the `createModalSchemaGroup(sectionId)` function is no longer needed. Modal styling is no longer per-section.

### Files modified

- Every section `schema.ts` that used `createModalSchemaGroup()` in its `editorTree`: remove the modal child node. Affected: description, details, impact, materials, journey.
- Every section default styles that spread `...DEFAULT_MODAL_STYLES`: remove the modal style keys.
- `components/layout/layout-renderer.tsx`: resolve `passport.modal.styles` once and pass as `modalStyles` prop to all sections.

### Theme editor integration

The theme editor shows "Modal" as a fixed component in the layout tree (alongside Header, Product Image, Footer). Clicking it reveals the modal style controls. A mock modal preview renders in the passport preview pane using the current modal styles, allowing the user to see their changes in real time.

---

## Fixed Component Schemas

### Current state

Fixed component editor schemas are defined in `apps/app/src/components/theme-editor/registry/component-tree.ts`. Section schemas are in `packages/dpp-components/src/sections/*/schema.ts`. Same concept, split across packages.

### Proposed state

Fixed components get the same `index.tsx` + `schema.ts` pattern as sections, inside `packages/dpp-components`. The flat component files become directories:

### Before
```
components/layout/
  header.tsx
  footer.tsx
  product-image.tsx
  content-frame.tsx
  layout-renderer.tsx
  demo-cta.tsx
```

### After
```
components/layout/
  header/
    index.tsx             ← renderer (was header.tsx)
    schema.ts             ← editor tree + defaults
  footer/
    index.tsx             ← renderer (was footer.tsx)
    schema.ts             ← editor tree + defaults
  product-image/
    index.tsx             ← renderer (was product-image.tsx)
    schema.ts             ← editor tree + defaults
  registry.ts             ← COMPONENT_REGISTRY mapping
  content-frame.tsx
  layout-renderer.tsx
  demo-cta.tsx
```

### Example: `components/layout/header/schema.ts`

```typescript
import { CAPITALIZATION_STYLE_OPTIONS } from "../../../sections/editor-options";
import type { FixedComponentSchema } from "../../../types/editor";

export const HEADER_SCHEMA: FixedComponentSchema = {
  id: "header",
  displayName: "Header",
  editorTree: {
    id: "header",
    displayName: "Header",
    styleFields: [
      { type: "color", path: "container.backgroundColor", label: "Background" },
      { type: "color", path: "container.borderColor", label: "Border Color" },
    ],
    configFields: [
      { type: "image", path: "logoUrl", label: "Logo" },
    ],
    children: [
      {
        id: "textLogo",
        displayName: "Text Logo",
        styleFields: [
          { type: "color", path: "textLogo.color", label: "Color" },
          { type: "typescale", path: "textLogo.typescale", label: "Typography" },
          {
            type: "select",
            path: "textLogo.textTransform",
            label: "Capitalization",
            options: [...CAPITALIZATION_STYLE_OPTIONS],
          },
        ],
      },
    ],
  },
  defaults: {
    styles: {
      container: { backgroundColor: "$background", borderColor: "$border" },
      textLogo: { color: "$foreground", textTransform: "none" },
    },
    content: {
      logoUrl: "",
    },
  },
};
```

### `components/layout/registry.ts`

```typescript
import type { FixedComponentRegistryEntry } from "../../types/editor";
import { Footer } from "./footer";
import { FOOTER_SCHEMA } from "./footer/schema";
import { Header } from "./header";
import { HEADER_SCHEMA } from "./header/schema";
import { ProductImage } from "./product-image";
import { PRODUCT_IMAGE_SCHEMA } from "./product-image/schema";
import { MODAL_SCHEMA } from "../modal/schema";

export const COMPONENT_REGISTRY: Record<string, FixedComponentRegistryEntry> = {
  header:       { schema: HEADER_SCHEMA, component: Header },
  productImage: { schema: PRODUCT_IMAGE_SCHEMA, component: ProductImage },
  footer:       { schema: FOOTER_SCHEMA, component: Footer },
  modal:        { schema: MODAL_SCHEMA, component: null }, // No renderer — the modal is opened by sections
};
```

### Files deleted

- `apps/app/src/components/theme-editor/registry/component-tree.ts` — replaced by the per-component `schema.ts` files and `COMPONENT_REGISTRY`.

### Files modified

- `apps/app/src/components/theme-editor/registry/utils.ts` — import `COMPONENT_REGISTRY` from `@dpp-components` instead of the local `COMPONENT_TREE`.

---

## Section Schema Expansion

Each section's `schema.ts` gains a `defaults` property containing the section's default styles and template content. These values are currently centralized in `lib/default-passport.ts`.

### Example: `sections/buttons/schema.ts` (expanded)

```typescript
import { CAPITALIZATION_STYLE_OPTIONS } from "../editor-options";
import type { SectionSchema } from "../../types/editor";

const SURFACE_CARD_SHADOW =
  "0px 0px 2px rgba(0,0,0,0.15), 0px 2px 5px rgba(0,0,0,0.05), 0px 8px 40px rgba(0,0,0,0.04)";

export const BUTTONS_SCHEMA: SectionSchema = {
  type: "buttons",
  displayName: "Menu Buttons",
  allowedZones: ["sidebar"],
  editorTree: {
    id: "buttons",
    displayName: "Menu Buttons",
    children: [
      {
        id: "buttons.button",
        displayName: "Button",
        styleFields: [
          { type: "color", path: "button.color", label: "Color" },
          { type: "typescale", path: "button.typescale", label: "Typography" },
          { type: "select", path: "button.textTransform", label: "Capitalization", options: [...CAPITALIZATION_STYLE_OPTIONS] },
          { type: "color", path: "button.backgroundColor", label: "Background" },
          { type: "toggle", path: "button.boxShadow", label: "Shadow" },
          { type: "toggle", path: "button.borderWidth", label: "Border", enabledValue: 1, disabledValue: 0 },
          { type: "radius", path: "button.borderRadius", label: "Border Radius" },
        ],
        children: [
          {
            id: "buttons.button.icon",
            displayName: "Icon",
            styleFields: [
              { type: "color", path: "button.icon.color", label: "Color" },
              { type: "number", path: "button.icon.size", label: "Size", unit: "px" },
            ],
          },
        ],
      },
    ],
    configFields: [
      { type: "modal", path: "menuItems", label: "Menu items", modalType: "menu-primary" },
    ],
  },

  defaults: {
    styles: {
      button: {
        typescale: "h6",
        color: "$cardForeground",
        backgroundColor: "$card",
        boxShadow: SURFACE_CARD_SHADOW,
        borderRadius: 8,
        borderWidth: 0,
        textTransform: "none",
      },
      "button.icon": { color: "$cardForeground", size: 20 },
    },
    content: {
      variant: "primary",
      menuItems: [
        { label: "Button 1", url: "" },
        { label: "Button 2", url: "" },
        { label: "Button 3", url: "" },
      ],
    },
  },
};
```

Note that `defaults.content` uses **placeholder** values ("Button 1", "Button 2") — not the current demo values ("Care instructions", "Recycling & Repair", "Warranty"). The demo values move to `lib/demo-passport.ts`.

---

## Default Assembly

### Shared tokens: `lib/default-tokens.ts`

Design tokens (colors, typography, fonts) are shared across all three passport variants. Extracted to avoid duplication:

```typescript
// lib/default-tokens.ts

import type { ColorTokens, CustomFont, TypeScale, TypographyScale } from "../types/passport";

const FONT_FAMILY = "Switzer Variable";
const FONT_URL = "https://storage.avelero.com/storage/v1/object/public/dpp-assets/system/fonts/Switzer-Variable.woff2";

export const DEFAULT_COLORS: ColorTokens = {
  background: "#FFFFFF",
  foreground: "#000000",
  mutedLight: "#E0E0E0",
  mutedLightForeground: "#808080",
  mutedDark: "#EBEBEB",
  mutedDarkForeground: "#4D4D4D",
  card: "#FFFFFF",
  cardForeground: "#000000",
  primary: "#0000FF",
  primaryForeground: "#FFFFFF",
  border: "#F2F2F2",
  link: "#0000FF",
};

export const DEFAULT_TYPOGRAPHY: Record<TypeScale, TypographyScale> = {
  h1: { fontFamily: FONT_FAMILY, fontSize: 32, fontWeight: 600, lineHeight: 1.3, letterSpacing: 0 },
  h2: { fontFamily: FONT_FAMILY, fontSize: 28, fontWeight: 500, lineHeight: 1.3, letterSpacing: 0 },
  h3: { fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: 500, lineHeight: 1.3, letterSpacing: 0 },
  h4: { fontFamily: FONT_FAMILY, fontSize: 21, fontWeight: 500, lineHeight: 1.3, letterSpacing: 0 },
  h5: { fontFamily: FONT_FAMILY, fontSize: 19, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0 },
  h6: { fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: 500, lineHeight: 1.4, letterSpacing: 0 },
  body: { fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 },
  "body-sm": { fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 },
  "body-xs": { fontFamily: FONT_FAMILY, fontSize: 11, fontWeight: 400, lineHeight: 1.5, letterSpacing: 0 },
};

export const DEFAULT_FONTS: CustomFont[] = [
  {
    fontFamily: FONT_FAMILY,
    src: FONT_URL,
    fontWeight: "100 900",
    fontStyle: "normal",
    format: "woff2",
    fontDisplay: "swap",
  },
];
```

### Brand passport: `lib/default-passport.ts` (simplified)

This file now only defines **layout order**. All style and content values come from the registries.

```typescript
// lib/default-passport.ts

import type { Passport, Section, SectionType } from "../types/passport";
import { SECTION_REGISTRY } from "../sections/registry";
import { COMPONENT_REGISTRY } from "../components/layout/registry";
import { DEFAULT_COLORS, DEFAULT_TYPOGRAPHY, DEFAULT_FONTS } from "./default-tokens";

function createSection(type: SectionType, id: string): Section {
  const { defaults } = SECTION_REGISTRY[type].schema;
  return {
    id,
    type,
    content: structuredClone(defaults.content),
    styles: structuredClone(defaults.styles),
  };
}

export const DEFAULT_PASSPORT: Passport = {
  version: 2,
  tokens: {
    colors: structuredClone(DEFAULT_COLORS),
    typography: structuredClone(DEFAULT_TYPOGRAPHY),
    fonts: structuredClone(DEFAULT_FONTS),
  },
  header: structuredClone(COMPONENT_REGISTRY.header.schema.defaults) as Passport["header"],
  productImage: structuredClone(COMPONENT_REGISTRY.productImage.schema.defaults) as Passport["productImage"],
  modal: structuredClone(COMPONENT_REGISTRY.modal.schema.defaults) as Passport["modal"],
  footer: structuredClone(COMPONENT_REGISTRY.footer.schema.defaults) as Passport["footer"],
  sidebar: [
    createSection("hero",        "sec_hero0001"),
    createSection("description", "sec_desc0001"),
    createSection("details",     "sec_deta0001"),
    createSection("buttons",     "sec_butt0001"),
    createSection("impact",      "sec_impa0001"),
    createSection("materials",   "sec_mate0001"),
    createSection("journey",     "sec_jour0001"),
  ],
  canvas: [],
};

export function createDefaultPassport(): Passport {
  return structuredClone(DEFAULT_PASSPORT);
}
```

### Demo passport: `lib/demo-passport.ts` (new)

Self-contained. All content is inline — no shared constants that could cause reference-sharing bugs with duplicate sections.

```typescript
// lib/demo-passport.ts

import type { Passport, Section, SectionType } from "../types/passport";
import { SECTION_REGISTRY } from "../sections/registry";
import { COMPONENT_REGISTRY } from "../components/layout/registry";
import { DEFAULT_COLORS, DEFAULT_TYPOGRAPHY, DEFAULT_FONTS } from "./default-tokens";

/** Create a demo section: styles from schema defaults, custom inline content. */
function demoSection(
  type: SectionType,
  id: string,
  content: Record<string, unknown>,
): Section {
  return {
    id,
    type,
    content,
    styles: structuredClone(SECTION_REGISTRY[type].schema.defaults.styles),
  };
}

export const DEMO_PASSPORT: Passport = {
  version: 2,
  tokens: {
    colors: structuredClone(DEFAULT_COLORS),
    typography: structuredClone(DEFAULT_TYPOGRAPHY),
    fonts: structuredClone(DEFAULT_FONTS),
  },
  header: {
    logoUrl: "/demo/acme-logo.svg",
    styles: structuredClone(COMPONENT_REGISTRY.header.schema.defaults.styles),
  },
  productImage: structuredClone(COMPONENT_REGISTRY.productImage.schema.defaults) as Passport["productImage"],
  modal: structuredClone(COMPONENT_REGISTRY.modal.schema.defaults) as Passport["modal"],
  footer: {
    social: { instagram: "https://instagram.com/acme" },
    styles: structuredClone(COMPONENT_REGISTRY.footer.schema.defaults.styles),
  },
  sidebar: [
    demoSection("hero", "sec_hero0001", {}),
    demoSection("description", "sec_desc0001", {}),
    demoSection("details", "sec_deta0001", {}),
    demoSection("buttons", "sec_butt0001", {
      variant: "primary",
      menuItems: [
        { label: "Care Instructions", url: "https://avelero.com/care" },
        { label: "Recycling & Repair", url: "https://avelero.com/recycling" },
        { label: "Warranty", url: "https://avelero.com/warranty" },
      ],
    }),
    demoSection("impact", "sec_impa0001", {}),
    demoSection("materials", "sec_mate0001", { showCertificationCheckIcon: true }),
    demoSection("journey", "sec_jour0001", {}),
  ],
  canvas: [],
};
```

---

## Editor Integration Changes

### `addSection` in `design-editor-provider.tsx`

```typescript
// Before:
import { DEFAULT_SECTION_TEMPLATES } from "@dpp-components/lib/default-passport";
const template = DEFAULT_SECTION_TEMPLATES[sectionType];

// After:
import { SECTION_REGISTRY } from "@dpp-components/sections/registry";
const { defaults } = SECTION_REGISTRY[sectionType].schema;
const newSection: Section = {
  id: generateSectionId(),
  type: sectionType,
  content: structuredClone(defaults.content),
  styles: structuredClone(defaults.styles),
};
```

`DEFAULT_SECTION_TEMPLATES` no longer exists. The registry is the template source.

### `getDefaultComponentStyleValue` in `design-editor-provider.tsx`

Currently looks up `DEFAULT_PASSPORT_TEMPLATE` for fixed components and `DEFAULT_SECTION_TEMPLATES` for sections. After:

```typescript
// Fixed components:
const defaultValue = COMPONENT_REGISTRY[componentId].schema.defaults.styles[path];

// Sections:
const defaultValue = SECTION_REGISTRY[sectionType].schema.defaults.styles[path];
```

### Layout tree in `layout-tree.tsx`

Currently imports `COMPONENT_TREE` from the local registry. After:

```typescript
import { COMPONENT_REGISTRY } from "@dpp-components/components/layout/registry";

// Fixed items resolve from COMPONENT_REGISTRY instead of COMPONENT_TREE
const headerSchema = COMPONENT_REGISTRY.header.schema;
const modalSchema = COMPONENT_REGISTRY.modal.schema;
```

The modal appears as a new fixed item in the layout tree between Product Image and Footer (or wherever makes sense in the editor UI).

### `resolveComponentForEditor` in `utils.ts`

Currently searches `COMPONENT_TREE` then `SECTION_REGISTRY`. After:

```typescript
import { COMPONENT_REGISTRY } from "@dpp-components/components/layout/registry";
import { SECTION_REGISTRY } from "@dpp-components/sections/registry";

export function resolveComponentForEditor(componentId: string, passport: Passport) {
  // 1. Check fixed components
  const fixed = COMPONENT_REGISTRY[componentId];
  if (fixed) return fixed.schema.editorTree;

  // 2. Check section registry
  // ... (same as before but using schema.editorTree)
}
```

---

## Proposed File Tree

```
packages/dpp-components/src/
│
├── types/
│   ├── passport.ts ─────────── Passport JSON document type. Tokens, styles, sections,
│   │                            fixed components (header, productImage, modal, footer).
│   │                            The core runtime schema stored per-brand in the database.
│   │
│   ├── data.ts ─────────────── EU compliance product data (DppData). Product identifiers,
│   │                            environmental metrics, materials, manufacturing, supply chain.
│   │                            Input data that section components render.
│   │                            (renamed from dpp-data.ts)
│   │
│   ├── content.ts ──────────── Non-compliance marketing data (DppContent, SimilarProduct).
│   │                            Used by carousel. DEPRECATED — remove when carousel is removed.
│   │                            (renamed from dpp-content.ts)
│   │
│   ├── editor.ts ───────────── Editor type system. ComponentDefinition, StyleField,
│   │                            ContentField, SectionSchema, FixedComponentSchema,
│   │                            SectionProps. Single canonical source for both
│   │                            packages/dpp-components and apps/app.
│   │
│   └── index.ts ────────────── Barrel re-export of all type modules.
│
├── sections/
│   ├── hero/
│   │   ├── index.tsx ───────── Hero renderer. Brand name + product title.
│   │   └── schema.ts ──────── Editor tree (title, brand typography) + defaults
│   │                           (styles only, no content — hero has no editable content).
│   │
│   ├── description/
│   │   ├── index.tsx ───────── Description renderer. Clamped preview + "Show more" modal.
│   │   └── schema.ts ──────── Editor tree (heading, body, showMore typography) + defaults.
│   │                           No modal subtree — modal styling is now passport-level.
│   │
│   ├── details/
│   │   ├── index.tsx ───────── Details renderer. Product metadata rows + modal.
│   │   └── schema.ts ──────── Editor tree (heading, rows, labels, values) + defaults.
│   │
│   ├── buttons/
│   │   ├── index.tsx ───────── Buttons renderer. CTA menu buttons.
│   │   └── schema.ts ──────── Editor tree (button, icon styling + menu items config) + defaults.
│   │                           Template content: Button 1, Button 2, Button 3 with empty URLs.
│   │
│   ├── impact/
│   │   ├── index.tsx ───────── Impact renderer. Environmental metrics cards + modal.
│   │   └── schema.ts ──────── Editor tree (title, helpLink, cards) + defaults.
│   │
│   ├── materials/
│   │   ├── index.tsx ───────── Materials renderer. Composition breakdown + modal.
│   │   └── schema.ts ──────── Editor tree (title, cards, percentages, certs) + defaults.
│   │
│   ├── journey/
│   │   ├── index.tsx ───────── Journey renderer. Supply chain timeline + modal.
│   │   └── schema.ts ──────── Editor tree (title, cards, operators, timeline) + defaults.
│   │
│   ├── banner/
│   │   ├── index.tsx ───────── Banner renderer. Marketing CTA with background image.
│   │   └── schema.ts ──────── Editor tree (container, headline, subline, button) + defaults.
│   │                           Template content: empty strings for all text/URL fields.
│   │
│   ├── carousel/
│   │   ├── index.tsx ───────── Carousel renderer. Similar products. DEPRECATED.
│   │   └── schema.ts ──────── Editor tree (title, nav, product cards) + defaults.
│   │
│   ├── registry.ts ─────────── SECTION_REGISTRY: Record<SectionType, { schema, component }>.
│   │                            No type definitions (moved to types/editor.ts).
│   │                            Imports all section schemas and components.
│   │
│   ├── transforms.ts ──────── Data transformation functions. Converts DppData into
│   │                           display models for impact, materials, journey sections.
│   │                           (renamed from _transforms.ts)
│   │
│   └── editor-options.ts ──── Shared select options (CAPITALIZATION_STYLE_OPTIONS).
│
├── components/
│   ├── layout/
│   │   ├── header/
│   │   │   ├── index.tsx ──── Header renderer. Logo + text logo + sticky positioning.
│   │   │   └── schema.ts ─── Editor tree (container bg/border, textLogo typography) + defaults.
│   │   │                      Default content: { logoUrl: "" }.
│   │   │
│   │   ├── footer/
│   │   │   ├── index.tsx ──── Footer renderer. Brand name + social links.
│   │   │   └── schema.ts ─── Editor tree (container, brandName, socialIcon) + defaults.
│   │   │                      Default content: { social: { instagram: "", ... } }.
│   │   │                      Config fields: social link URL inputs.
│   │   │
│   │   ├── product-image/
│   │   │   ├── index.tsx ──── Product image renderer. Media balancing algorithm.
│   │   │   └── schema.ts ─── Editor tree (frame border styling) + defaults.
│   │   │                      Default content: {} (no editable content).
│   │   │
│   │   ├── registry.ts ───── COMPONENT_REGISTRY: Record<string, { schema, component }>.
│   │   │                      Maps header, productImage, footer, modal to their schemas.
│   │   │
│   │   ├── content-frame.tsx  Wrapper that passes props to LayoutRenderer.
│   │   ├── layout-renderer.tsx  Registry-based two-column layout. Resolves
│   │   │                        passport-level modal styles and passes them to sections.
│   │   └── demo-cta.tsx       Demo page CTA overlay.
│   │
│   ├── modal/
│   │   ├── index.tsx ──────── Modal primitives. Dialog wrappers (Modal, ModalTrigger,
│   │   │                      ModalContent, ModalOverlay, ModalPortal) + building blocks
│   │   │                      (ModalTitle, ModalSubtitle, ModalDescription, ModalLabel,
│   │   │                      ModalValue, ModalField, ModalSection, ModalHeader, ModalFooter).
│   │   │                      Slot-aware: each building block reads from ModalStyles.
│   │   │                      (was components/modal.tsx)
│   │   │
│   │   └── schema.ts ──────── Editor tree for modal styling. Container (bg, shadow, border,
│   │                           radius) + 5 text slots (title, subtitle, description, label,
│   │                           value) each with color, typescale, capitalization.
│   │                           Defaults: the six modal.* style entries currently in
│   │                           default-passport.ts DEFAULT_MODAL_STYLES.
│   │
│   ├── modals/
│   │   ├── certification-modal.tsx  Material certification detail modal.
│   │   ├── description-modal.tsx    Full product description modal.
│   │   ├── impact-modal.tsx         Impact metric explainer modal.
│   │   ├── manufacturer-modal.tsx   Manufacturer profile modal.
│   │   ├── operator-modal.tsx       Supply chain operator profile modal.
│   │   └── index.ts                 Barrel export.
│   │
│   ├── data-table.tsx ──────── Reusable 2-column label/value table for modals.
│   └── index.ts ────────────── Public component exports.
│
├── lib/
│   ├── default-tokens.ts ──── Shared design tokens: DEFAULT_COLORS, DEFAULT_TYPOGRAPHY,
│   │                           DEFAULT_FONTS. Imported by both passport files.
│   │
│   ├── default-passport.ts ── Brand starter passport. Defines layout order only.
│   │                           Assembles sections from SECTION_REGISTRY schema defaults.
│   │                           Assembles fixed components from COMPONENT_REGISTRY schema defaults.
│   │                           Exports createDefaultPassport() for brand creation.
│   │
│   ├── demo-passport.ts ───── Demo passport for public passport.avelero.com.
│   │                           Self-contained with inline demo content and demo-specific layout.
│   │                           Shares styles from schema defaults and tokens from default-tokens.
│   │
│   ├── css-generator.ts ───── Generates CSS custom properties from passport tokens.
│   ├── resolve-styles.ts ──── Resolves $token references in StyleOverride values.
│   ├── editor-selection.ts ── Creates data attributes for editor selection/highlighting.
│   ├── google-fonts.ts ────── Google Fonts URL generation.
│   ├── token-utils.ts ─────── Token manipulation utilities.
│   ├── text-line-height.ts ── Typography line-height calculation helpers.
│   ├── interactive-hover.ts ─ Hover style generation for interactive elements.
│   └── url-utils.ts ────────── URL validation (isValidUrl).
│
├── utils/
│   └── formatting.ts ──────── Display formatting (currency, numbers).
│
├── styles/
│   └── globals.css ─────────── Base CSS for .dpp-root container.
│
└── index.ts ────────────────── Package entry. Re-exports types, components, sections, lib.
```

### Files in `apps/app` affected

| File | Change |
|------|--------|
| `theme-editor/registry/types.ts` | **DELETE** — types now from `@dpp-components/types/editor` |
| `theme-editor/registry/component-tree.ts` | **DELETE** — schemas now from `@dpp-components/components/layout/registry` |
| `theme-editor/registry/utils.ts` | **MODIFY** — import from `@dpp-components` registries |
| `contexts/design-editor-provider.tsx` | **MODIFY** — use `SECTION_REGISTRY[type].schema.defaults` instead of `DEFAULT_SECTION_TEMPLATES`. Handle passport-level modal styles. |
| `theme-editor/panel/views/layout-tree.tsx` | **MODIFY** — use `COMPONENT_REGISTRY` instead of `COMPONENT_TREE`. Add "Modal" as fixed item. |
| `theme-editor/panel/views/styles-section.tsx` | **MODIFY** — import types from `@dpp-components` |
| `theme-editor/panel/views/content-section.tsx` | **MODIFY** — import types from `@dpp-components` |

---

## Migration Checklist

Ordered to minimize breakage at each step. Each step should leave the codebase in a working state.

### Phase 1: Type unification

- [ ] Create `types/editor.ts` with the canonical superset of both type definitions
- [ ] Rename `types/dpp-data.ts` → `types/data.ts`
- [ ] Rename `types/dpp-content.ts` → `types/content.ts`
- [ ] Update `types/index.ts` barrel exports
- [ ] Update `sections/registry.ts` to import types from `types/editor.ts` and re-export them (for backward compat during migration)
- [ ] Update `apps/app` imports to use types from `@dpp-components`
- [ ] Delete `apps/app/src/components/theme-editor/registry/types.ts`
- [ ] Rename `sections/_transforms.ts` → `sections/transforms.ts`, update all import paths
- [ ] Typecheck + lint

### Phase 2: Section schema expansion

- [ ] Add `defaults` to `SectionSchema` type in `types/editor.ts`
- [ ] For each section (`hero`, `description`, `details`, `buttons`, `impact`, `materials`, `journey`, `banner`, `carousel`):
  - [ ] Move that section's style defaults from `default-passport.ts` into its `schema.ts` as `defaults.styles`
  - [ ] Move that section's content defaults into `defaults.content` (convert demo content to placeholder content where appropriate: "Button 1" instead of "Care Instructions")
  - [ ] Remove `modal.*` style keys from sections that had `...DEFAULT_MODAL_STYLES` (description, details, impact, materials, journey)
  - [ ] Remove `createModalSchemaGroup()` call from section editor trees
- [ ] Update `SECTION_REGISTRY` entries — schemas now include defaults
- [ ] Typecheck + lint

### Phase 3: Fixed component schemas

- [ ] Create `components/layout/header/` directory, move `header.tsx` → `header/index.tsx`
- [ ] Create `components/layout/header/schema.ts` with editor tree + defaults (from `component-tree.ts` + `default-passport.ts`)
- [ ] Repeat for `footer/` and `product-image/`
- [ ] Create `components/layout/registry.ts` with `COMPONENT_REGISTRY`
- [ ] Update `components/index.ts` export paths
- [ ] Typecheck + lint

### Phase 4: Modal elevation

- [ ] Move `components/modal.tsx` → `components/modal/index.tsx`
- [ ] Create `components/modal/schema.ts` with modal editor tree + defaults (from `DEFAULT_MODAL_STYLES`)
- [ ] Add `modal?: { styles: Styles }` to `Passport` type in `types/passport.ts`
- [ ] Add `modalStyles?: ModalStyles` to `SectionProps` in `types/editor.ts`
- [ ] Add modal entry to `COMPONENT_REGISTRY`
- [ ] Delete `sections/modal-schema.ts`
- [ ] Update `components/layout/layout-renderer.tsx` to resolve `passport.modal?.styles` and pass as `modalStyles` to sections
- [ ] Update each section renderer that opens modals (description, details, impact, materials, journey) to use `modalStyles` prop instead of section-scoped `s["modal.*"]` styles
- [ ] Update component import paths
- [ ] Typecheck + lint

### Phase 5: Default assembly

- [ ] Create `lib/default-tokens.ts` — extract tokens from `default-passport.ts`
- [ ] Rewrite `lib/default-passport.ts` — assembly-only, uses `SECTION_REGISTRY` and `COMPONENT_REGISTRY` schema defaults
- [ ] Create `lib/demo-passport.ts` — inline demo content, demo-specific layout
- [ ] Update `design-editor-provider.tsx`:
  - [ ] Use `SECTION_REGISTRY[type].schema.defaults` for `addSection`
  - [ ] Use `COMPONENT_REGISTRY[id].schema.defaults` for `getDefaultComponentStyleValue`
  - [ ] Remove imports of `DEFAULT_SECTION_TEMPLATES`
- [ ] Update layout tree to use `COMPONENT_REGISTRY` instead of `COMPONENT_TREE`
- [ ] Delete `apps/app/src/components/theme-editor/registry/component-tree.ts`
- [ ] Update all remaining import paths
- [ ] Update `packages/dpp-components/src/index.ts` package exports
- [ ] Typecheck + lint
- [ ] Full manual test: theme editor, demo page, brand creation flow

---

## Database migration note

Adding `modal` to the `Passport` type means existing brand passport JSON documents in the database won't have a `modal` field. This is handled by:

1. Making `modal` optional on the type (`modal?:`).
2. Falling back to schema defaults at read time:

```typescript
const modalStyles = passport.modal?.styles
  ?? COMPONENT_REGISTRY.modal.schema.defaults.styles;
```

No database migration is needed — the field is added lazily when a brand first edits modal styles in the theme editor.
