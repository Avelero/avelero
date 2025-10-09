# Avelero API Architecture - Deep Analysis & Identified Issues

## Executive Summary

This document provides a comprehensive analysis of the current Avelero API architecture, identifying specific weaknesses, inefficiencies, and gaps between user requirements and system capabilities. The API is built with **Hono + tRPC + Drizzle ORM** serving a digital product passport SaaS platform.

**Key Finding**: While the architecture has solid foundations (type-safe tRPC, Drizzle ORM, brand multi-tenancy), critical issues exist around **business logic placement**, **bulk operation design**, **transaction management**, and **query optimization**.

---

## Table of Contents

1. [Current Architecture Overview](#1-current-architecture-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Structure](#3-system-structure)
4. [User Requirements vs Current Capabilities](#4-user-requirements-vs-current-capabilities)
5. [Critical Issues & Weaknesses](#5-critical-issues--weaknesses)
6. [Code Examples of Problems](#6-code-examples-of-problems)
7. [Performance & Scalability Concerns](#7-performance--scalability-concerns)
8. [Recommendations Summary](#8-recommendations-summary)

---

## 1. Current Architecture Overview

### Architecture Pattern
```
┌─────────────┐
│   Client    │
│  (Next.js)  │
└──────┬──────┘
       │ HTTP/tRPC
       ▼
┌─────────────────────────────────────┐
│       Hono HTTP Server              │
│  (Port 3000, CORS, Headers)         │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│     tRPC Router Layer               │
│  • products.ts (710 lines)          │
│  • passports.ts (1229 lines)        │
│  • imports.ts (bulk operations)     │
│  • variants, templates, etc.        │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Database Query Layer (@v1/db)      │
│  • products.ts                      │
│  • passports.ts                     │
│  • Drizzle ORM queries              │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│     Supabase PostgreSQL             │
│  (RLS enabled, multi-tenant)        │
└─────────────────────────────────────┘
```

### Entry Point Flow

**File**: `apps/api/src/index.ts`

```typescript
const app = new Hono();

// Security & CORS
app.use(secureHeaders());
app.use("*", cors({
  origin: process.env.ALLOWED_API_ORIGINS?.split(",") ?? ["http://localhost:3000"],
  credentials: true,
}));

// Mount tRPC at /trpc/*
app.use("/trpc/*", trpcServer({
  router: appRouter,
  createContext: async (opts) => {
    const ctx = await createTRPCContext({ req: opts.req });
    return ctx;
  },
}));

export default {
  port: 3000,
  hostname: "0.0.0.0",
  fetch: app.fetch,
};
```

**Problem**: Entry point is clean, but lacks:
- Rate limiting
- Request tracing/logging infrastructure
- Metrics collection
- Circuit breaker patterns

---

## 2. Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| HTTP Server | Hono | Latest | Lightweight HTTP framework |
| API Protocol | tRPC | v10+ | Type-safe RPC framework |
| Database ORM | Drizzle ORM | Latest | Type-safe SQL query builder |
| Database | Supabase PostgreSQL | Cloud | Primary data store with RLS |
| Cache Layer | Redis (via @v1/kv) | Latest | Caching & invalidation |
| Runtime | Bun | 1.2.21 | JavaScript runtime |
| Auth | Supabase Auth | Cloud | JWT-based authentication |

---

## 3. System Structure

### 3.1 Router Organization

**File**: `apps/api/src/trpc/routers/_app.ts`

```typescript
export const appRouter = createTRPCRouter({
  brand: brandRouter,
  user: userRouter,
  catalog: catalogRouter,
  brandCatalog: brandCatalogRouter,
  categories: categoriesRouter,
  products: productsRouter,        // 710 lines - TOO LARGE
  variants: variantsRouter,
  passports: passportsRouter,       // 1229 lines - BLOATED
  templates: templatesRouter,
  modules: modulesRouter,
  productAttributes: productAttributesRouter,
  imports: importsRouter,           // Bulk operations
  analytics: analyticsRouter,
});
```

**Issue #1: Monolithic Router Files**
- `products.ts`: 710 lines in a single file
- `passports.ts`: 1,229 lines in a single file
- Violates Single Responsibility Principle
- Hard to maintain, test, and extend

### 3.2 Context Structure

**File**: `apps/api/src/trpc/init.ts`

```typescript
export interface TRPCContext {
  // Database clients
  supabase: SupabaseClient<SupabaseDatabase>;
  supabaseAdmin?: SupabaseClient<SupabaseDatabase> | null;
  db: DrizzleDatabase;

  // User authentication
  user: User | null;
  geo: GeoContext;

  // Brand scoping (multi-tenant isolation)
  brandId?: string | null;
  role?: Role | null;
  brandContext?: BrandContext | null;
  userContext?: UserContext | null;
  brandAccessManager?: BrandAccessManager | null;

  // Request metadata
  requestId?: string;
  timestamp: Date;
}
```

**Strong Points**:
- ✅ Comprehensive brand multi-tenancy support
- ✅ Helper methods for permission checking
- ✅ Type-safe context propagation

**Weaknesses**:
- ⚠️ Context creation is expensive (multiple DB queries per request)
- ⚠️ No connection pooling optimization
- ⚠️ Geo context underutilized

---

## 4. User Requirements vs Current Capabilities

### 4.1 User Story: Create Single Product with Minimal Data

**User Need**: "I want to quickly create a product with just a name and category"

**Current Implementation**:

```typescript
// File: apps/api/src/trpc/routers/products.ts:236
create: protectedProcedure
  .input(createProductSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, brandId } = ctx;

    if (!brandId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Brand context required",
      });
    }

    // Transform and prepare data
    const transformedData = transformProductData(input);

    // Calculate completeness score
    const completenessScore = calculateProductCompleteness({
      name: transformedData.name,
      description: transformedData.description,
      categoryId: transformedData.categoryId,
      primaryImageUrl: transformedData.primaryImageUrl,
      season: transformedData.season,
    });

    const newProductData = {
      ...transformedData,
      brandId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create the product
    const [newProduct] = await db
      .insert(products)
      .values(newProductData)
      .returning();

    // Invalidate caches
    await invalidateProductCaches(brandId);

    return {
      data: [newProduct],
      affectedCount: 1,
      meta: { completenessScore },
    };
  }),
```

**Issues**:
1. ⚠️ **Cache invalidation on every create** - slows down single operations
2. ⚠️ **Completeness calculation is synchronous** - blocks response
3. ⚠️ Returns array wrapper for single item (inconsistent API)
4. ✅ **Good**: Brand isolation, type safety, validation

**Gap**: Works fine for single products but design doesn't scale to bulk operations.

---

### 4.2 User Story: Create Product with Variants

**User Need**: "I want to create a product with 5 color variants in one operation"

**Current Implementation**:

```typescript
// File: apps/api/src/trpc/routers/products.ts:284
createWithVariants: protectedProcedure
  .input(
    z.object({
      productData: createProductSchema,
      variants: z.array(z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        customData: z.record(z.any()).optional(),
      })).optional(),
      createDefaultPassports: z.boolean().default(false),
      templateId: z.string().uuid().optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const txContext = createTransactionFromTRPCContext(ctx);
    const transformedProductData = transformProductData(input.productData);

    const transactionInput = {
      brandId: txContext.brandId,
      productData: {
        ...transformedProductData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      variants: input.variants,
      createDefaultPassports: input.createDefaultPassports,
      templateId: input.templateId,
    };

    // Execute transaction
    const result = await createProductWithVariantsTransaction(
      ctx.db,
      transactionInput,
      {
        timeout: 30000,
        isolation: "read committed",
        maxRetries: 3,
      },
    );

    if (!result.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Transaction failed: ${result.error}`,
      });
    }

    await invalidateProductCaches(txContext.brandId);

    return {
      data: result.data || [],
      affectedCount: result.data?.length || 0,
      transactionInfo: {
        operations: result.operations,
        success: result.success,
      },
    };
  }),
```

**Issues**:
1. ✅ **Good**: Uses transactions for atomicity
2. ⚠️ **30-second timeout** - too short for large batches
3. ⚠️ **Synchronous processing** - blocks client during entire operation
4. ⚠️ **Cache invalidation after transaction** - can fail silently
5. **CRITICAL**: Business logic scattered between router and transaction utility

**Gap**: Acceptable for 5-10 variants, but will timeout for 50+ variants.

---

### 4.3 User Story: Bulk Import 100,000 Products

**User Need**: "I want to import 100,000 products from our ERP system with all attributes"

**Current Implementation**:

```typescript
// File: apps/api/src/trpc/routers/imports.ts
export const importsRouter = createTRPCRouter({
  bulk: {
    createProducts: protectedProcedure
      .input(
        listProductsSchema.extend({
          items: createProductSchema.array().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { db, brandId } = ctx;
        if (!brandId) throw new Error("No active brand");

        const created: { id: string }[] = [];

        // 🚨 CRITICAL ISSUE: Sequential processing in loop
        for (const item of input.items) {
          const row = await createProduct(db, brandId, {
            name: item.name,
            description: item.description,
            categoryId: item.category_id,
            season: item.season,
            brandCertificationId: item.brand_certification_id,
            showcaseBrandId: item.showcase_brand_id,
            primaryImageUrl: item.primary_image_url,
          });
          if (row?.id) created.push({ id: row.id });
        }

        await redis.incr(`brand_version:${brandId}`);
        return { created: created.length, products: created };
      }),
  },
});
```

**CRITICAL ISSUES**:

1. **🚨 Sequential Loop Processing**:
   - Processes items **one at a time** in a `for` loop
   - For 100,000 products: ~100,000 database round trips
   - **Estimated time**: 2-3 seconds per product = **~70 hours total**

2. **🚨 No Batch Processing**:
   - Drizzle ORM supports `insert().values([array])` for batching
   - Current code doesn't use it

3. **🚨 No Background Job System**:
   - Bulk import blocks HTTP request
   - tRPC will timeout after ~2 minutes
   - No progress tracking for user

4. **🚨 No Error Recovery**:
   - If operation fails at item 50,000, all progress is lost
   - No partial success handling

5. **🚨 Memory Issues**:
   - Stores all created IDs in memory: `created: { id: string }[]`
   - For 100,000 products, this is ~3.2MB of string data in memory

**What Should Happen**:
```typescript
// Pseudo-code for proper implementation
bulkImport: protectedProcedure
  .input(bulkImportSchema)
  .mutation(async ({ ctx, input }) => {
    // 1. Create background job
    const jobId = await createJob({
      type: 'BULK_PRODUCT_IMPORT',
      brandId: ctx.brandId,
      totalItems: input.items.length,
      status: 'pending',
    });

    // 2. Enqueue job to worker
    await jobQueue.add('product-import', {
      jobId,
      brandId: ctx.brandId,
      items: input.items,
    }, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });

    // 3. Return immediately
    return {
      jobId,
      status: 'processing',
      estimatedDuration: calculateETA(input.items.length),
    };
  }),

// Worker (separate process)
async function processProductImport(job) {
  const BATCH_SIZE = 1000;
  const batches = chunk(job.data.items, BATCH_SIZE);

  for (const [index, batch] of batches.entries()) {
    await db.insert(products).values(
      batch.map(item => ({
        ...item,
        brandId: job.data.brandId,
        createdAt: new Date().toISOString(),
      }))
    );

    // Update progress
    await updateJobProgress(job.data.jobId, {
      processed: (index + 1) * BATCH_SIZE,
      total: job.data.items.length,
    });
  }
}
```

**Gap Analysis**:
- ❌ **No job queue system** (should use BullMQ, pg-boss, or similar)
- ❌ **No progress tracking**
- ❌ **No batch processing logic**
- ❌ **No worker infrastructure**

---

### 4.4 User Story: Update 1,000 Products at Once

**User Need**: "I want to update the season field for all products in my Spring 2025 collection"

**Current Implementation**:

```typescript
// File: apps/api/src/trpc/routers/products.ts:422
bulkUpdate: protectedProcedure
  .input(bulkUpdateProductSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, brandId } = ctx;
    const { selection, data: updateData, preview = false } = input;

    if (!brandId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Brand context required",
      });
    }

    // Build conditions based on selection
    const conditions = [eq(products.brandId, brandId)];

    if (typeof selection === "object" && "ids" in selection) {
      conditions.push(inArray(products.id, selection.ids));
    } else if (typeof selection === "object" && "filter" in selection) {
      if (selection.filter.categoryIds) {
        conditions.push(
          inArray(products.categoryId, selection.filter.categoryIds),
        );
      }
      if (selection.filter.seasons) {
        conditions.push(inArray(products.season, selection.filter.seasons));
      }
    }

    // 🚨 Safety guard: Count affected records
    const countQuery = await db
      .select({ count: count() })
      .from(products)
      .where(and(...conditions));

    const affectedCount = countQuery[0].count;

    // 🚨 Hard limit
    if (affectedCount > MAX_BULK_UPDATE) {  // MAX_BULK_UPDATE = 1000
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Bulk operation affects ${affectedCount} records. Maximum allowed is ${MAX_BULK_UPDATE}.`,
      });
    }

    // Preview mode check
    if (affectedCount > PREVIEW_THRESHOLD && !preview) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Bulk operation affects ${affectedCount} records. Use preview=true first.`,
      });
    }

    if (preview) {
      return { data: [], affectedCount, preview: true };
    }

    // Transform and perform update
    const transformedData = transformProductData(updateData);
    const finalUpdateData = {
      ...transformedData,
      updatedAt: new Date().toISOString(),
    };

    // 🚨 Single UPDATE query - can be slow for 1000+ records
    const updatedProducts = await db
      .update(products)
      .set(finalUpdateData)
      .where(and(...conditions))
      .returning();

    await invalidateProductCaches(brandId);

    return {
      data: updatedProducts,
      affectedCount: updatedProducts.length,
    };
  }),
