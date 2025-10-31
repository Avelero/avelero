# Pre-Commit Checklist

Run all mandatory checks before committing to prevent CI/CD failures.

## Critical Checks (All Must Pass)

1. **Type Check** - Verify no TypeScript errors:
   ```bash
   npm run type-check
   ```
   - **MUST PASS** - Zero errors allowed
   - Common issues: Missing imports, hoisting errors, type mismatches
   - Fix: Add missing imports, reorder function declarations, fix types

2. **Lint** - Check for code quality issues (--max-warnings 0):
   ```bash
   npm run lint
   ```
   - **MUST PASS** - Zero warnings allowed (CI enforces this)
   - Common issues: react-hooks/exhaustive-deps, missing dependencies
   - Auto-fix: `npm run lint:fix` (then verify changes)

3. **Format Check** - Ensure consistent code formatting:
   ```bash
   npm run format:check
   ```
   - **MUST PASS** - All files formatted with Prettier
   - Auto-fix: `npm run format`

4. **Security Audit** - Check for vulnerabilities:
   ```bash
   npm run security-audit
   ```
   - **MUST PASS** - No moderate/high/critical vulnerabilities
   - Fix: `npm audit fix` (or `npm audit fix --force` for breaking changes)

5. **Circular Dependencies** - Check for import cycles:
   ```bash
   npm run check-deps
   ```
   - **MUST PASS** - No circular dependencies
   - Fix: Refactor imports to break cycles

6. **Tests** - Run unit tests (when implemented):
   ```bash
   npm run test:unit
   ```

## Report Format

After running all checks, provide:

### If All Pass:
```
✅ PRE-COMMIT CHECKS PASSED

All quality gates passed:
✓ TypeScript compilation
✓ ESLint (0 warnings)
✓ Prettier formatting
✓ Security audit (0 vulnerabilities)
✓ No circular dependencies

Ready to commit! 🚀
```

### If Failures Exist:
```
❌ PRE-COMMIT CHECKS FAILED

Failed checks:
✗ ESLint: 3 warnings in FileUpload.tsx
  - Line 158: Missing dependency 'supportedFormats'
  - Line 180: Function 'validateFile' needs useCallback

✗ Format check: 2 files need formatting
  - .github/workflows/ci.yml
  - components/FileUpload.tsx

Auto-fix available? YES
Run: npm run lint:fix && npm run format
```

## Auto-Fix Workflow

If auto-fixable issues detected:

1. Run auto-fixes:
   ```bash
   npm run lint:fix      # Fix ESLint auto-fixable issues
   npm run format        # Format all files
   npm audit fix         # Fix security issues
   ```

2. Re-run checks to verify:
   ```bash
   npm run type-check
   npm run lint
   npm run format:check
   npm run security-audit
   npm run check-deps
   ```

3. If issues remain, offer manual help:
   - "I can help fix the remaining TypeScript errors"
   - "Would you like me to add the missing dependencies?"
   - "I can refactor to break the circular dependency"

## Suggested Next Steps

### All Checks Pass:
```bash
git add .
git commit -m "your commit message"
git push
```

### Issues Remain:
- Run `/fix-quality` to attempt automatic fixes
- Or say: "I see TypeScript errors. Would you like me to fix them?"
- Provide specific guidance for each remaining issue

## Common Issues and Solutions

1. **react-hooks/exhaustive-deps warnings**
   - Add missing dependencies to dependency array
   - Wrap arrays/objects in useMemo
   - Declare functions before use (hoisting)

2. **TypeScript hoisting errors**
   - Reorder function declarations
   - Move useCallback before it's used

3. **Missing imports**
   - Add: `import { useCallback, useMemo } from 'react'`

4. **Security vulnerabilities**
   - Run: `npm audit fix`
   - For breaking changes: `npm audit fix --force` (test thoroughly!)

5. **Format issues**
   - Run: `npm run format`

6. **Missing dev dependencies**
   - Install: `npm install --save-dev <package>`
   - Commit: `git add package.json package-lock.json`
