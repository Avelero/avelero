# Flexible Layout System for DPP Theme Editor

## Context

The DPP theme editor currently has a rigid layout: components render in a fixed order defined in code (`InformationFrame`), and the editor (`COMPONENT_TREE`) only allows toggling visibility and tweaking CSS/content fields. Users cannot reorder, add, or remove component instances.

This plan converts the system to a flexible, zone-based layout (like Shopify's theme editor) where brands can reorder components within zones, add multiple instances of the same component, and delete components they don't need.

---

## 1. New Types: Layout Config

**New file: `packages/dpp-components/src/types/layout-config.ts`**

```typescript
export type ZoneId = "column-left" | "column-right" | "content";

export type ComponentType =
  | "image"       // ProductImage
  | "hero"        // ProductDescription
  | "details"     // ProductDetails
  | "buttons"     // MenuFrame
  | "impact"      // ImpactFrame
  | "materials"   // MaterialsFrame
  | "journey"     // JourneyFrame
  | "banner";     // CTABanner

export interface LayoutComponentInstance {
  /** Unique instance ID (nanoid, e.g. "inst_a1b2c3") */
  id: string;
  /** Which component type from the library */
  componentType: ComponentType;
  /** Instance-specific content (e.g. menu items for buttons, banner text) */
  content?: Record<string, unknown>;
  /** Instance-specific style overrides (CSS variable values) */
  styles?: Record<string, unknown>;
}

export interface LayoutConfig {
  version: 1;
  zones: {
    "column-left": LayoutComponentInstance[];
    "column-right": LayoutComponentInstance[];
    "content": LayoutComponentInstance[];
  };
}
```

Key decisions:
- Header and Footer are NOT in the layout config. They're always rendered and their style/content editing stays exactly as it is today in the component tree.
- `content` on an instance replaces the need for shared config paths. For a "buttons" instance, `content.items` is the array of `{label, url}` menu items. For "banner", `content` carries headline, subline, CTA text, etc.
- `styles` on an instance is a flat map of CSS variable overrides (e.g. `{ "menu-button-color": "#FF0000" }`). These are applied as inline `style` on a wrapper div, overriding the global ThemeStyles values.
- Zones don't include `header` or `footer` since those are fixed structural elements.

**Extend `ThemeConfig` (same file: `theme-config.ts`)**

Add `layout?: LayoutConfig` to the interface. Optional for backward compat during migration.

---

## 2. Component Library Registry

**New file: `packages/dpp-components/src/lib/component-library.ts`**

Replaces `COMPONENT_TREE` as the source of truth for what components exist and where they can go.

```typescript
export interface ComponentLibraryEntry {
  type: ComponentType;
  displayName: string;
  allowedZones: ZoneId[];
  /** Default content when creating a new instance */
  defaultContent: Record<string, unknown>;
  /** Child components for the style editor tree (expand to edit sub-elements) */
  children?: ComponentEditorNode[];
  /** Style fields editable at the component level */
  styleFields?: StyleField[];
  /** Content fields editable in the Content tab */
  contentFields?: ContentField[];
}

export interface ComponentEditorNode {
  id: string;
  displayName: string;
  styleFields?: StyleField[];
  children?: ComponentEditorNode[];
}
```

The library is a constant `COMPONENT_LIBRARY: Record<ComponentType, ComponentLibraryEntry>` that defines:

| Type | Display Name | Allowed Zones | Default Content |
|------|-------------|---------------|-----------------|
| `image` | Product Image | column-left, column-right | `{}` |
| `hero` | Hero | column-right | `{}` |
| `details` | Details | column-right, content | `{}` |
| `buttons` | Buttons | column-right, content | `{ items: [] }` |
| `impact` | Impact | column-right, content | `{}` |
| `materials` | Materials | column-right, content | `{}` |
| `journey` | Journey | column-right, content | `{}` |
| `banner` | Banner | content | `{ headline: "", subline: "", ctaText: "", ctaUrl: "", backgroundImage: "", showHeadline: true, showSubline: true, showButton: true }` |

Each entry also carries the `styleFields` and `contentFields` arrays currently defined in `COMPONENT_TREE`, plus `children` for sub-element editing (e.g., banner has Headline, Subline, Button children).

---

## 3. Instance Content Model

### Buttons
Currently menu items live at `themeConfig.menus.primary` and `themeConfig.menus.secondary`. With the new system, each buttons instance stores its own items:

```typescript
// Instance content for a buttons component
{
  items: [
    { label: "Care Instructions", url: "https://..." },
    { label: "Recycling & Repair", url: "https://..." },
  ],
  variant: "primary"  // CSS variant: "primary" | "secondary" for existing styles
}
```

The `variant` field maps to the existing `menu-primary-button` or `menu-secondary-button` CSS classes, preserving all current styling. This avoids having to refactor the CSS system.

### Banner
Currently banner content lives at `themeConfig.cta.*`. With the new system, each banner instance stores its own content:

```typescript
// Instance content for a banner component
{
  backgroundImage: "https://...",
  headline: "Avelero Apparel",
  subline: "",
  ctaText: "DISCOVER MORE",
  ctaUrl: "https://avelero.com",
  showHeadline: true,
  showSubline: true,
  showButton: true,
}
```

### Data-driven components (hero, details, impact, materials, journey)
These pull data from `DppData` (the compliance data), so they don't need instance-level content. Their `content` field stays empty `{}`. Multiple instances of these would show the same data (which is fine; you'd typically only have one of each, but the system doesn't prevent multiples).

### Image
No content needed. Renders from `DppData.productIdentifiers.productImage`.

---

## 4. Instance Style Model

### Strategy: CSS variable scoping via inline styles

No changes to `css-generator.ts` initially. The existing ThemeStyles system continues to provide global defaults via CSS variables in `.dpp-root`. Instance-level style overrides are applied as inline `style` attributes on a wrapper div:

```html
<!-- Global defaults from ThemeStyles -->
<div class="dpp-root" style="--menu-primary-button-color: #1E2040; ...">

  <!-- Instance override: this specific buttons block gets red text -->
  <div style="--menu-primary-button-color: #FF0000;">
    <MenuFrame ... />
  </div>

  <!-- Another buttons block uses global defaults (no wrapper override) -->
  <div>
    <MenuFrame ... />
  </div>
</div>
```

CSS cascade handles priority naturally: inline CSS variables on the wrapper override the `.dpp-root` ones. No changes needed to the CSS generator or globals.css.

The `styles` field on a `LayoutComponentInstance` is stored as `Record<string, unknown>` where keys are CSS variable names (without `--` prefix) and values are the override values.

---

## 5. DPP Rendering Changes

### 5a. New: `layout-renderer.tsx`

**New file: `packages/dpp-components/src/components/layout/layout-renderer.tsx`**

Central rendering orchestrator. Receives `LayoutConfig`, `DppData`, `DppContent`, and `ThemeConfig`. Renders:

1. The two-column grid (reusing existing `@3xl:grid-cols-2` pattern from `image-and-info.tsx`)
2. Left column: iterates `zones["column-left"]` instances
3. Right column: iterates `zones["column-right"]` instances
4. Below the grid: iterates `zones["content"]` instances

Each instance is rendered via a `renderInstance(instance)` switch that maps `componentType` to the existing React component.

### 5b. New: `dpp-data-transformers.ts`

**New file: `packages/dpp-components/src/lib/dpp-data-transformers.ts`**

Extract data transformation logic from `InformationFrame` into standalone pure functions:
- `transformImpactMetrics(data: DppData)` - builds impact metrics array
- `transformMaterials(data: DppData)` - builds display materials array
- `transformJourney(data: DppData)` - builds journey stages array

These are called once in `layout-renderer.tsx` and passed to the relevant component instances.

### 5c. Modify `content-frame.tsx`

If `themeConfig.layout` exists, render `<LayoutRenderer>`. Otherwise, fall back to the existing `<ImageAndInfo>` + carousel + banner code. This keeps everything working during the transition.

### 5d. Deprecate `information-frame.tsx` and `image-and-info.tsx`

After migration, these become dead code. The layout renderer replaces both. Remove them in the cleanup phase.

---

## 6. Theme Editor Changes

### 6a. New Layout Tree UI

**Replace: `apps/app/src/components/theme-editor/panel/views/layout-tree.tsx`**

The new layout tree renders the zone structure with Shopify-like affordances:

```
Header                          [>]  (always present, click to edit styles/content)
─────────────────────────────────
Column (left)
  ⠿ Product Image              [🗑] [>]
  ┄┄┄┄┄ [+] ┄┄┄┄┄
─────────────────────────────────
Column (right)
  ⠿ Hero                       [🗑] [>]
  ┄┄┄┄┄ [+] ┄┄┄┄┄
  ⠿ Details                    [🗑] [>]
  ┄┄┄┄┄ [+] ┄┄┄┄┄
  ⠿ Buttons                    [🗑] [>]
  ┄┄┄┄┄ [+] ┄┄┄┄┄
  ⠿ Impact                     [🗑] [>]
  ┄┄┄┄┄ [+] ┄┄┄┄┄
  ⠿ Materials                  [🗑] [>]
  ┄┄┄┄┄ [+] ┄┄┄┄┄
  ⠿ Journey                    [🗑] [>]
  ┄┄┄┄┄ [+] ┄┄┄┄┄
─────────────────────────────────
Content
  ⠿ Buttons                    [🗑] [>]
  ┄┄┄┄┄ [+] ┄┄┄┄┄
  ⠿ Banner                     [🗑] [>]
  ┄┄┄┄┄ [+] ┄┄┄┄┄
─────────────────────────────────
Footer                          [>]  (always present, click to edit styles/content)
```

Key UI elements:
- **⠿** Drag handle (visible on hover, for reordering within zone)
- **🗑** Trash icon (visible on hover, deletes instance)
- **[>]** Navigate chevron (click to edit instance styles/content)
- **[+]** Blue insert line with plus dot (visible on hover between items). Clicking opens a popover listing available components for that zone.
- Zone headers ("Column (left)", "Column (right)", "Content") are non-clickable labels with "Add section" buttons
- Header and Footer are rendered outside the zone structure as fixed items (no drag, no delete)

### 6b. Add Component Popover

**New file: `apps/app/src/components/theme-editor/panel/views/add-component-popover.tsx`**

When clicking [+], shows a popover listing components available for that zone (filtered by `allowedZones`). Selecting a component creates a new instance at that position.

### 6c. Instance Editor Navigation

When clicking an instance in the tree, the editor navigates to that instance's style/content editor. This reuses the existing Styles/Content tab pattern from `design-panel.tsx`, but reads fields from the `ComponentLibraryEntry` instead of `COMPONENT_TREE`, and reads/writes values from/to the instance's `content` and `styles` (falling back to ThemeStyles for globals).

### 6d. Drag-and-Drop Reordering

For V1, use a simple button-based reorder (move up/move down) or implement basic HTML5 drag-and-drop within zones. The layout tree already has the visual structure for this.

---

## 7. Editor State Management Changes

**Modify: `apps/app/src/contexts/design-editor-provider.tsx`**

Add to `DesignEditorContextValue`:

```typescript
// Layout state
layoutDraft: LayoutConfig;  // Derived from themeConfigDraft.layout

// Instance CRUD
addInstance(zoneId: ZoneId, componentType: ComponentType, position: number): string;
deleteInstance(zoneId: ZoneId, instanceId: string): void;
moveInstance(zoneId: ZoneId, instanceId: string, newPosition: number): void;

// Instance editing
updateInstanceContent(zoneId: ZoneId, instanceId: string, path: string, value: unknown): void;
updateInstanceStyle(zoneId: ZoneId, instanceId: string, cssVar: string, value: unknown): void;
getInstanceContent(zoneId: ZoneId, instanceId: string, path: string): unknown;
getInstanceStyle(zoneId: ZoneId, instanceId: string, cssVar: string): unknown;

// Navigation (extend existing)
navigateToInstance(zoneId: ZoneId, instanceId: string): void;
```

All instance mutations update `themeConfigDraft.layout` (the layout lives inside ThemeConfig), which means the existing save flow (`saveDrafts` -> tRPC mutation) handles persistence automatically with no backend changes.

---

## 8. Migration

**New file: `packages/dpp-components/src/lib/layout-migration.ts`**

```typescript
export function generateDefaultLayout(config: ThemeConfig): LayoutConfig
```

Converts existing visibility flags + menu/cta config into a `LayoutConfig`:
- `column-left`: one `image` instance
- `column-right`: `hero` + conditionally `details`, `buttons` (primary), `impact`, `materials`, `journey`, `buttons` (secondary) based on `sections.show*` flags
- `content`: conditionally `banner` based on `sections.showCTABanner`

For buttons instances, menu items from `themeConfig.menus.primary` / `themeConfig.menus.secondary` are copied into `instance.content.items`.

For banner instances, CTA config from `themeConfig.cta.*` is copied into `instance.content`.

This function runs:
1. **In the DPP renderer**: if `themeConfig.layout` is undefined, auto-generate it on-the-fly
2. **In the theme editor**: on first load, if no layout exists, generate one and set it as the draft

Since we only have 2 brands with known configurations, we can also write a one-time DB migration script.

---

## 9. Files to Create / Modify / Delete

### New Files
| File | Purpose |
|------|---------|
| `packages/dpp-components/src/types/layout-config.ts` | LayoutConfig, ComponentType, LayoutComponentInstance types |
| `packages/dpp-components/src/lib/component-library.ts` | COMPONENT_LIBRARY registry (replaces COMPONENT_TREE) |
| `packages/dpp-components/src/lib/layout-migration.ts` | generateDefaultLayout() migration function |
| `packages/dpp-components/src/lib/dpp-data-transformers.ts` | Extracted data transformation functions |
| `packages/dpp-components/src/components/layout/layout-renderer.tsx` | Zone-based rendering orchestrator |
| `apps/app/src/components/theme-editor/panel/views/add-component-popover.tsx` | Component picker popover |

### Modified Files
| File | Change |
|------|--------|
| `packages/dpp-components/src/types/theme-config.ts` | Add `layout?: LayoutConfig` field |
| `packages/dpp-components/src/types/index.ts` | Export new layout types |
| `packages/dpp-components/src/components/layout/content-frame.tsx` | Conditional: use LayoutRenderer if layout exists |
| `apps/app/src/contexts/design-editor-provider.tsx` | Add instance CRUD, layout state, instance navigation |
| `apps/app/src/components/theme-editor/panel/views/layout-tree.tsx` | Complete rewrite: zone-based tree with drag/delete/insert UI |
| `apps/app/src/components/theme-editor/panel/design-panel.tsx` | Handle instance-level navigation and editing |
| `apps/app/src/components/theme-editor/registry/types.ts` | Update/extend types for new registry |

### Deleted Files (after migration complete)
| File | Reason |
|------|--------|
| `apps/app/src/components/theme-editor/registry/component-tree.ts` | Replaced by component-library.ts |
| `packages/dpp-components/src/components/layout/information-frame.tsx` | Replaced by layout-renderer.tsx |
| `packages/dpp-components/src/components/layout/image-and-info.tsx` | Replaced by layout-renderer.tsx |

---

## 10. Implementation Phases

### Phase 1: Types & Registry (foundation)
1. Create `layout-config.ts` with all types
2. Create `component-library.ts` with COMPONENT_LIBRARY constant (port styleFields/contentFields/children from COMPONENT_TREE)
3. Add `layout?: LayoutConfig` to ThemeConfig
4. Export from `types/index.ts`
5. `bun typecheck` + `bun lint`

### Phase 2: Data Transformers & Migration
1. Create `dpp-data-transformers.ts` (extract from information-frame.tsx)
2. Create `layout-migration.ts` with `generateDefaultLayout()`
3. Write unit test for migration function
4. `bun typecheck` + `bun lint`

### Phase 3: DPP Rendering
1. Create `layout-renderer.tsx`
2. Modify `content-frame.tsx` to conditionally use LayoutRenderer
3. Test: DPP pages render identically with auto-generated layout
4. `bun typecheck` + `bun lint`

### Phase 4: Editor State
1. Add layout state and instance CRUD to `design-editor-provider.tsx`
2. Add instance navigation support
3. Wire instance content/style read/write helpers
4. `bun typecheck` + `bun lint`

### Phase 5: Editor UI
1. Rewrite `layout-tree.tsx` with zone sections, drag handles, trash icons, insert lines
2. Create `add-component-popover.tsx`
3. Update `design-panel.tsx` for instance-level editing
4. Test full editor flow: add, delete, reorder, edit instances
5. `bun typecheck` + `bun lint`

### Phase 6: Cleanup
1. Run migration on existing brands (generate layout config)
2. Delete `component-tree.ts`, `information-frame.tsx`, `image-and-info.tsx`
3. Remove legacy rendering fallback from `content-frame.tsx`
4. Remove `themeConfig.sections` visibility flags (now derived from layout)
5. Remove `themeConfig.menus` and `themeConfig.cta` (now on instances)
6. Final `bun typecheck` + `bun lint` + `bun build`

---

## 11. Verification

After each phase:
- `bun typecheck` passes
- `bun lint` passes
- `bun build` passes

After Phase 3:
- DPP demo page renders identically to current (visual regression check)
- DPP with no layout config auto-generates and renders correctly

After Phase 5:
- Theme editor loads with zone-based layout tree
- Can add a new buttons instance via [+] popover
- Can delete an instance via trash icon
- Can reorder instances within a zone
- Can edit instance content (menu items, banner text)
- Can edit instance styles (colors, typography, etc.)
- Preview updates live when editing instances
- Save persists all changes
- DPP page renders the saved layout correctly
