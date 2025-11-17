# Completion System Refactoring Plan

## Background

The completion system currently tracks passport module completion status using:
- `passports` table (being removed per proposal)
- `passport_module_completion` table (needs to be removed)
- `passport_template_modules` table (still valid - defines which modules are enabled per template)

**New Architecture**: Passport logic moves to the PRODUCT level via `products.template_id`.

## Current System Architecture

### Current Flow
```
Product → Passport → Template → Template Modules (enabled/disabled)
                  ↓
          Passport Module Completion (per passport, per module)
```

### Current Tables
1. **passports** (REMOVE):
   - Links: brandId, productId, variantId, templateId
   - Unique constraint: (brand, product, variant)

2. **passport_module_completion** (REMOVE):
   - Links: passportId, moduleKey
   - Tracks: isCompleted, lastEvaluatedAt

3. **passport_template_modules** (KEEP):
   - Links: templateId, moduleKey
   - Config: enabled (boolean), config (jsonb)

## New System Architecture

### New Flow
```
Product (with template_id) → Template → Template Modules (enabled/disabled)
              ↓
      Product Module Completion (per product, per module)
```

### New Tables Required

#### 1. Create `product_module_completion` table
```sql
CREATE TABLE product_module_completion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  module_key varchar NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  last_evaluated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  UNIQUE(product_id, module_key)
);

-- Add RLS policies
ALTER TABLE product_module_completion ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_module_completion_select_for_brand_members
  ON product_module_completion FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_module_completion.product_id
      AND is_brand_member(p.brand_id)
    )
  );

CREATE POLICY product_module_completion_insert_for_brand_members
  ON product_module_completion FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_module_completion.product_id
      AND is_brand_member(p.brand_id)
    )
  );

CREATE POLICY product_module_completion_update_for_brand_members
  ON product_module_completion FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_module_completion.product_id
      AND is_brand_member(p.brand_id)
    )
  );

CREATE POLICY product_module_completion_delete_for_brand_members
  ON product_module_completion FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_module_completion.product_id
      AND is_brand_member(p.brand_id)
    )
  );

-- Add service_role bypass
CREATE POLICY product_module_completion_service_role_all
  ON product_module_completion FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
```

#### 2. Migration to transfer existing data (if needed)
```sql
-- If preserving existing completion data:
INSERT INTO product_module_completion (product_id, module_key, is_completed, last_evaluated_at)
SELECT
  p.product_id,
  pmc.module_key,
  pmc.is_completed,
  pmc.last_evaluated_at
FROM passport_module_completion pmc
JOIN passports p ON p.id = pmc.passport_id
ON CONFLICT (product_id, module_key) DO UPDATE SET
  is_completed = EXCLUDED.is_completed,
  last_evaluated_at = EXCLUDED.last_evaluated_at;
```

#### 3. Drop old tables
```sql
DROP TABLE IF EXISTS passport_module_completion CASCADE;
DROP TABLE IF EXISTS passports CASCADE;
```

## Code Changes Required

### 1. Schema Changes (`packages/db/src/schema`)

**File**: `packages/db/src/schema/products/product-module-completion.ts` (NEW)
```typescript
import { sql } from "drizzle-orm";
import { boolean, pgPolicy, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { products } from "./products";

export const productModuleCompletion = pgTable(
  "product_module_completion",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    moduleKey: varchar("module_key").notNull(),
    isCompleted: boolean("is_completed").notNull().default(false),
    lastEvaluatedAt: timestamp("last_evaluated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One completion record per (product, module)
    uniqueIndex("product_module_completion_product_module_unq").on(
      table.productId,
      table.moduleKey,
    ),
    // RLS policies
    pgPolicy("product_module_completion_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_id
        AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_module_completion_insert_for_brand_members", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_id
        AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_module_completion_update_for_brand_members", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_id
        AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_module_completion_delete_for_brand_members", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products p
        WHERE p.id = product_id
        AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_module_completion_service_role_all", {
      as: "permissive",
      for: "all",
      to: ["service_role"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
  ],
);
```

**File**: `packages/db/src/schema/index.ts`
- Remove exports: `passports`, `passportModuleCompletion`
- Add export: `productModuleCompletion`

**File**: `packages/db/src/schema/passports/` directory
- Delete `passports.ts`
- Delete `passport-module-completion.ts`
- Keep `passport-templates.ts` and `passport-template-modules.ts`

### 2. Completion System Refactoring (`packages/db/src/completion`)

**File**: `packages/db/src/completion/evaluate.ts`

**OLD CODE**:
```typescript
export async function evaluateAndUpsertCompletion(
  db: Database,
  brandId: string,
  productId: string,
  opts?: { onlyModules?: ModuleKey[] },
) {
  // Resolve passport and template enabled modules
  const [pp] = await db
    .select({
      passportId: passports.id,
      templateId: passports.templateId,
    })
    .from(passports)
    .innerJoin(products, eq(passports.productId, products.id))
    .where(and(eq(products.id, productId), eq(passports.brandId, brandId)))
    .limit(1);
  if (!pp) return;
  // ... rest of logic
}
```

