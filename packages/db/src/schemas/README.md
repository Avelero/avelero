# Database Schemas Documentation

This directory contains the comprehensive schema system for the Avelero application, providing type-safe, validated, and standardized data structures across all modules.

## Overview

The schema system consists of several key components:

### Core Files

- **`shared.ts`** - Base schemas, error handling, and response envelopes
- **`enums.ts`** - Standardized enum definitions and metadata
- **`validation-utils.ts`** - Advanced validation functions with context awareness
- **`modules.ts`** - Module extension framework for schema customization

## Enum System

### Available Enums

#### EntityStatus
Manages entity lifecycle states with proper state transition validation:
```typescript
import { entityStatusEnum, validateEntityStatus } from "@v1/db/schemas";

// Basic validation
const result = validateEntityStatus("active");

// With transition validation
const transitionResult = validateEntityStatus("published", "draft");
```

**Values**: `draft`, `active`, `inactive`, `published`, `pending`, `archived`, `cancelled`, `deferred`, `blocked`

#### Priority
Hierarchical priority system with role-based access control:
```typescript
import { priorityEnum, validatePriority } from "@v1/db/schemas";

const context = {
  user: { id: "user1", role: "admin", permissions: ["admin"] }
};

const result = validatePriority("critical", context);
```

**Values**: `low`, `medium`, `high`, `critical`

#### UserRole
Brand-scoped user roles with permission validation:
```typescript
import { userRoleEnum, validateUserRole } from "@v1/db/schemas";

const context = {
  user: { id: "owner1", role: "owner", brandId: "brand1" },
  brand: { id: "brand1", ownerId: "owner1", memberIds: ["owner1"] }
};

const result = validateUserRole("admin", context);
```

**Values**: `owner`, `admin`, `member`, `viewer`

#### JobStatus
Background job lifecycle with transition constraints:
```typescript
import { jobStatusEnum, validateJobStatus } from "@v1/db/schemas";

// Valid transition: queued -> running
const result = validateJobStatus("running", "queued");
```

**Values**: `pending`, `queued`, `running`, `completed`, `failed`, `cancelled`, `timeout`, `retrying`

#### Other Enums
- **PermissionType**: `read`, `write`, `delete`, `manage`, `admin`
- **DataSourceType**: `manual`, `import`, `api`, `bulk`, `migration`, `sync`, `webhook`
- **ValidationSeverity**: `info`, `success`, `warning`, `error`, `critical`
- **Environment**: `development`, `testing`, `staging`, `production`
- **SortDirection**: `asc`, `desc`
- **Visibility**: `private`, `internal`, `public`, `restricted`

### Enum Features

#### Display Labels
Human-readable labels for all enum values:
```typescript
import { entityStatusLabels, getEnumLabel } from "@v1/db/schemas";

console.log(entityStatusLabels.active); // "Active"
console.log(getEnumLabel("high", "priority")); // "High Priority"
```

#### Color Schemes
Tailwind CSS-compatible color classes:
```typescript
import { entityStatusColors, priorityColors } from "@v1/db/schemas";

console.log(entityStatusColors.active); // "text-green-700 bg-green-100"
console.log(priorityColors.critical); // "text-red-700 bg-red-100"
```

#### Sort Ordering
Logical ordering for UI display:
```typescript
import { sortEnumValues, priorityOrder } from "@v1/db/schemas";

const priorities = ["critical", "low", "high", "medium"];
const sorted = sortEnumValues(priorities, "priority");
// Result: ["low", "medium", "high", "critical"]
```

## Validation System

### Core Validation Functions

#### Individual Validation
```typescript
import { validateEnum, validateEntityStatus } from "@v1/db/schemas";

// Basic enum validation
const result = validateEnum("active", entityStatusEnum, "status");

// Advanced entity status with transitions
const statusResult = validateEntityStatus("published", "active", context);

if (result.success) {
  console.log("Valid value:", result.data);
} else {
  console.log("Errors:", result.errors);
  console.log("Error response:", result.errorResponse);
}
```

#### Batch Validation
```typescript
import { validateEnumBatch, validateEntityStatusBatch } from "@v1/db/schemas";

// Validate multiple enum values
const values = ["low", "medium", "invalid", "high"];
const batchResult = validateEnumBatch(values, priorityEnum, "priority");

console.log("Valid items:", batchResult.validItems);
console.log("Invalid items:", batchResult.invalidItems);
console.log("Summary:", batchResult.summary);

// Validate status transitions in batch
const updates = [
  { id: "1", status: "active", currentStatus: "draft" },
  { id: "2", status: "published", currentStatus: "active" }
];
const statusBatchResult = validateEntityStatusBatch(updates, context);
```

### Validation Context

Validation functions support rich context for advanced business logic:

```typescript
import { createValidationContext } from "@v1/db/schemas";

const context = createValidationContext({
  userId: "user1",
  userRole: "admin",
  brandId: "brand1",
  brandOwnerId: "owner1",
  requestId: "req-123",
  requestPath: "/api/products",
  environment: "production",
  features: { advancedValidation: true }
});
```

### Permission-Based Filtering

Filter enum values based on user permissions:

```typescript
import { filterEnumByPermissions } from "@v1/db/schemas";

const context = {
  user: { id: "user1", role: "member", permissions: ["read", "write"] }
};

const priorities = ["low", "medium", "high", "critical"];
const filtered = filterEnumByPermissions(priorities, "priority", context);
// Result: ["low", "medium", "high"] (critical removed for non-admins)
```

## Integration with tRPC

### Router Usage

