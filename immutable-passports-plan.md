# DPP Publishing Layer Implementation Plan

## Introduction

The current Digital Product Passport (DPP) management platform is designed around brand-centric editing, similar to Shopify's product management interface. While this makes it easy for brands to create, edit, and delete products and variants, it poses a significant compliance risk: once a QR code is generated and affixed to a physical product, the associated passport must remain accessible and editable indefinitely. The current normalized data model allows variants to be accidentally deleted through routine operations like modifying attribute values, which would invalidate QR codes already in circulation. This plan introduces an immutable publishing layer on top of the existing working layer, ensuring that published passports persist independently of changes made in the brand's editing interface.

---

## 1. Table Schema

### 1.1 product_passports

The permanent identity record for a published passport. Once created, this record persists regardless of changes to the underlying working data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Internal identifier |
| `upid` | VARCHAR(24) | UNIQUE, NOT NULL | Universal Product Identifier, used in public URLs |
| `brand_id` | UUID | NOT NULL, FK → brands | The brand that owns this passport |
| `working_variant_id` | UUID | FK → variants, ON DELETE SET NULL | Link to the editable variant; becomes NULL if variant is deleted |
| `current_version_id` | UUID | FK → dpp_versions | Points to the active version |
| `first_published_at` | TIMESTAMPTZ | NOT NULL | When the passport was first published |
| `last_published_at` | TIMESTAMPTZ | NOT NULL | When the passport was most recently updated |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() | Record update timestamp |

**URL Structure:** Passports are accessed via `/{upid}` only. No brand slug or product handle is included in the URL. This ensures URLs remain stable regardless of any changes brands make to their organization structure.

### 1.2 dpp_versions

Immutable version history. Each publish action creates a new record; records are never updated or deleted.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Internal identifier |
| `passport_id` | UUID | NOT NULL, FK → product_passports | The passport this version belongs to |
| `version_number` | INTEGER | NOT NULL | Sequential version number per passport |
| `data_snapshot` | JSONB | NOT NULL | Complete DPP content as a self-contained JSON object |
| `content_hash` | VARCHAR(64) | NOT NULL | SHA-256 hash of the canonical JSON for integrity verification |
| `schema_version` | VARCHAR(10) | NOT NULL | Version of the JSON schema used (e.g., "1.0", "1.1") |

**Unique constraint:** `(passport_id, version_number)`

**Note on schema_version:** This field tracks which version of the DPP JSON structure was used to create the snapshot. As the platform evolves and the JSON schema changes (new fields, restructured data, renamed properties), this version indicator allows the system to correctly interpret and migrate older snapshots.

### 1.3 Cascade Delete Policy

**Critical:** The `product_passports` and `dpp_versions` tables must never have cascade deletes configured. These tables are immutable and must persist indefinitely—even if:

- The associated variant is deleted from the working layer
- The associated product is deleted
- The entire brand account is deleted

This ensures QR codes remain resolvable for auditing and compliance purposes, regardless of what happens in the working layer.

### 1.4 Working Layer Changes

The following columns are added to the existing `products` table to track publishing state:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `status` | VARCHAR(20) | NOT NULL, DEFAULT 'unpublished' | Either `published` or `unpublished`. Used for UI display only. |
| `has_unpublished_changes` | BOOLEAN | NOT NULL, DEFAULT false | Set to `true` on every save, set to `false` on publish |

These columns are for communicating publishing state to the user in the dashboard. Once a product is published, it remains visitable via its QR codes indefinitely (unless deleted).

---

## 2. URL Structure Changes

### Current Structure (Deprecated)

```
passport.avelero.com/{brandSlug}/{productHandle}/{upid}
```

### New Structure

```
passport.avelero.com/{upid}
```

The URL structure is simplified to use only the UPID. Brand slug and product handle are removed entirely from the URL path. This ensures URLs remain permanently stable—brands can reorganize their products, rename handles, or rebrand entirely without affecting QR code accessibility.

**Important:** The UPID must now be globally unique across all product passports in the entire database—not just unique within a brand or product. This is required because the UPID is now the sole identifier in the URL path.

### Future: Custom Brand Domains

In the future, brands will be able to connect their own custom domains (e.g., `dpp.fillingpieces.com/{upid}`). These custom domains will serve the content from `passport.avelero.com` while displaying the brand's domain in the browser. This is not a redirect—the user sees and remains on the brand's domain; Avelero simply serves the passport content behind it.

---

## 3. Data Snapshot Structure