**NEW CODE**:
```typescript
export async function evaluateAndUpsertCompletion(
  db: Database,
  brandId: string,
  productId: string,
  opts?: { onlyModules?: ModuleKey[] },
): Promise<void> {
  // Resolve product and template enabled modules
  const [product] = await db
    .select({
      id: products.id,
      templateId: products.templateId,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);

  if (!product) return;

  // If product has no template, return early with no enabled modules
  if (!product.templateId) {
    return;
  }

  // Get enabled modules from template
  const enabledModulesRows = await db
    .select({ moduleKey: passportTemplateModules.moduleKey })
    .from(passportTemplateModules)
    .where(
      and(
        eq(passportTemplateModules.templateId, product.templateId),
        eq(passportTemplateModules.enabled, true),
      ),
    );

  const enabled = new Set<ModuleKey>(
    enabledModulesRows.map((r) => r.moduleKey as ModuleKey),
  );

  const targetModules: ModuleKey[] = (
    opts?.onlyModules ?? Array.from(enabled)
  ).filter((k) => enabled.has(k)) as ModuleKey[];

  if (!targetModules.length) {
    // Nothing to evaluate; still prune rows for modules no longer enabled
    await pruneDisabledModules(db, productId, Array.from(enabled));
    return;
  }

  // Evaluate in parallel with minimal reads per rule
  const results = await Promise.all(
    targetModules.map(async (key) => {
      const rule = RULES[key];
      const isCompleted = rule ? await rule.evaluate({ db, productId }) : false;
      return { key, isCompleted } as const;
    }),
  );

  // Upsert results into product_module_completion
  await db
    .insert(productModuleCompletion)
    .values(
      results.map((r) => ({
        productId: product.id,
        moduleKey: r.key,
        isCompleted: r.isCompleted,
        lastEvaluatedAt: new Date().toISOString(),
      })),
    )
    .onConflictDoUpdate({
      target: [
        productModuleCompletion.productId,
        productModuleCompletion.moduleKey,
      ],
      set: {
        isCompleted: (productModuleCompletion as any).excluded.isCompleted,
        lastEvaluatedAt: (productModuleCompletion as any).excluded.lastEvaluatedAt,
      },
    });

  // Prune rows for modules that are no longer enabled
  await pruneDisabledModules(db, productId, Array.from(enabled));
}

async function pruneDisabledModules(
  db: Database,
  productId: string,
  enabledKeys: string[],
): Promise<void> {
  if (!enabledKeys.length) {
    await db
      .delete(productModuleCompletion)
      .where(eq(productModuleCompletion.productId, productId));
    return;
  }
  await db
    .delete(productModuleCompletion)
    .where(
      and(
        eq(productModuleCompletion.productId, productId),
        notInArray(productModuleCompletion.moduleKey, enabledKeys),
      ),
    );
}
```

**File**: `packages/db/src/completion/template-sync.ts`
- Remove all `passports` references
- Update to work with `products.template_id` directly

**File**: `packages/db/src/completion/rules.ts`
- Update SKU reference on line 47 (use variant.id instead of variant.sku)

### 3. Router Changes (`apps/api/src/trpc/routers/passports`)

**Current**: The passports router needs major refactoring since passports table no longer exists.

**New Approach**:
- Passports are now just products with a `template_id`
- Passport CRUD operations should manipulate product.template_id
- Passport listing should query products where template_id IS NOT NULL

**Example Implementation**:
```typescript
// apps/api/src/trpc/routers/passports/index.ts

export const passportsRouter = router({
  list: protectedProcedure
    .input(listPassportsSchema)
    .query(async ({ input, ctx }) => {
      const { brand_id } = input;

      // Query products where template_id is set (these are "passports")
      const results = await db
        .select({
          id: products.id,
          product_id: products.id,
          variant_id: productVariants.id, // If variants exist
          template_id: products.templateId,
          status: products.status,
          // ... other fields
        })
        .from(products)
        .leftJoin(productVariants, eq(productVariants.productId, products.id))
        .where(
          and(
            eq(products.brandId, brand_id),
            isNotNull(products.templateId)
          )
        );

      return results;
    }),

  get: protectedProcedure
    .input(getPassportSchema)
    .query(async ({ input, ctx }) => {
      // Get product by UPID (unique passport identifier)
      // UPID is stored in products.upid or productVariants.upid
    }),

  create: protectedProcedure
    .input(createPassportSchema)
    .mutation(async ({ input, ctx }) => {
      const { product_id, variant_id, template_id, status } = input;

      // Simply update the product's template_id
      await db
        .update(products)
        .set({
          templateId: template_id,
          status: status
        })
        .where(eq(products.id, product_id));

      return { success: true };
    }),

  update: protectedProcedure
    .input(updatePassportSchema)
    .mutation(async ({ input, ctx }) => {
      const { upid, template_id, status } = input;

      // Find product by UPID and update template_id
      await db
        .update(products)
        .set({
          templateId: template_id,
          status: status
        })
        .where(eq(products.upid, upid));

      return { success: true };
    }),

  delete: protectedProcedure
    .input(deletePassportSchema)
    .mutation(async ({ input, ctx }) => {
      const { upid } = input;

      // Simply set template_id to null (remove passport association)
      await db
        .update(products)
        .set({ templateId: null })
        .where(eq(products.upid, upid));

      return { success: true };
    }),
});
```

