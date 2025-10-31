# CI/CD Troubleshooting Guide

Diagnose and fix GitHub Actions CI/CD pipeline failures.

## Quick Diagnosis

Run this command to check the latest workflow status:

```bash
gh run list --branch <branch-name> --limit 5
```

To view failure logs:

```bash
gh run view <run-id> --log-failed
```

## Common CI/CD Failures

### 1. ESLint Failures (--max-warnings 0)

**Error**: "Process completed with exit code 1" after linting

**Cause**: ESLint warnings treated as errors in CI (--max-warnings 0 flag)

**Common Warnings**:
- `react-hooks/exhaustive-deps` - Missing dependencies in hooks
- Unused variables or imports
- Console.log statements

**Solution**:
```bash
# Check locally first
npm run lint

# Auto-fix what's possible
npm run lint:fix

# Manually fix remaining issues:
# - Add missing dependencies to hook arrays
# - Remove unused imports
# - Remove console.log statements
```

**Example Fix**:
```typescript
// ❌ Warning: Missing dependency
const fetch = useCallback(async () => {
  await fetchKeys()
}, [])

// ✅ Fixed
const fetchKeys = useCallback(async () => { ... }, [])
const fetch = useCallback(async () => {
  await fetchKeys()
}, [fetchKeys])
```

### 2. TypeScript Compilation Errors

**Error**: "error TS2448: Block-scoped variable used before its declaration"

**Cause**: Functions used before declaration (hoisting issue)

**Solution**:
```typescript
// ❌ Wrong order
const parent = useCallback(() => {
  child()  // Used before declaration
}, [child])

const child = useCallback(() => { ... }, [])

// ✅ Correct order
const child = useCallback(() => { ... }, [])

const parent = useCallback(() => {
  child()  // Now declared
}, [child])
```

**Error**: "error TS2304: Cannot find name 'useCallback'"

**Solution**: Add missing import
```typescript
import { useCallback, useMemo, useEffect } from 'react'
```

### 3. Prettier Formatting Failures

**Error**: "Code style issues found in the above file"

**Cause**: Files not formatted with Prettier

**Solution**:
```bash
# Check which files need formatting
npm run format:check

# Auto-format all files
npm run format

# Verify
npm run format:check
```

### 4. Security Audit Failures

**Error**: "X moderate/high/critical severity vulnerabilities"

**Cause**: Outdated packages with known vulnerabilities

**Solution**:
```bash
# Fix non-breaking changes
npm audit fix

# If issues remain, check details
npm audit

# Force fix (may be breaking - test after!)
npm audit fix --force

# Verify no vulnerabilities remain
npm audit --audit-level=moderate
```

**Common Vulnerabilities**:
- micromatch < 4.0.8 (ReDoS)
- vite 7.1.0-7.1.10 (backslash bypass)

### 5. Missing Dev Dependencies

**Error**: "sh: 1: <command>: not found"

**Example**: `sh: 1: madge: not found`

**Cause**: Package used in npm script but not in package.json

**Solution**:
```bash
# Install missing package
npm install --save-dev madge

# Verify it works
npm run check-deps

# Commit package files
git add package.json package-lock.json
git commit -m "fix: add missing dev dependency"
```

### 6. Build Failures - Missing Environment Variables

**Error**: "Error: supabaseUrl is required"

**Cause**: Environment variables not set in GitHub Actions

**Solution**:

1. Go to **GitHub Repository → Settings → Secrets and variables → Actions**

2. Add required secrets:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

3. Update workflow if needed (.github/workflows/ci.yml):
   ```yaml
   - name: Build application
     run: npm run build
     env:
       NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
       NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
   ```

### 7. CodeQL/SARIF Upload Failures

**Error**: "Resource not accessible by integration"

**Cause**: Workflow lacks security-events permission

**Solution**:

Add permissions to workflow (.github/workflows/ci.yml):
```yaml
security-scan:
  name: Security Scan
  runs-on: ubuntu-latest
  permissions:
    contents: read
    security-events: write  # Required for SARIF upload
    actions: read
```

**Error**: "CodeQL Action v2 is deprecated"

**Solution**: Update to v3
```yaml
- name: Upload Trivy scan results
  uses: github/codeql-action/upload-sarif@v3  # Changed from v2
  with:
    sarif_file: 'trivy-results.sarif'
```

### 8. Circular Dependency Failures

**Error**: "Circular dependency detected"

**Cause**: Import cycles in codebase

**Solution**:
```bash
# Check for circular dependencies
npm run check-deps

# View detailed circular dependency graph
npx madge --circular --extensions ts,tsx .
```

**Fixing Circular Dependencies**:
1. Identify the cycle
2. Extract shared code to new file
3. Break the cycle by importing from the new file

## Pre-Push Checklist

**Run this EVERY time before pushing to prevent CI failures:**

```bash
# 1. Type check
npm run type-check

# 2. Lint (zero warnings)
npm run lint

# 3. Format check
npm run format:check

# 4. Security audit
npm run security-audit

# 5. Circular dependencies
npm run check-deps
```

**If any fail, fix before pushing!**

## Debugging Workflow

1. **Check latest run**:
   ```bash
   gh run list --branch feature/your-branch --limit 3
   ```

2. **View failure logs**:
   ```bash
   gh run view <run-id> --log-failed
   ```

3. **Identify failure type** (ESLint, TypeScript, Format, Security, Build)

4. **Reproduce locally**:
   ```bash
   npm run <failing-command>
   ```

5. **Fix issues** (use guidance above)

6. **Verify fix**:
   ```bash
   # Run all checks
   npm run type-check && npm run lint && npm run format:check && npm run security-audit
   ```

7. **Commit and push**:
   ```bash
   git add .
   git commit -m "fix: resolve CI failures"
   git push
   ```

## Emergency: CI Keeps Failing

If CI continues to fail after multiple fix attempts:

1. **Create clean branch**:
   ```bash
   git checkout -b fix/ci-issues
   ```

2. **Run comprehensive cleanup**:
   ```bash
   npm run lint:fix
   npm run format
   npm audit fix
   ```

3. **Fix remaining issues manually** (check each error message)

4. **Verify everything passes locally**:
   ```bash
   npm run type-check && \
   npm run lint && \
   npm run format:check && \
   npm run security-audit && \
   npm run check-deps
   ```

5. **Push and verify CI passes**

6. **Merge into main branch** once green

## Useful Commands

```bash
# View workflow runs
gh run list --branch <branch> --limit 10

# View specific run details
gh run view <run-id>

# View only failed logs
gh run view <run-id> --log-failed

# Watch run in real-time
gh run watch <run-id>

# Re-run failed jobs
gh run rerun <run-id>

# Cancel running workflow
gh run cancel <run-id>
```

## Prevention Tips

1. **Always run `/pre-commit`** before committing
2. **Use `/pro-mode`** to activate strict quality standards
3. **Fix warnings immediately** - don't let them accumulate
4. **Keep dependencies updated** - run `npm audit fix` regularly
5. **Test locally first** - reproduce CI environment with `npm ci`
6. **Add pre-commit hooks** - use husky/lint-staged
7. **Monitor CI failures** - set up GitHub notifications