When a product passport is published, the complete DPP content is captured as a self-contained JSON-LD object. This snapshot is stored in the `data_snapshot` column of the `dpp_versions` table. The structure follows JSON-LD conventions for semantic interoperability and includes all information required for EU ESPR compliance.

```json
{
  "@context": {
    "@vocab": "https://schema.org/",
    "dpp": "https://avelero.com/dpp/v1/",
    "espr": "https://ec.europa.eu/espr/"
  },
  "@type": "dpp:DigitalProductPassport",
  "@id": "https://passport.avelero.com/771Gh4J11gLj345m",
  "productIdentifiers": {
    "upid": "771Gh4J11gLj345m",
    "sku": "DJ-ORG-2024-BLU",
    "barcode": "5901234123457"
  },
  "productAttributes": {
    "name": "Classic Organic Denim Jacket",
    "description": "Classic fit denim jacket made from 100% organic cotton with recycled metal buttons.",
    "image": "https://cdn.avelero.com/products/denim-jacket-001.webp",
    "category": "Jackets",
    "manufacturer": {
      "name": "EcoWear Textiles",
      "legalName": "EcoWear Textiles BV",
      "email": "manufacturing@ecowear.com",
      "phone": "+31 20 123 4567",
      "website": "https://ecowear-textiles.com",
      "addressLine1": "Funenpark 220A",
      "addressLine2": "",
      "city": "Amsterdam",
      "state": "North-Holland",
      "zip": "1018AK",
      "countryCode": "NL"
    },
    "attributes": [
      { "name": "Size", "value": "M" },
      { "name": "Color", "value": "Indigo Blue" }
    ],
    "weight": { "value": 850, "unit": "grams" }
  },
  "environmental": {
    "waterLiters": { "value": 2500, "unit": "liters" },
    "carbonKgCo2e": { "value": 8.5, "unit": "kgCO2e" }
  },
  "materials": {
    "composition": [
      {
        "material": "Organic Cotton",
        "percentage": 98,
        "recyclable": true,
        "countryOfOrigin": "India",
        "certification": {
          "title": "GOTS",
          "certificationCode": "GOTS-2024-12345",
          "testingInstitute": {
            "instituteName": "Control Union Certifications",
            "instituteEmail": "info@controlunion.com",
            "instituteWebsite": "https://controlunion.com",
            "instituteAddressLine1": "Meeuwenlaan 4-6",
            "instituteAddressLine2": "",
            "instituteCity": "Zwolle",
            "instituteState": "Overijssel",
            "instituteZip": "8011BZ",
            "instituteCountryCode": "NL"
          }
        }
      },
      {
        "material": "Recycled Polyester",
        "percentage": 2,
        "recyclable": true,
        "countryOfOrigin": "Italy",
        "certification": {
          "title": "GRS",
          "certificationCode": "GRS-2024-67890",
          "testingInstitute": {
            "instituteName": "Textile Exchange",
            "instituteEmail": "info@textileexchange.org",
            "instituteWebsite": "https://textileexchange.org",
            "instituteAddressLine1": "1800 M Street NW",
            "instituteAddressLine2": "Suite 400",
            "instituteCity": "Washington",
            "instituteState": "DC",
            "instituteZip": "20036",
            "instituteCountryCode": "US"
          }
        }
      }
    ]
  },
  "supplyChain": [
    {
      "stepType": "Raw Material",
      "sortIndex": 0,
      "operators": [
        {
          "displayName": "Organic Cotton Farms Gujarat",
          "legalName": "Gujarat Organic Cotton Cooperative Ltd.",
          "email": "info@gujcotton.in",
          "phone": "+91 79 2658 1234",
          "website": "https://gujcotton.in",
          "addressLine1": "Industrial Estate Road",
          "addressLine2": "",
          "city": "Ahmedabad",
          "state": "Gujarat",
          "zip": "380015",
          "countryCode": "IN"
        }
      ]
    },
    {
      "stepType": "Weaving",
      "sortIndex": 1,
      "operators": [
        {
          "displayName": "Premium Weaving Mills",
          "legalName": "Premium Weaving Mills Pvt. Ltd.",
          "email": "orders@premiumweaving.in",
          "phone": "+91 422 234 5678",
          "website": "https://premiumweaving.in",
          "addressLine1": "SIDCO Industrial Estate",
          "addressLine2": "Plot 15",
          "city": "Coimbatore",
          "state": "Tamil Nadu",
          "zip": "641021",
          "countryCode": "IN"
        }
      ]
    },
    {
      "stepType": "Dyeing / Printing",
      "sortIndex": 2,
      "operators": [
        {
          "displayName": "EcoDye BV",
          "legalName": "EcoDye Sustainable Finishing BV",
          "email": "production@ecodye.nl",
          "phone": "+31 13 456 7890",
          "website": "https://ecodye.nl",
          "addressLine1": "Textile Lane 42",
          "addressLine2": "",
          "city": "Tilburg",
          "state": "North-Brabant",
          "zip": "5038CD",
          "countryCode": "NL"
        }
      ]
    },
    {
      "stepType": "Stitching",
      "sortIndex": 3,
      "operators": [
        {
          "displayName": "Precision Stitch Factory",
          "legalName": "Precision Stitch Manufacturing Ltd.",
          "email": "info@precisionstitch.pt",
          "phone": "+351 22 789 0123",
          "website": "https://precisionstitch.pt",
          "addressLine1": "Zona Industrial Norte",
          "addressLine2": "Lote 22",
          "city": "Porto",
          "state": "Porto",
          "zip": "4100-452",
          "countryCode": "PT"
        }
      ]
    },
    {
      "stepType": "Assembly",
      "sortIndex": 4,
      "operators": [
        {
          "displayName": "Fashion Assembly Ltd.",
          "legalName": "Fashion Assembly International BV",
          "email": "production@fashionassembly.com",
          "phone": "+31 20 456 7890",
          "website": "https://fashionassembly.com",
          "addressLine1": "Garment District 88",
          "addressLine2": "",
          "city": "Amsterdam",
          "state": "North-Holland",
          "zip": "1017EF",
          "countryCode": "NL"
        }
      ]
    },
    {
      "stepType": "Finishing",
      "sortIndex": 5,
      "operators": [
        {
          "displayName": "Quality Finish BV",
          "legalName": "Quality Finish Netherlands BV",
          "email": "qa@qualityfinish.nl",
          "phone": "+31 10 567 8901",
          "website": "https://qualityfinish.nl",
          "addressLine1": "Haven Straat 100",
          "addressLine2": "Unit B",
          "city": "Rotterdam",
          "state": "South-Holland",
          "zip": "3012AB",
          "countryCode": "NL"
        }
      ]
    }
  ],
  "metadata": {
    "schemaVersion": "1.0",
    "publishedAt": "2026-01-16T10:30:00Z",
    "versionNumber": 1
  }
}
```

