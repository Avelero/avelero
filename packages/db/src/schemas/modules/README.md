# Module Schema Extension Framework

## Overview

The Module Schema Extension Framework provides a standardized, type-safe way to extend base schemas with module-specific fields while maintaining consistency across the Avelero API. This framework is designed to work seamlessly with the existing envelope patterns from Task 1.2.

## Key Features

- **Type-safe schema extension** - Full TypeScript inference for extended schemas
- **Automatic base schema merging** - Combines base and module-specific fields
- **Centralized registry** - Manage all module schemas in one place
- **Response envelope integration** - Works with existing success/error patterns
- **Validation utilities** - Custom validation helpers for business rules
- **Consistent naming** - Enforces camelCase conventions throughout

## Architecture

### Core Components

1. **Extension Functions** - Create extended schemas from base + module fields
2. **Module Schema Creator** - Bundles all schemas for a module
3. **Registry System** - Centralized storage and retrieval
4. **Type Helpers** - TypeScript inference utilities
5. **Validation Utilities** - Custom validation logic

### File Structure

```
packages/db/src/schemas/modules/
├── index.ts                    # Main exports and utilities
├── products.ts                 # Products module extensions
├── variants.ts                 # Variants module extensions
├── passports.ts                # Passports module extensions
├── README.md                   # This documentation
└── __tests__/
    └── module-extension-framework.test.ts
```

## Usage Guide

### 1. Creating a New Module Extension

```typescript
import { z } from "zod";
import {
  createModuleSchemas,
  registerModuleSchemas,
  type InferModuleFilter,
  validationPatterns,
} from "../shared";

// Define module-specific extensions
const myModuleFilterExtensions = {
  // Module-specific filter fields
  myModuleIds: z.array(z.string().uuid()).optional(),
  customAttribute: z.string().optional(),
  hasFeature: z.boolean().optional(),
} as const;

const myModuleSortFields = [
  "customSort",
  "featureScore",
] as const;

const myModuleIncludeExtensions = {
  customRelation: z.boolean().default(false),
  relatedData: z.boolean().default(false),
} as const;

// Create and register the module schemas
export const myModuleSchemas = registerModuleSchemas(
  createModuleSchemas({
    moduleId: "myModule",
    filterExtensions: myModuleFilterExtensions,
    sortFields: myModuleSortFields,
    includeExtensions: myModuleIncludeExtensions,
    // ... other extensions
  })
);

// Export types for use in application
export type MyModuleFilter = InferModuleFilter<typeof myModuleSchemas>;
```

### 2. Using Module Schemas in tRPC Routers

```typescript
import { createTRPCRouter, protectedProcedure } from "../init";
import { myModuleSchemas } from "@v1/db/schemas/modules";

export const myModuleRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      filter: myModuleSchemas.filterSchema.optional(),
      sort: myModuleSchemas.sortSchema.optional(),
      pagination: myModuleSchemas.paginationSchema.optional(),
      include: myModuleSchemas.includeSchema.optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { filter = {}, sort, pagination, include } = input;

      // Use Drizzle with type-safe filtering
      const data = await ctx.db.query.myModuleTable.findMany({
        where: /* build conditions from filter */,
        orderBy: /* build order from sort */,
        limit: pagination?.limit,
        with: /* build relations from include */,
      });

      // Return standardized response
      return myModuleSchemas.createListResponse(myModuleDataSchema)(data);
    }),

  create: protectedProcedure
    .input(myModuleSchemas.dataSchema.extend({
      // Required fields for creation
      name: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await ctx.db.insert(myModuleTable)
        .values({ ...input, brandId: ctx.brandId })
        .returning();

      return myModuleSchemas.createMutationResponse(myModuleDataSchema)({
        data: [created],
        affectedCount: 1,
      });
    }),
});
```

### 3. Frontend Usage with Type Safety

