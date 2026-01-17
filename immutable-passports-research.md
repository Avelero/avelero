# Immutable Product Passports Research Document

This document serves as a reference for understanding the **current state** of the Avelero Digital Product Passport (DPP) platform. It explains the existing normalized data model, how editing works, and the architecture we are working **away from** in the immutable passports implementation.

---

## Table of Contents

1. [Overview](#overview)
2. [Current Architecture Summary](#current-architecture-summary)
3. [Database Schema - The Normalized Data Model](#database-schema---the-normalized-data-model)
   - [Core Tables](#core-tables)
   - [Catalog Tables (Brand-Level Reusable Entities)](#catalog-tables-brand-level-reusable-entities)
   - [Product Tables (Product-Level Data)](#product-tables-product-level-data)
   - [Variant Override Tables](#variant-override-tables)
   - [Integration Tables](#integration-tables)
4. [Entity Relationships Diagram](#entity-relationships-diagram)
5. [How Editing Currently Works](#how-editing-currently-works)
   - [Product Creation Flow](#product-creation-flow)
   - [Product Editing Flow](#product-editing-flow)
   - [Variant Matrix System](#variant-matrix-system)
   - [Manual Save Button](#manual-save-button)
6. [Public DPP Rendering](#public-dpp-rendering)
7. [Key Problems with Current Architecture](#key-problems-with-current-architecture)
8. [File Tree of Relevant Files](#file-tree-of-relevant-files)

---

## Overview

Avelero is a Digital Product Passport (DPP) management platform that allows brands to create, edit, and publish product passports compliant with EU ESPR regulations. The platform features:

- **Brand-centric editing UI** (similar to Shopify's product management)
- **Normalized relational data model** (highly interconnected tables)
- **Variant matrix system** with attributes (Size, Color, etc.)
- **External integrations** (Shopify, ERPs) for data sync
- **Public-facing passport viewer** with customizable themes

---

## Current Architecture Summary

The current architecture uses a **fully normalized working layer** where all product data is stored across multiple related tables. Every time a public DPP is accessed, the system performs complex JOINs across many tables to assemble the complete passport data.

**Key Characteristics:**
- No immutable snapshots - all data is live and editable
- Products and variants can be deleted, breaking any QR codes in circulation
- Cascade deletes propagate through the entire data model
- URL structure includes brand slug and product handle (mutable)
- Complex queries required for public DPP rendering

---

## Database Schema - The Normalized Data Model

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `brands` | Brand/organization accounts | `id`, `name`, `slug`, `logo_path`, `country_code` |
| `users` | User accounts | `id`, `email` |
| `brand_members` | Links users to brands with roles | `user_id`, `brand_id`, `role` |

### Catalog Tables (Brand-Level Reusable Entities)

These tables store reusable entities that are defined at the brand level and can be referenced by multiple products.

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `brand_attributes` | Attribute definitions (e.g., Color, Size) | `id`, `brand_id`, `name`, `taxonomy_attribute_id` |
| `brand_attribute_values` | Values for attributes (e.g., Red, Blue, Large) | `id`, `brand_id`, `attribute_id`, `name`, `taxonomy_value_id` |
| `brand_manufacturers` | Manufacturer companies | `id`, `brand_id`, `name`, `legal_name`, address fields, contact fields |
| `brand_facilities` | Supply chain operators/facilities | `id`, `brand_id`, `display_name`, `legal_name`, address fields, contact fields |
| `brand_materials` | Material definitions | `id`, `brand_id`, `name`, `certification_id`, `recyclable`, `country_of_origin` |
| `brand_certifications` | Certification records | `id`, `brand_id`, `title`, `certification_code`, institute fields, dates |
| `brand_eco_claims` | Eco/sustainability claims | `id`, `brand_id`, `claim` |
| `brand_seasons` | Seasonal collections | `id`, `brand_id`, `name` |
| `brand_tags` | Organizational tags | `id`, `brand_id`, `name` |
| `brand_collections` | Product collections | `id`, `brand_id`, `name` |

### Product Tables (Product-Level Data)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `products` | Core product data | `id`, `brand_id`, `name`, `product_handle`, `description`, `image_path`, `category_id`, `season_id`, `manufacturer_id`, `status`, `source`, `source_integration_id` |
| `product_variants` | Variant instances of products | `id`, `product_id`, `sku`, `barcode`, `upid`, `name` (override), `description` (override), `image_path` (override) |
| `product_variant_attributes` | Links variants to attribute values | `variant_id`, `attribute_value_id`, `sort_order` |
| `product_materials` | Links products to materials with percentages | `id`, `product_id`, `brand_material_id`, `percentage` |
| `product_journey_steps` | Supply chain journey steps | `id`, `product_id`, `sort_index`, `step_type`, `facility_id` |
| `product_environment` | Environmental impact metrics | `product_id`, `metric`, `value`, `unit` |
| `product_eco_claims` | Links products to eco claims | `id`, `product_id`, `eco_claim_id` |
| `product_tags` | Links products to tags | `id`, `product_id`, `tag_id` |
| `product_weight` | Product weight data | `product_id`, `value`, `unit` |
| `product_commercial` | Commercial/pricing data | `product_id`, various pricing fields |

### Variant Override Tables

The variant override tables allow variants to have their own data that overrides the product-level defaults. This supports multi-source integration where different integrations provide different data for the same variant.

| Table | Purpose |
|-------|---------|
| `variant_environment` | Variant-specific environmental data |
| `variant_materials` | Variant-specific material composition |
| `variant_journey_steps` | Variant-specific supply chain steps |
| `variant_eco_claims` | Variant-specific eco claims |
| `variant_weight` | Variant-specific weight |
| `variant_commercial` | Variant-specific commercial data |

### Integration Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `integrations` | Available integration providers | `id`, `name`, `type`, `capabilities` |
| `brand_integrations` | Brand's connected integrations | `id`, `brand_id`, `integration_id`, `credentials`, `status`, `is_primary`, `sync_interval` |
| `sync_jobs` | Background sync job status | `id`, `brand_integration_id`, `status`, progress fields |
| `entity_links` | Links internal entities to external IDs | `entity_type`, `entity_id`, `external_id`, `integration_id` |
| `product_links` | Specific product to external mapping | `product_id`, `external_id`, `integration_id` |
| `variant_links` | Specific variant to external mapping | `variant_id`, `external_id`, `integration_id` |
| `field_configs` | Controls which fields come from which source | `brand_integration_id`, `entity_type`, `field_name`, `source` |

---

## Entity Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                  BRAND LEVEL                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐                                                                    │
│  │  brands  │                                                                    │
│  └────┬─────┘                                                                    │
│       │ 1:N                                                                      │
│       │                                                                          │
│  ┌────┴─────────────────────────────────────────────────────────────────────┐   │
│  │                        CATALOG ENTITIES                                   │   │
│  │                                                                           │   │
│  │  ┌─────────────────┐  ┌─────────────────────┐  ┌──────────────────────┐  │   │
│  │  │brand_attributes │──│brand_attribute_values│  │brand_manufacturers  │  │   │
│  │  └─────────────────┘  └─────────────────────┘  └──────────────────────┘  │   │
│  │                                                                           │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐  │   │
│  │  │brand_materials  │──│brand_certifications│  │brand_facilities       │  │   │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────────────┘  │   │
│  │                                                                           │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐  │   │
│  │  │brand_eco_claims │  │brand_seasons    │  │brand_tags               │  │   │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                                PRODUCT LEVEL                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────┐                                                                    │
│  │ products │ → FK to: brand_manufacturers, taxonomy_categories, brand_seasons  │
│  └────┬─────┘                                                                    │
│       │                                                                          │
│  ┌────┴───────────────────────────────────────────────────────────────────────┐ │
│  │                      PRODUCT ATTRIBUTES                                     │ │
│  │                                                                             │ │
│  │  ┌───────────────────┐   ┌─────────────────────┐   ┌────────────────────┐  │ │
│  │  │product_materials  │   │product_journey_steps│   │product_environment │  │ │
│  │  └───────────────────┘   └─────────────────────┘   └────────────────────┘  │ │
│  │         ↓ FK                     ↓ FK                                       │ │
│  │   brand_materials         brand_facilities                                  │ │
│  │                                                                             │ │
│  │  ┌───────────────────┐   ┌─────────────────────┐   ┌────────────────────┐  │ │
│  │  │product_eco_claims │   │product_tags         │   │product_weight      │  │ │
│  │  └───────────────────┘   └─────────────────────┘   └────────────────────┘  │ │
│  │         ↓ FK                     ↓ FK                                       │ │
│  │   brand_eco_claims         brand_tags                                       │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌──────────────────┐                                                            │
│  │ product_variants │ ← 1:N from products                                        │
│  └────────┬─────────┘                                                            │
│           │                                                                      │
│  ┌────────┴─────────────────────────────────────────────────────────────────┐   │
│  │                    VARIANT RELATIONSHIPS                                  │   │
│  │                                                                           │   │
│  │  ┌──────────────────────────┐                                            │   │
│  │  │product_variant_attributes│ ← M:N to brand_attribute_values            │   │
│  │  └──────────────────────────┘                                            │   │
│  │                                                                           │   │
│  │  OVERRIDE TABLES (optional, override product-level data):                │   │
│  │  ┌──────────────────┐  ┌───────────────────────┐  ┌────────────────────┐ │   │
│  │  │variant_materials │  │variant_journey_steps  │  │variant_environment │ │   │
│  │  └──────────────────┘  └───────────────────────┘  └────────────────────┘ │   │
│  │                                                                           │   │
│  │  ┌──────────────────┐  ┌───────────────────────┐                         │   │
│  │  │variant_eco_claims│  │variant_weight         │                         │   │
│  │  └──────────────────┘  └───────────────────────┘                         │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## How Editing Currently Works

### Product Creation Flow

1. **User navigates to Create Passport page** (`/passports/create`)
2. **User fills out product form** with sections:
   - Basic Info: name, description, image, product handle
   - Organization: category, season, tags
   - Variants: attribute selection matrix (see below)
   - Environment: carbon footprint, water usage, eco claims
   - Materials: material composition with percentages
   - Journey: supply chain steps with facilities
3. **User clicks Save button** (all sections submitted at once)
4. **Backend creates records atomically:**
   - Insert into `products` table
   - Generate variants via matrix or explicit creation
   - Insert into `product_variant_attributes` for each variant
   - Insert into `product_materials`, `product_journey_steps`, etc.

### Product Editing Flow

1. **User navigates to Edit Passport page** (`/passports/edit/[handle]`)
2. **Data is fetched** from normalized tables via complex JOINs
3. **User modifies any field** in the form
4. **User clicks Save button**
5. **Backend performs full replacement:**
   - Updates `products` table core fields
   - Deletes and re-inserts materials, journey steps, eco claims
   - For variants: handles additions/deletions based on matrix changes

### Variant Matrix System

The variant system uses a **matrix approach** where attribute dimensions generate a cartesian product of variants:

**Example:**
- Dimension 1: Color = [Red, Blue, Green]
- Dimension 2: Size = [S, M, L]
- Result: 9 variants (Red-S, Red-M, Red-L, Blue-S, etc.)

**Key behaviors:**
1. **New products:** Full matrix editing enabled - add/remove attributes, add/remove values
2. **Saved products:** Matrix still editable, variants become clickable for individual editing
3. **After publishing (proposed):** Matrix editing will be locked

**Current danger:** Removing a value from a dimension (e.g., removing "Blue" from Color) cascades to delete all variants with that attribute value via `ON DELETE CASCADE` on `product_variant_attributes`.

### Manual Save Button

Currently, the form uses a **manual Save button pattern**:
- User makes changes
- Nothing is persisted until Save is clicked
- Both Cancel and Save buttons present
- No autosave functionality

**UI Pattern:**
```
[Cancel] [Save]
```

**Unsaved changes protection:** Navigation away prompts the user to confirm discarding changes.

---

## Public DPP Rendering

### Current URL Structure
```
passport.avelero.com/{brandSlug}/{productHandle}/{variantUpid?}
```

### Data Fetching Flow

1. **Resolve brand** from slug → `brands` table
2. **Resolve product** from handle → `products` table
3. **Resolve variant** (if UPID provided) → `product_variants` table
4. **Load product attributes** via parallel queries:
   - Materials: `product_materials` → `brand_materials` → `brand_certifications`
   - Journey: `product_journey_steps` → `brand_facilities`
   - Environment: `product_environment`
   - Eco Claims: `product_eco_claims` → `brand_eco_claims`
5. **Load variant attributes** if variant resolving to product-level fails
6. **Load theme config** from `brand_theme` table
7. **Assemble DPP data object** for frontend rendering

### Theme System

Brands can customize their passport appearance via:
- `brand_theme` table stores theme configuration (logo, colors, fonts, sections)
- Custom CSS stylesheets (uploaded to Supabase storage)
- Google Fonts integration
- Section visibility and ordering

---

## Key Problems with Current Architecture

### 1. QR Code Invalidation Risk
- Deleting a product or variant removes the data entirely
- QR codes affixed to physical products become unresolvable
- No way to recover or audit deleted passports

### 2. Cascading Data Loss
- Normalized model with `ON DELETE CASCADE` on most FKs
- Deleting a `brand_attribute_value` cascades to delete all variants using it
- Accidental attribute changes can destroy many variants

### 3. URL Instability
- Brand slug can change (rebranding)
- Product handle can change (organizational changes)
- Both break existing QR codes

### 4. Performance Overhead
- Every public DPP request requires 10+ table JOINs
- No caching layer (always live data)
- Theme data fetched on every request

### 5. No Version History
- Changes overwrite previous state
- No audit trail of passport content
- Cannot prove what was displayed at a given time (compliance issue)

### 6. Ambiguous Publish State
- `status` field exists but has multiple meanings (archived, scheduled, etc.)
- No clear distinction between "working draft" and "published version"
- No concept of "unpublished changes pending"

---

## File Tree of Relevant Files

```
avelero-v2/
├── apps/
│   ├── api/                              # Backend API (Hono + tRPC)
│   │   └── src/
│   │       ├── trpc/
│   │       │   └── routers/
│   │       │       ├── products/
│   │       │       │   ├── index.ts      # Product CRUD router
│   │       │       │   └── variants.ts   # Variant CRUD router
│   │       │       ├── catalog/          # Catalog entity routers
│   │       │       └── dpp-public/       # Public DPP endpoints
│   │       └── schemas/                  # Input validation schemas
│   │
│   ├── app/                              # Dashboard frontend (Next.js)
│   │   └── src/
│   │       ├── app/
│   │       │   └── (dashboard)/(main)/(sidebar)/
│   │       │       └── passports/
│   │       │           ├── (list)/
│   │       │           │   └── page.tsx          # Passports table page
│   │       │           └── (form)/
│   │       │               ├── create/           # Create passport
│   │       │               └── edit/[handle]/    # Edit passport
│   │       │                   ├── page.tsx
│   │       │                   └── variant/
│   │       │                       ├── [upid]/   # Edit variant
│   │       │                       └── new/      # Create variant
│   │       │
│   │       ├── components/
│   │       │   ├── forms/
│   │       │   │   └── passport/
│   │       │   │       ├── product-form.tsx      # Main product form
│   │       │   │       ├── variant-form.tsx      # Variant form
│   │       │   │       ├── actions.tsx           # Form action buttons
│   │       │   │       └── blocks/
│   │       │   │           ├── basic-info-block.tsx
│   │       │   │           ├── variant-block.tsx      # Variant matrix UI
│   │       │   │           ├── materials-block.tsx
│   │       │   │           ├── journey-block.tsx
│   │       │   │           ├── environment-block.tsx
│   │       │   │           └── organization-block.tsx
│   │       │   │
│   │       │   ├── passports/
│   │       │   │   ├── table-section.tsx         # Passports data table
│   │       │   │   └── data-section.tsx          # Metrics cards
│   │       │   │
│   │       │   └── tables/
│   │       │       └── variants/                 # Variant table components
│   │       │
│   │       └── hooks/
│   │           ├── use-passport-form.ts          # Form state management
│   │           └── use-brand-catalog.ts          # Catalog data hooks
│   │
│   └── dpp/                              # Public passport viewer (Next.js)
│       └── src/
│           ├── app/
│           │   └── [brand]/
│           │       └── [productHandle]/
│           │           ├── page.tsx               # Product DPP page
│           │           └── [variantUpid]/
│           │               └── page.tsx           # Variant DPP page
│           └── lib/
│               ├── api.ts                         # Data fetching utilities
│               └── validation.ts                  # URL param validation
│
├── packages/
│   ├── db/                               # Database layer (Drizzle ORM)
│   │   └── src/
│   │       ├── schema/
│   │       │   ├── index.ts              # All schema exports
│   │       │   ├── core/
│   │       │   │   ├── brands.ts         # brands table
│   │       │   │   └── users.ts          # users table
│   │       │   │
│   │       │   ├── catalog/
│   │       │   │   ├── brand-attributes.ts
│   │       │   │   ├── brand-attribute-values.ts
│   │       │   │   ├── brand-manufacturers.ts
│   │       │   │   ├── brand-facilities.ts
│   │       │   │   ├── brand-materials.ts
│   │       │   │   ├── brand-certifications.ts
│   │       │   │   ├── brand-eco-claims.ts       # ⚠️ To be removed
│   │       │   │   └── brand-seasons.ts
│   │       │   │
│   │       │   ├── products/
│   │       │   │   ├── products.ts               # products table
│   │       │   │   ├── product-variants.ts       # product_variants table
│   │       │   │   ├── product-variant-attributes.ts
│   │       │   │   ├── product-materials.ts
│   │       │   │   ├── product-journey-steps.ts
│   │       │   │   ├── product-environment.ts
│   │       │   │   ├── product-eco-claims.ts     # ⚠️ To be removed
│   │       │   │   ├── product-weight.ts
│   │       │   │   ├── product-commercial.ts
│   │       │   │   ├── product-tags.ts
│   │       │   │   └── variant-*.ts              # Variant override tables
│   │       │   │
│   │       │   └── integrations/
│   │       │       ├── brand-integrations.ts
│   │       │       ├── sync-jobs.ts
│   │       │       └── links/
│   │       │           ├── entity-links.ts
│   │       │           ├── product-links.ts
│   │       │           └── variant-links.ts
│   │       │
│   │       └── queries/
│   │           ├── products/
│   │           │   ├── crud.ts                   # Create/Update/Delete
│   │           │   ├── get.ts                    # Single product fetch
│   │           │   ├── list.ts                   # Product listing
│   │           │   ├── variants.ts               # Variant queries
│   │           │   ├── variant-attributes.ts     # Matrix operations
│   │           │   └── resolve-variant-data.ts   # Override resolution
│   │           │
│   │           └── dpp/
│   │               ├── public.ts                 # Public DPP assembly
│   │               ├── transform.ts              # Data transformation
│   │               └── carousel.ts               # Product carousel (to be disabled)
│   │
│   ├── dpp-components/                   # Shared DPP UI components
│   │   └── src/
│   │       ├── header.tsx
│   │       ├── footer.tsx
│   │       ├── content-frame.tsx
│   │       └── types.ts                  # ThemeConfig, ThemeStyles types
│   │
│   ├── integrations/                     # External integration adapters
│   │   └── src/
│   │       └── shopify/                  # Shopify adapter
│   │
│   └── jobs/                             # Background job definitions
│       └── src/
│           └── trigger/
│               ├── integrations/
│               │   └── sync-integration.ts
│               └── bulk/
│                   ├── export-products.ts
│                   ├── import-products.ts
│                   └── validate-and-stage.ts
│
└── immutable-passports-plan.md           # The plan we are implementing
```

---

## Summary for LLM Agents

When working on the immutable passports implementation, remember:

1. **Current state = normalized working layer** — All data lives in connected tables with cascade deletes
2. **No publishing layer yet** — `product_passports` and `dpp_versions` tables need to be created
3. **Status field exists but is overloaded** — Currently supports archived/unpublished/published/scheduled
4. **Eco claims are to be removed** — `brand_eco_claims` and `product_eco_claims` tables
5. **URL structure will change** — From `/{brandSlug}/{productHandle}/{upid}` to just `/{upid}`
6. **Manual Save → Autosave** — Current pattern uses explicit Save button; will change to debounced autosave
7. **Variant matrix danger** — Editing dimensions can cascade-delete variants; publishing will lock the matrix
8. **Product Carousel is to be disabled** — Feature flag `FEATURE_PRODUCT_CAROUSEL_ENABLED=false`
9. **Public API will be simplified** — Will read from `dpp_versions.data_snapshot` instead of normalized queries

Key files for the implementation:
- Schema: `packages/db/src/schema/products/products.ts` (add `has_unpublished_changes`)
- Schema: Create `packages/db/src/schema/products/product-passports.ts`
- Schema: Create `packages/db/src/schema/products/dpp-versions.ts`
- Form: `apps/app/src/components/forms/passport/product-form.tsx` (autosave, Publish button)
- Block: `apps/app/src/components/forms/passport/blocks/variant-block.tsx` (lock matrix after publish)
- Public: `packages/db/src/queries/dpp/public.ts` (read from snapshots)