```

**Issues**:

1. **✅ Good Safety Guards**:
   - Hard limit of 1,000 records
   - Preview mode for large operations
   - Count query before update

2. **⚠️ Performance Issues**:
   - `.returning()` loads all updated records into memory
   - For 1,000 products, this is ~1-2MB of data returned
   - Single UPDATE query can take 5-10 seconds

3. **⚠️ Arbitrary Limits**:
   ```typescript
   const MAX_BULK_UPDATE = 1000;
   const PREVIEW_THRESHOLD = 100;
   ```
   - Why 1,000? Should be based on database performance testing
   - Prevents legitimate use cases (updating 5,000 products)

4. **❌ No Batch Processing**:
   - Could update in batches of 100-200 records
   - Would provide better progress feedback
   - Would reduce lock contention

**What User Expects**:
```typescript
// Expected: Background job with progress
bulkUpdate: protectedProcedure
  .input(bulkUpdateSchema)
  .mutation(async ({ ctx, input }) => {
    // For > 1000 records, create background job
    if (estimatedCount > 1000) {
      const jobId = await createBulkUpdateJob({
        brandId: ctx.brandId,
        selection: input.selection,
        updateData: input.data,
      });

      return {
        jobId,
        status: 'queued',
        estimatedDuration: '2-5 minutes',
      };
    }

    // For <= 1000 records, process synchronously
    return await performBulkUpdate(ctx.db, input);
  }),
