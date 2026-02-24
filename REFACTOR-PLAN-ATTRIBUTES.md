# Attribute & Taxonomy System Refactor Plan

## 1. How the Current System Works

### The Four Core Tables

The system has two layers: a **global taxonomy** (read-only, shared across all brands) and **brand-specific catalog data** (mutable, per-brand).

**Global taxonomy layer:**

- `taxonomy_attributes` — A dictionary of standardized attribute types (Color, Size, Gender, etc.). Each has a `friendlyId`, `publicId`, `name`, and `description`. Read-only for all authenticated users.
- `taxonomy_values` — Standardized values within each taxonomy attribute (e.g., Black, Blue, White under Color). Each carries a `sortOrder` (so sizes render S → M → L → XL) and a `metadata` JSONB field that stores enrichment data like color swatches (`{ swatch: "#000000" }`). Read-only for all authenticated users.

**Brand catalog layer:**

- `brand_attributes` — Brand-owned attribute definitions. Has an **optional** `taxonomyAttributeId` FK that links it to a taxonomy attribute. Unique constraint on `(brandId, name)` prevents duplicate attribute names per brand.
- `brand_attribute_values` — Brand-owned values under each brand attribute. Has an **optional** `taxonomyValueId` FK that links it to a taxonomy value. Unique constraint on `(brandId, attributeId, name)` prevents duplicate value names within an attribute.

Products never reference taxonomy tables directly. Variants reference `brand_attribute_values` through the `product_variant_attributes` join table.

### How Attributes Appear in the UI

When a user opens the variant editor to add dimensions (like Color or Size), the system builds a merged list of options using the `useAttributes` hook. This hook calls `buildAttributeValueOptions()`, which does the following:

1. Loads all `brand_attribute_values` for the given brand attribute.
2. Loads all `taxonomy_values` for the linked taxonomy attribute (if any).
3. Adds all brand values to the options list, marking each one's linked taxonomy value as "covered."
4. Also marks taxonomy values as "covered" if a brand value with the same name exists (case-insensitive), even without an explicit `taxonomyValueId` link.
5. For any uncovered taxonomy values, adds them to the list with a synthetic ID prefixed with `tax:` (e.g., `tax:550e8400-e29b-41d4-a716-446655440000`).
6. Sorts everything by `sortOrder`.

The result is a unified dropdown where brand-owned values and pending taxonomy values appear together. The `tax:` prefix is how the system distinguishes "this is a taxonomy placeholder, not yet materialized as a brand record" from "this is a real brand value."

### What Happens When a User Selects a Taxonomy Value

If a user selects an option with a `tax:` prefix, the system knows it needs to create a brand record for this value before it can be saved to a variant. This materialization happens at save time. The system calls `ensureBrandAttributeValueForTaxonomy()`, which creates a new `brand_attribute_values` row linked to the taxonomy value via `taxonomyValueId`.

### What Happens When a User Creates a Custom Value

If the attribute is linked to a taxonomy (`taxonomyAttributeId` is set), the `CreateValueModal` opens. This modal requires the user to:

1. Enter a name for the new value.
2. Select a "standard value" from the taxonomy to link it to — this is **required** when the attribute has taxonomy options.

If the attribute has no taxonomy link, the value is created directly without a modal.

### How Shopify Integration Creates Attributes

The sync engine (`packages/integrations/src/sync/processor.ts`) processes Shopify variant options (e.g., `{ name: "Color", value: "Red" }`):

1. `batchCreateBrandAttributes()` upserts brand attributes by name using `ON CONFLICT DO NOTHING`. It does **not** set `taxonomyAttributeId` during batch creation.
2. `batchCreateBrandAttributeValues()` upserts brand attribute values using `ON CONFLICT DO UPDATE`, where the update fills in `taxonomyValueId` via `COALESCE` if it was previously null.
3. The result: Shopify-imported attributes often exist without taxonomy links, creating a parallel set of brand attributes that don't participate in the taxonomy system.

### How Metadata (Color Swatches) Works