```typescript
// React component with full type inference
import { trpc } from "@/lib/trpc";
import type { MyModuleFilter, MyModuleSort } from "@v1/db/schemas/modules";

export function MyModuleList() {
  const [filters, setFilters] = useState<Partial<MyModuleFilter>>({
    hasFeature: true,
    customAttribute: "example",
  });

  const [sort, setSort] = useState<MyModuleSort>({
    field: "customSort", // Type-safe field selection
    direction: "desc",
  });

  const { data, isLoading } = trpc.myModule.list.useQuery({
    filter: filters,
    sort,
    pagination: { limit: 20 },
    include: { customRelation: true },
  });

  // data is fully typed based on schema definitions
  return (
    <div>
      {data?.data.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
}
```

## Extension Types

### Filter Extensions

Add module-specific filtering capabilities:

```typescript
const filterExtensions = {
  // ID-based filters
  moduleIds: z.array(z.string().uuid()).optional(),

  // Attribute filters
  customStatus: z.array(z.enum(["active", "inactive"])).optional(),
  hasAttribute: z.boolean().optional(),

  // Range filters
  scoreRange: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
  }).optional(),

  // Pattern matching
  namePattern: z.string().optional(),

  // Relationship filters
  relatedItemIds: z.array(z.string().uuid()).optional(),
} as const;
```

### Sort Extensions

Add module-specific sortable fields:

```typescript
const sortFields = [
  "customField",
  "calculatedScore",
  "lastProcessed",
  "priority",
] as const;
```

### Include Extensions

Define module-specific relations to include:

```typescript
const includeExtensions = {
  // Direct relations
  relatedItems: z.boolean().default(false),
  metadata: z.boolean().default(false),

  // Computed relations
  statistics: z.boolean().default(false),
  validationResults: z.boolean().default(false),

  // Through relations
  parentCategory: z.boolean().default(false),
} as const;
```

### Data Extensions

Specify module-specific data fields for mutations:

```typescript
const dataExtensions = {
  // Core module fields
  customAttribute: z.string().max(255).optional(),
  settings: z.record(z.any()).optional(),

  // Validation fields
  validationScore: z.number().min(0).max(100).optional(),

  // Metadata
  lastProcessedAt: z.date().optional(),
  processingNotes: z.string().max(1000).optional(),
} as const;
```

## Registry Management

### Registering Modules

```typescript
// Automatic registration during module creation
export const myModuleSchemas = registerModuleSchemas(
  createModuleSchemas({
    moduleId: "myModule",
    // ... extensions
  })
);
```

### Retrieving Registered Modules

```typescript
import { getModuleSchemas, getRegisteredModuleIds } from "@v1/db/schemas/modules";

// Get specific module
const productSchemas = getModuleSchemas("products");

// List all registered modules
const allModuleIds = getRegisteredModuleIds();
console.log("Registered modules:", allModuleIds);
```

### Development Utilities

```typescript
import {
  getAllModuleSchemas,
  validateModuleRegistration,
  getModuleSchemaStats,
} from "@v1/db/schemas/modules";

// Get all schemas for inspection
const allSchemas = getAllModuleSchemas();

// Validate a module is properly registered
const validation = validateModuleRegistration("products");
if (!validation.hasAllSchemas) {
  console.log("Missing schemas:", validation.missingSchemas);
}

// Get overall statistics
const stats = getModuleSchemaStats();
console.log(`${stats.validModules}/${stats.totalModules} modules valid`);
```

## Best Practices

### 1. Naming Conventions

- Use **camelCase** for all field names
- Prefix module-specific fields with module name when ambiguous
- Use descriptive, clear field names
- Follow existing patterns in base schemas

```typescript
// Good
moduleSpecificIds: z.array(z.string().uuid()).optional(),
hasValidationErrors: z.boolean().optional(),
lastSyncedAt: z.date().optional(),

// Avoid
module_ids: z.array(z.string().uuid()).optional(), // snake_case
x: z.boolean().optional(), // unclear
synced: z.date().optional(), // ambiguous
```

### 2. Type Safety

- Always use TypeScript inference helpers
- Export module types for reuse
- Leverage strict mode for validation
- Document complex type relationships

```typescript
// Export types for external use
export type ProductsFilter = InferModuleFilter<typeof productsSchemas>;
export type ProductsData = InferModuleData<typeof productsSchemas>;

// Use in application code
const handleFilter = (filter: ProductsFilter) => {
  // filter is fully typed
};
```