```

**Gap**: No support for > 1,000 record updates without manual chunking.

---

## 5. Critical Issues & Weaknesses

### 5.1 Business Logic Placement Issues

**Problem**: Business logic is scattered across three layers:

1. **Router Layer** (`apps/api/src/trpc/routers/`)
2. **Query Layer** (`packages/db/src/queries/`)
3. **Transaction Utilities** (`packages/db/src/utils/`)

**Example: Product Creation Logic**

**In Router** (`products.ts:236`):
```typescript
create: protectedProcedure
  .input(createProductSchema)
  .mutation(async ({ ctx, input }) => {
    // ❌ BUSINESS LOGIC IN ROUTER
    const transformedData = transformProductData(input);
    const completenessScore = calculateProductCompleteness({
      name: transformedData.name,
      description: transformedData.description,
      // ...
    });

    const newProductData = {
      ...transformedData,
      brandId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const [newProduct] = await db
      .insert(products)
      .values(newProductData)
      .returning();

    // ❌ SIDE EFFECT IN ROUTER
    await invalidateProductCaches(brandId);

    return { data: [newProduct], affectedCount: 1, meta: { completenessScore } };
  }),
```

**In Query Layer** (`packages/db/src/queries/products.ts:84`):
```typescript
export async function createProduct(
  db: Database,
  brandId: string,
  input: { name: string; description?: string; /* ... */ },
) {
  let created: { id: string } | undefined;

  // ❌ TRANSACTION LOGIC IN QUERY LAYER
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(products)
      .values({
        id: crypto.randomUUID(),
        brandId,
        name: input.name,
        description: input.description ?? null,
        // ... mapping logic here
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();
    created = row;

    // ❌ BUSINESS LOGIC IN QUERY LAYER
    if (row?.id) {
      await evaluateAndUpsertCompletion(tx, brandId, row.id);
    }
  });

  return created;
}
```

**Why This is Bad**:
1. **Cannot reuse logic**: Product creation duplicated in 3 places
2. **Inconsistent behavior**: Router version calculates completeness differently
3. **Hard to test**: Must mock entire tRPC context
4. **Violates SRP**: Router handles validation, transformation, business logic, and caching

**Correct Architecture**:
```typescript
// packages/db/src/services/product-service.ts
export class ProductService {
  constructor(private db: Database, private cache: CacheService) {}

  async createProduct(brandId: string, input: CreateProductInput): Promise<Product> {
    return await this.db.transaction(async (tx) => {
      // 1. Transform input
      const productData = this.transformProductData(input);

      // 2. Calculate scores
      const completeness = this.calculateCompleteness(productData);

      // 3. Insert product
      const [product] = await tx.insert(products).values({
        ...productData,
        brandId,
        completeness,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).returning();

      // 4. Update completion tracking
      await this.updateCompletionTracking(tx, product.id, brandId);

      // 5. Invalidate caches
      await this.cache.invalidateProductCaches(brandId);

      return product;
    });
  }
}

// apps/api/src/trpc/routers/products.ts
create: protectedProcedure
  .input(createProductSchema)
  .mutation(async ({ ctx, input }) => {
    const service = new ProductService(ctx.db, ctx.cache);
    const product = await service.createProduct(ctx.brandId, input);
    return { data: [product] };
  }),
```

---

### 5.2 Query Optimization Issues

**Problem**: Passport list endpoint performs expensive joins on every request

**File**: `apps/api/src/trpc/routers/passports.ts:306-376`

```typescript
list: protectedProcedure
  .input(...)
  .query(async ({ ctx, input }) => {
    // ...

    // 🚨 ALWAYS joins 5 tables, even if not needed
    if (needsJoins) {
      const query = db
        .select({
          passport: passports,
          ...(include.product && { product: products }),
          ...(include.variant && { variant: productVariants }),
          ...(include.template && { template: passportTemplates }),
        })
        .from(passports)
        .leftJoin(products, eq(passports.productId, products.id))
        .leftJoin(productVariants, eq(passports.variantId, productVariants.id))
        .leftJoin(passportTemplates, eq(passports.templateId, passportTemplates.id))
        // 🚨 More joins for search/filter
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .leftJoin(brandColors, eq(productVariants.colorId, brandColors.id))
        .leftJoin(brandSizes, eq(productVariants.sizeId, brandSizes.id))
        .where(and(...conditions))
        .orderBy(...)
        .limit(limit + 1);

      const queryResults = !cursor && offset > 0
        ? await query.offset(offset)
        : await query;

      // Map results
      results = queryResults.map((row) => ({
        ...row.passport,
        ...(include.product && row.product && { product: row.product }),
        ...(include.variant && row.variant && { variant: row.variant }),
        ...(include.template && row.template && { template: row.template }),
      }));
    }
    // ...
  }),
```

**Issues**:

1. **🚨 N+1 Query Problem in Disguise**:
   - Joins 6 tables on every list request
   - Even when user only needs passport IDs
   - Query time: ~500ms-2s for 1,000 passports

2. **🚨 Search Performance**:
   ```typescript
   if (filter.search?.trim()) {
     const searchTerm = `%${rawSearchTerm}%`;
     conditions.push(
       sql`(
         ${products.name} ILIKE ${searchTerm}
         OR COALESCE(${products.description}, '') ILIKE ${searchTerm}
         OR COALESCE(${products.season}, '') ILIKE ${searchTerm}
         OR COALESCE(${productVariants.sku}, '') ILIKE ${searchTerm}
         OR ${productVariants.upid} ILIKE ${searchTerm}
         OR ${passports.id}::text ILIKE ${searchTerm}
         OR ${passports.slug} ILIKE ${searchTerm}
         OR COALESCE(${categories.name}, '') ILIKE ${searchTerm}
         OR COALESCE(${brandColors.name}, '') ILIKE ${searchTerm}
         OR COALESCE(${brandSizes.name}, '') ILIKE ${searchTerm}
       )`,
     );
   }
   ```
   - **10 ILIKE comparisons per row** - extremely slow
   - No full-text search indexes
   - No search result caching
   - For 10,000 passports: ~10-30 seconds query time

3. **🚨 Pagination Issues**:
   ```typescript
   const offset = page && page > 1 ? (page - 1) * limit : 0;
   const queryResults = !cursor && offset > 0
     ? await query.offset(offset)
     : await query;
   ```
   - Uses OFFSET for pagination fallback
   - OFFSET 5000 with complex joins = 5+ seconds
   - Database still scans all rows before offset

4. **❌ No Query Result Caching**:
   - Same list query runs on every request
   - No ETag support
   - No conditional GET (304 Not Modified)

**What Should Happen**:
```typescript
// 1. Use database indexes
CREATE INDEX idx_passports_search ON passports
USING gin(to_tsvector('english', name || ' ' || slug));

// 2. Implement search service
async function searchPassports(query: string) {
  return db.select()
    .from(passports)
    .where(sql`to_tsvector('english', name || ' ' || slug) @@ plainto_tsquery('english', ${query})`)
    .limit(20);
}

// 3. Cache list results
const cacheKey = `passports:list:${brandId}:${hashQueryParams(input)}`;
const cached = await cache.get(cacheKey);
if (cached) return cached;

const results = await db.query...
await cache.set(cacheKey, results, { ttl: 60 }); // 1 minute
return results;
```

---

### 5.3 Transaction Management Issues

**Problem**: Inconsistent transaction usage and error handling

**Example 1: No Transaction** (`products.ts:236`):
```typescript
create: protectedProcedure
  .mutation(async ({ ctx, input }) => {
    // ... transformations ...

    // 🚨 No transaction - what if cache invalidation fails?
    const [newProduct] = await db
      .insert(products)
      .values(newProductData)
      .returning();

    // 🚨 This can fail silently, leaving stale cache
    await invalidateProductCaches(brandId);

    return { data: [newProduct] };
  }),
```

**Example 2: Transaction Without Retry** (`products.ts:320`):
```typescript
createWithVariants: protectedProcedure
  .mutation(async ({ ctx, input }) => {
    // Uses transaction but fixed timeout
    const result = await createProductWithVariantsTransaction(
      ctx.db,
      transactionInput,
      {
        timeout: 30000,  // 🚨 Fixed 30s - what if network is slow?
        isolation: "read committed",
        maxRetries: 3,   // ✅ Good
      },
    );

    if (!result.success) {
      // 🚨 Generic error - no details for user
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Transaction failed: ${result.error}`,
      });
    }
    // ...
  }),
```

**Example 3: Transaction in Query Layer** (`queries/products.ts:98`):
```typescript
export async function createProduct(db: Database, brandId: string, input: {...}) {
  let created: { id: string } | undefined;

  // 🚨 Transaction hardcoded in query function
  await db.transaction(async (tx) => {
    const [row] = await tx.insert(products).values({...}).returning();
    created = row;

    if (row?.id) {
      await evaluateAndUpsertCompletion(tx, brandId, row.id);
    }
  });

  return created;
}
```

**Issues**:
1. **Inconsistent**: Some operations use transactions, some don't
2. **No retry logic**: Most operations fail immediately on conflict
3. **Poor error messages**: Users get generic "Transaction failed"
4. **Cache invalidation outside transaction**: Can leave inconsistent state
5. **No saga pattern**: For multi-step operations (create product → variants → passports)

---

### 5.4 Caching Strategy Issues

**Problem**: Cache invalidation is aggressive and blocks operations

**File**: `packages/kv/src/invalidation.ts` (referenced in routers)

```typescript
// Called after EVERY product mutation
export async function invalidateProductCaches(brandId: string) {
  await redis.del(`products:list:${brandId}`);
  await redis.del(`products:metrics:${brandId}`);
  await redis.del(`products:aggregates:${brandId}`);
  await redis.incr(`brand_version:${brandId}`);
}
```

**Called from**:
- `products.create()` - after inserting 1 product
- `products.update()` - after updating 1 product
- `products.bulkUpdate()` - after updating 1,000 products
- `products.delete()` - after deleting products

**Issues**:

1. **🚨 Synchronous Cache Invalidation**:
   ```typescript
   const [newProduct] = await db.insert(products).values(...).returning();

   // 🚨 Blocks response by ~50-100ms for Redis operations
   await invalidateProductCaches(brandId);

   return { data: [newProduct] };
   ```

2. **🚨 Blanket Invalidation**:
   - Creating 1 product invalidates ALL list caches
   - Updating product name invalidates metrics cache (unnecessary)
   - No granular cache keys

3. **❌ No Background Invalidation**:
   - Could use Redis pub/sub to notify cache workers
   - Could use time-based expiry instead of active invalidation

4. **❌ Cache Stampede Risk**:
   ```typescript
   // If 10 users request products list after invalidation:
   const cached = await cache.get(cacheKey);
   if (!cached) {
     // 🚨 All 10 users trigger expensive query simultaneously
     const data = await db.query.products.findMany({...});
     await cache.set(cacheKey, data);
     return data;
   }
   ```
   - No cache locking
   - No stale-while-revalidate pattern

**Better Approach**:
```typescript
// 1. Granular cache keys
const cacheKey = `products:list:${brandId}:${page}:${sortField}:${filterHash}`;

// 2. Async invalidation
await db.insert(products).values(...);
queueMicrotask(() => invalidateProductCaches(brandId));  // Non-blocking
return { data: [newProduct] };

// 3. Cache stampede protection
async function getOrSetCache(key, fetchFn, ttl) {
  const lockKey = `lock:${key}`;
  const data = await cache.get(key);

  if (data) return data;

  // Try to acquire lock
  const locked = await cache.set(lockKey, '1', { ttl: 10, nx: true });
  if (!locked) {
    // Another request is fetching, wait for it
    await sleep(100);
    return cache.get(key) || fetchFn();
  }

  // We have the lock, fetch data
  const fresh = await fetchFn();
  await cache.set(key, fresh, { ttl });
  await cache.del(lockKey);
  return fresh;
}
```

---

## 6. Code Examples of Problems

### 6.1 Bloated Router Files

**Problem**: 1,229 lines in `passports.ts` - should be split into modules

**Current Structure**:
```
passports.ts (1,229 lines)
├── list (170 lines) - pagination, filtering, sorting, joins
├── countByStatus (107 lines) - aggregation logic
├── get (82 lines) - single passport retrieval
├── create (68 lines) - creation with scoring
├── update (80 lines) - partial updates with recalculation
├── bulkUpdate (114 lines) - bulk operations with safety guards
├── aggregate (214 lines) - 10+ different metrics
└── getFilterOptions (78 lines) - filter dropdown data
```

**Should Be**:
```
passports/
├── router.ts (50 lines) - route definitions only
├── list-handler.ts (100 lines) - list logic
├── crud-handler.ts (150 lines) - CRUD operations
├── bulk-handler.ts (120 lines) - bulk operations
├── aggregation-handler.ts (200 lines) - metrics & stats
└── filter-handler.ts (80 lines) - filter options
```

---

### 6.2 Rigid Endpoint Design

**Problem**: Cannot get product with variants without also fetching template data

**Current**:
```typescript
// To get product with variants, must also join templates
const product = await trpc.products.get.query({
  where: { productId: 'xyz' },
  include: {
    variants: true,    // ✅ Want this
    template: false,   // ❌ Don't want, but query still joins
    category: false,
  }
});
```

**Generated SQL**:
```sql
SELECT
  products.*,
  productVariants.*,
  passportTemplates.*  -- 🚨 Fetched even though include.template = false
FROM products
LEFT JOIN product_variants ON ...
LEFT JOIN passport_templates ON ...  -- 🚨 Unnecessary join
WHERE products.id = 'xyz';
```

**Why**: The `needsJoins` flag is too coarse-grained:
```typescript
const needsJoins =
  include.product ||
  include.variant ||
  include.template ||
  filter.search?.trim() ||
  filter.categoryIds?.length;

if (needsJoins) {
  // 🚨 Joins ALL tables, even if only one include is true
  const query = db.select({...})
    .leftJoin(products, ...)
    .leftJoin(productVariants, ...)
    .leftJoin(passportTemplates, ...)
    .leftJoin(categories, ...)
    .leftJoin(brandColors, ...)
    .leftJoin(brandSizes, ...);
}
```

**Should Be**:
```typescript
// Dynamic query builder
let query = db.select({ passport: passports }).from(passports);

if (include.product) {
  query = query.leftJoin(products, eq(passports.productId, products.id));
}
if (include.variant) {
  query = query.leftJoin(productVariants, eq(passports.variantId, productVariants.id));
}
if (include.template) {
  query = query.leftJoin(passportTemplates, eq(passports.templateId, passportTemplates.id));
}

// Only join for filters if actually filtering
if (filter.categoryIds?.length) {
  query = query.leftJoin(categories, eq(products.categoryId, categories.id));
}
```

---

## 7. Performance & Scalability Concerns

### 7.1 No Connection Pooling Optimization

**Issue**: Every request creates new context with database queries

```typescript
// apps/api/src/trpc/init.ts:91
export async function createTRPCContext(c: { req: Request }): Promise<TRPCContext> {
  const supabase = createSupabaseForRequest(authHeader ?? null);
  const supabaseAdmin = createSupabaseAdmin();
  const db = drizzleDb;  // ✅ Singleton, good

  const { data: userRes } = await supabase.auth.getUser(bearerToken);
  const user = userRes?.user ?? null;

  if (user) {
    // 🚨 2 database queries on EVERY authenticated request
    const { data: userData } = await supabase
      .from("users")
      .select("brand_id, email, full_name")
      .eq("id", user.id)
      .single();

    const { data: memberships } = await supabase
      .from("users_on_brand")
      .select("user_id, brand_id, role, created_at")
      .eq("user_id", user.id);

    // ... more processing ...
  }

  return { /* context */ };
}
```

**Impact**:
- **2 DB queries per request** minimum
- For 100 req/sec: **200 queries/sec just for context**
- Context creation: ~50-150ms per request

**Solution**:
```typescript
// Cache user context for 5 minutes
async function getUserContext(userId: string): Promise<UserContext> {
  const cacheKey = `user:context:${userId}`;
  const cached = await cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const userData = await supabase.from("users").select("...").eq("id", userId).single();
  const memberships = await supabase.from("users_on_brand").select("...").eq("user_id", userId);

  const context = { /* build context */ };
  await cache.set(cacheKey, JSON.stringify(context), { ttl: 300 });
  return context;
}
```

---

### 7.2 Memory Usage Concerns

**Problem**: Bulk operations load all data into memory

```typescript
// Example: Bulk update returns ALL updated records
bulkUpdate: protectedProcedure
  .mutation(async ({ ctx, input }) => {
    // ...

    // 🚨 For 1,000 products, loads ~1-2MB into Node.js memory
    const updatedProducts = await db
      .update(products)
      .set(finalUpdateData)
      .where(and(...conditions))
      .returning();  // 🚨 Returns full rows

    return {
      data: updatedProducts,  // 🚨 Serializes to JSON response
      affectedCount: updatedProducts.length,
    };
  }),
```

**Impact**:
- For 1,000 products × 2KB each = **2MB per request**
- JSON serialization adds ~30% overhead = **2.6MB**
- If 10 concurrent bulk updates: **26MB** memory spike
- Can cause garbage collection pauses

**Solution**:
```typescript
// Option 1: Return only count
const result = await db.update(products)
  .set(finalUpdateData)
  .where(and(...conditions));
  // No .returning()

return {
  affectedCount: result.rowCount,
  success: true,
};

// Option 2: Stream results (for large datasets)
const stream = db.update(products)
  .set(finalUpdateData)
  .where(and(...conditions))
  .returning()
  .stream();

return new ReadableStream({
  async start(controller) {
    for await (const row of stream) {
      controller.enqueue(row);
    }
    controller.close();
  }
});
```

---

### 7.3 No Rate Limiting

**Problem**: API has no rate limiting - vulnerable to abuse

```typescript
// apps/api/src/index.ts - No rate limiting middleware
app.use(secureHeaders());
app.use("*", cors({...}));

// 🚨 Missing:
// app.use(rateLimiter({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 1000, // 1000 requests per 15 min
// }));

app.use("/trpc/*", trpcServer({...}));
```

**Risks**:
- User can send 100,000 requests/sec
- Can drain database connection pool
- Can fill up Redis cache
- No DDoS protection

---

## 8. Recommendations Summary

### High Priority (Critical)

1. **✅ Implement Background Job System**
   - Use BullMQ or pg-boss
   - Handle bulk imports asynchronously
   - Provide progress tracking via WebSocket or polling

2. **✅ Add Service Layer**
   - Extract business logic from routers
   - Create `ProductService`, `PassportService`, etc.
   - Make services independently testable

3. **✅ Optimize Query Performance**
   - Add full-text search indexes
   - Implement query result caching
   - Use dynamic query building (conditional joins)

4. **✅ Fix Bulk Operations**
   - Implement batch processing (1,000 records per batch)
   - Add partial success handling
   - Use streaming for large result sets

### Medium Priority (Important)

5. **✅ Refactor Large Router Files**
   - Split `passports.ts` (1,229 lines) into modules
   - Split `products.ts` (710 lines) into modules
   - Create handler pattern

6. **✅ Improve Transaction Management**
   - Add retry logic with exponential backoff
   - Implement saga pattern for multi-step operations
   - Move transactions to service layer

7. **✅ Optimize Caching Strategy**
   - Implement granular cache keys
   - Add cache stampede protection
   - Use async cache invalidation

8. **✅ Add Rate Limiting**
   - Implement per-user rate limits
   - Add IP-based rate limiting
   - Different limits per endpoint type

### Low Priority (Nice to Have)

9. **✅ Add Request Tracing**
   - Implement OpenTelemetry
   - Track query performance
   - Monitor slow endpoints

10. **✅ Improve Error Messages**
    - Return structured errors
    - Include error codes for client handling
    - Add error recovery suggestions

11. **✅ Add API Versioning**
    - Prepare for breaking changes
    - Support multiple API versions
    - Gradual migration path

---

## Conclusion

The current Avelero API has a **solid foundation** with tRPC, Drizzle ORM, and proper authentication. However, it suffers from critical architectural issues:

**Biggest Problems**:
1. 🚨 **No background job system** - blocks bulk operations
2. 🚨 **Business logic in routers** - hard to maintain and test
3. 🚨 **Query optimization needed** - slow list/search operations
4. 🚨 **Bulk operations don't scale** - sequential processing

**Next Steps**:
1. Implement background job queue (BullMQ)
2. Create service layer for business logic
3. Add query caching and indexes
4. Refactor bulk operations to use batching

This analysis provides a clear roadmap for API redesign focused on **scalability**, **maintainability**, and **performance**.
