# TypeScript Strict Mode Help

Get help with TypeScript strict mode issues, especially `exactOptionalPropertyTypes`.

## Common Patterns

### Handling Optional Properties with `exactOptionalPropertyTypes`

**Problem**: Cannot assign `undefined` to optional properties
```typescript
// ❌ WRONG
const obj: { prop?: string } = { prop: undefined }
```

**Solutions**:

1. **Conditional Spreading** (Recommended):
```typescript
const value: string | undefined = getValue()
const obj = {
  required: 'value',
  ...(value ? { prop: value } : {})
}
```

2. **Build Incrementally**:
```typescript
const obj: { prop?: string } = { required: 'value' }
if (value) obj.prop = value
```

### Safe Array Access with `noUncheckedIndexedAccess`

**Problem**: Array indices might not exist
```typescript
// ⚠️ arr[0] has type T | undefined
const first = arr[0]
```

**Solution**:
```typescript
function getFirstSafe<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined
  return arr[0]  // TypeScript knows this is safe
}
```

### Type Guards Instead of `any`

**Problem**: Need to handle unknown types
```typescript
// ❌ WRONG
function process(data: any) { ... }
```

**Solution**:
```typescript
function isValidData(data: unknown): data is { name: string } {
  return typeof data === 'object' &&
         data !== null &&
         'name' in data &&
         typeof data.name === 'string'
}

function process(data: unknown): void {
  if (isValidData(data)) {
    console.log(data.name)  // TypeScript knows the shape
  }
}
```

---

Need help with a specific strict mode error? Share the error message and code, and I'll provide a type-safe solution.
