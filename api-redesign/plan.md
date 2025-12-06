# API Server Redesign Plan

> **Purpose:** Complete migration plan from current API structure to the redesigned architecture. This document provides everything needed to implement the changes in a structured, phased approach.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Target Architecture](#2-target-architecture)
3. [Router Specifications](#3-router-specifications)
4. [Schema Specifications](#4-schema-specifications)
5. [Query Layer Changes](#5-query-layer-changes)
6. [File Structure (Target State)](#6-file-structure-target-state)
7. [Migration Phases](#7-migration-phases)
8. [Testing Strategy](#8-testing-strategy)
9. [Rollback Plan](#9-rollback-plan)

---

## 1. Design Principles

### 1.1 Naming Conventions

| Principle | Description |
|-----------|-------------|
| **Semantic Clarity** | Router names should clearly indicate their domain (e.g., `brands` for brand management, `catalog` for brand-owned entities) |
| **Context Alignment** | Endpoints should live where their required context makes sense (user-level vs brand-level) |
| **Action Consistency** | Similar operations use consistent naming (`list`, `get`, `create`, `update`, `delete`) |
| **Singular Resources** | Router names are plural (`brands`, `products`), but refer to the collection |

### 1.2 Context Requirements

| Context Level | Procedure Type | Use Cases |
|---------------|---------------|-----------|
| **Public** | `publicProcedure` | DPP data, public carousel |
| **User** | `protectedProcedure` | Profile, invites received, brand list |
| **Brand** | `brandRequiredProcedure` | Products, catalog, theme, members |

### 1.3 Endpoint Design Rules

1. **One endpoint per semantic action** - Combine `get` and `getByUpid` into single `get` with discriminated input
2. **Separate concerns by context** - Accept invite (user) vs send invite (brand)
3. **Mutations for state changes** - Use mutations for any data modification
4. **Queries for data retrieval** - Use queries for read-only operations
5. **No deprecated endpoints** - Remove deprecated code, don't just mark it

---

## 2. Target Architecture

### 2.1 Router Structure Overview

```
appRouter
├── user                        # User profile & account management
│   ├── get                     # Query: Current user profile
│   ├── update                  # Mutation: Update profile + active brand
│   ├── delete                  # Mutation: Delete account
│   └── invites
│       ├── list                # Query: Invites sent to this user
│       ├── accept              # Mutation: Accept invite
│       └── reject              # Mutation: Reject invite
│
├── brands                      # Brand lifecycle management
│   ├── list                    # Query: User's brand memberships
│   ├── create                  # Mutation: Create brand
│   ├── update                  # Mutation: Update brand details
│   ├── delete                  # Mutation: Delete brand
│   ├── members
│   │   ├── list                # Query: Brand members
│   │   ├── update              # Mutation: Update member role
│   │   ├── remove              # Mutation: Remove member
│   │   └── leave               # Mutation: Current user leaves
│   ├── invites
│   │   ├── list                # Query: Pending invites for brand
│   │   ├── send                # Mutation: Send invite
│   │   └── revoke              # Mutation: Revoke pending invite
│   └── theme
│       ├── get                 # Query: Theme styles + config
│       ├── update              # Mutation: Update theme config
│       └── carousel
│           ├── candidates      # Query: Products for carousel selection
│           └── update          # Mutation: Save carousel selection
│
├── catalog                     # Brand-owned catalog entities
│   ├── colors.*                # CRUD (list/create/update/delete)
│   ├── sizes.*                 # CRUD
│   ├── materials.*             # CRUD
│   ├── seasons.*               # CRUD
│   ├── facilities.*            # CRUD
│   ├── showcaseBrands.*        # CRUD
│   ├── ecoClaims.*             # CRUD
│   ├── certifications.*        # CRUD
│   └── tags.*                  # CRUD
│
├── products
│   ├── list                    # Query: Paginated products with filters
│   ├── get                     # Query: Single product (by ID or UPID)
│   ├── create                  # Mutation: Create product
│   ├── update                  # Mutation: Update product
│   ├── delete                  # Mutation: Delete product
│   └── variants
│       ├── list                # Query: Variants (by product ID or UPID)
│       ├── upsert              # Mutation: Replace variants
│       └── delete              # Mutation: Delete variant(s)
│
├── bulk                        # Bulk import operations
│   ├── import
│   │   ├── start               # Mutation: Start import job
│   │   ├── status              # Query: Job status
│   │   ├── approve             # Mutation: Approve & commit
│   │   └── cancel              # Mutation: Cancel job
│   ├── staging
│   │   ├── reviewSummary       # Query: All review data
│   │   ├── preview             # Query: Staging preview
│   │   ├── errors              # Query: Import errors
│   │   └── export              # Query: Export failed rows
│   └── values
│       ├── unmapped            # Query: Values needing definition
│       ├── catalogData         # Query: Catalog for mapping UI
│       ├── ensureCategory      # Mutation: Create category path
│       ├── define              # Mutation: Define single value
│       ├── batchDefine         # Mutation: Define multiple values
│       └── mapToExisting       # Mutation: Map to existing entity
│
├── composite                   # Performance-optimized batch queries
│   ├── initDashboard           # Query: User + brands + invites
│   ├── membersWithInvites      # Query: Members + invites for brand
│   └── catalogContent          # Query: All catalog data for forms
│
├── summary                     # Aggregated statistics
│   └── productStatus           # Query: Product count by status
│
├── dppPublic                   # Public DPP endpoints (no auth)
│   ├── getByProductUpid        # Query: DPP by product UPID
│   ├── getByVariantUpid        # Query: DPP by variant UPID
│   └── carousel
│       └── list                # Query: Carousel products for DPP
│
└── internal                    # Server-to-server (Trigger.dev)
    ├── emitProgress            # Mutation: WebSocket progress
    └── cleanupJob              # Mutation: Cleanup connections
```

### 2.2 Endpoint Count Summary

| Router | Endpoints | Change |
|--------|-----------|--------|
| user | 6 | +2 (accept, reject moved here) |
| brands | 14 | -1 (setActive removed, invites restructured) |
| catalog | 36 | No change |
| products | 8 | -2 (merged get/getByUpid, removed variants.get) |
| bulk | 15 | -1 (removed deprecated validate) |
| composite | 3 | Renamed only |
| summary | 1 | No change |
| dppPublic | 4 | +1 (carousel.list) |
| internal | 2 | No change |
| **Total** | **89** | -4 (from 93, excluding removed templates) |

---

## 3. Router Specifications

### 3.1 user Router

**Purpose:** Manage the authenticated user's profile, preferences, and invites received.

**Context:** `protectedProcedure` (requires authenticated user, no brand context needed)

#### Endpoints

| Endpoint | Type | Input | Output | Description |
|----------|------|-------|--------|-------------|
| `user.get` | Query | None | `UserProfile \| null` | Get current user's profile |
| `user.update` | Mutation | `UserUpdateInput` | `UserProfile` | Update profile including active brand |
| `user.delete` | Mutation | None | `{ id: string }` | Delete account, storage, and auth |
| `user.invites.list` | Query | None | `UserInvite[]` | List invites sent to user's email |
| `user.invites.accept` | Mutation | `{ invite_id: string }` | `{ success: true, brandId: string }` | Accept an invite |
| `user.invites.reject` | Mutation | `{ invite_id: string }` | `{ success: true }` | Reject an invite |

#### Input Schemas

```typescript
// user.update - includes setting active brand
const userUpdateSchema = z.object({
  email: emailSchema.optional(),
  full_name: z.string().trim().min(1).nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  brand_id: uuidSchema.nullable().optional(),  // Set active brand
});

// user.invites.accept/reject
const inviteActionSchema = z.object({
  invite_id: uuidSchema,
});
```

#### Key Implementation Notes

- `user.update` now handles setting active brand (previously `workflow.setActive`)
- `user.invites.accept/reject` moved from `workflow.invites.respond`
- User-level operations only need `user.id`, not brand context

---

### 3.2 brands Router

**Purpose:** Manage brand lifecycle, team members, invites sent, and theme configuration.

**Context:** Mixed - `protectedProcedure` for list/create, `brandRequiredProcedure` for brand-specific operations

#### Endpoints

| Endpoint | Type | Auth | Input | Output | Description |
|----------|------|------|-------|--------|-------------|
| `brands.list` | Query | Protected | None | `BrandMembership[]` | User's brand memberships |
| `brands.create` | Mutation | Protected | `BrandCreateInput` | `Brand` | Create new brand |
| `brands.update` | Mutation | Brand (owner) | `BrandUpdateInput` | `Brand` | Update brand details |
| `brands.delete` | Mutation | Brand (owner) | `{ brand_id: string }` | `{ success: true }` | Delete brand |
| `brands.members.list` | Query | Brand | None | `Member[]` | List brand members |
| `brands.members.update` | Mutation | Brand (owner) | `MemberUpdateInput` | `{ success: true }` | Update member role |
| `brands.members.remove` | Mutation | Brand (owner) | `{ user_id: string }` | `{ success: true }` | Remove member |
| `brands.members.leave` | Mutation | Brand | `{ brand_id?: string }` | `{ success: true, nextBrandId }` | Leave brand |
| `brands.invites.list` | Query | Brand (owner) | None | `BrandInvite[]` | List pending invites |
| `brands.invites.send` | Mutation | Brand (owner) | `InviteSendInput` | `InviteResult` | Send invite |
| `brands.invites.revoke` | Mutation | Brand (owner) | `{ invite_id: string }` | `{ success: true }` | Revoke invite |
| `brands.theme.get` | Query | Brand | None | `ThemeData` | Get theme styles + config |
| `brands.theme.update` | Mutation | Brand | `{ config: ThemeConfig }` | `{ success: true }` | Update theme config |
| `brands.theme.carousel.candidates` | Query | Brand | `CarouselCandidatesInput` | `PaginatedProducts` | Products for carousel selection |
| `brands.theme.carousel.update` | Mutation | Brand | `{ product_ids: string[] }` | `{ success: true }` | Save carousel selection |

#### Input Schemas

```typescript
// Brand CRUD
const brandCreateSchema = z.object({
  name: shortStringSchema,
  slug: slugSchema.optional().nullable(),
  email: emailSchema.optional().nullable(),
  country_code: countryCodeSchema.optional().nullable(),
  logo_url: shortStringSchema.optional().nullable(),
  avatar_hue: avatarHueSchema.optional(),
});

const brandUpdateSchema = updateWithNullable(brandCreateSchema, [
  "email", "country_code", "logo_url", "avatar_hue"
]);

// Members
const memberUpdateSchema = z.object({
  user_id: uuidSchema,
  role: roleSchema,  // "owner" | "member"
});

// Invites
const inviteSendSchema = z.object({
  email: emailSchema,
  role: roleSchema.default("member"),
});

// Theme carousel
const carouselCandidatesSchema = z.object({
  search: shortStringSchema.optional(),
  filterState: filterStateSchema.optional(),
  sort: sortSchema.optional(),
  cursor: z.string().optional(),
  limit: paginationLimitSchema.default(50),
});

const carouselUpdateSchema = z.object({
  product_ids: uuidArraySchema,
});
```

#### Key Implementation Notes

- `brands.theme` contains theme_config, theme_styles, google_fonts_url
- `brands.theme.carousel.candidates` returns products available for carousel selection (dashboard use)
- `brands.theme.carousel.update` saves the selected product IDs to the brand's carousel configuration
- `brands.members.leave` allows leaving any brand user is member of (validates membership internally)
- `brands.members.update` and `brands.members.remove` are separated for clarity

---

### 3.3 catalog Router

**Purpose:** Manage brand-owned catalog entities (colors, sizes, materials, etc.).

**Context:** `brandRequiredProcedure` for all operations

#### Structure

Uses factory pattern - each entity has identical CRUD structure:

```typescript
const catalogRouter = createTRPCRouter({
  colors: createCatalogResourceRouter("color", colorSchemas, colorOperations),
  sizes: createCatalogResourceRouter("size", sizeSchemas, sizeOperations),
  materials: createCatalogResourceRouter("material", materialSchemas, materialOperations),
  seasons: createCatalogResourceRouter("season", seasonSchemas, seasonOperations),
  facilities: createCatalogResourceRouter("facility", facilitySchemas, facilityOperations),
  showcaseBrands: createCatalogResourceRouter("showcase brand", showcaseBrandSchemas, showcaseBrandOperations),
  ecoClaims: createCatalogResourceRouter("eco claim", ecoClaimSchemas, ecoClaimOperations),
  certifications: createCatalogResourceRouter("certification", certificationSchemas, certificationOperations),
  tags: createCatalogResourceRouter("tag", tagSchemas, tagOperations),
});
```

#### Endpoints per Entity (×9)

| Endpoint | Type | Input | Output |
|----------|------|-------|--------|
| `catalog.{entity}.list` | Query | ListSchema | `Entity[]` |
| `catalog.{entity}.create` | Mutation | CreateSchema | `Entity` |
| `catalog.{entity}.update` | Mutation | UpdateSchema | `Entity` |
| `catalog.{entity}.delete` | Mutation | `{ id: string }` | `Entity` |

#### Key Implementation Notes

- No changes to actual implementation, only router rename from `brand` to `catalog`
- Factory pattern (`createCatalogResourceRouter`) remains unchanged
- All 36 endpoints (9 × 4) maintain existing behavior

---

### 3.4 products Router

**Purpose:** Manage products and their variants.

**Context:** `brandRequiredProcedure` for all operations

#### Endpoints

| Endpoint | Type | Input | Output | Description |
|----------|------|-------|--------|-------------|
| `products.list` | Query | `ProductListInput` | `PaginatedProducts` | Paginated products with filters |
| `products.get` | Query | `ProductGetInput` | `Product` | Single product by ID or UPID |
| `products.create` | Mutation | `ProductCreateInput` | `Product` | Create product |
| `products.update` | Mutation | `ProductUpdateInput` | `Product` | Update product |
| `products.delete` | Mutation | `{ id: string }` | `Product` | Delete product |
| `products.variants.list` | Query | `VariantListInput` | `Variant[]` | Variants by product ID or UPID |
| `products.variants.upsert` | Mutation | `VariantUpsertInput` | `Variant[]` | Replace variants |
| `products.variants.delete` | Mutation | `VariantDeleteInput` | `{ deleted: number }` | Delete variant(s) |

#### Input Schemas

```typescript
// Unified get - accepts either id OR upid
const productGetSchema = z.union([
  z.object({ id: uuidSchema }),
  z.object({ upid: z.string().length(16).regex(/^[a-zA-Z0-9]+$/) }),
]).and(z.object({
  includeVariants: z.boolean().optional().default(false),
  includeAttributes: z.boolean().optional().default(false),
}));

// Variants list - accepts either product_id OR product_upid
const variantListSchema = z.union([
  z.object({ product_id: uuidSchema }),
  z.object({ product_upid: z.string().length(16).regex(/^[a-zA-Z0-9]+$/) }),
]).and(z.object({
  cursor: z.string().optional(),
  limit: paginationLimitSchema.optional(),
}));

// Variant delete - accepts either variant_id OR product_id
const variantDeleteSchema = z.union([
  z.object({ variant_id: uuidSchema }),
  z.object({ product_id: uuidSchema }),
]);
```

#### Key Implementation Notes

- `products.get` merges previous `get` and `getByUpid` into single endpoint
- `products.variants.list` now accepts `product_id` OR `product_upid`
- `products.variants.get` removed (redundant with `variants.list`)
- Query layer needs update to handle discriminated union input

---

### 3.5 bulk Router

**Purpose:** Handle bulk import operations including staging, validation, and value mapping.

**Context:** `brandRequiredProcedure` for all operations

#### Endpoints

| Endpoint | Type | Input | Output | Description |
|----------|------|-------|--------|-------------|
| `bulk.import.start` | Mutation | `ImportStartInput` | `{ jobId, status }` | Start import job |
| `bulk.import.status` | Query | `{ jobId: string }` | `ImportStatus` | Job status |
| `bulk.import.approve` | Mutation | `{ jobId: string }` | `{ status: "COMMITTING" }` | Approve & commit |
| `bulk.import.cancel` | Mutation | `{ jobId: string }` | `{ status: "CANCELLED" }` | Cancel job |
| `bulk.staging.reviewSummary` | Query | `{ jobId: string }` | `ReviewSummary` | All review data |
| `bulk.staging.preview` | Query | `StagingPreviewInput` | `StagingPreview` | Staging preview |
| `bulk.staging.errors` | Query | `ImportErrorsInput` | `ImportErrors` | Import errors |
| `bulk.staging.export` | Query | `{ jobId: string }` | `{ csv, filename }` | Export failed rows |
| `bulk.values.unmapped` | Query | `{ jobId: string }` | `UnmappedValues` | Values needing definition |
| `bulk.values.catalogData` | Query | `{ jobId: string }` | `CatalogData` | Catalog for mapping UI |
| `bulk.values.ensureCategory` | Mutation | `EnsureCategoryInput` | `{ id, created }` | Create category path |
| `bulk.values.define` | Mutation | `DefineValueInput` | `DefineResult` | Define single value |
| `bulk.values.batchDefine` | Mutation | `BatchDefineInput` | `BatchDefineResult` | Define multiple values |
| `bulk.values.mapToExisting` | Mutation | `MapToExistingInput` | `MapResult` | Map to existing entity |

#### Key Implementation Notes

- `bulk.import.validate` removed (was deprecated)
- All other endpoints remain unchanged
- 15 total endpoints (down from 16)

---

### 3.6 composite Router

**Purpose:** Performance-optimized batch queries for critical paths.

**Context:** `protectedProcedure` for initDashboard, `brandRequiredProcedure` for others

#### Endpoints

| Endpoint | Type | Auth | Input | Output | Description |
|----------|------|------|-------|--------|-------------|
| `composite.initDashboard` | Query | Protected | None | `{ user, brands, invites }` | Dashboard initialization |
| `composite.membersWithInvites` | Query | Brand | None | `{ members, invites }` | Members + invites |
| `composite.catalogContent` | Query | Brand | None | `CatalogContent` | All catalog data |

#### Key Implementation Notes

- Renamed from `workflowInit` → `initDashboard`
- Renamed from `brandCatalogContent` → `catalogContent`
- Implementation logic unchanged

---

### 3.7 summary Router

**Purpose:** Aggregated statistics for dashboard widgets.

**Context:** `brandRequiredProcedure`

#### Endpoints

| Endpoint | Type | Input | Output | Description |
|----------|------|-------|--------|-------------|
| `summary.productStatus` | Query | None | `Record<status, count>` | Product count by status |

#### Future Expansion

```typescript
// Potential future endpoints
summary.productsByCategory    // Products by category
summary.importHistory         // Recent imports
summary.teamActivity          // Team activity metrics
```

---

### 3.8 dppPublic Router

**Purpose:** Public endpoints for Digital Product Passport display (no authentication).

**Context:** `publicProcedure` (no auth required)

#### Endpoints

| Endpoint | Type | Input | Output | Description |
|----------|------|-------|--------|-------------|
| `dppPublic.getByProductUpid` | Query | `{ brandSlug, productUpid }` | `DppData \| null` | DPP by product |
| `dppPublic.getByVariantUpid` | Query | `{ brandSlug, productUpid, variantUpid }` | `DppData \| null` | DPP by variant |
| `dppPublic.carousel.list` | Query | `CarouselListInput` | `CarouselProduct[]` | Carousel for DPP display |

#### Input Schemas

```typescript
// Carousel for public DPP display
const carouselListSchema = z.object({
  brandSlug: slugSchema,
  productUpid: upidSchema,           // Current product being viewed
  limit: z.number().min(1).max(20).default(8),
});
```

#### Key Implementation Notes

- `dppPublic.carousel.list` is NEW - fetches carousel products for DPP consumer view
- Returns products from brand's saved carousel configuration
- Filters by relevance (e.g., same category as current product)
- No authentication required

---

### 3.9 internal Router

**Purpose:** Server-to-server communication for background jobs (Trigger.dev).

**Context:** `publicProcedure` with API key validation

#### Endpoints

| Endpoint | Type | Input | Output | Description |
|----------|------|-------|--------|-------------|
| `internal.emitProgress` | Mutation | `ProgressPayload` | `{ success, emittedTo }` | WebSocket progress |
| `internal.cleanupJob` | Mutation | `{ apiKey, jobId }` | `{ success: true }` | Cleanup connections |

#### Key Implementation Notes

- Protected by `INTERNAL_API_KEY` environment variable
- Not exposed to frontend clients
- Used by Trigger.dev background jobs

---

## 4. Schema Specifications

### 4.1 Schema File Structure (Target)

```
schemas/
├── _shared/
│   ├── primitives.ts           # No changes
│   ├── patterns.ts             # No changes
│   └── domain.ts               # No changes
├── catalog/                    # Renamed from brand-catalog/
│   ├── index.ts
│   ├── colors.ts
│   ├── sizes.ts
│   ├── materials.ts
│   ├── seasons.ts
│   ├── facilities.ts
│   ├── showcase-brands.ts
│   ├── eco-claims.ts
│   ├── certifications.ts
│   └── tags.ts
├── index.ts                    # Update exports
├── user.ts                     # Add invite accept/reject, brand_id field
├── brands.ts                   # Renamed from workflow.ts, restructured
├── brands-theme.ts             # NEW - extracted theme schemas
├── products.ts                 # Update get schema for discriminated union
├── bulk.ts                     # Remove validate schema
├── summary.ts                  # No changes
└── dpp-public.ts               # NEW - add carousel schema
```

### 4.2 Files to Delete

```
schemas/
├── brand.ts                    # DELETE - overlaps with brands.ts
├── catalog.ts                  # DELETE - empty/unused
└── templates.ts                # DELETE - feature removed
```

### 4.3 Key Schema Changes

#### user.ts Updates

```typescript
// Add brand_id to update schema
export const userUpdateSchema = z.object({
  email: emailSchema.optional(),
  full_name: z.string().trim().min(1).nullable().optional(),
  avatar_url: urlOrPathSchema.nullable().optional(),
  brand_id: uuidSchema.nullable().optional(),  // NEW - set active brand
});

// Add invite action schemas
export const inviteAcceptSchema = z.object({
  invite_id: uuidSchema,
});

export const inviteRejectSchema = z.object({
  invite_id: uuidSchema,
});
```

#### brands.ts (renamed from workflow.ts)

```typescript
// Rename exports
export const brandCreateSchema = workflowCreateSchema;      // Same content
export const brandUpdateSchema = workflowUpdateSchema;      // Same content
export const brandIdSchema = workflowBrandIdSchema;         // Same content

// Restructured members schemas
export const memberUpdateSchema = z.object({
  user_id: uuidSchema,
  role: roleSchema,
});

export const memberRemoveSchema = z.object({
  user_id: uuidSchema,
});

export const memberLeaveSchema = z.object({
  brand_id: uuidSchema.optional(),  // Optional, uses active brand if not provided
});

// Restructured invites schemas
export const inviteSendSchema = z.object({
  email: emailSchema,
  role: roleSchema.default("member"),
});

export const inviteRevokeSchema = z.object({
  invite_id: uuidSchema,
});
```

#### brands-theme.ts (NEW)

```typescript
// Extract theme schemas from inline definitions
export const themeConfigSchema = z.record(z.unknown());

export const themeUpdateSchema = z.object({
  config: themeConfigSchema,
});

export const carouselCandidatesSchema = z.object({
  search: shortStringSchema.optional(),
  filterState: filterStateSchema.optional(),
  sort: z.object({
    field: z.enum(["name", "category", "season", "createdAt"]),
    direction: z.enum(["asc", "desc"]).default("asc"),
  }).optional(),
  cursor: z.string().optional(),
  limit: paginationLimitSchema.default(50),
});

export const carouselUpdateSchema = z.object({
  product_ids: uuidArraySchema,
});
```

#### products.ts Updates

```typescript
// Unified get schema (replaces separate get and getByUpid)
export const productGetSchema = z.intersection(
  z.union([
    z.object({ id: uuidSchema }),
    z.object({ upid: upidSchema }),
  ]),
  z.object({
    includeVariants: z.boolean().optional().default(false),
    includeAttributes: z.boolean().optional().default(false),
  }),
);

// Unified variant list schema
export const variantListSchema = z.intersection(
  z.union([
    z.object({ product_id: uuidSchema }),
    z.object({ product_upid: upidSchema }),
  ]),
  z.object({
    cursor: z.string().optional(),
    limit: paginationLimitSchema.optional(),
  }),
);

// Add UPID schema
export const upidSchema = z.string()
  .length(16, "UPID must be 16 characters")
  .regex(/^[a-zA-Z0-9]+$/, "UPID must be alphanumeric");
```

#### dpp-public.ts (NEW or update)

```typescript
export const dppCarouselListSchema = z.object({
  brandSlug: slugSchema,
  productUpid: upidSchema,
  limit: z.number().min(1).max(20).default(8),
});
```

---

## 5. Query Layer Changes

### 5.1 Query Files Overview

| File | Changes Required |
|------|-----------------|
| `users.ts` | No changes |
| `brands.ts` | Add `getCarouselProducts` for public DPP |
| `brand-members.ts` | No changes |
| `brand-invites.ts` | No changes |
| `brand-catalog.ts` | No changes |
| `products.ts` | Update `getProductWithIncludes` for UPID lookup |
| `templates.ts` | DELETE |
| `bulk-import.ts` | No changes |
| `staging.ts` | No changes |
| `value-mappings.ts` | No changes |
| `dpp-public.ts` | Add `getCarouselProductsForDpp` |

### 5.2 Key Query Changes

#### products.ts

```typescript
// Update to handle either ID or UPID
export async function getProductWithIncludes(
  db: Database,
  brandId: string,
  identifier: { id: string } | { upid: string },
  options: ProductIncludeOptions,
): Promise<ProductWithRelations | null> {
  const whereClause = 'id' in identifier
    ? eq(products.id, identifier.id)
    : eq(products.upid, identifier.upid);
  
  // ... rest of implementation
}

// Similar update for variant listing
export async function listVariantsForProduct(
  db: Database,
  brandId: string,
  identifier: { product_id: string } | { product_upid: string },
  options: VariantListOptions,
): Promise<Variant[]> {
  // ...
}
```

#### dpp-public.ts

```typescript
// NEW: Get carousel products for public DPP display
export async function getCarouselProductsForDpp(
  db: Database,
  brandSlug: string,
  currentProductUpid: string,
  limit: number = 8,
): Promise<CarouselProduct[]> {
  // 1. Get brand by slug
  // 2. Get brand's carousel configuration (saved product IDs)
  // 3. Fetch products from configuration
  // 4. Filter by relevance to current product (e.g., same category)
  // 5. Return limited results
}
```

---

## 6. File Structure (Target State)

### 6.1 Router Files

```
apps/api/src/trpc/routers/
├── _app.ts                     # Update imports, rename routers
├── user/
│   └── index.ts                # Add invites.accept, invites.reject
├── brands/                     # Renamed from workflow/
│   ├── index.ts                # Update composition
│   ├── base.ts                 # Remove setActive
│   ├── members.ts              # Split into update/remove/leave
│   ├── invites.ts              # Remove respond, keep send/revoke
│   └── theme.ts                # Add carousel.candidates, carousel.update
├── catalog/                    # Renamed from brand/
│   └── index.ts                # Update imports only
├── products/
│   ├── index.ts                # Merge get/getByUpid
│   └── variants.ts             # Update list for UPID, remove get
├── bulk/
│   ├── index.ts                # No changes
│   ├── import.ts               # Remove validate endpoint
│   ├── staging.ts              # No changes
│   └── values.ts               # No changes
├── composite/
│   └── index.ts                # Rename endpoints
├── summary/
│   └── index.ts                # No changes
├── dpp-public/
│   └── index.ts                # Add carousel.list
├── internal/
│   └── index.ts                # No changes
└── templates/                  # DELETE entire directory
```

### 6.2 Schema Files

```
apps/api/src/schemas/
├── _shared/
│   ├── primitives.ts           # No changes
│   ├── patterns.ts             # No changes
│   └── domain.ts               # No changes
├── catalog/                    # Renamed from brand-catalog/
│   └── (all files)             # No changes to content
├── index.ts                    # Update exports
├── user.ts                     # Add brand_id, invite actions
├── brands.ts                   # Renamed from workflow.ts
├── brands-theme.ts             # NEW
├── products.ts                 # Update get/variant schemas
├── bulk.ts                     # Remove validate schema
├── summary.ts                  # No changes
├── dpp-public.ts               # NEW or update
├── brand.ts                    # DELETE
├── catalog.ts                  # DELETE
└── templates.ts                # DELETE
```

### 6.3 Query Files

```
packages/db/src/queries/
├── index.ts                    # Remove templates export
├── users.ts                    # No changes
├── brands.ts                   # No changes
├── brand-members.ts            # No changes
├── brand-invites.ts            # No changes
├── brand-catalog.ts            # No changes
├── products.ts                 # Update for UPID support
├── bulk-import.ts              # No changes
├── staging.ts                  # No changes
├── value-mappings.ts           # No changes
├── dpp-public.ts               # Add carousel query
├── catalog.ts                  # No changes
└── templates.ts                # DELETE
```

---

## 7. Migration Phases

### Phase 1: Preparation & Schema Updates (Low Risk)

**Duration:** ~2 hours

**Tasks:**
1. Create `api-redesign` branch
2. Create new schema files:
   - `brands-theme.ts` (extract from inline)
   - `dpp-public.ts` (add carousel schema)
3. Update `user.ts` schema:
   - Add `brand_id` to update schema
   - Add `inviteAcceptSchema`, `inviteRejectSchema`
4. Update `products.ts` schema:
   - Add `upidSchema`
   - Create unified `productGetSchema` (discriminated union)
   - Create unified `variantListSchema`
5. Update `bulk.ts` schema:
   - Remove `validateImportSchema`
6. Rename `brand-catalog/` → `catalog/`
7. Delete unused schemas:
   - `brand.ts`
   - `catalog.ts`
   - `templates.ts`
8. Update `schemas/index.ts` barrel export

**Verification:**
- TypeScript compilation passes
- No import errors

---

### Phase 2: Query Layer Updates (Low Risk)

**Duration:** ~1-2 hours

**Tasks:**
1. Update `products.ts` queries:
   - Modify `getProductWithIncludes` to accept `{ id } | { upid }`
   - Modify variant listing to accept `{ product_id } | { product_upid }`
2. Add to `dpp-public.ts`:
   - `getCarouselProductsForDpp` query function
3. Delete `templates.ts` query file
4. Update `queries/index.ts` barrel export

**Verification:**
- TypeScript compilation passes
- Existing tests pass

---

### Phase 3: User Router Restructure (Medium Risk)

**Duration:** ~1-2 hours

**Tasks:**
1. Update `user/index.ts`:
   - Add `user.invites.accept` endpoint
   - Add `user.invites.reject` endpoint
   - Update `user.update` to handle `brand_id`
2. Move accept/reject logic from `workflow/invites.ts` to `user/index.ts`

**Verification:**
- Test user profile update with brand_id
- Test invite accept flow
- Test invite reject flow

---

### Phase 4: Brands Router Restructure (Medium Risk)

**Duration:** ~3-4 hours

**Tasks:**
1. Rename `workflow/` directory → `brands/`
2. Update `brands/index.ts`:
   - Update router composition
   - Rename exported router
3. Update `brands/base.ts`:
   - Remove `setActive` procedure (moved to user.update)
4. Update `brands/members.ts`:
   - Split `update` into separate `update`, `remove`, `leave` endpoints
5. Update `brands/invites.ts`:
   - Remove `respond` procedure (split to user + separate revoke)
   - Keep `list`, `send`
   - Add explicit `revoke` endpoint
6. Update `brands/theme.ts`:
   - Add `carousel.candidates` query
   - Add `carousel.update` mutation
   - Keep `get` and `update` (renamed from `updateConfig`)
7. Update `_app.ts`:
   - Change `workflow: workflowRouter` → `brands: brandsRouter`

**Verification:**
- Test brand CRUD operations
- Test member management
- Test invite send/revoke
- Test theme operations
- Test carousel selection

---

### Phase 5: Catalog & Products Router Updates (Medium Risk)

**Duration:** ~2-3 hours

**Tasks:**
1. Rename `brand/` directory → `catalog/`
2. Update `catalog/index.ts`:
   - Update imports
   - Rename exported router
3. Update `_app.ts`:
   - Change `brand: brandRouter` → `catalog: catalogRouter`
4. Update `products/index.ts`:
   - Merge `get` and `getByUpid` into single `get` endpoint
5. Update `products/variants.ts`:
   - Remove `get` endpoint (redundant with `list`)
   - Update `list` to accept `product_id` OR `product_upid`

**Verification:**
- Test all catalog CRUD operations
- Test product get by ID
- Test product get by UPID
- Test variant listing by product ID
- Test variant listing by product UPID

---

### Phase 6: Bulk, Composite, DPP Updates (Low Risk)

**Duration:** ~2 hours

**Tasks:**
1. Update `bulk/import.ts`:
   - Remove deprecated `validate` endpoint
2. Update `composite/index.ts`:
   - Rename `workflowInit` → `initDashboard`
   - Rename `brandCatalogContent` → `catalogContent`
3. Update `dpp-public/index.ts`:
   - Add `carousel.list` endpoint

**Verification:**
- Test bulk import flow (start, status, approve, cancel)
- Test composite queries
- Test public DPP carousel

---

### Phase 7: Cleanup & Templates Removal (Low Risk)

**Duration:** ~1 hour

**Tasks:**
1. Delete `templates/` router directory
2. Delete `templates.ts` schema file
3. Delete `templates.ts` query file
4. Remove templates from `_app.ts`
5. Search codebase for any remaining template references
6. Update any client code referencing templates

**Verification:**
- No TypeScript errors
- No runtime errors
- Full test suite passes

---

### Phase 8: Client Updates & Testing (Medium Risk)

**Duration:** ~3-4 hours

**Tasks:**
1. Update frontend TRPC client calls:
   - `trpc.workflow.*` → `trpc.brands.*`
   - `trpc.brand.*` → `trpc.catalog.*`
   - `trpc.workflow.setActive` → `trpc.user.update({ brand_id })`
   - `trpc.workflow.invites.respond({ action: "accept" })` → `trpc.user.invites.accept`
   - `trpc.workflow.invites.respond({ action: "decline" })` → `trpc.user.invites.reject`
   - `trpc.products.getByUpid` → `trpc.products.get({ upid })`
   - `trpc.composite.workflowInit` → `trpc.composite.initDashboard`
   - `trpc.composite.brandCatalogContent` → `trpc.composite.catalogContent`
2. Update any template references
3. Full end-to-end testing

**Verification:**
- All dashboard functionality works
- All product management works
- All import flows work
- DPP pages render correctly

---

## 8. Testing Strategy

### 8.1 Unit Tests

| Area | Tests |
|------|-------|
| Schemas | Validate all new/updated schemas with valid and invalid inputs |
| Queries | Test discriminated union handling in get/list functions |

### 8.2 Integration Tests

| Flow | Tests |
|------|-------|
| User | Profile update with brand_id, invite accept/reject |
| Brands | CRUD, member management, invite send/revoke |
| Theme | Get, update, carousel candidates, carousel update |
| Products | Get by ID, get by UPID, variant list by ID/UPID |
| DPP | Public carousel list |

### 8.3 End-to-End Tests

| Scenario | Steps |
|----------|-------|
| Brand Switching | Login → Switch brand → Verify active brand persists |
| Invite Flow | Send invite → Accept as recipient → Verify membership |
| Product Carousel | Select products → Save → View on DPP → Verify display |

---

## 9. Rollback Plan

### 9.1 Pre-Migration Checklist

- [ ] Create backup branch from main
- [ ] Document current API contract
- [ ] Ensure all tests pass before migration
- [ ] Communicate migration timeline to team

### 9.2 Rollback Triggers

- Critical functionality broken
- Data integrity issues
- Performance degradation >50%
- Multiple blocking bugs

### 9.3 Rollback Steps

1. **Immediate:** Revert to backup branch
2. **Client:** Revert frontend to previous version
3. **Database:** No schema changes required (same underlying data)
4. **Communication:** Notify team of rollback

### 9.4 Post-Rollback

- Document failure reasons
- Create issues for blocking problems
- Plan revised migration with fixes

---

## Summary

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| Routers | 10 | 9 | -1 (templates removed) |
| Endpoints | ~93 | ~89 | -4 |
| Schema Files | 15 | 13 | -2 (deleted), +2 (new) |
| Query Files | 13 | 12 | -1 (templates removed) |

### Key Benefits

1. **Semantic Clarity** - Router names match their domain
2. **Context Alignment** - Endpoints live where their context requirements make sense
3. **Reduced Duplication** - Merged get/getByUpid, removed deprecated endpoints
4. **Clean Separation** - User-level vs brand-level operations clearly separated
5. **Future-Proof** - Clear patterns for expansion

---

*Plan created as part of API redesign initiative. December 2024*