---

## 4. Publishing System

### Keeping Save Button + Adding Publish Shortcut

The existing Save button remains in place. Given the complex variant creation/deletion that happens when selecting and de-selecting attributes and attribute values, autosave would be fragile. Instead, we keep explicit save actions and add a convenient Publish shortcut.

### Form UI Changes

**Current UI:**
```
[Back] [Save]
```

**New UI:**
```
⋮ (three-dot menu at top right)      [Back] [Save] [Publish]
```

**Three-dot menu (top right of product form):**
- Contains a "Publish" action
- Provides quick access to publishing without scrolling to the bottom
- Only appears on the product edit form, NOT on variant edit forms

**Important:** The three-dot menu with Publish action is NOT added to the variant editing page. This is intentional—publishing happens at the product level, not the variant level.

**Form actions (bottom of form):**
- Keep existing `Back` and `Save` buttons
- Add `Publish` button on the right side

**Publish button text logic:**
- `Publish` — if the passport has never been published before
- `Publish changes` — if the passport has been published at least once

### Publishing State Columns

The `products` table tracks publishing state with two columns (see Section 1.4):

- **`status`** — Either `unpublished` (default) or `published`. Once published, remains `published` forever. Previous states `archived` and `scheduled` are removed.
- **`has_unpublished_changes`** — Set to `true` on every save, set to `false` on publish.

### Publish Action Sequence

When a user clicks the Publish button, the following happens in order:

1. **Force save** — Run a save action immediately, even though autosave has been running. This ensures any final changes are persisted. This sets `has_unpublished_changes = true`.

2. **Create snapshot** — Generate the JSON-LD snapshot from the current working data.

3. **Create version record** — Insert a new row into `dpp_versions` with the snapshot.

4. **Update passport record** — Update `product_passports.current_version_id` and `last_published_at`.

5. **Clear change flag** — Set `has_unpublished_changes = false` on the `products` table.

6. **Update status** — If this is the first publish, set `status = 'published'` on the `products` table.

### Manual Publishing Only