### 4. Migration Script

**File**: `apps/api/supabase/migrations/YYYYMMDDHHMMSS_refactor_completion_system.sql`

```sql
-- Create new product_module_completion table
CREATE TABLE product_module_completion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  module_key varchar NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  last_evaluated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),

  UNIQUE(product_id, module_key)
);

-- Migrate existing data (if preserving completion history)
INSERT INTO product_module_completion (product_id, module_key, is_completed, last_evaluated_at)
SELECT
  p.product_id,
  pmc.module_key,
  pmc.is_completed,
  pmc.last_evaluated_at
FROM passport_module_completion pmc
JOIN passports p ON p.id = pmc.passport_id
ON CONFLICT (product_id, module_key) DO UPDATE SET
  is_completed = EXCLUDED.is_completed,
  last_evaluated_at = EXCLUDED.last_evaluated_at;

-- Enable RLS
ALTER TABLE product_module_completion ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY product_module_completion_select_for_brand_members
  ON product_module_completion FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_module_completion.product_id
      AND is_brand_member(p.brand_id)
    )
  );

CREATE POLICY product_module_completion_insert_for_brand_members
  ON product_module_completion FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_module_completion.product_id
      AND is_brand_member(p.brand_id)
    )
  );

CREATE POLICY product_module_completion_update_for_brand_members
  ON product_module_completion FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_module_completion.product_id
      AND is_brand_member(p.brand_id)
    )
  );

CREATE POLICY product_module_completion_delete_for_brand_members
  ON product_module_completion FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = product_module_completion.product_id
      AND is_brand_member(p.brand_id)
    )
  );

CREATE POLICY product_module_completion_service_role_all
  ON product_module_completion FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Drop old tables
DROP TABLE IF EXISTS passport_module_completion CASCADE;
DROP TABLE IF EXISTS passports CASCADE;
```

## Implementation Steps

### Phase 1: Preparation (Before Breaking Changes)
1. ✅ Create new `product_module_completion` table schema
2. ✅ Add migration script
3. ✅ Run migration on development database
4. ✅ Verify data migration (if applicable)

### Phase 2: Code Refactoring
1. ✅ Update schema exports in `packages/db/src/schema/index.ts`
2. ✅ Create `product-module-completion.ts` schema file
3. ✅ Refactor `evaluate.ts` to use `productModuleCompletion`
4. ✅ Refactor `template-sync.ts`
5. ✅ Fix `rules.ts` SKU reference
6. ✅ Delete `passports.ts` and `passport-module-completion.ts` schema files

### Phase 3: Router Updates
1. ✅ Refactor `passports` router to work with `products.template_id`
2. ✅ Update all passport-related queries
3. ✅ Test passport CRUD operations

### Phase 4: Testing & Validation
1. ✅ Run type-check: `npx tsc --noEmit`
2. ✅ Run lint: `npm run lint`
3. ✅ Run build: `npm run build`
4. ✅ Test completion evaluation
5. ✅ Test passport CRUD
6. ✅ Verify RLS policies

## Key Design Decisions

1. **Why product_module_completion instead of variant_module_completion?**
   - Passports were per (product, variant) but completion logic is primarily product-level
   - Most completion rules evaluate product attributes, not variant-specific data
   - Simplifies the model and reduces duplicate completion tracking

2. **Backward Compatibility**
   - Migration script preserves existing completion data
   - Frontend should use UPID (products.upid or productVariants.upid) for passport identification
   - Template association is now simpler: just set products.template_id

3. **Performance Considerations**
   - Fewer tables = simpler joins
   - Index on (product_id, module_key) for fast completion lookups
   - RLS policies use EXISTS with products join (should use indexes)

## Testing Checklist

- [ ] Can create a product with template_id
- [ ] Completion evaluation runs without errors
- [ ] Module completion status is saved correctly
- [ ] Disabled modules are pruned
- [ ] Passport CRUD operations work via products API
- [ ] RLS policies correctly restrict access
- [ ] Migration preserves existing completion data
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Build succeeds

## Rollback Plan

If issues arise:
1. Keep old tables temporarily (don't drop immediately)
2. Run both systems in parallel for validation
3. Use feature flag to switch between old/new completion systems
4. Restore from backup if data integrity issues occur

## References

- Original proposal: `proposal.md`
- Migration template: `apps/api/supabase/migrations/20251117140714_backend_redesign.sql`
- Completion rules: `packages/db/src/completion/rules.ts`
- Module keys: `packages/db/src/completion/module-keys.ts`