### 3. Validation Helpers

- Create module-specific validation functions
- Include business rule validation
- Provide transformation utilities
- Add comprehensive error handling

```typescript
// Validation helper example
export const validateProductSku = (sku: string): boolean => {
  const skuPattern = /^[A-Z0-9-]{8,12}$/;
  return skuPattern.test(sku);
};

// Transformation helper example
export const transformProductData = (data: any): any => {
  return {
    ...data,
    season: data.season?.toUpperCase(),
    name: data.name?.trim(),
  };
};
```

### 4. Documentation

- Include comprehensive JSDoc comments
- Document business rules and constraints
- Provide usage examples
- Explain complex relationships

```typescript
/**
 * Product-specific filter extensions
 *
 * Extends base filter schema with product catalog specific fields:
 * - Product identification (SKUs, UPIDs)
 * - Product attributes (seasons, certifications)
 * - Relationship filtering (variants, materials)
 * - Content filtering (images, descriptions)
 */
const productFilterExtensions = {
  /**
   * Filter by product SKUs
   * @example ["SKU123", "SKU456"]
   */
  skus: z.array(z.string()).optional(),
  // ... more fields
} as const;
```

## Testing

### Unit Tests

The framework includes comprehensive unit tests covering:

- Extension function behavior
- Module creation and registration
- Type inference correctness
- Error handling scenarios
- Performance characteristics

Run tests with:

```bash
cd packages/db
npm test src/schemas/modules/__tests__/
```

### Integration Tests

Test module extensions in tRPC routers:

```typescript
// Test tRPC integration
describe("MyModule tRPC Router", () => {
  test("should accept module-specific filters", async () => {
    const caller = createCaller({ /* mock context */ });

    const result = await caller.myModule.list({
      filter: {
        myModuleIds: ["uuid1", "uuid2"],
        customAttribute: "test",
      },
    });

    expect(result.data).toBeDefined();
  });
});
```

## Migration Guide

### From Existing Schemas

To migrate existing module schemas to the extension framework:

1. **Identify module-specific fields** in current schemas
2. **Group fields by type** (filter, sort, include, etc.)
3. **Create extension objects** using the new format
4. **Register the module** with the framework
5. **Update tRPC routers** to use new schemas
6. **Update frontend types** to use inferred types

### Breaking Changes

The extension framework maintains compatibility with existing patterns but provides enhanced type safety and consistency. Key changes:

- Schema structure is now standardized across modules
- Type exports follow consistent naming patterns
- Response envelopes are created through framework utilities
- Registry system provides centralized management

## Examples

See the following implemented examples:

- **products.ts** - Product catalog with variants, images, and attributes
- **variants.ts** - Product variants with SKUs, colors, and sizes
- **passports.ts** - Digital product passports with templates and modules

Each example demonstrates different aspects of the framework and provides real-world usage patterns.

## Troubleshooting

### Common Issues

1. **Type inference not working**
   - Ensure you're using the `Infer*` type helpers
   - Check that the module is properly registered
   - Verify TypeScript version compatibility

2. **Schema validation failing**
   - Check field naming follows camelCase convention
   - Verify all required imports are present
   - Use strict mode during development

3. **Registry errors**
   - Ensure moduleId is unique
   - Check that schemas are registered before use
   - Clear registry in tests to avoid conflicts

### Debug Utilities

```typescript
// Check module registration
import { validateModuleRegistration } from "@v1/db/schemas/modules";

const validation = validateModuleRegistration("myModule");
console.log("Module validation:", validation);

// Inspect schema structure
import { getModuleSchemas } from "@v1/db/schemas/modules";

const schemas = getModuleSchemas("myModule");
console.log("Module schemas:", Object.keys(schemas));
```

## Contributing

When adding new modules or extending existing ones:

1. Follow the established patterns in existing modules
2. Add comprehensive tests for new functionality
3. Update documentation with usage examples
4. Ensure TypeScript types are properly exported
5. Test integration with tRPC routers
6. Validate performance impact for large datasets

The Module Schema Extension Framework provides a robust foundation for building type-safe, scalable APIs while maintaining consistency across the Avelero platform.