Publishing is always a manual action performed by the user in the dashboard. There is no auto-publish functionality for any fields.

When integration syncs run (e.g., 24-hour data refresh from Shopify or ERP systems), the working layer is updated and `has_unpublished_changes` is set to `true`. The user must then manually click "Publish changes" to create a new version.

This approach:
- Prevents version explosion from frequent sync updates
- Gives brands full control over what gets published and when
- Ensures brands review changes before they go live

Future consideration: Add UI indicators (badges, notifications) to alert brands when they have unpublished changes pending.

---

## 5. Variant Matrix Behavior

### Current Matrix UI Structure

The variant matrix block consists of:

1. **Attribute selection area** — Drag-and-drop blocks for each attribute (e.g., Color, Size). Each block shows the attribute title and a multi-select trigger to add/remove attribute values.

2. **"Add attribute" button** — Opens a popover to add a new attribute (either custom or from a default list).

3. **Variants table** — A matrix table showing all variant combinations:
   - With one attribute: simple table with rows for each value
   - With two+ attributes: collapsible accordion table (e.g., Color rows that expand to show Size sub-rows)
   - Columns: Attribute values, SKU, Barcode

4. **"Add variant" button** — Allows manual variant creation

### Three UI States

#### State 1: Before Saving (New Variants)

- Variant rows display a "new" chip/label
- Rows are not clickable
- Attribute selection area is fully editable (add/remove attributes, add/remove values)

#### State 2: After Saving (Saved, Not Published)

- "New" chip disappears
- Rows become clickable (attribute text underlines on hover)
- Clicking a row navigates to the variant edit page
- Attribute selection area remains fully editable

#### State 3: After Publishing (Published)

- **The attribute selection area is hidden entirely**
- Only the variants table and "Add variant" button remain visible
- Existing variant rows are clickable and navigate to edit pages
- Variants are "set in stone" — they persist and cannot be accidentally deleted by modifying attributes

### Adding New Variants After Publishing

After publishing, brands can still add new variants:

1. Click "Add variant" button
2. Navigate to variant creation page
3. Select attribute values for the new variant
4. Save the variant (it is saved but not yet published)
5. The new variant appears in the table, ready to be published

### Editing Variant Attributes After Publishing

When navigating into an individual variant's edit page, brands can still modify the attribute values for that specific variant. The restriction only applies to the matrix-level attribute structure—individual variants remain editable.

---

## 6. Product and Variant Deletion

### Variant Deletion

On the variants page (`/passport/{product-handle}/variants`), users can delete variants via the three-dot menu. For published variants, the delete option remains available but triggers a confirmation modal:

```
┌─────────────────────────────────────────────────────┐
│  Delete variant                                     │
│                                                     │
│  This will make the QR code inactive. You won't    │
│  be able to edit this variant from your dashboard  │
│  anymore.                                           │
│                                                     │
│  Are you sure you want to proceed?                 │
│                                                     │
│                        [Cancel]  [Delete variant]   │
└─────────────────────────────────────────────────────┘
```

### Product Deletion

Deleting a product follows the same logic as variant deletion, but at a larger scale—it deletes all variants belonging to that product. The confirmation modal warns the user accordingly:

```
┌─────────────────────────────────────────────────────┐
│  Delete product                                     │
│                                                     │
│  This will make the QR codes for all [X] variants  │
│  inactive. You won't be able to edit them from     │
│  your dashboard anymore.                            │
│                                                     │
│  Are you sure you want to proceed?                 │
│                                                     │
│                        [Cancel]  [Delete product]   │
└─────────────────────────────────────────────────────┘
```

### What Happens on Deletion

When a user confirms deletion of a published variant or product:

1. **Working layer data is deleted** — The variant/product record and all associated normalized table data are removed from the brand's account

2. **Publishing layer persists** — The `product_passports` record and all `dpp_versions` records remain intact for auditing and compliance

3. **Link is severed** — `product_passports.working_variant_id` is set to `NULL` (via `ON DELETE SET NULL`)

4. **QR code behavior** — The QR code URL still resolves, but the passport displays the last published version and indicates it is no longer active

---

## 7. Passports Page UI Changes

### Metrics Cards

Replace the current metrics cards (Archived, Unpublished, Published, Scheduled) with:

| Card | Metric | Description |
|------|--------|-------------|
| Total Passports | Count of all passports | Overview of portfolio size |
| Published | Count where `status = 'published'` | How many are live |
| Unpublished | Count where `status = 'unpublished'` | Drafts waiting for first publish |
| Pending Changes | Count where `status = 'published'` AND `has_unpublished_changes = true` | Passports with changes not yet published |

