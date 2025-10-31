# Fix Code Quality Issues

Automatically fix all fixable code quality issues in the codebase.

## Auto-Fix Steps (Run in Order)

1. **Fix ESLint issues**:
   ```bash
   npm run lint:fix
   ```
   - Fixes auto-fixable linting issues
   - May not fix all exhaustive-deps warnings (manual intervention needed)

2. **Format all code with Prettier**:
   ```bash
   npm run format
   ```
   - Formats all TypeScript, JavaScript, JSON, CSS, and Markdown files
   - Ensures consistent code style

3. **Fix security vulnerabilities**:
   ```bash
   npm audit fix
   ```
   - Fixes non-breaking security issues
   - If issues remain:
     ```bash
     npm audit fix --force
     ```
   - ⚠️ Warning: `--force` may introduce breaking changes - test thoroughly!

4. **Verify all fixes**:
   ```bash
   npm run type-check      # Check TypeScript
   npm run lint           # Check ESLint (0 warnings)
   npm run format:check   # Verify formatting
   npm run security-audit # Verify no vulnerabilities
   npm run check-deps     # Check circular dependencies
   ```

## Report Format

After running all fixes, provide detailed report:

### Success Report:
```
✅ AUTO-FIX COMPLETE

Fixed issues:
✓ ESLint: 5 auto-fixable issues resolved
✓ Prettier: 12 files formatted
✓ Security: 2 vulnerabilities patched

Verification:
✓ TypeScript: 0 errors
✓ ESLint: 0 warnings
✓ Format: All files formatted
✓ Security: 0 vulnerabilities
✓ Dependencies: No circular imports

All checks passed! Ready to commit.
```

### Partial Fix Report:
```
⚠️ AUTO-FIX PARTIAL

Auto-fixed:
✓ ESLint: 3 issues fixed
✓ Prettier: 8 files formatted
✓ Security: 1 vulnerability fixed

Manual fixes needed:
✗ TypeScript: 2 errors
  - components/FileUpload.tsx:132 - 'useCallback' is not defined
  - components/FileUpload.tsx:180 - Function used before declaration

✗ ESLint: 1 warning (manual fix required)
  - components/FileUpload.tsx:158 - Missing dependency: 'supportedFormats'

Would you like me to fix these remaining issues?
```

## Manual Fix Guidance

If issues remain after auto-fix, provide specific solutions:

### 1. TypeScript Errors

**Missing imports**:
```typescript
// Add to top of file:
import { useCallback, useMemo } from 'react'
```

**Hoisting errors**:
```typescript
// Move function declarations before use:
const helperFunc = useCallback(() => { ... }, [])  // Declare first

const mainFunc = useCallback(() => {
  helperFunc()  // Use after declaration
}, [helperFunc])
```

### 2. ESLint exhaustive-deps

**Missing dependencies**:
```typescript
// Add all used variables/functions to deps:
const fetch = useCallback(async () => {
  await fetchKeys()  // Used inside
}, [fetchKeys])  // Must be in deps array
```

**Stable arrays/objects**:
```typescript
// Wrap in useMemo:
const formats = useMemo(() => ['.mp3', '.wav'], [])

const validate = useCallback((file) => {
  return formats.includes(file.ext)
}, [formats])  // Now stable reference
```

**Function order**:
```typescript
// Declare before use:
const fetchKeys = useCallback(async () => { ... }, [])

const fetchData = useCallback(async () => {
  await fetchKeys()  // Used after declaration
}, [fetchKeys])
```

### 3. Security Vulnerabilities

**Non-breaking fixes**:
```bash
npm audit fix
```

**Breaking changes** (use cautiously):
```bash
npm audit fix --force
# Then test thoroughly:
npm run type-check
npm run lint
npm run test:unit
```

### 4. Missing Dev Dependencies

```bash
npm install --save-dev <missing-package>
git add package.json package-lock.json
```

## Offer to Fix Manually

If auto-fix doesn't resolve everything:

1. **TypeScript errors**: "I can add the missing imports and reorder functions"
2. **ESLint deps**: "I can add the missing dependencies to hook arrays"
3. **Security**: "Should I run `npm audit fix --force`? (may be breaking)"
4. **Refactoring needed**: "I can refactor this to fix the circular dependency"

## Next Steps

### All Fixed:
```bash
git add .
git commit -m "fix: resolve code quality issues"
git push
```

### Manual Intervention Needed:
- Offer to fix remaining issues one by one
- Explain tradeoffs for each approach
- Verify fixes with user before proceeding