Color swatch data lives exclusively in `taxonomy_values.metadata`. When a brand value is linked to a taxonomy value via `taxonomyValueId`, the UI extracts the hex color from the taxonomy value's metadata using `extractHex()`. Brand values without taxonomy links have no swatch data.

---

## 2. Why the Current System is Inefficient

### Problem 1: Dual-Identity Runtime Model

The `tax:` prefix creates a parallel ID namespace. Every component that handles attribute values must understand two types of IDs: real UUIDs (brand values) and synthetic `tax:` strings (pending taxonomy values). This dual-identity model affects:

- **`useAttributes` hook** — Must build, merge, and deduplicate two sources.
- **`AttributeSelect` component** — Must handle both ID types when toggling values.
- **`variant-block.tsx`** — Must resolve `tax:` IDs to real brand value IDs at save time.
- **`variant-form.tsx`** — Must handle the ID transition when taxonomy values are materialized.
- **`AttributesSelectBlock`** — Must pass `tax:` IDs through selection state.

Any new feature that touches attribute values (bulk editing, CSV import, API endpoints) must also implement this dual-ID logic.

### Problem 2: Deduplication Logic is Fragile

The `buildAttributeValueOptions()` function uses two deduplication strategies:

1. **Explicit link deduplication** — A taxonomy value is "covered" if any brand value has `taxonomyValueId` pointing to it.
2. **Name-based deduplication** — A taxonomy value is also "covered" if a brand value with the same name (case-insensitive) exists, even without a `taxonomyValueId` link.

The name-based fallback exists because Shopify imports create brand values without taxonomy links. But name matching breaks with: localization (a Dutch brand naming a color "Zwart" vs taxonomy "Black"), synonyms ("Navy" vs "Dark Blue"), renames, and imports from systems with slightly different naming conventions.

### Problem 3: Asymmetric Backfill Behavior

There's an inconsistency between how attributes and values handle conflicts during sync:

- `batchCreateBrandAttributeValues()` uses `ON CONFLICT DO UPDATE` with `COALESCE` to **backfill** missing `taxonomyValueId` on existing rows.
- `batchCreateBrandAttributes()` uses `ON CONFLICT DO NOTHING` and does **not** backfill `taxonomyAttributeId`.

This means attributes imported via Shopify remain permanently unlinked to taxonomy (no backfill), while values may get linked opportunistically. The result is an inconsistent linking state: a brand attribute might have no taxonomy link, but some of its values do.

### Problem 4: Forced Taxonomy Linking on Custom Value Creation

The `CreateValueModal` requires selecting a "standard value" when the attribute has a taxonomy link (`canCreate = name.trim() && (!taxonomyAttributeId || selectedTaxonomyValueId)`). This means:

- If a brand has "Color" linked to the taxonomy and wants to add "Rose Gold" (which isn't in the taxonomy), they're forced to pick the closest standard value — which might not be appropriate.
- Users can't simply add a free-text custom value to a taxonomy-linked attribute without choosing a mapping.

This makes the system feel rigid and breaks the principle that taxonomy should be enrichment, not a requirement.

### Problem 5: Two Conceptual Categories of Attributes

The UI implicitly treats attributes as either "standard" (taxonomy-linked) or "custom" (inline, no taxonomy), with different creation flows, different component paths (`isCustomInline` flag), and different modal behaviors. This split adds conditional logic throughout the variant editor and settings pages.

### Problem 6: Metadata is Inaccessible Without Taxonomy Links

Color swatches only render for values linked to taxonomy via `taxonomyValueId`. Values created through Shopify sync (without taxonomy links) or custom values that the user chose not to link never get swatches, even if they represent the same color. There's no way to attach metadata directly to a brand value.

---

## 3. What the System Should Look Like After Refactoring

### Core Principle

**Brand catalog tables are the sole runtime source of truth. Taxonomy tables are seed templates and nothing more.**

Products, variants, the UI, and all business logic only ever reference brand attribute IDs and brand attribute value IDs. Taxonomy IDs never appear in form state, selection state, or any runtime data flow. The `tax:` prefix pattern is eliminated entirely.

### Schema Changes

**`brand_attribute_values` — add two columns:**

- `metadata` (JSONB, nullable, default `{}`) — Stores enrichment data like color swatches directly on the brand value. During seeding, this is copied from `taxonomy_values.metadata`. Users or future features can also set this independently.
- `sortOrder` (integer, nullable, default `0`) — Controls display ordering. During seeding, this is copied from `taxonomy_values.sortOrder`. Users can reorder later.

**`brand_attributes` and `brand_attribute_values` — keep but deprecate taxonomy FKs:**

- `brand_attributes.taxonomyAttributeId` — Keep the column for now. It can serve as a passive reference for analytics, data export, or future standardization features. But it is never used in runtime UI logic, form state, or merge operations.
- `brand_attribute_values.taxonomyValueId` — Same treatment. Keep as passive reference, never used in runtime rendering or deduplication.

These FK columns become informational provenance markers, not operational dependencies. They could eventually be dropped entirely, but there's no urgency.

**Optional: Add provenance tracking:**

- `brand_attributes.origin` (text enum: `seeded`, `manual`, `integration`) — Records how the attribute was created. Useful for UI badges ("Imported from Shopify") or analytics.
- `brand_attribute_values.origin` (same enum) — Records how the value was created.

This is optional and can be added later if needed.

### Brand Seeding on Creation

When a new brand account is created, a seeding function runs (either in-transaction or as a post-creation job):

1. Read all `taxonomy_attributes` and their `taxonomy_values`.
2. For each taxonomy attribute, create a `brand_attributes` row with:
   - `name` = taxonomy attribute name
   - `taxonomyAttributeId` = taxonomy attribute ID (for provenance)
3. For each taxonomy value under that attribute, create a `brand_attribute_values` row with:
   - `name` = taxonomy value name
   - `taxonomyValueId` = taxonomy value ID (for provenance)
   - `metadata` = copied from `taxonomy_values.metadata` (this is how color swatches are preserved)
   - `sortOrder` = copied from `taxonomy_values.sortOrder`

After seeding, the brand has a complete set of default attributes and values as brand-owned records. These are indistinguishable in the UI from manually-created or import-created records.

### Backfill for Existing Brands

For brands that already exist, run a one-time migration script:

1. For each brand, check which taxonomy attributes/values don't yet have corresponding brand records.
2. Create missing brand records with metadata and sort order copied from taxonomy.
3. For existing brand values that have a `taxonomyValueId` link, copy the taxonomy value's `metadata` into the brand value's new `metadata` column if it's empty.

This ensures all existing brands are brought up to the same state as newly-seeded brands.

### Simplified UI Behavior

**`useAttributes` hook — complete rewrite:**

The hook no longer merges two sources. It simply:

1. Loads `brand_attribute_values` for the given brand attribute.
2. Returns them as options, sorted by `sortOrder`.
3. Extracts `hex` from `brand_attribute_values.metadata` directly (no taxonomy lookup needed).

The `buildAttributeValueOptions()` function, the `tax:` prefix, `coveredTaxonomyIds`, `coveredNames`, `isBrandValue` flag, and all deduplication logic are removed.

**`AttributeSelect` component — simplified:**

- Collapsed view: Shows attribute name + selected value chips with hex colors from brand value metadata.
- Expanded view: Dropdown with search + inline create option.
- Create value: Always creates directly (no modal for taxonomy linking). Just enter a name.

**`CreateValueModal` — removed or dramatically simplified:**

The modal that forces taxonomy linking is no longer needed. Value creation becomes a single input field. If you want to preserve the modal for consistency, it just takes a name (and optionally a color picker for metadata).

**`AttributesSelectBlock` and `DimensionSelect` — simplified:**

Selection state only contains brand value UUIDs. No `tax:` prefixes. No special handling for taxonomy vs. custom. The `handleSelectOption` function just toggles a UUID. The `handleCreateNew` function just creates a brand value directly.

**Settings page (`attributes-section.tsx`) — simplified:**

No more separate "Link to standard value" dropdowns per attribute/value. Attributes are just a flat list. Values are just a flat list under each attribute. The taxonomy link columns in the table can be removed or replaced with a passive "Origin" badge.

### Simplified Sync Engine Behavior

**`batchCreateBrandAttributes()`** — No changes needed. It already upserts by `(brandId, name)` with `ON CONFLICT DO NOTHING`. Since brands are pre-seeded, importing "Color" when "Color" already exists simply returns the existing ID. No taxonomy linking needed.

**`batchCreateBrandAttributeValues()`** — Simplify the `ON CONFLICT DO UPDATE`:

- Remove the `COALESCE` logic for backfilling `taxonomyValueId`.
- On conflict, just update `updatedAt` (or do nothing).
- Since brands are pre-seeded with default values, importing "Black" under "Color" finds the existing seeded record and reuses it.

**`resolveAttributeValueIds()`** — No changes needed. It already looks up brand attributes/values by name. Pre-seeded values are found by the same lookup.

**New values from Shopify** (e.g., a color "Dusty Rose" not in taxonomy): Created as brand values without taxonomy links — exactly the same as today, but without the implication that they're "missing" a link.

### Metadata & Color Swatches

After the refactor, metadata flows like this:

1. **Seeded values** (from taxonomy): `metadata` is copied from `taxonomy_values.metadata` during brand seeding. Swatches work immediately.
2. **Manually created values**: `metadata` is null by default. No swatch. A future enhancement could add a color picker to value creation.
3. **Imported values** (from Shopify): `metadata` is null by default unless the import carries metadata. Shopify's `linkedMetafield` data could be used to populate metadata if available.

The UI reads `hex` from `brand_attribute_values.metadata` directly. No taxonomy join needed.

### Adding New Taxonomy Attributes/Values in the Future

If you add a new attribute to the taxonomy (e.g., "Fabric Type" with values "Cotton", "Polyester", "Silk"):

1. Add it to `taxonomy_attributes` and `taxonomy_values` (via your existing YAML sync).
2. Run a script that seeds the new attribute and values into all existing brands that don't have it yet.
3. New brands automatically get it via the brand creation seeding.

This is a one-time operational task, not a runtime concern.

---

## 4. Migration Phases

### Phase 1: Schema & Data (Low Risk, High ROI)

1. Add `metadata` (JSONB) and `sortOrder` (integer) columns to `brand_attribute_values`.
2. Write a migration script that copies `metadata` and `sortOrder` from linked taxonomy values into existing brand values.
3. Write a seeding function that creates default brand attributes/values on brand creation.
4. Backfill existing brands with any missing seeded attributes/values.
5. Verify that all brand values that previously rendered swatches still render swatches via their own `metadata`.

### Phase 2: Frontend Simplification

1. Rewrite `useAttributes` to read only from brand values. Remove all taxonomy merge logic, `tax:` prefix handling, and deduplication.
2. Simplify `CreateValueModal` to a plain name input (remove required taxonomy value selection).
3. Simplify `AttributeSelect` to remove the `hasTaxonomy` branching and `CreateValueModal` trigger for taxonomy-linked attributes.
4. Simplify `AttributesSelectBlock` / `DimensionSelect` to remove `tax:` ID handling.
5. Update `variant-block.tsx` and `variant-form.tsx` to remove any `tax:` → brand value ID resolution at save time.
6. Remove the `isBrandValue` flag from `AttributeValueOption`.
7. Update the settings page to remove taxonomy linking UI elements.

### Phase 3: Backend Cleanup

1. Simplify `batchCreateBrandAttributeValues()` to remove `COALESCE`-based `taxonomyValueId` backfill.
2. Remove `ensureBrandAttributeForTaxonomy()` and `ensureBrandAttributeValueForTaxonomy()` — no longer needed since values are pre-seeded.
3. Remove `listBrandAttributeValuesWithTaxonomy()` and `listBrandAttributesWithTaxonomy()` queries that join to taxonomy tables — brand values now carry their own metadata.
4. Remove taxonomy value loading from `useBrandCatalog` hook (the `taxonomyValuesByAttribute` map).
5. Clean up types: remove `taxonomyValueId` and `taxonomyAttributeId` from frontend-facing types if they're no longer used in UI logic.

### Phase 4: Optional Future Enhancements

- Add a color picker to value creation for manual metadata assignment.
- Add provenance fields (`origin`, `origin_source`) for UI badges.
- Drop taxonomy FK columns from brand tables if confirmed unused.
- Consider structured metadata definitions (similar to Shopify's metaobject fields) for richer attribute metadata beyond just color swatches.

---

## 5. Test Scenarios & Acceptance Criteria

### Brand Creation

- A new brand immediately has all taxonomy attributes (Color, Size, Gender, etc.) as brand attributes with seeded values.
- Seeded "Color" values have color swatch metadata populated.
- Seeded "Size" values are sorted in logical order (XS → S → M → L → XL → XXL).

### Variant Editing

- Adding a variant dimension shows only brand values in the dropdown. No `tax:` prefixed IDs appear.
- Selecting seeded "Black" uses the existing brand value ID — no new record is created.
- Creating a custom value "Deep Sea Blue" under Color just creates a brand value. No modal asking to link to a taxonomy standard.
- Color swatches render for seeded values. No swatch renders for custom values (unless metadata is manually set).

### Shopify Import

- Importing a product with Color: "Black" finds the pre-seeded "Black" brand value and reuses it.
- Importing a product with Color: "Dusty Rose" (not in taxonomy) creates a new brand value without errors or "missing link" states.
- Importing an attribute "Material" that doesn't exist as a seeded attribute creates a new brand attribute normally.
- No duplicate attributes or values are created when importing attributes that match seeded names.

### Settings Page

- All attributes appear in one flat list (no "standard" vs "custom" split).
- Values can be renamed, added, and deleted without taxonomy linking considerations.
- Deleting a seeded value that's in use by variants is blocked (existing behavior, unchanged).

### Backward Compatibility

- Existing products referencing brand attribute values continue to work without changes (product_variant_attributes FK targets are unchanged).
- Existing brand values with taxonomy links retain their swatch metadata (migrated to `metadata` column).
- No data loss during migration.

---

## 6. Data Impact Assessment

Assuming ~50 taxonomy attributes with an average of ~20 values each:

- **Per brand:** ~50 attribute rows + ~1,000 value rows = ~1,050 rows
- **At 200 brands:** ~210,000 rows total
- **Row size:** ~200 bytes each (UUID + UUID + UUID + text + JSONB + integer + timestamps)
- **Total storage:** ~42 MB

This is negligible for Postgres/Supabase. Index overhead is similarly minimal.

---

## 7. What We Keep vs. What We Remove

### Keep

- `taxonomy_attributes` and `taxonomy_values` tables (as seed templates, not runtime dependencies)
- `taxonomy_categories` and `taxonomy_external_mappings` (for Shopify category mapping)
- `brand_attributes` and `brand_attribute_values` tables (the sole runtime source of truth)
- `product_variant_attributes` join table (unchanged)
- Unique constraints on brand tables (prevent duplicates)
- RLS policies (unchanged)
- `batchCreateBrandAttributes()` and `batchCreateBrandAttributeValues()` (simplified but kept)
- Taxonomy YAML sync for maintaining the template library

### Remove

- `tax:` prefix ID system and all associated parsing/handling
- `buildAttributeValueOptions()` merge/deduplication logic
- `CreateValueModal` taxonomy linking requirement
- Taxonomy value loading in `useBrandCatalog` for runtime UI
- `listBrandAttributeValuesWithTaxonomy()` join queries (replaced by direct brand value reads)
- `listBrandAttributesWithTaxonomy()` join queries
- `ensureBrandAttributeForTaxonomy()` function
- `ensureBrandAttributeValueForTaxonomy()` function
- `COALESCE`-based taxonomy backfill in batch operations
- `coveredTaxonomyIds` / `coveredNames` deduplication sets
- `isBrandValue` flag on `AttributeValueOption`
- `hasTaxonomy` branching in components
- `isCustomInline` distinction (all attributes behave the same way)