### Table Columns

Add a new column to the passports table:

| Column | Description |
|--------|-------------|
| Last Published At | Displays the last publish date/time in a user-friendly format (e.g., "Today at 2:30 PM", "Jan 15, 2026"). Empty if the passport has never been published. |

The existing Status column now only displays two states: `Published` or `Unpublished`.

### Table Row Click Behavior

**Current behavior:** Clicking a passport row navigates to `/{brand-slug}/{product-handle}`, which fetches product data but not variant/attribute data. This required separate queries and complicated the logic.

**New behavior:** Clicking a passport row navigates directly to the first variant's UPID: `/{upid}`

**Note:** Even products where the user has not actively configured variants still have one default variant with a generated UPID. This means every product always has at least one variant to link to.

### Bulk Actions

**Current bulk actions:**
- Delete
- Change Status → (secondary menu with Archive, Unpublished, Published, Scheduled)

**New bulk actions:**
- Delete
- Publish

When "Publish" is clicked, all selected passports are published. The secondary status menu is removed entirely.

### Row-Level Actions (Three-Dot Menu)

Each passport row's three-dot menu contains:

- **Delete** — Deletes the passport (with confirmation modal)
- **Publish** — Publishes the passport (disabled/muted if already published and has no unpublished changes)

### Bonus: First-Publish Warning Modal

When a user publishes a passport for the first time, display a warning modal:

```
┌─────────────────────────────────────────────────────────┐
│  Publishing your passport                               │
│                                                         │
│  Once published, you will no longer be able to add or  │
│  remove attributes from this product. You can still    │
│  edit individual variants and their attribute values.  │
│                                                         │
│  ☐ Do not show this again                              │
│                                                         │
│                          [Cancel]  [Publish]            │
└─────────────────────────────────────────────────────────┘
```

- "Do not show again" preference is stored in browser cookies
- The modal reappears after 1-2 months even if dismissed, ensuring all users see it periodically

### Bonus: Delete Confirmation Modal

When deleting a published passport (single or bulk), the confirmation modal includes:

```
┌─────────────────────────────────────────────────────────┐
│  Delete passport(s)                                     │
│                                                         │
│  Are you sure you want to delete [X] passport(s)?      │
│                                                         │
│  This will make the QR code(s) inactive. You will not  │
│  be able to edit them from your dashboard anymore.     │
│                                                         │
│                          [Cancel]  [Delete]             │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Disable Product Carousel Feature

The product carousel feature is temporarily disabled but not deleted. This simplifies the public passport rendering and reduces query complexity.

### Implementation

Add a feature flag via environment variable:

```
FEATURE_PRODUCT_CAROUSEL_ENABLED=false
```

### What Gets Disabled

When the feature flag is `false`:

- **Theme editor page** — Product carousel configuration section is hidden
- **Passport render** — Product carousel component is not rendered
- **Product carousel modal** — The modal for selecting products is not shown
- **Public API** — Product carousel fetching logic is skipped

### Code Retention

Do not delete the product carousel code. Keep it in the codebase so the feature can be re-enabled later by setting the environment variable to `true`.

---

## 9. Remove Eco Claims

Eco claims are being removed entirely due to compliance risk (brands making unverified claims).

### Deletions Required

| Area | Action |
|------|--------|
| Database | Delete `eco_claims` table |
| API | Remove eco claims from all queries and router endpoints |
| Editing UI | Remove eco claims section from passport/variant edit forms |
| Creating UI | Remove eco claims section from passport/variant create forms |
| Excel Import | Remove eco claims columns from import logic |
| Excel Export | Remove eco claims columns from export logic |

---

## 10. Public DPP API Refactoring

The public API for viewing digital product passports must be refactored to fetch from the publishing layer instead of the normalized working tables.

### Current Behavior

- Fetches theme styling and config (brand-level)
- Fetches product data from normalized tables (complex queries)
- Fetches product carousel data
- Fetches eco claims

### New Behavior

The public API fetches only:

1. **Theme config** — Brand-level styling and configuration (unchanged)
2. **Theme styles** — Brand-level visual settings (unchanged)
3. **Product passport snapshot** — The JSON-LD object from `dpp_versions.data_snapshot`

### Benefits

- No complex normalized table queries for passport content
- Significantly improved performance
- Self-contained JSON-LD object has all required data
- Theme data is brand-generic and can be cached/standardized