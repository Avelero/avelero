# Integration System Implementation Plan

> **Purpose**: This document details the complete implementation plan for the Avelero integration management system, including architecture, file changes, and phased execution.
>
> **Last Updated**: December 2024
>
> **Progress**: Phase 1 completed (December 2024) - Database schema created and migrations applied
>
> **Prerequisites**: Read `research-integration.md` first for current state context.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Core Philosophy](#2-core-philosophy)
3. [Three-Layer Architecture](#3-three-layer-architecture)
4. [Field Registry Design](#4-field-registry-design)
5. [Connector Schema Format](#5-connector-schema-format)
6. [ETL Process Patterns](#6-etl-process-patterns)
7. [Database Schema Changes](#7-database-schema-changes)
8. [New File Structure](#8-new-file-structure)
9. [Shopify OAuth Flow (Required for App Store)](#9-shopify-oauth-flow-required-for-app-store)
10. [Phased Implementation Plan](#10-phased-implementation-plan)

---

## 1. Executive Summary

### 1.1 What We're Building

An integration management system that:
- Connects to external systems (Shopify, It's Perfect, and future integrations)
- Syncs product data on a configurable schedule (default: every 6 hours)
- Enforces single-owner field ownership (one integration per field per brand)
- Follows "last-write-wins" philosophy with null-protection
- Is extensible for adding new integrations with minimal code changes

### 1.2 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Last-write-wins** | Prevents data decoupling; integration systems are the source of truth |
| **Single field ownership** | Avoids precedence conflicts between systems |
| **Null-protection** | Never overwrite existing data with null values |
| **Three-layer architecture** | Separates code (transforms), config (capabilities), and user choices |
| **Encrypted credentials** | API keys encrypted at rest with AES-256-GCM |
| **Link-first, name-fallback** | Reference entities (materials, etc.) are matched by integration link first, then by name. Allows brands to rename entities without breaking sync. |
| **Separate entity link tables** | Each reference entity type has its own link table with proper FK constraints (ON DELETE CASCADE) |

### 1.3 Timeline Estimate

| Phase | Duration | Description | Status |
|-------|----------|-------------|--------|
| Phase 1 | 3-4 days | Database schema + Field Registry | ✅ **COMPLETED** |
| Phase 2 | 2-3 days | Encryption utilities + Core infrastructure | 🔄 **NEXT** |
| Phase 3 | 4-5 days | API routers + UI components | ⏳ Pending |
| Phase 4 | 5-7 days | Shopify connector + Sync engine | ⏳ Pending |
| Phase 5 | 5-7 days | It's Perfect connector | ⏳ Pending |
| Phase 6 | 2-3 days | Testing + Polish | ⏳ Pending |
| **Total** | **3-4 weeks** | | **In Progress** |

---

## 2. Core Philosophy

### 2.1 Data Flow Direction

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  External System │ ──► │     Avelero      │ ──► │       DPP        │
│  (Shopify, etc)  │     │  (Data Layer)    │     │  (Visualization) │
└──────────────────┘     └──────────────────┘     └──────────────────┘
        │                                                  
        │ We FOLLOW data, we don't SET data                
        │ External systems are source of truth             
        ▼                                                  
   ┌─────────────────────────────────────────────────┐
   │  • No write-back to external systems            │
   │  • Manual edits can be overwritten by sync      │
   │  • Users can disable field ownership to prevent │
   │    sync overwriting specific fields             │
   └─────────────────────────────────────────────────┘
```

### 2.2 Field Ownership Rules

1. **One owner per field per brand**: A field can only be owned by ONE integration at a time
2. **No precedence**: We don't handle "Shopify before It's Perfect" - it's either owned or not
3. **Manual edits**: Users can always manually edit fields, but owned fields will be overwritten on next sync
4. **Opt-out**: Users can disable ownership for specific fields to preserve manual changes
5. **Null-protection**: If external system returns null, we keep existing value

### 2.3 Sync Behavior

```
┌─────────────────────────────────────────────────────────────────┐
│                      SYNC DECISION TREE                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
               ┌──────────────────────────┐
               │  Is field ownership      │
               │  enabled for this field? │
               └──────────────────────────┘
                      │           │
                     YES          NO
                      │           │
                      ▼           ▼
        ┌─────────────────┐   ┌─────────────────┐
        │ Is external     │   │ SKIP - don't    │
        │ value non-null? │   │ update field    │
        └─────────────────┘   └─────────────────┘
              │       │
             YES      NO
              │       │
              ▼       ▼
        ┌─────────┐  ┌─────────────────┐
        │ UPDATE  │  │ KEEP existing   │
        │ field   │  │ value (null     │
        │         │  │ protection)     │
        └─────────┘  └─────────────────┘
```

---

## 3. Three-Layer Architecture

### 3.1 Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 1: CONNECTOR CODE (packages/jobs/src/lib/integrations/connectors/)  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • API client implementations                                               │
│  • Transform functions (parsing, data conversion)                           │
│  • Field definitions with source options                                    │
│  • 100% in TypeScript code                                                  │
│  • Changes require code deployment                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 2: FIELD REGISTRY (packages/db/src/integrations/field-registry.ts)  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Master list of ALL syncable fields in Avelero                            │
│  • Field types, constraints, relationships                                  │
│  • Table/column mappings                                                    │
│  • Single source of truth for data model                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  LAYER 3: BRAND CONFIGURATION (Database tables)                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│  • Which integrations is this brand connected to?                           │
│  • Which fields does each integration own?                                  │
│  • What source option did the brand choose? (e.g., SKU vs Barcode)          │
│  • Stored in `brand_integrations` and `integration_field_configs`           │
│  • Configurable at runtime via UI                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 What Goes Where

| Aspect | Layer | Location | Changeable |
|--------|-------|----------|------------|
| How to call Shopify API | 1 (Code) | `connectors/shopify/client.ts` | Code deploy |
| Parse material string "Cotton 80%" | 1 (Code) | `connectors/its-perfect/transforms.ts` | Code deploy |
| Available source options for productIdentifier | 1 (Code) | `connectors/shopify/schema.ts` | Code deploy |
| What fields exist in Avelero | 2 (Registry) | `field-registry.ts` | Code deploy |
| Which integration owns `description` | 3 (DB) | `integration_field_configs` | Runtime UI |
| Use `sku` or `barcode` for identifier | 3 (DB) | `integration_field_configs` | Runtime UI |
| API key for Shopify | 3 (DB) | `brand_integrations` (encrypted) | Runtime UI |

---

## 4. Field Registry Design

### 4.1 Purpose

The Field Registry is the **single source of truth** for all syncable fields in Avelero. It defines:
- What fields exist
- What tables/columns they map to
- Their data types and constraints
- Their relationships

### 4.2 File Location

```
packages/db/src/integrations/field-registry.ts
```

### 4.3 Schema Format

```typescript
export interface FieldDefinition {
  // Where this field lives in the database
  table: string;
  column?: string;  // Optional for virtual/relation fields
  
  // Data type information
  type: 'string' | 'text' | 'number' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'enum' | 'reference' | 'relation';
  
  // For enum types
  enumValues?: string[];
  
  // For reference types (FK to lookup table)
  referencesTable?: string;
  
  // For relation types (many-to-many, one-to-many)
  relationType?: 'one-to-many' | 'many-to-many';
  throughTable?: string;  // Junction table
  
  // Constraints
  required?: boolean;
  maxLength?: number;
  
  // Human-readable description
  description: string;
  
  // Category for UI grouping
  category: 'basic' | 'identifiers' | 'organization' | 'commercial' | 'environment' | 'materials' | 'supply-chain' | 'media';
}

export const fieldRegistry: Record<string, FieldDefinition> = {
  // See Section 4.4 for complete field list
};
```

### 4.4 Complete Field Registry (created)

This will be a separate file containing 60+ field definitions. A summary:

**Product Entity (~25 fields)**:
- `product.name`, `product.productIdentifier`, `product.description`
- `product.ean`, `product.gtin`, `product.upid`
- `product.price`, `product.currency`, `product.webshopUrl`
- `product.weight`, `product.weightUnit`, `product.gender`
- `product.primaryImagePath`, `product.status`, `product.salesStatus`
- `product.categoryId`, `product.seasonId`, `product.manufacturerId`

**Variant Entity (~4 fields)**:
- `variant.upid`, `variant.colorId`, `variant.sizeId`

**Environment Entity (~2 fields)**:
- `environment.carbonKgCo2e`, `environment.waterLiters`

**Relations (~4 fields)**:
- `product.materials`, `product.ecoClaims`, `product.journeySteps`, `product.tags`

**Lookup Entities (~25 fields across seasons, materials, facilities, etc.)**

---

## 5. Connector Schema Format

### 5.1 Purpose

Each connector defines:
1. What entities it can provide (product, season, material, etc.)
2. What fields it can populate
3. What source options exist for each field
4. How to transform external data to our format

### 5.2 File Structure

```
packages/jobs/src/lib/integrations/connectors/
├── index.ts              # Connector registry
├── types.ts              # Shared types
├── shopify/
│   ├── index.ts          # Exports
│   ├── schema.ts         # Field definitions
│   ├── client.ts         # API client
│   └── transforms.ts     # Data transformations
└── its-perfect/
    ├── index.ts
    ├── schema.ts
    ├── client.ts
    └── transforms.ts
```

### 5.3 Connector Schema Format

```typescript
// packages/jobs/src/lib/integrations/connectors/types.ts

export interface SourceOption {
  key: string;           // Unique identifier (e.g., 'sku', 'barcode')
  label: string;         // Human-readable label for UI
  path: string;          // JSON path in external data (e.g., 'variants[0].sku')
  computed?: boolean;    // Is this computed from other fields?
  transform?: (value: unknown) => unknown;  // Optional per-source transform
}

export interface ConnectorFieldDefinition {
  // Which of our fields this maps to
  targetField: string;   // Key from fieldRegistry (e.g., 'product.name')
  
  // Entity grouping
  entity: 'product' | 'variant' | 'season' | 'material' | 'facility' | 'environment';
  
  // Human-readable description
  description?: string;
  
  // Available source options (brand chooses one)
  sourceOptions: SourceOption[];
  
  // Default source if brand doesn't specify
  defaultSource: string;
  
  // Global transform (applied after source-specific transform)
  transform?: (value: unknown, context?: any) => unknown;
  
  // For relation fields
  isRelation?: boolean;
  relationEntity?: string;
  
  // For reference fields (creates lookup entity if missing)
  referenceEntity?: string;
}

export interface ConnectorSchema {
  // Connector metadata
  slug: string;
  name: string;
  description: string;
  authType: 'oauth' | 'api_key' | 'api_key_secret';
  
  // What entities this connector can provide
  entities: {
    [entityName: string]: {
      table: string;
      identifiedBy: string;          // Field used to match records
      parentEntity?: string;         // For child entities
      syncMode?: 'full' | 'upsert-on-reference';
    };
  };
  
  // Field definitions
  fields: {
    [fieldKey: string]: ConnectorFieldDefinition;
  };
}
```

### 5.4 Shopify Connector Schema Example

```typescript
// packages/jobs/src/lib/integrations/connectors/shopify/schema.ts

import type { ConnectorSchema } from '../types';

export const shopifySchema: ConnectorSchema = {
  slug: 'shopify',
  name: 'Shopify',
  description: 'E-commerce platform for online stores',
  authType: 'oauth',  // Shopify requires OAuth for App Store apps
  
  entities: {
    product: {
      table: 'products',
      identifiedBy: 'productIdentifier',
    },
    variant: {
      table: 'product_variants',
      identifiedBy: 'upid',
      parentEntity: 'product',
    },
  },
  
  fields: {
    'product.name': {
      targetField: 'product.name',
      entity: 'product',
      description: 'Product display name',
      sourceOptions: [
        { key: 'title', label: 'Product Title', path: 'title' },
      ],
      defaultSource: 'title',
      transform: (v) => String(v).trim().slice(0, 100),
    },
    
    'product.productIdentifier': {
      targetField: 'product.productIdentifier',
      entity: 'product',
      description: 'Unique product identifier',
      sourceOptions: [
        { key: 'handle', label: 'URL Handle', path: 'handle' },
        { key: 'sku', label: 'First Variant SKU', path: 'variants.edges[0].node.sku' },
        { key: 'barcode', label: 'First Variant Barcode', path: 'variants.edges[0].node.barcode' },
        { 
          key: 'shopify_id', 
          label: 'Shopify Product ID', 
          path: 'id',
          transform: (id) => String(id).replace('gid://shopify/Product/', ''),
        },
      ],
      defaultSource: 'handle',
    },
    
    'product.description': {
      targetField: 'product.description',
      entity: 'product',
      sourceOptions: [
        { key: 'descriptionHtml', label: 'HTML Description', path: 'descriptionHtml' },
        { key: 'description', label: 'Plain Text', path: 'description' },
      ],
      defaultSource: 'description',
      transform: (v) => v ? String(v).slice(0, 2000) : null,
    },
    
    'product.price': {
      targetField: 'product.price',
      entity: 'product',
      sourceOptions: [
        { key: 'minPrice', label: 'Minimum Price', path: 'priceRange.minVariantPrice.amount' },
        { key: 'maxPrice', label: 'Maximum Price', path: 'priceRange.maxVariantPrice.amount' },
      ],
      defaultSource: 'minPrice',
      transform: (v) => v ? parseFloat(String(v)) : null,
    },
    
    'product.currency': {
      targetField: 'product.currency',
      entity: 'product',
      sourceOptions: [
        { key: 'currencyCode', label: 'Currency Code', path: 'priceRange.minVariantPrice.currencyCode' },
      ],
      defaultSource: 'currencyCode',
    },
    
    'product.primaryImagePath': {
      targetField: 'product.primaryImagePath',
      entity: 'product',
      sourceOptions: [
        { key: 'featuredImage', label: 'Featured Image', path: 'featuredImage.url' },
        { key: 'firstImage', label: 'First Image', path: 'images.edges[0].node.url' },
      ],
      defaultSource: 'featuredImage',
    },
    
    'product.status': {
      targetField: 'product.status',
      entity: 'product',
      sourceOptions: [
        { key: 'status', label: 'Shopify Status', path: 'status' },
      ],
      defaultSource: 'status',
      transform: (v) => {
        const s = String(v).toUpperCase();
        if (s === 'ACTIVE') return 'published';
        if (s === 'DRAFT') return 'unpublished';
        if (s === 'ARCHIVED') return 'archived';
        return 'unpublished';
      },
    },
    
    'product.webshopUrl': {
      targetField: 'product.webshopUrl',
      entity: 'product',
      sourceOptions: [
        { key: 'onlineStoreUrl', label: 'Online Store URL', path: 'onlineStoreUrl' },
      ],
      defaultSource: 'onlineStoreUrl',
    },
  },
};
```

### 5.5 It's Perfect Connector Schema Example

```typescript
// packages/jobs/src/lib/integrations/connectors/its-perfect/schema.ts

import type { ConnectorSchema } from '../types';

export const itsPerfectSchema: ConnectorSchema = {
  slug: 'its-perfect',
  name: "It's Perfect",
  description: 'ERP system for fashion & lifestyle brands',
  authType: 'api_key_secret',
  
  entities: {
    product: {
      table: 'products',
      identifiedBy: 'productIdentifier',
    },
    season: {
      table: 'brand_seasons',
      identifiedBy: 'name',
      syncMode: 'upsert-on-reference',  // Create if product references it
    },
    material: {
      table: 'brand_materials',
      identifiedBy: 'name',
      syncMode: 'upsert-on-reference',
    },
    facility: {
      table: 'brand_facilities',
      identifiedBy: 'displayName',
      syncMode: 'upsert-on-reference',
    },
  },
  
  fields: {
    'product.productIdentifier': {
      targetField: 'product.productIdentifier',
      entity: 'product',
      sourceOptions: [
        { key: 'styleNumber', label: 'Style Number', path: 'style.number' },
        { key: 'articleNumber', label: 'Article Number', path: 'article.number' },
        { key: 'ean', label: 'EAN Code', path: 'ean' },
        { key: 'gtin', label: 'GTIN', path: 'gtin' },
      ],
      defaultSource: 'styleNumber',
    },
    
    'product.name': {
      targetField: 'product.name',
      entity: 'product',
      sourceOptions: [
        { key: 'styleName', label: 'Style Name', path: 'style.name' },
        { key: 'articleName', label: 'Article Name', path: 'article.name' },
      ],
      defaultSource: 'styleName',
    },
    
    'product.seasonId': {
      targetField: 'product.seasonId',
      entity: 'product',
      referenceEntity: 'season',  // Will create season if doesn't exist
      sourceOptions: [
        { key: 'deliverySeason', label: 'Delivery Season', path: 'delivery.season' },
        { key: 'collectionSeason', label: 'Collection Season', path: 'collection.season' },
      ],
      defaultSource: 'deliverySeason',
    },
    
    'season.name': {
      targetField: 'season.name',
      entity: 'season',
      sourceOptions: [
        { key: 'label', label: 'Season Label', path: 'label' },
      ],
      defaultSource: 'label',
    },
    
    'season.startDate': {
      targetField: 'season.startDate',
      entity: 'season',
      sourceOptions: [
        { key: 'deliveryStart', label: 'Delivery Start', path: 'delivery.startDate' },
      ],
      defaultSource: 'deliveryStart',
      transform: (v) => v ? new Date(String(v)).toISOString().split('T')[0] : null,
    },
    
    'season.endDate': {
      targetField: 'season.endDate',
      entity: 'season',
      sourceOptions: [
        { key: 'deliveryEnd', label: 'Delivery End', path: 'delivery.endDate' },
      ],
      defaultSource: 'deliveryEnd',
      transform: (v) => v ? new Date(String(v)).toISOString().split('T')[0] : null,
    },
    
    'product.materials': {
      targetField: 'product.materials',
      entity: 'product',
      isRelation: true,
      relationEntity: 'material',
      sourceOptions: [
        { key: 'composition', label: 'Material Composition', path: 'composition' },
        { key: 'bomMaterials', label: 'Bill of Materials', path: 'bom.materials' },
      ],
      defaultSource: 'composition',
      // Transform handles complex parsing - see Section 6
    },
    
    'material.name': {
      targetField: 'material.name',
      entity: 'material',
      sourceOptions: [
        { key: 'name', label: 'Material Name', path: 'name' },
      ],
      defaultSource: 'name',
    },
    
    'material.countryOfOrigin': {
      targetField: 'material.countryOfOrigin',
      entity: 'material',
      sourceOptions: [
        { key: 'origin', label: 'Country of Origin', path: 'origin_country' },
      ],
      defaultSource: 'origin',
    },
    
    'material.recyclable': {
      targetField: 'material.recyclable',
      entity: 'material',
      sourceOptions: [
        { key: 'recycled', label: 'Is Recycled', path: 'is_recycled' },
      ],
      defaultSource: 'recycled',
      transform: (v) => Boolean(v),
    },
    
    'environment.carbonKgCo2e': {
      targetField: 'environment.carbonKgCo2e',
      entity: 'environment',
      sourceOptions: [
        { key: 'lcaCarbon', label: 'LCA Carbon Footprint', path: 'lca.carbon_kg_co2e' },
        { key: 'calculatedCarbon', label: 'Calculated Carbon', path: 'sustainability.carbon' },
      ],
      defaultSource: 'lcaCarbon',
      transform: (v) => v ? parseFloat(String(v)) : null,
    },
    
    'environment.waterLiters': {
      targetField: 'environment.waterLiters',
      entity: 'environment',
      sourceOptions: [
        { key: 'lcaWater', label: 'LCA Water Usage', path: 'lca.water_liters' },
      ],
      defaultSource: 'lcaWater',
      transform: (v) => v ? parseFloat(String(v)) : null,
    },
    
    'product.journeySteps': {
      targetField: 'product.journeySteps',
      entity: 'product',
      isRelation: true,
      relationEntity: 'facility',
      sourceOptions: [
        { key: 'supplyChain', label: 'Supply Chain', path: 'supply_chain' },
        { key: 'productionSteps', label: 'Production Steps', path: 'production.steps' },
      ],
      defaultSource: 'supplyChain',
      // Transform handles complex parsing - see Section 6
    },
  },
};
```

---

## 6. ETL Process Patterns

### 6.1 Overview

The ETL (Extract, Transform, Load) process handles:
1. **Extract**: Fetch data from external API
2. **Transform**: Apply transforms, parse complex fields, handle relationships
3. **Load**: Upsert to database tables

### 6.2 Complex Transform Examples

#### 6.2.1 Splitting Composite Material Strings

**Problem**: It's Perfect stores materials as: `"Cotton 80%; Polyester 20%"` or `"Cotton:80|Polyester:20"`

**Solution**: Create integration-specific transform functions:

```typescript
// packages/jobs/src/lib/integrations/connectors/its-perfect/transforms.ts

export interface ParsedMaterial {
  name: string;
  percentage: number;
  countryOfOrigin?: string;
  recyclable?: boolean;
  externalId?: string;  // External system ID (if available, else uses name)
}

/**
 * Parse material composition from various formats
 * 
 * Supported formats:
 * - "Cotton 80%; Polyester 20%"
 * - "Cotton:80|Polyester:20"
 * - "80% Cotton, 20% Polyester"
 * - Array of { material_name, percentage }
 */
export function parseMaterialComposition(input: unknown): ParsedMaterial[] {
  // Handle array format (already structured)
  if (Array.isArray(input)) {
    return input.map(item => ({
      name: item.material_name || item.name || '',
      percentage: parseFloat(item.percentage || item.share || '0'),
      countryOfOrigin: item.origin_country || item.country || undefined,
      recyclable: Boolean(item.is_recycled || item.recycled),
    })).filter(m => m.name && !isNaN(m.percentage));
  }
  
  // Handle string formats
  if (typeof input !== 'string' || !input.trim()) {
    return [];
  }
  
  const str = input.trim();
  const results: ParsedMaterial[] = [];
  
  // Try different formats
  
  // Format 1: "Cotton 80%; Polyester 20%"
  const semicolonParts = str.split(';').map(s => s.trim()).filter(Boolean);
  if (semicolonParts.length > 1 || str.includes('%')) {
    for (const part of semicolonParts) {
      const match = part.match(/^(.+?)\s*(\d+(?:\.\d+)?)\s*%?$/);
      if (match) {
        results.push({
          name: match[1].trim(),
          percentage: parseFloat(match[2]),
        });
      } else {
        // Try reverse: "80% Cotton"
        const reverseMatch = part.match(/^(\d+(?:\.\d+)?)\s*%?\s*(.+)$/);
        if (reverseMatch) {
          results.push({
            name: reverseMatch[2].trim(),
            percentage: parseFloat(reverseMatch[1]),
          });
        }
      }
    }
  }
  
  // Format 2: "Cotton:80|Polyester:20"
  if (results.length === 0 && str.includes('|')) {
    const pipeParts = str.split('|').map(s => s.trim()).filter(Boolean);
    for (const part of pipeParts) {
      const [name, pct] = part.split(':').map(s => s.trim());
      if (name && pct) {
        results.push({
          name,
          percentage: parseFloat(pct),
        });
      }
    }
  }
  
  // Format 3: "Cotton, Polyester" (no percentages - split evenly)
  if (results.length === 0 && str.includes(',')) {
    const commaParts = str.split(',').map(s => s.trim()).filter(Boolean);
    if (commaParts.length > 0) {
      const evenPercentage = 100 / commaParts.length;
      for (const name of commaParts) {
        results.push({
          name,
          percentage: evenPercentage,
        });
      }
    }
  }
  
  return results;
}

/**
 * Parse supply chain / journey steps from various formats
 * 
 * Supported formats:
 * - Array of { step_name, supplier_name, country_code }
 * - "Spinning@SupplierA|Weaving@SupplierB"
 */
export interface ParsedJourneyStep {
  sortIndex: number;
  stepType: string;
  facility: {
    externalId?: string;  // External system ID for the facility
    displayName: string;
    countryCode?: string;
    city?: string;
  };
}

export function parseJourneySteps(input: unknown): ParsedJourneyStep[] {
  if (Array.isArray(input)) {
    return input.map((item, index) => ({
      sortIndex: item.order ?? item.sort_index ?? index,
      stepType: item.process_type || item.step_type || item.step_name || 'unknown',
      facility: {
        displayName: item.supplier_name || item.facility_name || 'Unknown Facility',
        countryCode: item.country_code || item.country,
        city: item.city,
      },
    }));
  }
  
  if (typeof input !== 'string' || !input.trim()) {
    return [];
  }
  
  // Format: "Spinning@SupplierA|Weaving@SupplierB"
  const parts = input.split('|').map(s => s.trim()).filter(Boolean);
  return parts.map((part, index) => {
    const [stepType, facilityName] = part.split('@').map(s => s.trim());
    return {
      sortIndex: index,
      stepType: stepType || 'unknown',
      facility: {
        displayName: facilityName || 'Unknown Facility',
      },
    };
  });
}
```

### 6.3 Multi-Table Entity Handling

#### 6.3.1 Entity Matching Strategy: Link-First, Name-Fallback

All reference entities use a consistent matching strategy that allows brands to rename entities in Avelero while maintaining sync integrity:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ENTITY MATCHING DECISION TREE                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                ┌───────────────────────────────┐
                │  1. Check integration link    │
                │  (brandIntegrationId +        │
                │   externalId)                 │
                └───────────────────────────────┘
                        │           │
                     FOUND       NOT FOUND
                        │           │
                        ▼           ▼
              ┌─────────────┐   ┌───────────────────────────┐
              │ Use linked  │   │ 2. Fallback: find by name │
              │ entity ID   │   │ (brandId + name/identifier)│
              └─────────────┘   └───────────────────────────┘
                                        │           │
                                     FOUND       NOT FOUND
                                        │           │
                                        ▼           ▼
                              ┌─────────────────┐   ┌─────────────────┐
                              │ Create link to  │   │ Create new      │
                              │ existing entity │   │ entity + link   │
                              └─────────────────┘   └─────────────────┘
```

**Why this approach?**
- Brands can rename "CO-ORG-100" from the ERP to "Organic Cotton" for public display
- Future syncs will still match via the link, not the (changed) name
- First sync uses name matching to avoid duplicates if entity already exists

#### 6.3.2 Reference Entity Pattern (Generic)

```typescript
// packages/jobs/src/lib/integrations/sync-engine.ts

type LinkableEntityType = 
  | 'material' | 'facility' | 'manufacturer' | 'season'
  | 'color' | 'size' | 'tag' | 'ecoClaim' | 'certification';

const entityConfig: Record<LinkableEntityType, {
  table: string;
  linkTable: string;
  identifierField: string;
  idColumn: string;
}> = {
  material: {
    table: 'brand_materials',
    linkTable: 'integration_material_links',
    identifierField: 'name',
    idColumn: 'material_id',
  },
  facility: {
    table: 'brand_facilities',
    linkTable: 'integration_facility_links',
    identifierField: 'displayName',
    idColumn: 'facility_id',
  },
  manufacturer: {
    table: 'brand_manufacturers',
    linkTable: 'integration_manufacturer_links',
    identifierField: 'name',
    idColumn: 'manufacturer_id',
  },
  season: {
    table: 'brand_seasons',
    linkTable: 'integration_season_links',
    identifierField: 'name',
    idColumn: 'season_id',
  },
  color: {
    table: 'brand_colors',
    linkTable: 'integration_color_links',
    identifierField: 'name',
    idColumn: 'color_id',
  },
  size: {
    table: 'brand_sizes',
    linkTable: 'integration_size_links',
    identifierField: 'name',
    idColumn: 'size_id',
  },
  tag: {
    table: 'brand_tags',
    linkTable: 'integration_tag_links',
    identifierField: 'name',
    idColumn: 'tag_id',
  },
  ecoClaim: {
    table: 'brand_eco_claims',
    linkTable: 'integration_eco_claim_links',
    identifierField: 'claim',
    idColumn: 'eco_claim_id',
  },
  certification: {
    table: 'brand_certifications',
    linkTable: 'integration_certification_links',
    identifierField: 'title',
    idColumn: 'certification_id',
  },
};

async function resolveOrCreateEntity(
  ctx: SyncContext,
  entityType: LinkableEntityType,
  externalId: string,
  externalName: string,
  entityData: Record<string, unknown>,
): Promise<string> {
  const config = entityConfig[entityType];
  
  // 1. Check for existing link (link-first)
  const existingLink = await findEntityLink(
    ctx.db,
    config.linkTable,
    ctx.brandIntegrationId,
    externalId,
  );
  
  if (existingLink) {
    // Already linked - use existing entity
    return existingLink.entityId;
  }
  
  // 2. Fallback: try to find by identifier field (name-fallback)
  const identifierValue = entityData[config.identifierField] as string;
  if (identifierValue) {
    const existing = await findEntityByIdentifier(
      ctx.db,
      ctx.brandId,
      entityType,
      identifierValue,
    );
    
    if (existing) {
      // Found by name - create link for future syncs
      await createEntityLink(ctx.db, config.linkTable, {
        brandIntegrationId: ctx.brandIntegrationId,
        entityId: existing.id,
        externalId,
        externalName,
      });
      return existing.id;
    }
  }
  
  // 3. Not found - create new entity + link
  const created = await createEntity(ctx.db, ctx.brandId, entityType, entityData);
  await createEntityLink(ctx.db, config.linkTable, {
    brandIntegrationId: ctx.brandIntegrationId,
    entityId: created.id,
    externalId,
    externalName,
  });
  
  return created.id;
}
```

#### 6.3.3 Relation Entity Pattern (Materials Example)

For many-to-many relations like product_materials, we use the same link-first, name-fallback strategy:

```typescript
async function handleMaterialsRelation(
  ctx: SyncContext,
  productId: string,
  materialsData: ParsedMaterial[],
): Promise<void> {
  const materialIds: Array<{ brandMaterialId: string; percentage: number }> = [];
  
  for (const mat of materialsData) {
    // Use the generic resolveOrCreateEntity with link-first, name-fallback
    const materialId = await resolveOrCreateEntity(
      ctx,
      'material',
      mat.externalId || mat.name,  // Use external ID if available, else name
      mat.name,                     // Store original name for reference
      {
        name: mat.name,
        countryOfOrigin: mat.countryOfOrigin,
        recyclable: mat.recyclable,
      },
    );
    
    materialIds.push({
      brandMaterialId: materialId,
      percentage: mat.percentage,
    });
  }
  
  // Replace all materials for this product
  await upsertProductMaterials(ctx.db, productId, materialIds);
}
```

**Note on externalId for materials:**
- Some ERPs provide unique material IDs (e.g., `"MAT-001"`)
- Others only provide names (e.g., `"Cotton"`)
- When no external ID is available, we use the name as the external ID
- This means name-based matching and link-based matching will be equivalent on first sync
- But after first sync, the link is established and name changes in Avelero won't break the sync

### 6.4 Sync Engine Core

```typescript
// packages/jobs/src/lib/integrations/sync-engine.ts

export async function syncProducts(ctx: SyncContext): Promise<SyncResult> {
  const connector = getConnector(ctx.integrationSlug);
  const schema = connector.schema;
  
  // Build effective field mappings
  const effectiveFields = buildEffectiveFieldMappings(schema, ctx.fieldConfigs);
  
  let created = 0, updated = 0, skipped = 0;
  const errors: Array<{ externalId: string; message: string }> = [];
  
  // Fetch and process products
  for await (const batch of connector.fetchProducts(ctx.credentials, ctx.config)) {
    for (const external of batch) {
      try {
        const result = await processProduct(ctx, external, effectiveFields, schema);
        if (result === 'created') created++;
        else if (result === 'updated') updated++;
        else skipped++;
      } catch (error) {
        errors.push({
          externalId: external.externalId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  
  return {
    success: errors.length === 0,
    productsProcessed: created + updated + skipped,
    created,
    updated,
    skipped,
    errors,
  };
}

async function processProduct(
  ctx: SyncContext,
  external: FetchedProduct,
  effectiveFields: Map<string, EffectiveFieldConfig>,
  schema: ConnectorSchema,
): Promise<'created' | 'updated' | 'skipped'> {
  
  // 1. Extract values for each entity
  const extracted = extractValues(external, effectiveFields);
  
  // 2. Handle reference entities (seasons, etc.)
  if (extracted.product.seasonId) {
    const seasonId = await handleReferenceEntity(ctx, 'season', external.data, effectiveFields);
    extracted.product.seasonId = seasonId;
  }
  
  // 3. Find or create product
  const existingLink = await findProductLink(ctx.db, ctx.brandIntegrationId, external.externalId);
  
  let productId: string;
  let action: 'created' | 'updated' | 'skipped';
  
  if (existingLink) {
    // Update existing product (only owned fields)
    const updates = filterOwnedFields(extracted.product, effectiveFields);
    
    if (Object.keys(updates).length === 0) {
      return 'skipped';
    }
    
    // Apply null protection - don't update with null values
    const safeUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== null && v !== undefined)
    );
    
    if (Object.keys(safeUpdates).length === 0) {
      return 'skipped';
    }
    
    await updateProduct(ctx.db, ctx.brandId, {
      id: existingLink.productId,
      ...safeUpdates,
    });
    
    productId = existingLink.productId;
    action = 'updated';
  } else {
    // Try to find by productIdentifier
    const existing = await findProductByIdentifier(ctx.db, ctx.brandId, extracted.product.productIdentifier);
    
    if (existing) {
      // Link and update
      await createProductLink(ctx.db, ctx.brandIntegrationId, existing.id, external.externalId);
      await updateProduct(ctx.db, ctx.brandId, {
        id: existing.id,
        ...filterOwnedFields(extracted.product, effectiveFields),
      });
      productId = existing.id;
      action = 'updated';
    } else {
      // Create new product
      const created = await createProduct(ctx.db, ctx.brandId, extracted.product);
      await createProductLink(ctx.db, ctx.brandIntegrationId, created.id, external.externalId);
      productId = created.id;
      action = 'created';
    }
  }
  
  // 4. Handle relation entities (materials, journey steps, etc.)
  if (extracted.materials && effectiveFields.has('product.materials')) {
    await handleMaterialsRelation(ctx, productId, extracted.materials);
  }
  
  if (extracted.journeySteps && effectiveFields.has('product.journeySteps')) {
    await handleJourneyStepsRelation(ctx, productId, extracted.journeySteps);
  }
  
  // 5. Handle environment data
  if (extracted.environment && Object.keys(extracted.environment).length > 0) {
    await upsertProductEnvironment(ctx.db, productId, extracted.environment);
  }
  
  return action;
}
```

---

## 7. Database Schema Changes

### 7.1 New Tables Summary

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `integrations` | Master list of available integration types | slug, name, authType, availableFields |
| `brand_integrations` | Brand's connections to integrations | brandId, integrationId, credentials, syncSettings |
| `integration_field_configs` | Field ownership configuration per brand | brandIntegrationId, fieldKey, isEnabled, selectedSource |
| `integration_sync_jobs` | Sync job execution history | brandIntegrationId, status, stats |
| `integration_product_links` | Maps our products to external IDs | brandIntegrationId, productId, externalId |
| `integration_material_links` | Maps materials to external IDs | brandIntegrationId, materialId, externalId |
| `integration_facility_links` | Maps facilities to external IDs | brandIntegrationId, facilityId, externalId |
| `integration_manufacturer_links` | Maps manufacturers to external IDs | brandIntegrationId, manufacturerId, externalId |
| `integration_season_links` | Maps seasons to external IDs | brandIntegrationId, seasonId, externalId |
| `integration_color_links` | Maps colors to external IDs | brandIntegrationId, colorId, externalId |
| `integration_size_links` | Maps sizes to external IDs | brandIntegrationId, sizeId, externalId |
| `integration_tag_links` | Maps tags to external IDs | brandIntegrationId, tagId, externalId |
| `integration_eco_claim_links` | Maps eco claims to external IDs | brandIntegrationId, ecoClaimId, externalId |
| `integration_certification_links` | Maps certifications to external IDs | brandIntegrationId, certificationId, externalId |

### 7.2 Detailed Schema Definitions

#### 7.2.1 `integrations` Table

```typescript
// packages/db/src/schema/integrations/integrations.ts

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    slug: text("slug").notNull().unique(),           // 'shopify', 'its-perfect'
    name: text("name").notNull(),                    // 'Shopify'
    description: text("description"),
    iconUrl: text("icon_url"),
    authType: text("auth_type").notNull(),           // 'oauth', 'api_key', 'api_key_secret'
    configSchema: jsonb("config_schema"),            // JSON schema for required config
    availableFields: jsonb("available_fields").notNull().default([]),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Global read access for authenticated users
    pgPolicy("integrations_select_for_authenticated", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`true`,
    }),
    // Only system can modify
    pgPolicy("integrations_modify_service_only", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
```

#### 7.2.2 `brand_integrations` Table

```typescript
// packages/db/src/schema/integrations/brand-integrations.ts

export const brandIntegrations = pgTable(
  "brand_integrations",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    integrationId: uuid("integration_id")
      .references(() => integrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    
    // Connection status
    status: text("status").notNull().default("pending"),
    // 'pending' | 'connected' | 'error' | 'disabled'
    
    // Encrypted credentials
    credentialsEncrypted: bytea("credentials_encrypted"),
    credentialsIv: bytea("credentials_iv"),
    
    // Integration-specific configuration
    config: jsonb("config"),
    
    // Sync settings
    syncEnabled: boolean("sync_enabled").default(true).notNull(),
    syncIntervalHours: integer("sync_interval_hours").default(6).notNull(),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true, mode: "string" }),
    lastSyncStatus: text("last_sync_status"),  // 'success' | 'partial' | 'error'
    lastSyncError: text("last_sync_error"),
    nextSyncAt: timestamp("next_sync_at", { withTimezone: true, mode: "string" }),
    
    // Metadata
    connectedAt: timestamp("connected_at", { withTimezone: true, mode: "string" }),
    connectedBy: uuid("connected_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("brand_integrations_brand_integration_unq").on(
      table.brandId,
      table.integrationId,
    ),
    index("idx_brand_integrations_brand_id").on(table.brandId),
    index("idx_brand_integrations_next_sync").on(table.nextSyncAt),
    // RLS policies
    pgPolicy("brand_integrations_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_integrations_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_integrations_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_integrations_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);
```

#### 7.2.3 `integration_field_configs` Table

```typescript
// packages/db/src/schema/integrations/integration-field-configs.ts

export const integrationFieldConfigs = pgTable(
  "integration_field_configs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    
    // Field identification (matches keys in connector schema)
    fieldKey: text("field_key").notNull(),  // e.g., 'product.name', 'product.materials'
    
    // Ownership
    isEnabled: boolean("is_enabled").default(false).notNull(),
    
    // Source selection (which source option from connector schema)
    selectedSource: text("selected_source"),  // NULL = use connector default
    
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_field_configs_integration_field_unq").on(
      table.brandIntegrationId,
      table.fieldKey,
    ),
    index("idx_integration_field_configs_integration").on(table.brandIntegrationId),
    // RLS via brand_integrations
    pgPolicy("integration_field_configs_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_field_configs_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_field_configs_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_field_configs_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
  ],
);
```

#### 7.2.4 `integration_sync_jobs` Table

```typescript
// packages/db/src/schema/integrations/integration-sync-jobs.ts

export const integrationSyncJobs = pgTable(
  "integration_sync_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    
    status: text("status").notNull().default("pending"),
    // 'pending' | 'running' | 'completed' | 'failed'
    
    triggerType: text("trigger_type").notNull(),
    // 'scheduled' | 'manual' | 'webhook'
    
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "string" }),
    
    // Stats
    productsFetched: integer("products_fetched").default(0).notNull(),
    productsCreated: integer("products_created").default(0).notNull(),
    productsUpdated: integer("products_updated").default(0).notNull(),
    productsSkipped: integer("products_skipped").default(0).notNull(),
    errorsCount: integer("errors_count").default(0).notNull(),
    
    // Details
    summary: jsonb("summary"),
    errorLog: jsonb("error_log"),
    
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_integration_sync_jobs_integration").on(table.brandIntegrationId),
    index("idx_integration_sync_jobs_created").on(table.createdAt),
    // RLS via brand_integrations
    pgPolicy("integration_sync_jobs_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_sync_jobs_insert_by_service", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("integration_sync_jobs_update_by_service", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
```

#### 7.2.5 `integration_product_links` Table

```typescript
// packages/db/src/schema/integrations/integration-product-links.ts

export const integrationProductLinks = pgTable(
  "integration_product_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    
    // External system references
    externalId: text("external_id").notNull(),
    externalVariantId: text("external_variant_id"),
    externalUrl: text("external_url"),
    
    // Sync metadata
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: "string" }),
    lastSyncedHash: text("last_synced_hash"),  // For change detection
    
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_product_links_integration_external_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    index("idx_integration_product_links_product").on(table.productId),
    index("idx_integration_product_links_integration").on(table.brandIntegrationId),
    // RLS via brand_integrations
    pgPolicy("integration_product_links_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_product_links_modify_by_service", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
```

#### 7.2.6 Entity Link Tables (Reference Entities)

These tables link brand-scoped reference entities (materials, facilities, etc.) to their external system identifiers. This allows brands to rename entities in Avelero while maintaining sync integrity with external systems.

**Matching Strategy**: Link-first, name-fallback
1. Check if a link exists for this `(brandIntegrationId, externalId)` → use linked entity
2. If no link, try to find entity by name/identifier within the brand
3. If found by name, create a link for future syncs
4. If not found, create new entity + create link

```typescript
// packages/db/src/schema/integrations/integration-entity-links.ts

// =============================================================================
// MATERIAL LINKS
// =============================================================================

export const integrationMaterialLinks = pgTable(
  "integration_material_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    materialId: uuid("material_id")
      .references(() => brandMaterials.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),  // Original name from external system
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_material_links_ext_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    index("idx_integration_material_links_material").on(table.materialId),
    pgPolicy("integration_material_links_select", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_material_links_modify_by_service", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);

// =============================================================================
// FACILITY LINKS
// =============================================================================

export const integrationFacilityLinks = pgTable(
  "integration_facility_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    facilityId: uuid("facility_id")
      .references(() => brandFacilities.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_facility_links_ext_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    index("idx_integration_facility_links_facility").on(table.facilityId),
    pgPolicy("integration_facility_links_select", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_facility_links_modify_by_service", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);

// =============================================================================
// MANUFACTURER LINKS
// =============================================================================

export const integrationManufacturerLinks = pgTable(
  "integration_manufacturer_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    manufacturerId: uuid("manufacturer_id")
      .references(() => brandManufacturers.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_manufacturer_links_ext_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    index("idx_integration_manufacturer_links_manufacturer").on(table.manufacturerId),
    pgPolicy("integration_manufacturer_links_select", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_manufacturer_links_modify_by_service", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);

// =============================================================================
// SEASON LINKS
// =============================================================================

export const integrationSeasonLinks = pgTable(
  "integration_season_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    seasonId: uuid("season_id")
      .references(() => brandSeasons.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_season_links_ext_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    index("idx_integration_season_links_season").on(table.seasonId),
    pgPolicy("integration_season_links_select", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_season_links_modify_by_service", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);

// =============================================================================
// COLOR LINKS
// =============================================================================

export const integrationColorLinks = pgTable(
  "integration_color_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    colorId: uuid("color_id")
      .references(() => brandColors.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_color_links_ext_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    index("idx_integration_color_links_color").on(table.colorId),
    pgPolicy("integration_color_links_select", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_color_links_modify_by_service", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);

// =============================================================================
// SIZE LINKS
// =============================================================================

export const integrationSizeLinks = pgTable(
  "integration_size_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    sizeId: uuid("size_id")
      .references(() => brandSizes.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_size_links_ext_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    index("idx_integration_size_links_size").on(table.sizeId),
    pgPolicy("integration_size_links_select", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_size_links_modify_by_service", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);

// =============================================================================
// TAG LINKS
// =============================================================================

export const integrationTagLinks = pgTable(
  "integration_tag_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    tagId: uuid("tag_id")
      .references(() => brandTags.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_tag_links_ext_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    index("idx_integration_tag_links_tag").on(table.tagId),
    pgPolicy("integration_tag_links_select", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_tag_links_modify_by_service", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);

// =============================================================================
// ECO CLAIM LINKS
// =============================================================================

export const integrationEcoClaimLinks = pgTable(
  "integration_eco_claim_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    ecoClaimId: uuid("eco_claim_id")
      .references(() => brandEcoClaims.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_eco_claim_links_ext_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    index("idx_integration_eco_claim_links_eco_claim").on(table.ecoClaimId),
    pgPolicy("integration_eco_claim_links_select", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_eco_claim_links_modify_by_service", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);

// =============================================================================
// CERTIFICATION LINKS
// =============================================================================

export const integrationCertificationLinks = pgTable(
  "integration_certification_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    certificationId: uuid("certification_id")
      .references(() => brandCertifications.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    externalId: text("external_id").notNull(),
    externalName: text("external_name"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("integration_certification_links_ext_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    index("idx_integration_certification_links_certification").on(table.certificationId),
    pgPolicy("integration_certification_links_select", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_certification_links_modify_by_service", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
```

---

## 8. New File Structure

### 8.1 Complete File Tree

```
packages/db/src/
├── schema/
│   └── integrations/              # NEW DIRECTORY
│       ├── index.ts               # NEW: Export aggregator
│       ├── integrations.ts        # NEW: Master integration types
│       ├── brand-integrations.ts  # NEW: Brand connections
│       ├── integration-field-configs.ts  # NEW: Field ownership
│       ├── integration-sync-jobs.ts      # NEW: Sync history
│       ├── integration-product-links.ts  # NEW: Product external ID mapping
│       └── integration-entity-links.ts   # NEW: Reference entity links (9 tables)
├── integrations/                  # NEW DIRECTORY
│   └── field-registry.ts          # NEW: Master field definitions
├── queries/
│   ├── index.ts                   # MODIFY: Add integration exports
│   └── integrations.ts            # NEW: Integration queries
└── utils/
    ├── index.ts                   # MODIFY: Add encryption export
    └── encryption.ts              # NEW: Credential encryption

packages/jobs/src/
├── lib/
│   └── integrations/              # NEW DIRECTORY
│       ├── index.ts               # NEW: Main exports
│       ├── types.ts               # NEW: Shared types
│       ├── registry.ts            # NEW: Connector registry
│       ├── sync-engine.ts         # NEW: Core sync logic
│       └── connectors/
│           ├── index.ts           # NEW: Connector exports
│           ├── types.ts           # NEW: Connector interface types
│           ├── shopify/
│           │   ├── index.ts       # NEW: Shopify exports
│           │   ├── schema.ts      # NEW: Shopify field schema
│           │   ├── client.ts      # NEW: Shopify API client
│           │   └── transforms.ts  # NEW: Shopify transforms
│           └── its-perfect/
│               ├── index.ts       # NEW: It's Perfect exports
│               ├── schema.ts      # NEW: It's Perfect field schema
│               ├── client.ts      # NEW: It's Perfect API client
│               └── transforms.ts  # NEW: It's Perfect transforms
└── trigger/
    ├── index.ts                   # MODIFY: Add sync task exports
    ├── integration-sync.ts        # NEW: Main sync task
    └── integration-sync-scheduler.ts  # NEW: Scheduled sync task

apps/api/src/
├── trpc/routers/
│   ├── _app.ts                    # MODIFY: Add integrations router
│   └── integrations/              # NEW DIRECTORY
│       ├── index.ts               # NEW: Main router
│       ├── connections.ts         # NEW: Connect/disconnect
│       ├── mappings.ts            # NEW: Field mappings
│       └── sync.ts                # NEW: Sync operations
├── routes/
│   └── integrations/              # NEW DIRECTORY (Raw HTTP for OAuth)
│       ├── index.ts               # NEW: Route aggregator
│       └── shopify.ts             # NEW: Shopify OAuth endpoints
├── schemas/
│   └── integrations.ts            # NEW: Zod schemas
└── index.ts                       # MODIFY: Mount OAuth routes

apps/app/src/
├── app/(dashboard)/(main)/(sidebar)/settings/
│   └── integrations/              # NEW DIRECTORY
│       ├── page.tsx               # NEW: Integration list
│       ├── layout.tsx             # NEW: Layout
│       └── [slug]/
│           ├── page.tsx           # NEW: Integration detail
│           └── layout.tsx         # NEW: Detail layout
└── components/integrations/       # NEW DIRECTORY
    ├── integration-card.tsx       # NEW: Integration card
    ├── connect-modal.tsx          # NEW: Connection modal
    ├── field-mapping-table.tsx    # NEW: Field ownership UI
    ├── sync-status-badge.tsx      # NEW: Status indicator
    └── sync-history-table.tsx     # NEW: Sync history
```

### 8.2 Files Summary

| Category | New Files | Modified Files |
|----------|-----------|----------------|
| Database Schema | 7 | 1 (index.ts) |
| Database Utils | 2 | 1 (index.ts) |
| Database Queries | 1 | 1 (index.ts) |
| Jobs/Connectors | 14 | 0 |
| Jobs/Tasks | 2 | 1 (index.ts) |
| API Routers | 4 | 1 (_app.ts) |
| API Schemas | 1 | 0 |
| App Pages | 4 | 0 |
| App Components | 5 | 0 |
| **Total** | **40** | **5** |

**Database Tables**: 14 new tables total
- 5 core integration tables (integrations, brand_integrations, field_configs, sync_jobs, product_links)
- 9 entity link tables (material, facility, manufacturer, season, color, size, tag, eco_claim, certification)

---

## 9. Shopify OAuth Flow (Required for App Store)

> **Important**: Shopify requires OAuth for public apps submitted to the App Store. This section details the complete OAuth implementation that must be added to your existing plan.

### 9.1 What Shopify Reviews

Shopify doesn't review your code. They verify:
1. **OAuth flow works** - They click "Install" and verify the handshake completes
2. **App listing** - Name, description, icon, screenshots, privacy policy URL
3. **Basic functionality** - The app does what it claims
4. **Required scopes** - You only request scopes you actually need

### 9.2 OAuth Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────────┐
│                         SHOPIFY OAUTH INSTALLATION FLOW                         │
└────────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────┐                    ┌─────────────────┐                    ┌──────────────┐
  │   Shopify   │                    │  Avelero API    │                    │   Avelero    │
  │   Admin     │                    │  (apps/api)     │                    │   Database   │
  └──────┬──────┘                    └────────┬────────┘                    └──────┬───────┘
         │                                    │                                    │
         │  1. User clicks "Install"          │                                    │
         │ ──────────────────────────────────►│                                    │
         │    GET /api/integrations/shopify/  │                                    │
         │    install?shop=mystore.myshopify.com                                   │
         │                                    │                                    │
         │                                    │  2. Generate state, store in DB    │
         │                                    │ ──────────────────────────────────►│
         │                                    │    oauth_states: { state, brandId, │
         │                                    │    expiresAt }                     │
         │                                    │                                    │
         │  3. Redirect to Shopify OAuth      │                                    │
         │ ◄──────────────────────────────────│                                    │
         │    https://{shop}/admin/oauth/     │                                    │
         │    authorize?client_id=...&        │                                    │
         │    scope=read_products&            │                                    │
         │    redirect_uri=...&state=...      │                                    │
         │                                    │                                    │
  ┌──────┴──────┐                             │                                    │
  │   Shopify   │  4. User approves scopes    │                                    │
  │   OAuth     │                             │                                    │
  └──────┬──────┘                             │                                    │
         │                                    │                                    │
         │  5. Redirect with code             │                                    │
         │ ──────────────────────────────────►│                                    │
         │    GET /api/integrations/shopify/  │                                    │
         │    callback?code=...&shop=...&     │                                    │
         │    state=...&hmac=...              │                                    │
         │                                    │                                    │
         │                                    │  6. Verify state, HMAC             │
         │                                    │ ──────────────────────────────────►│
         │                                    │    Check state matches             │
         │                                    │                                    │
         │                                    │  7. Exchange code for token        │
         │                                    │ ◄──────────────────────────────────│
         │                                    │    POST https://{shop}/admin/      │
         │                                    │    oauth/access_token              │
         │                                    │                                    │
         │                                    │  8. Store encrypted credentials    │
         │                                    │ ──────────────────────────────────►│
         │                                    │    brand_integrations: {           │
         │                                    │      shopDomain, accessToken }     │
         │                                    │                                    │
         │  9. Redirect to success page       │                                    │
         │ ◄──────────────────────────────────│                                    │
         │    /settings/integrations/shopify  │                                    │
         │    ?success=true                   │                                    │
         │                                    │                                    │
```

### 9.3 Database Changes for OAuth

#### 9.3.1 `oauth_states` Table (NEW)

Add this table to store pending OAuth states for CSRF protection:

```typescript
// packages/db/src/schema/integrations/oauth-states.ts

export const oauthStates = pgTable(
  "oauth_states",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    state: text("state").notNull().unique(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    integrationSlug: text("integration_slug").notNull(),  // 'shopify', 'its-perfect'
    
    // Store shop domain for Shopify OAuth
    shopDomain: text("shop_domain"),
    
    // Expiration (short-lived, ~10 minutes)
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" })
      .notNull(),
    
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_oauth_states_state").on(table.state),
    index("idx_oauth_states_expires").on(table.expiresAt),
    // Service role only - no RLS for end users
    pgPolicy("oauth_states_service_only", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
```

#### 9.3.2 Update `brand_integrations` for Shopify OAuth

The credentials structure for Shopify OAuth should store:

```typescript
// Shopify OAuth credentials (stored encrypted in brand_integrations.credentials)
interface ShopifyOAuthCredentials {
  shopDomain: string;       // "mystore.myshopify.com"
  accessToken: string;      // Permanent access token from OAuth
  scope: string;            // Scopes granted "read_products,read_inventory"
  installedAt: string;      // ISO timestamp
}

// vs API Key (for other integrations)
interface ApiKeyCredentials {
  apiKey: string;
  apiSecret?: string;
}
```

### 9.4 OAuth Endpoints

#### 9.4.1 Install Endpoint

```typescript
// apps/api/src/routes/integrations/shopify/install.ts
// This is a raw HTTP endpoint, NOT a tRPC procedure (Shopify redirects here)

import { Hono } from 'hono';
import crypto from 'crypto';

const shopifyOAuth = new Hono();

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;  // e.g., "https://app.avelero.com"

// Step 1: User clicks "Install" - redirect to Shopify OAuth
shopifyOAuth.get('/install', async (c) => {
  const shop = c.req.query('shop');
  const brandId = c.req.query('brandId');  // Passed from your app
  
  // Validate shop format
  if (!shop || !isValidShopDomain(shop)) {
    return c.text('Invalid shop domain', 400);
  }
  
  if (!brandId) {
    return c.text('Missing brandId', 400);
  }
  
  // Generate cryptographically secure state
  const state = crypto.randomBytes(32).toString('hex');
  
  // Store state for verification (expires in 10 minutes)
  await db.insert(oauthStates).values({
    state,
    brandId,
    integrationSlug: 'shopify',
    shopDomain: shop,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  
  // Required scopes for product sync
  const scopes = 'read_products';
  
  // Build Shopify OAuth URL
  const authUrl = `https://${shop}/admin/oauth/authorize?` + new URLSearchParams({
    client_id: SHOPIFY_CLIENT_ID,
    scope: scopes,
    redirect_uri: `${APP_URL}/api/integrations/shopify/callback`,
    state,
  });
  
  return c.redirect(authUrl);
});

function isValidShopDomain(shop: string): boolean {
  // Must be {store}.myshopify.com format
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

export default shopifyOAuth;
```

#### 9.4.2 Callback Endpoint

```typescript
// apps/api/src/routes/integrations/shopify/callback.ts

import crypto from 'crypto';

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

shopifyOAuth.get('/callback', async (c) => {
  const { code, shop, state, hmac } = c.req.query();
  
  // 1. Validate required parameters
  if (!code || !shop || !state || !hmac) {
    return c.redirect(`${APP_URL}/settings/integrations/shopify?error=missing_params`);
  }
  
  // 2. Validate shop domain format
  if (!isValidShopDomain(shop)) {
    return c.redirect(`${APP_URL}/settings/integrations/shopify?error=invalid_shop`);
  }
  
  // 3. Verify HMAC signature from Shopify
  if (!verifyHmac(c.req.query(), SHOPIFY_CLIENT_SECRET)) {
    return c.redirect(`${APP_URL}/settings/integrations/shopify?error=invalid_hmac`);
  }
  
  // 4. Verify state exists and hasn't expired
  const storedState = await db.query.oauthStates.findFirst({
    where: and(
      eq(oauthStates.state, state),
      gt(oauthStates.expiresAt, new Date().toISOString()),
    ),
  });
  
  if (!storedState) {
    return c.redirect(`${APP_URL}/settings/integrations/shopify?error=invalid_state`);
  }
  
  // 5. Exchange authorization code for permanent access token
  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });
  
  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('Shopify token exchange failed:', error);
    return c.redirect(`${APP_URL}/settings/integrations/shopify?error=token_exchange_failed`);
  }
  
  const { access_token, scope } = await tokenResponse.json();
  
  // 6. Encrypt and store credentials
  const credentials: ShopifyOAuthCredentials = {
    shopDomain: shop,
    accessToken: access_token,
    scope,
    installedAt: new Date().toISOString(),
  };
  
  const encrypted = await encryptCredentials(credentials);
  
  // Get the Shopify integration ID
  const shopifyIntegration = await db.query.integrations.findFirst({
    where: eq(integrations.slug, 'shopify'),
  });
  
  // 7. Create or update brand_integrations
  await db.insert(brandIntegrations)
    .values({
      brandId: storedState.brandId,
      integrationId: shopifyIntegration!.id,
      status: 'connected',
      credentialsEncrypted: encrypted.ciphertext,
      credentialsIv: encrypted.iv,
      connectedAt: new Date().toISOString(),
      config: { shopDomain: shop },
      syncEnabled: true,
      nextSyncAt: new Date().toISOString(),  // Trigger first sync immediately
    })
    .onConflictDoUpdate({
      target: [brandIntegrations.brandId, brandIntegrations.integrationId],
      set: {
        status: 'connected',
        credentialsEncrypted: encrypted.ciphertext,
        credentialsIv: encrypted.iv,
        connectedAt: new Date().toISOString(),
        config: { shopDomain: shop },
        updatedAt: new Date().toISOString(),
      },
    });
  
  // 8. Clean up state
  await db.delete(oauthStates).where(eq(oauthStates.state, state));
  
  // 9. Redirect to success page
  return c.redirect(`${APP_URL}/settings/integrations/shopify?success=true`);
});

function verifyHmac(query: Record<string, string>, secret: string): boolean {
  const { hmac, ...params } = query;
  
  // Sort parameters alphabetically
  const message = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');
  
  const computedHmac = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(hmac),
    Buffer.from(computedHmac)
  );
}
```

### 9.5 Shopify Partner Dashboard Configuration

When you create the app in the Shopify Partner Dashboard, configure these URLs:

| Field | Value |
|-------|-------|
| **App URL** | `https://app.avelero.com/api/integrations/shopify/install` |
| **Allowed redirection URL(s)** | `https://app.avelero.com/api/integrations/shopify/callback` |
| **Privacy policy URL** | `https://avelero.com/privacy` |
| **App name** | "Avelero" |

### 9.6 Required Environment Variables

```bash
# .env.local (apps/api and apps/app)
SHOPIFY_CLIENT_ID=your_client_id_from_partner_dashboard
SHOPIFY_CLIENT_SECRET=your_client_secret_from_partner_dashboard

# Already in your plan
INTEGRATION_ENCRYPTION_KEY=base64_encoded_32_byte_key
```

### 9.7 UI: Initiating the OAuth Flow

```tsx
// apps/app/src/components/integrations/shopify-connect-button.tsx

export function ShopifyConnectButton({ brandId }: { brandId: string }) {
  const [shop, setShop] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const handleConnect = () => {
    if (!shop) return;
    
    // Ensure .myshopify.com suffix
    let shopDomain = shop;
    if (!shopDomain.includes('.myshopify.com')) {
      shopDomain = `${shopDomain}.myshopify.com`;
    }
    
    // Redirect to install endpoint (this will redirect to Shopify)
    window.location.href = `/api/integrations/shopify/install?` +
      new URLSearchParams({
        shop: shopDomain,
        brandId,
      });
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>Connect Shopify Store</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect to Shopify</DialogTitle>
          <DialogDescription>
            Enter your Shopify store name to connect
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="mystore"
              value={shop}
              onChange={(e) => setShop(e.target.value)}
            />
            <span className="text-muted-foreground">.myshopify.com</span>
          </div>
          <Button onClick={handleConnect} disabled={!shop}>
            Continue to Shopify
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### 9.8 App Submission Checklist

Before submitting to the Shopify App Store:

- [ ] Create app in [Shopify Partner Dashboard](https://partners.shopify.com)
- [ ] Configure App URL and Redirect URLs (see 9.5)
- [ ] Create a development store for testing
- [ ] Test complete OAuth flow on development store
- [ ] Verify product sync works with OAuth token
- [ ] Prepare app listing:
  - [ ] App name and description
  - [ ] Icon (1200x1200px)
  - [ ] Screenshots (min 2)
  - [ ] Privacy policy URL
  - [ ] Category selection
- [ ] Set distribution to "Unlisted" (for private use) or "Public"
- [ ] Submit for review (~2 weeks turnaround)

### 9.9 Post-Installation: Using the Access Token

After OAuth completes, your sync engine uses the stored token:

```typescript
// packages/jobs/src/lib/integrations/connectors/shopify/client.ts

export async function createShopifyClient(credentials: ShopifyOAuthCredentials) {
  const { shopDomain, accessToken } = credentials;
  
  return {
    async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
      const response = await fetch(
        `https://${shopDomain}/admin/api/2024-01/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
          },
          body: JSON.stringify({ query, variables }),
        }
      );
      
      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.errors) {
        throw new Error(`Shopify GraphQL error: ${JSON.stringify(data.errors)}`);
      }
      
      return data.data;
    },
  };
}
```

---

## 10. Phased Implementation Plan

### Phase 1: Database Schema & Field Registry (3-4 days) ✅ **COMPLETED**

**Goal**: Create database tables and the master field registry.

**Status**: ✅ **COMPLETED** - All schema files created and migrations applied (December 2024)

#### Files to CREATE:

1. ✅ **`packages/db/src/schema/integrations/integrations.ts`** - **CREATED**
   - Integration type master table schema
   - RLS policies for global read access

2. ✅ **`packages/db/src/schema/integrations/brand-integrations.ts`** - **CREATED**
   - Brand connection table schema
   - Encrypted credentials columns
   - Sync settings columns
   - RLS policies for brand-scoped access

3. ✅ **`packages/db/src/schema/integrations/integration-field-configs.ts`** - **CREATED**
   - Field ownership configuration schema
   - Unique constraint on (brandIntegrationId, fieldKey)
   - RLS policies via brand_integrations join

4. ✅ **`packages/db/src/schema/integrations/integration-sync-jobs.ts`** - **CREATED**
   - Sync job history schema
   - Stats columns
   - RLS policies

5. ✅ **`packages/db/src/schema/integrations/integration-product-links.ts`** - **CREATED**
   - External ID mapping schema for products
   - Unique constraint on (brandIntegrationId, externalId)
   - RLS policies

6. ✅ **`packages/db/src/schema/integrations/integration-entity-links.ts`** - **CREATED**
   - External ID mapping for all reference entities (9 tables):
     - `integration_material_links`
     - `integration_facility_links`
     - `integration_manufacturer_links`
     - `integration_season_links`
     - `integration_color_links`
     - `integration_size_links`
     - `integration_tag_links`
     - `integration_eco_claim_links`
     - `integration_certification_links`
   - All with proper FK constraints (ON DELETE CASCADE)
   - All with unique constraint on (brandIntegrationId, externalId)
   - All with `externalName` column to store original name from external system

7. ✅ **`packages/db/src/schema/integrations/oauth-states.ts`** - **CREATED**
   - OAuth state storage for CSRF protection
   - Columns: state, brandId, integrationSlug, shopDomain, expiresAt
   - Service-role only RLS (no end-user access)

8. ✅ **`packages/db/src/schema/integrations/index.ts`** - **CREATED**
   - Export all integration schemas (including oauth-states)

9. **`packages/db/src/integrations/field-registry.ts`** ✅ **ALREADY CREATED**
   - Complete field registry with 87 field definitions
   - Type definitions for FieldDefinition interface

#### Files to MODIFY:

1. ✅ **`packages/db/src/schema/index.ts`** - **MODIFIED**
   - Add: `export * from "./integrations/index.js";`

#### Database Migration:

- ✅ Run `drizzle-kit generate` to create migration - **COMPLETED**
- ✅ Run `drizzle-kit migrate` to apply - **COMPLETED**

**Migration Status**: All 15 tables created successfully:
- `integrations` (integration types master table)
- `brand_integrations` (brand connections)
- `integration_field_configs` (field ownership)
- `integration_sync_jobs` (sync history)
- `integration_product_links` (product external ID mapping)
- `integration_material_links` (material external ID mapping)
- `integration_facility_links` (facility external ID mapping)
- `integration_manufacturer_links` (manufacturer external ID mapping)
- `integration_season_links` (season external ID mapping)
- `integration_color_links` (color external ID mapping)
- `integration_size_links` (size external ID mapping)
- `integration_tag_links` (tag external ID mapping)
- `integration_eco_claim_links` (eco claim external ID mapping)
- `integration_certification_links` (certification external ID mapping)
- `oauth_states` (OAuth state storage)

---

### Phase 2: Encryption Utilities & Core Infrastructure (2-3 days)

**Goal**: Implement credential encryption and basic query functions.

#### Files to CREATE:

1. **`packages/db/src/utils/encryption.ts`**
   - `encryptCredentials(credentials, masterKey)` function
   - `decryptCredentials(encrypted, iv, masterKey)` function
   - AES-256-GCM implementation

2. **`packages/db/src/queries/integrations.ts`**
   - `listAvailableIntegrations(db)`
   - `listBrandIntegrations(db, brandId)`
   - `getBrandIntegration(db, brandId, integrationId)`
   - `createBrandIntegration(db, brandId, input)`
   - `updateBrandIntegration(db, brandId, id, input)`
   - `deleteBrandIntegration(db, brandId, id)`
   - `listFieldConfigs(db, brandIntegrationId)`
   - `updateFieldConfig(db, id, input)`
   - `listSyncJobs(db, brandIntegrationId)`
   - `createSyncJob(db, input)`
   - `updateSyncJob(db, id, input)`
   - `findProductLink(db, brandIntegrationId, externalId)`
   - `createProductLink(db, input)`
   - `updateProductLink(db, id, input)`
   - Generic entity link functions (used for all 9 entity types):
     - `findEntityLink(db, linkTable, brandIntegrationId, externalId)`
     - `createEntityLink(db, linkTable, input)`
     - `findEntityByIdentifier(db, brandId, entityType, identifier)`

#### Files to MODIFY:

1. **`packages/db/src/utils/index.ts`**
   - Add: `export * from "./encryption.js";`

2. **`packages/db/src/queries/index.ts`**
   - Add: `export * from "./integrations.js";`

#### Environment Variables:

- Add `INTEGRATION_ENCRYPTION_KEY` to `.env` files
- Document key generation: `openssl rand -base64 32`

---

### Phase 3: API Routers & Schemas (4-5 days)

**Goal**: Create tRPC routers AND OAuth endpoints for managing integrations.

#### Files to CREATE:

1. **`apps/api/src/schemas/integrations.ts`**
   - Zod schemas for all integration operations
   - `listAvailableSchema`, `listConnectedSchema`
   - `connectSchema`, `disconnectSchema`
   - `listFieldMappingsSchema`, `updateFieldMappingSchema`
   - `triggerSyncSchema`, `listSyncHistorySchema`

2. **`apps/api/src/trpc/routers/integrations/index.ts`**
   - Main integrations router
   - Compose connections, mappings, sync sub-routers

3. **`apps/api/src/trpc/routers/integrations/connections.ts`**
   - `listAvailable` - List available integration types
   - `list` - List brand's connected integrations
   - `connect` - Connect new integration (API key integrations only)
   - `disconnect` - Disconnect integration
   - `testConnection` - Test credentials

4. **`apps/api/src/trpc/routers/integrations/mappings.ts`**
   - `list` - List field configs for integration
   - `update` - Update field ownership/source
   - `listAllOwnerships` - Get all owned fields across integrations

5. **`apps/api/src/trpc/routers/integrations/sync.ts`**
   - `trigger` - Manually trigger sync
   - `history` - List sync job history
   - `status` - Get current sync status

6. **`apps/api/src/routes/integrations/shopify.ts`** ⬅️ **NEW (Shopify OAuth - Raw HTTP)**
   - `GET /api/integrations/shopify/install` - Initiate OAuth flow
     - Validates shop domain
     - Generates and stores OAuth state
     - Redirects to Shopify OAuth authorize URL
   - `GET /api/integrations/shopify/callback` - OAuth callback
     - Validates HMAC signature
     - Verifies state matches stored state
     - Exchanges code for permanent access token
     - Encrypts and stores credentials in `brand_integrations`
     - Cleans up OAuth state
     - Redirects to success page

7. **`apps/api/src/routes/integrations/index.ts`**
   - Export and register all OAuth routes with Hono

#### Files to MODIFY:

1. **`apps/api/src/trpc/routers/_app.ts`**
   - Add: `integrations: integrationsRouter,`

2. **`apps/api/src/index.ts`** (or main Hono app file)
   - Mount OAuth routes: `app.route('/api/integrations', integrationOAuthRoutes)`

---

### Phase 4: Shopify Connector & Sync Engine (5-7 days)

**Goal**: Implement the first connector (Shopify) and sync engine.

#### Files to CREATE:

1. **`packages/jobs/src/lib/integrations/types.ts`**
   - `IntegrationCredentials` interface
   - `IntegrationConfig` interface
   - `FetchedProduct` interface
   - `SyncResult` interface
   - `SyncContext` interface

2. **`packages/jobs/src/lib/integrations/connectors/types.ts`**
   - `SourceOption` interface
   - `ConnectorFieldDefinition` interface
   - `ConnectorSchema` interface
   - `IntegrationConnector` interface

3. **`packages/jobs/src/lib/integrations/connectors/shopify/schema.ts`**
   - Complete Shopify field schema (see Section 5.4)

4. **`packages/jobs/src/lib/integrations/connectors/shopify/client.ts`**
   - `testConnection(credentials)` function
   - `fetchProducts(credentials, config)` async generator
   - GraphQL queries for products

5. **`packages/jobs/src/lib/integrations/connectors/shopify/transforms.ts`**
   - Status transformation
   - Price extraction
   - Image URL handling

6. **`packages/jobs/src/lib/integrations/connectors/shopify/index.ts`**
   - Export Shopify connector

7. **`packages/jobs/src/lib/integrations/connectors/index.ts`**
   - Export all connectors

8. **`packages/jobs/src/lib/integrations/registry.ts`**
   - `getConnector(slug)` function
   - `getAllConnectors()` function
   - Connector registration

9. **`packages/jobs/src/lib/integrations/sync-engine.ts`**
   - `syncProducts(ctx)` main function
   - `processProduct(ctx, external, fields)` function
   - `buildEffectiveFieldMappings(schema, configs)` function
   - `extractValues(external, fields)` function
   - `handleReferenceEntity(ctx, type, data)` function
   - Null-protection logic

10. **`packages/jobs/src/lib/integrations/index.ts`**
    - Export all integration utilities

11. **`packages/jobs/src/trigger/integration-sync.ts`**
    - `syncIntegration` on-demand task
    - Full sync implementation

12. **`packages/jobs/src/trigger/integration-sync-scheduler.ts`**
    - `integrationSyncScheduler` scheduled task
    - Cron: every hour, check for due syncs

#### Files to MODIFY:

1. **`packages/jobs/src/trigger/index.ts`**
   - Add: `export { syncIntegration } from "./integration-sync";`
   - Add: `export { integrationSyncScheduler } from "./integration-sync-scheduler";`

---

### Phase 5: It's Perfect Connector (5-7 days)

**Goal**: Implement the second connector with complex transforms.

#### Files to CREATE:

1. **`packages/jobs/src/lib/integrations/connectors/its-perfect/schema.ts`**
   - Complete It's Perfect field schema (see Section 5.5)
   - Multi-entity support (product, season, material, facility)

2. **`packages/jobs/src/lib/integrations/connectors/its-perfect/client.ts`**
   - `testConnection(credentials)` function
   - `fetchProducts(credentials, config)` async generator
   - API endpoint handling

3. **`packages/jobs/src/lib/integrations/connectors/its-perfect/transforms.ts`**
   - `parseMaterialComposition(input)` function (see Section 6.2.1)
   - `parseJourneySteps(input)` function
   - Complex string parsing for various formats

4. **`packages/jobs/src/lib/integrations/connectors/its-perfect/index.ts`**
   - Export It's Perfect connector

#### Files to MODIFY:

1. **`packages/jobs/src/lib/integrations/connectors/index.ts`**
   - Add It's Perfect to connector exports

2. **`packages/jobs/src/lib/integrations/registry.ts`**
   - Register It's Perfect connector

3. **`packages/jobs/src/lib/integrations/sync-engine.ts`**
   - Add `handleMaterialsRelation(ctx, productId, materials)` function
   - Add `handleJourneyStepsRelation(ctx, productId, steps)` function
   - Enhance reference entity handling for all types

---

### Phase 6: UI Components (3-4 days)

**Goal**: Create the management UI for integrations.

#### Files to CREATE:

1. **`apps/app/src/app/(dashboard)/(main)/(sidebar)/settings/integrations/layout.tsx`**
   - Settings integrations layout

2. **`apps/app/src/app/(dashboard)/(main)/(sidebar)/settings/integrations/page.tsx`**
   - Integration list page
   - Available integrations grid
   - Connected integrations list

3. **`apps/app/src/app/(dashboard)/(main)/(sidebar)/settings/integrations/[slug]/layout.tsx`**
   - Integration detail layout

4. **`apps/app/src/app/(dashboard)/(main)/(sidebar)/settings/integrations/[slug]/page.tsx`**
   - Integration detail page
   - Connection status
   - Field mapping configuration
   - Sync history

5. **`apps/app/src/components/integrations/integration-card.tsx`**
   - Card component for integration display
   - Status indicator
   - Connect/Configure actions

6. **`apps/app/src/components/integrations/connect-modal.tsx`**
   - Modal for entering credentials
   - Form validation
   - Connection testing

7. **`apps/app/src/components/integrations/field-mapping-table.tsx`**
   - Table of available fields
   - Enable/disable toggles
   - Source option dropdowns
   - Ownership conflict warnings

8. **`apps/app/src/components/integrations/sync-status-badge.tsx`**
   - Badge showing sync status
   - Last sync time
   - Error indicator

9. **`apps/app/src/components/integrations/sync-history-table.tsx`**
   - Table of sync job history
   - Stats (created, updated, skipped, errors)
   - Expandable error details

---

### Phase 7: Testing & Polish (2-3 days)

**Goal**: End-to-end testing and refinement.

#### Tasks:

1. **Unit Tests**
   - Transform functions (material parsing, etc.)
   - Encryption utilities
   - Field mapping logic

2. **Integration Tests**
   - API router tests
   - Sync engine tests with mock data

3. **Manual Testing**
   - Full Shopify connection flow
   - Field mapping UI
   - Sync execution and monitoring

4. **Documentation**
   - Update README with integration setup
   - Document adding new connectors
   - API documentation

5. **Error Handling**
   - Improve error messages
   - Add retry logic for transient failures
   - Handle rate limiting

6. **Performance**
   - Optimize batch sizes
   - Add progress tracking
   - Implement cancellation

---

## Summary

This plan provides a complete roadmap for implementing the integration management system. Key deliverables:

- **43 new files** and **6 modified files**
- **15 new database tables** for integration management:
  - 5 core tables (integrations, brand_integrations, field_configs, sync_jobs, product_links)
  - 9 entity link tables (material, facility, manufacturer, season, color, size, tag, eco_claim, certification)
  - 1 OAuth table (oauth_states) for Shopify App Store compliance
- **Field registry** with 87 field definitions across 14 entities ✅ ALREADY CREATED
- **2 connectors** (Shopify, It's Perfect) with extensible architecture
- **Shopify OAuth flow** for App Store submission (Section 9)
- **Scheduled sync** via Trigger.dev cron jobs
- **Complete UI** for connection and configuration

The three-layer architecture ensures:
- **Transforms are in code** (deployed with changes)
- **Capabilities are defined** (per connector)
- **Choices are configurable** (per brand, at runtime)

**Entity Matching Strategy**: Link-first, name-fallback
- External entities (materials, seasons, etc.) are linked by external ID
- Brands can rename entities in Avelero without breaking sync
- First sync uses name matching to avoid duplicates
- Subsequent syncs use link-based matching

**Shopify OAuth** (Section 9):
- Required for Shopify App Store submission
- Implements full OAuth 2.0 flow with CSRF protection
- Uses raw HTTP endpoints (not tRPC) since Shopify redirects directly
- Stores encrypted access tokens in `brand_integrations`
- Includes app submission checklist

Adding new integrations requires only:
1. Create connector directory with schema, client, transforms
2. Register in connector registry
3. Seed `integrations` table with new type
4. For OAuth integrations: add OAuth endpoints similar to Shopify
5. No changes to sync engine or UI