```typescript
// In tRPC router
import {
  entityStatusEnum,
  priorityEnum,
  validateEntityStatus,
  createValidationContext
} from "@v1/db/schemas";

export const productsRouter = createTRPCRouter({
  updateStatus: protectedProcedure
    .input(z.object({
      productId: z.string().uuid(),
      status: entityStatusEnum,
      currentStatus: entityStatusEnum.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const validationContext = createValidationContext({
        userId: ctx.user.id,
        userRole: ctx.role,
        brandId: ctx.brandId,
        requestId: ctx.requestId,
      });

      const statusValidation = validateEntityStatus(
        input.status,
        input.currentStatus,
        validationContext
      );

      if (!statusValidation.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: statusValidation.errorResponse!.message,
          cause: statusValidation.errors,
        });
      }

      // Status is validated, proceed with update
      // ...
    }),
});
```

### Frontend Usage

```typescript
// In React components
import { trpc } from "@/lib/trpc";
import {
  entityStatusLabels,
  entityStatusColors,
  sortEnumValues
} from "@v1/db/schemas";

export function StatusSelect({ value, onChange }) {
  const statuses = sortEnumValues(
    ["draft", "active", "published", "archived"],
    "entityStatus"
  );

  return (
    <select value={value} onChange={onChange}>
      {statuses.map(status => (
        <option key={status} value={status}>
          {entityStatusLabels[status]}
        </option>
      ))}
    </select>
  );
}

export function StatusBadge({ status }) {
  const colorClass = entityStatusColors[status];
  const label = entityStatusLabels[status];

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorClass}`}>
      {label}
    </span>
  );
}
```

## Error Handling Integration

The enum system integrates seamlessly with the comprehensive error handling system:

```typescript
import {
  validatePriority,
  createCommonErrors,
  type ValidationError,
  type ErrorResponse
} from "@v1/db/schemas";

const result = validatePriority("critical", context);

if (!result.success) {
  // Comprehensive error information available
  const validationErrors: ValidationError[] = result.errors!;
  const errorResponse: ErrorResponse = result.errorResponse!;

  // Can be used directly in API responses
  return res.status(422).json({
    success: false,
    error: errorResponse
  });
}
```

## State Transition Rules

### Entity Status Transitions

The system enforces logical state transitions:

```
draft → [pending, active, published, cancelled]
pending → [active, published, cancelled, blocked]
active → [inactive, published, archived, cancelled]
published → [inactive, archived, cancelled]
inactive → [active, archived, cancelled]
blocked → [pending, cancelled]
deferred → [pending, cancelled]
cancelled → [] (terminal)
archived → [] (terminal)
```

### Job Status Transitions

Background jobs follow strict workflow rules:

```
pending → [queued, cancelled]
queued → [running, cancelled]
running → [completed, failed, timeout, cancelled]
retrying → [running, failed, cancelled]
failed → [retrying, cancelled]
timeout → [retrying, cancelled]
completed → [] (terminal)
cancelled → [] (terminal)
```

## Best Practices

### 1. Always Use Validation Functions
```typescript
// ✅ Good
const result = validateEntityStatus(input.status, currentStatus, context);
if (!result.success) throw new Error(result.errorResponse!.message);

// ❌ Bad
const status = entityStatusEnum.parse(input.status); // No transition validation
```

### 2. Provide Context for Better Validation
```typescript
// ✅ Good
const context = createValidationContext({
  userId: ctx.user.id,
  userRole: ctx.role,
  brandId: ctx.brandId,
});
const result = validatePriority("critical", context);

// ❌ Bad
const result = validatePriority("critical"); // No permission checking
```

### 3. Use Batch Validation for Multiple Items
```typescript
// ✅ Good
const batchResult = validateEntityStatusBatch(statusUpdates, context);

// ❌ Bad
const results = statusUpdates.map(update =>
  validateEntityStatus(update.status, update.currentStatus, context)
); // Less efficient, harder to handle errors
```

### 4. Handle Warnings Appropriately
```typescript
const result = validateEntityStatus("draft", "published", context);
if (result.success && result.warnings) {
  // Log warnings for monitoring
  console.warn("Status transition warnings:", result.warnings);

  // Optionally show to user
  showWarningToast(result.warnings.join(", "));
}
```

### 5. Use Permission-Based Filtering
```typescript
// ✅ Good - Show only appropriate options to user
const availableStatuses = filterEnumByPermissions(
  allStatuses,
  "entityStatus",
  context
);

// ❌ Bad - Show all options, validate later
const availableStatuses = allStatuses;
```

## Testing

The enum and validation system includes comprehensive test coverage:

```bash
# Run enum tests
npm test packages/db/src/schemas/__tests__/enums.test.ts

# Run validation tests
npm test packages/db/src/schemas/__tests__/validation-utils.test.ts
```

Key test areas:
- Enum value validation
- Display labels and metadata
- State transition rules
- Permission-based validation
- Batch validation
- Error response generation
- Context-aware validation

## Migration Guide

When updating from basic text fields to enum validation:

### 1. Database Migration
```sql
-- Create enum type
CREATE TYPE entity_status AS ENUM (
  'draft', 'active', 'inactive', 'published',
  'pending', 'archived', 'cancelled', 'deferred', 'blocked'
);

-- Update table
ALTER TABLE products
ALTER COLUMN status TYPE entity_status
USING status::entity_status;
```

### 2. Schema Updates
```typescript
// Before
status: text("status").notNull().default("draft")

// After
status: entityStatusPgEnum("status").notNull().default("draft")
```

### 3. API Updates
```typescript
// Before
.input(z.object({
  status: z.string()
}))

// After
.input(z.object({
  status: entityStatusEnum
}))
```

This enum and validation system provides a robust foundation for maintaining data integrity while supporting complex business logic and user permission systems.