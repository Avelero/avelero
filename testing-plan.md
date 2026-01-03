# Avelero Testing Strategy

> **Last Updated**: January 2026  
> **Status**: Phase 1 - Integration Package Testing

---

## Table of Contents

1. [Overview](#overview)
2. [Test Types & Definitions](#test-types--definitions)
3. [File Naming Convention](#file-naming-convention)
4. [Current Focus: Phase 1](#current-focus-phase-1)
5. [Testing Package Architecture](#testing-package-architecture)
6. [CI/CD Pipeline Architecture](#cicd-pipeline-architecture)
7. [Future Phases (Not Yet Implemented)](#future-phases-not-yet-implemented)

---

## Overview

This document outlines Avelero's testing strategy for a modern CI/CD pipeline. The goal is to have:

1. **Unit Tests** - Fast, isolated tests that run on every PR and production deploy
2. **Integration Tests** - Database-dependent tests that run on PRs with preview branches
3. **Component Tests** - React hook/component behavior tests (treated as unit tests)

### Key Principles

- **Co-located tests**: Tests live alongside the code they test (`__tests__/` folders)
- **Shared utilities**: Common test helpers live in `packages/testing`
- **File naming over folders**: Use `*.integration.test.ts` suffix to identify integration tests
- **Test real code**: Never copy functions into test files; always import from source

---

## Test Types & Definitions

| Type | Definition | Database? | Speed | CI Stage |
|------|------------|-----------|-------|----------|
| **Unit Test** | Tests a single function/module in isolation with mocked dependencies | ❌ No | <10ms | Preview + Production |
| **Integration Test** | Tests multiple modules together with a real database | ✅ Yes (Preview Branch) | 100-500ms | Preview Only |
| **Component Test** | Tests React hooks/components using `@testing-library/react` | ❌ No | 10-50ms | Preview + Production |

### Examples in Our Codebase

**Unit Test**: Testing a pure utility function
```typescript
// packages/utils/__tests__/format.test.ts
import { formatCurrency } from "../src/format";
expect(formatCurrency(100, "EUR")).toBe("€100.00");
```

**Integration Test**: Testing sync engine with real database
```typescript
// packages/integrations/__tests__/sync/basic-sync.integration.test.ts
const result = await syncProducts(ctx);
// Queries real Supabase preview branch
const products = await testDb.select().from(products);
```

**Component Test**: Testing React hook behavior
```typescript
// apps/app/__tests__/hooks/use-variants.test.ts
import { renderHook, act } from "@testing-library/react";
import { useVariants } from "@/hooks/use-variants";

const { result } = renderHook(() => useVariants());
act(() => result.current.addVariant({ sku: "TEST" }));
expect(result.current.state.variants[0].status).toBe("new");
```

---

## File Naming Convention

Tests are differentiated by **file name suffix**, not folder structure:

| File Pattern | Test Type | Runs In |
|--------------|-----------|---------|
| `*.test.ts` | Unit Test | `bun run test:unit` |
| `*.unit.test.ts` | Unit Test (explicit) | `bun run test:unit` |
| `*.integration.test.ts` | Integration Test | `bun run test:integration` |

### Bun Test Commands

```bash
# Run only unit tests (fast, no DB)
bun test --testPathPattern='\.test\.ts$' --testPathIgnorePatterns='\.integration\.test\.ts$'

# Run only integration tests (requires DATABASE_URL)
bun test --testPathPattern='\.integration\.test\.ts$'

# Run all tests
bun test
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "bun test --preload ./__tests__/setup.ts",
    "test:unit": "bun test --preload ./__tests__/setup.ts --testPathIgnorePatterns='\\.integration\\.test\\.ts$'",
    "test:integration": "bun test --preload ./__tests__/setup.ts --testPathPattern='\\.integration\\.test\\.ts$' --serial"
  }
}
```

---

## Current Focus: Phase 1

> ⚠️ **We are NOT implementing the full file tree yet.**  
> Phase 1 focuses on two things only:
> 1. Create the `packages/testing` shared utilities package
> 2. Refactor `packages/integrations/__tests__` to use the new testing package

### Phase 1 Deliverables

#### 1. Create `packages/testing`

```
packages/testing/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # Main exports
    ├── db.ts                  # Database utilities (createTestBrand, cleanupTables, etc.)
    ├── mocks/
    │   ├── index.ts
    │   └── shopify.ts         # MSW handlers for Shopify API
    └── fixtures/
        ├── index.ts
        ├── products.ts        # Mock product factories
        └── variants.ts        # Mock variant factories
```

#### 2. Refactor `packages/integrations/__tests__`

**Before (current structure):**
```
packages/integrations/__tests__/
├── setup.ts
├── sync/
│   ├── basic-sync.test.ts      # ← These are integration tests
│   ├── resync.test.ts
│   └── ...
└── utils/
    ├── test-db.ts              # ← Move to packages/testing
    ├── mock-shopify.ts         # ← Move to packages/testing
    └── sync-context.ts         # ← Move to packages/testing
```

**After (Phase 1 structure):**
```
packages/integrations/__tests__/
├── setup.ts                    # Uses @v1/testing
├── sync/
│   ├── basic-sync.integration.test.ts    # ← Renamed with suffix
│   ├── edge-cases.integration.test.ts
│   ├── field-config.integration.test.ts
│   ├── matching.integration.test.ts
│   ├── multi-sync.integration.test.ts
│   ├── performance.integration.test.ts
│   └── resync.integration.test.ts
└── multi-source/
    └── conflicts.integration.test.ts
```

---

## Testing Package Architecture

### `packages/testing/package.json`

```json
{
  "name": "@v1/testing",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./db": "./src/db.ts",
    "./mocks": "./src/mocks/index.ts",
    "./mocks/shopify": "./src/mocks/shopify.ts",
    "./fixtures": "./src/fixtures/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@v1/db": "workspace:*",
    "drizzle-orm": "^0.44.7",
    "msw": "^2.7.0",
    "postgres": "^3.4.7"
  },
  "devDependencies": {
    "@types/bun": "^1.2.16",
    "@v1/tsconfig": "workspace:*",
    "typescript": "^5.9.2"
  }
}
```

### Key Exports

```typescript
// packages/testing/src/index.ts
export * from "./db";
export * from "./mocks";
export * from "./fixtures";

// packages/testing/src/db.ts
export { testDb, createTestBrand, createTestBrandIntegration, cleanupTables, closeTestDb };

// packages/testing/src/mocks/shopify.ts
export { mockServer, setMockProducts, clearMockProducts, createMockProduct, createMockVariant };

// packages/testing/src/fixtures/products.ts
export { createSizeVariants, createColorSizeVariants, createThreeAttributeVariants };
```

---

## CI/CD Pipeline Architecture

### Workflow File Structure

**Consolidated into two main files:**

| File | Purpose | When It Runs |
|------|---------|--------------|
| `preview.yaml` | Preview deployments + all tests | On PRs to `main` |
| `production.yaml` | Production deployments + unit tests only | On push to `main` |

### Preview Workflow (`preview.yaml`)

Tests run in this order:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PREVIEW PIPELINE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  detect-changes                                                      │
│       │                                                              │
│       ├──────────────────┬──────────────────┬─────────────────────  │
│       ▼                  ▼                  ▼                        │
│  test-unit           test-lint-*       setup-database               │
│  (all packages)      (per-app)              │                        │
│       │                  │                  │                        │
│       ▼                  ▼                  ▼                        │
│       └──────────────────┴────────┬─────────┘                        │
│                                   │                                  │
│                                   ▼                                  │
│                          test-integration                            │
│                    (packages/integrations only)                      │
│                                   │                                  │
│                                   ▼                                  │
│                          all-tests-passed                            │
│                                   │                                  │
│       ┌───────────────────────────┼───────────────────────────┐     │
│       ▼                           ▼                           ▼     │
│  deploy-app                 deploy-api                  deploy-*    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Preview Workflow Jobs (Key Additions)

```yaml
# preview.yaml - Add these jobs

test-unit:
  name: 🧪 Unit Tests
  needs: detect-changes
  if: github.event.action != 'closed'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v1
      with:
        bun-version: latest
    - name: Install dependencies
      run: bun install
    - name: Run unit tests
      run: bun run test:unit

test-integration:
  name: 🧪 Integration Tests
  needs: [detect-changes, setup-database, test-unit]
  if: |
    needs.detect-changes.outputs.integrations_changed == 'true' && 
    github.event.action != 'closed'
  runs-on: ubuntu-latest
  env:
    SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
    SUPABASE_PROJECT_ID: ${{ secrets.SUPABASE_PROJECT_ID }}
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v1
    - uses: supabase/setup-cli@v1
    - name: Install dependencies
      run: bun install
    - name: Fetch Branch Credentials
      run: |
        BRANCH_NAME="${{ github.head_ref }}"
        supabase branches get "$BRANCH_NAME" --project-ref $SUPABASE_PROJECT_ID -o env > .env.supabase
        set -a && source .env.supabase && set +a
        DATABASE_URL=$(echo "$POSTGRES_URL" | sed 's/:6543/:5432/')
        echo "DATABASE_URL=$DATABASE_URL" >> $GITHUB_ENV
    - name: Run integration tests
      run: bun run test:integration
      working-directory: ./packages/integrations
```

### Production Workflow (`production.yaml`)

**Consolidated single workflow:**

```yaml
name: Production Deploy

on:
  push:
    branches:
      - main

jobs:
  # ─────────────────────────────────────────────────────────────────
  # Gate: Unit tests must pass before any deployment
  # ─────────────────────────────────────────────────────────────────
  test-unit:
    name: 🧪 Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run test:unit

  # ─────────────────────────────────────────────────────────────────
  # Deployments (all depend on test-unit passing)
  # ─────────────────────────────────────────────────────────────────
  deploy-app:
    name: 📱 Deploy App
    needs: test-unit
    # ... existing production-app.yaml content

  deploy-api:
    name: 🔧 Deploy API
    needs: test-unit
    # ... existing production-api.yaml content

  deploy-web:
    name: 🌐 Deploy Web
    needs: test-unit
    # ... existing production-web.yaml content

  deploy-dpp:
    name: 📋 Deploy DPP
    needs: test-unit
    # ... existing production-dpp.yaml content

  deploy-jobs:
    name: ⚙️ Deploy Jobs
    needs: [test-unit, deploy-api]
    # ... existing production-jobs.yaml content

  deploy-db:
    name: 🗄️ Run Migrations
    needs: test-unit
    # ... existing production-db.yaml content
```

### Why No Integration Tests in Production?

1. **Integration tests need a test database** - We can't run them against production
2. **They already ran on the PR** - Before merging, the preview branch verified everything
3. **Unit tests catch regressions** - Fast feedback on broken logic
4. **Deployment is the real test** - Health checks verify production is working

---

## Future Phases (Not Yet Implemented)

> ⚠️ **These phases are documented for future reference only.**  
> Do not implement until Phase 1 is complete and verified.

### Phase 2: App Unit & Component Tests

```
apps/app/__tests__/
├── setup.ts
├── hooks/
│   ├── use-variants.test.ts           # Component test with renderHook
│   ├── use-passport-form.test.ts
│   └── use-attributes.test.ts
└── unit/
    └── utils/
        └── product-handle.test.ts
```

**Dependencies to add to `apps/app/package.json`:**
```json
{
  "devDependencies": {
    "@testing-library/react": "^16.0.0",
    "@v1/testing": "workspace:*"
  }
}
```

### Phase 3: API Route Tests

```
apps/api/__tests__/
├── setup.ts
├── unit/
│   └── middleware/
│       └── auth.test.ts
└── integration/
    └── routes/
        ├── products.integration.test.ts
        └── integrations.integration.test.ts
```

### Phase 4: Package Unit Tests

```
packages/db/__tests__/
└── queries/
    └── products.test.ts

packages/utils/__tests__/
└── format.test.ts
```

### Phase 5: Coverage Reporting

Add to CI:
```yaml
- name: Upload coverage
  uses: codecov/codecov-action@v4
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: false
```

---

## Appendix: Test Command Reference

| Command | Scope | Description |
|---------|-------|-------------|
| `bun run test` | All | Run all tests in package |
| `bun run test:unit` | Unit only | Fast tests, no DB required |
| `bun run test:integration` | Integration only | Requires DATABASE_URL, runs serially |
| `turbo run test` | Monorepo | Run tests across all packages in parallel |
| `turbo run test:unit` | Monorepo | Run unit tests across all packages |

---

## Appendix: Decision Log

| Decision | Rationale |
|----------|-----------|
| File naming over folders | More flexible; tests can live anywhere in `__tests__/` |
| Component tests = Unit tests | They don't need a database, so they run in CI with unit tests |
| `@testing-library/react` for hooks | Tests real code, not extracted copies |
| Integration tests only on preview | Can't run against production; already verified in PR |
| Consolidated production.yaml | Simpler maintenance; clear dependency chain |
