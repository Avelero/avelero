# Custom Domain Management - Implementation Plan

> **Status**: In Progress (Phase 6 Complete)
> **Based on**: [custom-domain-specs.md](./custom-domain-specs.md)
> **Methodology**: Test-Driven Development (TDD)

---

## Table of Contents

1. [File Tree Overview](#1-file-tree-overview)
2. [Phase 1: Database Schema & Migration](#phase-1-database-schema--migration)
3. [Phase 2: API Schemas & Utilities](#phase-2-api-schemas--utilities)
4. [Phase 3: Unit Tests (TDD Foundation)](#phase-3-unit-tests-tdd-foundation)
5. [Phase 4: tRPC Router Implementation](#phase-4-trpc-router-implementation)
6. [Phase 5: Integration Tests](#phase-5-integration-tests)
7. [Phase 6: Client Hooks](#phase-6-client-hooks)
8. [Phase 7: UI Components](#phase-7-ui-components)
9. [Phase 8: Settings Page Integration](#phase-8-settings-page-integration)
10. [Phase 9: Final Validation](#phase-9-final-validation)

---

## 1. File Tree Overview

### Current Relevant Structure

```
avelero-v2/
├── packages/
│   └── db/
│       └── src/
│           └── schema/
│               ├── brands/
│               │   ├── brand-theme.ts
│               │   ├── brand-members.ts
│               │   ├── brand-invites.ts
│               │   └── brand-tags.ts
│               └── index.ts
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── schemas/
│   │   │   │   ├── _shared/
│   │   │   │   │   ├── primitives.ts
│   │   │   │   │   └── patterns.ts
│   │   │   │   └── brand.ts
│   │   │   ├── trpc/
│   │   │   │   └── routers/
│   │   │   │       └── brand/
│   │   │   │           ├── index.ts
│   │   │   │           ├── base.ts
│   │   │   │           └── theme.ts
│   │   │   └── utils/
│   │   │       └── errors.ts
│   │   └── __tests__/
│   │       ├── setup.ts
│   │       └── integration/
│   │           └── trpc/
│   │               └── bulk-export.test.ts
│   └── app/
│       └── src/
│           ├── app/
│           │   └── (dashboard)/(main)/(sidebar)/settings/
│           │       ├── layout.tsx
│           │       └── page.tsx
│           ├── components/
│           │   ├── settings/
│           │   │   ├── set-name.tsx
│           │   │   ├── set-slug.tsx
│           │   │   └── set-email.tsx
│           │   └── modals/
│           │       └── delete-brand-modal.tsx
│           └── hooks/
│               ├── use-brand.ts
│               └── use-user.ts
```

### After Implementation

```
avelero-v2/
├── packages/
│   └── db/
│       └── src/
│           └── schema/
│               ├── brands/
│               │   ├── brand-theme.ts
│               │   ├── brand-members.ts
│               │   ├── brand-invites.ts
│               │   ├── brand-tags.ts
│               │   └── brand-custom-domains.ts       ✓ DONE
│               └── index.ts                          ✓ DONE
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── schemas/
│   │   │   │   ├── _shared/
│   │   │   │   │   ├── primitives.ts
│   │   │   │   │   └── patterns.ts
│   │   │   │   ├── brand.ts
│   │   │   │   └── custom-domains.ts                 ← NEW
│   │   │   ├── trpc/
│   │   │   │   └── routers/
│   │   │   │       └── brand/
│   │   │   │           ├── index.ts                  ← MODIFIED
│   │   │   │           ├── base.ts
│   │   │   │           ├── theme.ts
│   │   │   │           └── custom-domains.ts         ← NEW
│   │   │   └── utils/
│   │   │       ├── errors.ts
│   │   │       └── dns-verification.ts               ← NEW
│   │   └── __tests__/
│   │       ├── setup.ts
│   │       ├── unit/
│   │       │   ├── schemas/
│   │       │   │   └── custom-domains.test.ts        ← NEW
│   │       │   └── utils/
│   │       │       └── dns-verification.test.ts      ← NEW
│   │       └── integration/
│   │           └── trpc/
│   │               ├── bulk-export.test.ts
│   │               └── custom-domains.test.ts        ← NEW
│   └── app/
│       └── src/
│           ├── app/
│           │   └── (dashboard)/(main)/(sidebar)/settings/
│           │       ├── layout.tsx
│           │       └── page.tsx                      ← MODIFIED
│           ├── components/
│           │   ├── settings/
│           │   │   ├── set-name.tsx
│           │   │   ├── set-slug.tsx
│           │   │   ├── set-email.tsx
│           │   │   └── set-domain.tsx                ← NEW
│           │   └── modals/
│           │       ├── delete-brand-modal.tsx
│           │       ├── custom-domain-modal.tsx       ← NEW
│           │       └── remove-domain-modal.tsx       ← NEW
│           └── hooks/
│               ├── use-brand.ts
│               ├── use-user.ts
│               └── use-custom-domain.ts              ← NEW
```

### Summary of Changes

| Type | Count | Files |
|------|-------|-------|
| **NEW** | 12 | Schema, schemas, utils, router, tests, hooks, components, modals |
| **MODIFIED** | 3 | `index.ts` (schema export), `brand/index.ts` (router), `settings/page.tsx` |

---

## Phase 1: Database Schema & Migration

**Goal**: Create the `brand_custom_domains` table with proper indexes and RLS policies.

**Prerequisites**: None

### Subtasks

#### 1.1 Create the schema file

**File**: `packages/db/src/schema/brands/brand-custom-domains.ts`

**Action**: Create new file with the following:
- Table definition with all columns (id, brandId, domain, status, verificationToken, etc.)
- Unique index on `brandId` (one domain per brand)
- Unique index on `domain` (global uniqueness)
- Regular indexes on `domain` and `status`
- RLS policies:
  - SELECT: `is_brand_member(brand_id)`
  - INSERT: `is_brand_owner(brand_id)`
  - UPDATE: `is_brand_owner(brand_id)`
  - DELETE: `is_brand_owner(brand_id)`
- Export types: `BrandCustomDomain`, `BrandCustomDomainInsert`

**Reference**: See spec section 3.1 for complete schema definition.

#### 1.2 Export the schema

**File**: `packages/db/src/schema/index.ts`

**Action**: Add export statement:
```typescript
export * from "./brands/brand-custom-domains";
```

#### 1.3 Generate the migration

**Command**:
```bash
bun db:generate
```

**Expected**: A new migration file in `packages/db/drizzle/` containing:
- CREATE TABLE statement
- Index creation
- RLS policy creation

#### 1.4 Apply the migration

**Command**:
```bash
bun db:migrate
```

**Verification**: Confirm table exists in database.

#### 1.5 Generate TypeScript types

**Command**:
```bash
cd packages/supabase && bun types:generate
```

**Verification**: Check that `Database` type includes `brand_custom_domains` table.

### Phase 1 Completion Criteria
- [x] Schema file created with all columns and constraints
- [x] Schema exported from index
- [x] Migration generated successfully
- [x] Migration applied successfully
- [x] TypeScript types regenerated
- [x] Table visible in database with correct structure

### Phase 1 Completion Notes
- **Schema file**: `packages/db/src/schema/brands/brand-custom-domains.ts`
- **Migration file**: `apps/api/supabase/migrations/20260122175801_empty_kitty_pryde.sql`
- **Completed**: 2026-01-22

---

## Phase 2: API Schemas & Utilities

**Goal**: Create Zod validation schemas and DNS verification utility.

**Prerequisites**: Phase 1 complete

### Subtasks

#### 2.1 Create domain validation schema

**File**: `apps/api/src/schemas/custom-domains.ts`

**Action**: Create new file with:
- `domainSchema`: Validates domain format (regex, min/max length, reserved domains check)
- `customDomainAddSchema`: Input for adding a domain (`{ domain: string }`)
- `customDomainStatusSchema`: Enum of `pending | verified | failed`
- `reservedDomains`: Array of reserved domains (avelero.com, localhost, etc.)

**Details**:
- Domain regex: `^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$`
- Min length: 4 characters
- Max length: 253 characters
- Transform: lowercase normalization
- Refine: no consecutive dots, not reserved

**Reference**: See spec section 6.3 for complete schema.

#### 2.2 Create DNS verification utility

**File**: `apps/api/src/utils/dns-verification.ts`

**Action**: Create new file with:
- `generateVerificationToken()`: Creates `avelero-verify-{64-char-hex}` token
- `verifyDomainDns(domain, expectedToken)`: Performs DNS TXT lookup
- `DnsVerificationResult` type: `{ success, error?, foundRecords? }`

**Implementation details**:
- Use `node:dns/promises` for `resolveTxt()`
- TXT host format: `_avelero-verification.{domain}`
- Timeout: 10 seconds
- Handle errors: `ENOTFOUND`, `ENODATA`, timeout
- Concatenate chunked TXT records
- Trim whitespace before comparison

**Reference**: See spec section 4.2 for complete implementation.

### Phase 2 Completion Criteria
- [x] Validation schema file created
- [x] Domain regex properly validates all test cases from spec
- [x] Reserved domains list includes all required domains
- [x] DNS utility functions implemented
- [x] Token generation uses cryptographically secure random bytes

### Phase 2 Completion Notes
- **Schema file**: `apps/api/src/schemas/custom-domains.ts`
- **DNS utility file**: `apps/api/src/utils/dns-verification.ts`
- **Completed**: 2026-01-22

---

## Phase 3: Unit Tests (TDD Foundation)

**Goal**: Write unit tests BEFORE implementing router logic. These tests define expected behavior.

**Prerequisites**: Phase 2 complete

### Subtasks

#### 3.1 Create schema validation tests

**File**: `apps/api/__tests__/unit/schemas/custom-domains.test.ts`

**Action**: Create test file with comprehensive tests:

```typescript
describe("customDomainAddSchema", () => {
  describe("valid domains", () => {
    // Test: nike.com, passport.nike.com, eu.passport.nike.com
    // Test: domain with numbers, hyphens
    // Test: uppercase normalization
  });

  describe("invalid domains", () => {
    // Test: empty, no TLD, consecutive dots
    // Test: starts/ends with hyphen
    // Test: port, protocol, path
    // Test: IP address format
    // Test: too short, too long
  });

  describe("reserved domains", () => {
    // Test: avelero.com, passport.avelero.com
    // Test: subdomain of reserved (foo.avelero.com)
    // Test: localhost, example.com
  });
});
```

**Run command**:
```bash
bun test apps/api/__tests__/unit/schemas/custom-domains.test.ts
```

#### 3.2 Create DNS verification tests

**File**: `apps/api/__tests__/unit/utils/dns-verification.test.ts`

**Action**: Create test file with mocked DNS:

```typescript
describe("generateVerificationToken", () => {
  // Test: returns string starting with "avelero-verify-"
  // Test: has sufficient entropy (64 hex chars after prefix)
  // Test: each call returns unique token
});

describe("verifyDomainDns", () => {
  describe("successful verification", () => {
    // Mock: TXT record matches token
    // Mock: one of multiple records matches
    // Mock: chunked record concatenation
    // Mock: whitespace trimming
  });

  describe("failed verification", () => {
    // Mock: ENOTFOUND error
    // Mock: ENODATA error
    // Mock: token mismatch
  });

  describe("error handling", () => {
    // Mock: timeout (10s)
    // Mock: DNS resolution error
  });
});
```

**Important**: Use `mock.module("node:dns/promises", ...)` to mock DNS calls.

**Run command**:
```bash
bun test apps/api/__tests__/unit/utils/dns-verification.test.ts
```

### Phase 3 Completion Criteria
- [x] Schema tests written (52 tests)
- [x] DNS utility tests written (27 tests)
- [x] All test scenarios from spec section 10.1 and 10.2 covered
- [x] Tests are runnable with `bun test` command
- [x] All tests PASSING (since Phase 2 implementation exists)

### Phase 3 Completion Notes
- **Schema tests file**: `apps/api/__tests__/unit/schemas/custom-domains.test.ts` (52 tests)
- **DNS tests file**: `apps/api/__tests__/unit/utils/dns-verification.test.ts` (27 tests)
- **Schema fix**: Added IP address rejection to domainSchema (IPv4 pattern check)
- **Total unit tests**: 79 tests, all passing
- **Completed**: 2026-01-22

---

## Phase 4: tRPC Router Implementation

**Goal**: Implement the custom domains router with all procedures. Run unit tests after each procedure.

**Prerequisites**: Phase 3 complete (tests written)

### Subtasks

#### 4.1 Create the router file structure

**File**: `apps/api/src/trpc/routers/brand/custom-domains.ts`

**Action**: Create file with imports and basic structure:
```typescript
import { createTRPCRouter, brandRequiredProcedure } from "../../init.js";
import { hasRole } from "../../middleware/auth/roles.js";
import { ROLES } from "../../../config/roles.js";
import { customDomainAddSchema } from "../../../schemas/custom-domains.js";
import { brandCustomDomains } from "@v1/db/schema";
import { generateVerificationToken, verifyDomainDns } from "../../../utils/dns-verification.js";

// Procedures will be added in subsequent subtasks
```

#### 4.2 Implement `get` procedure

**Action**: Add get procedure to fetch brand's current domain:
- Authorization: Brand member (via `brandRequiredProcedure`)
- Input: None (uses `brandId` from context)
- Query: Select from `brandCustomDomains` where `brandId` matches
- Output: Domain object or `null`

**Test**: Run schema tests to verify they pass:
```bash
bun test apps/api/__tests__/unit/schemas/custom-domains.test.ts
```

#### 4.3 Implement `add` procedure

**Action**: Add mutation to create new domain:
- Authorization: Brand owner only (`hasRole([ROLES.OWNER])`)
- Input: `customDomainAddSchema`
- Validations:
  - Domain format (via schema)
  - Brand doesn't already have a domain
  - Domain not claimed by another brand
- Actions:
  - Generate verification token
  - Insert record with `status: 'pending'`
- Output: Domain object with DNS instructions

**Error codes**:
- `DOMAIN_ALREADY_CONFIGURED`
- `DOMAIN_ALREADY_CLAIMED`
- `INVALID_DOMAIN_FORMAT` (from schema)
- `RESERVED_DOMAIN` (from schema)

**Test**: Run DNS tests:
```bash
bun test apps/api/__tests__/unit/utils/dns-verification.test.ts
```

#### 4.4 Implement `verify` procedure

**Action**: Add mutation to trigger DNS verification:
- Authorization: Brand owner only
- Input: None (operates on brand's current domain)
- Validations:
  - Domain exists for brand
  - Domain not already verified
- Actions:
  - Call `verifyDomainDns(domain, token)`
  - Update status to `verified` or `failed`
  - Set `lastVerificationAttempt` timestamp
  - Set `verifiedAt` if successful
  - Store error message if failed
- Output: `{ success, status, error?, verifiedAt? }`

**Error codes**:
- `NO_DOMAIN_CONFIGURED`
- `ALREADY_VERIFIED`

#### 4.5 Implement `remove` procedure

**Action**: Add mutation to delete domain:
- Authorization: Brand owner only
- Input: None (operates on brand's current domain)
- Validation: Domain exists for brand
- Action: Hard delete the record
- Output: `{ success: true }`

**Error codes**:
- `NO_DOMAIN_CONFIGURED`

#### 4.6 Create and export the router

**Action**: Combine all procedures into router:
```typescript
export const brandCustomDomainsRouter = createTRPCRouter({
  get: customDomainGetProcedure,
  add: customDomainAddProcedure,
  verify: customDomainVerifyProcedure,
  remove: customDomainRemoveProcedure,
});
```

#### 4.7 Integrate router into brand router

**File**: `apps/api/src/trpc/routers/brand/index.ts`

**Action**: Add import and include in brand router:
```typescript
import { brandCustomDomainsRouter } from "./custom-domains.js";

export const brandRouter = createTRPCRouter({
  // ... existing routers
  customDomains: brandCustomDomainsRouter,
});
```

### Phase 4 Completion Criteria
- [x] All 4 procedures implemented (get, add, verify, remove)
- [x] Router exported and integrated
- [x] All unit tests from Phase 3 now PASSING (TDD green phase)
- [x] Run: `bun test apps/api/__tests__/unit/` - all pass

**Test command after completion**:
```bash
bun test apps/api/__tests__/unit/schemas/custom-domains.test.ts
bun test apps/api/__tests__/unit/utils/dns-verification.test.ts
```

### Phase 4 Completion Notes
- **Router file**: `apps/api/src/trpc/routers/brand/custom-domains.ts`
- **Procedures**: get, add, verify, remove (all implemented)
- **Unit tests**: 79 tests (52 schema + 27 DNS), all passing
- **Typecheck**: Passing
- **Lint**: Passing
- **Completed**: 2026-01-22

---

## Phase 5: Integration Tests

**Goal**: Write and run integration tests that test the full router with database.

**Prerequisites**: Phase 4 complete

### Subtasks

#### 5.1 Create integration test file

**File**: `apps/api/__tests__/integration/trpc/custom-domains.test.ts`

**Action**: Create test file with setup:
```typescript
import "../../setup";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { cleanupTables, createTestBrand, createTestUser, testDb } from "@v1/db/testing";

// Mock DNS before importing router
const mockResolveTxt = mock(() => Promise.resolve([["avelero-verify-..."]]));
mock.module("node:dns/promises", () => ({
  resolveTxt: mockResolveTxt,
}));

import { brandCustomDomainsRouter } from "../../../src/trpc/routers/brand/custom-domains";
```

#### 5.2 Implement `get` tests

**Tests**:
- Returns `null` when no domain configured
- Returns domain config for brand member
- Includes verification token for pending domain
- Includes `verifiedAt` for verified domain
- Includes error message for failed domain
- Denies access to non-brand members

#### 5.3 Implement `add` tests

**Tests**:
- Creates domain with `pending` status
- Generates unique verification token
- Returns DNS instructions
- Normalizes domain to lowercase
- Allows brand owner
- Denies brand member (non-owner)
- Denies unauthenticated user
- Rejects invalid domain format
- Rejects reserved domain
- Rejects if brand already has domain
- Rejects if domain claimed by another brand

#### 5.4 Implement `verify` tests

**Tests**:
- Updates status to `verified` on success
- Sets `verifiedAt` timestamp
- Clears `verificationError` on success
- Updates status to `failed` on DNS failure
- Stores error message
- Updates `lastVerificationAttempt`
- Returns error when no domain configured
- Returns error when already verified

#### 5.5 Implement `remove` tests

**Tests**:
- Deletes pending domain
- Deletes verified domain
- Deletes failed domain
- Returns error when no domain configured
- Allows brand owner only
- Allows domain to be reclaimed after removal

#### 5.6 Run all integration tests

**Command**:
```bash
bun test apps/api/__tests__/integration/trpc/custom-domains.test.ts
```

### Phase 5 Completion Criteria
- [x] Integration test file created
- [x] All test scenarios from spec section 10.3 implemented
- [x] All integration tests passing
- [x] DNS mocking working correctly

### Phase 5 Completion Notes
- **Test file**: `apps/api/__tests__/integration/trpc/custom-domains.test.ts`
- **Total tests**: 39 tests (5 get, 11 add, 13 verify, 10 remove)
- **Coverage**: Authorization, validation, success/failure paths, edge cases
- **DNS mocking**: Uses `mock.module("node:dns/promises")` for DNS lookup simulation
- **Completed**: 2026-01-22

---

## Phase 6: Client Hooks

**Goal**: Create React hooks for the frontend to interact with the API.

**Prerequisites**: Phase 5 complete

### Subtasks

#### 6.1 Create custom domain hooks file

**File**: `apps/app/src/hooks/use-custom-domain.ts`

**Action**: Create file with the following hooks:

```typescript
"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
```

#### 6.2 Implement `useCustomDomainQuery`

**Action**: Query hook for fetching current domain:
- Uses `trpc.brand.customDomains.get.queryOptions()`
- Enabled only on client side (`typeof window !== "undefined"`)
- Returns domain data or null

#### 6.3 Implement `useAddCustomDomainMutation`

**Action**: Mutation hook for adding domain:
- Uses `trpc.brand.customDomains.add.mutationOptions()`
- Invalidates query cache on success

#### 6.4 Implement `useVerifyCustomDomainMutation`

**Action**: Mutation hook for verifying domain:
- Uses `trpc.brand.customDomains.verify.mutationOptions()`
- Invalidates query cache on success

#### 6.5 Implement `useRemoveCustomDomainMutation`

**Action**: Mutation hook for removing domain:
- Uses `trpc.brand.customDomains.remove.mutationOptions()`
- Invalidates query cache on success

### Phase 6 Completion Criteria
- [x] All 4 hooks implemented
- [x] Proper cache invalidation on mutations
- [x] Client-side only query execution

### Phase 6 Completion Notes
- **Hooks file**: `apps/app/src/hooks/use-custom-domain.ts`
- **Hooks implemented**:
  - `useCustomDomainQuery` - Query hook for fetching current domain (client-side only)
  - `useCustomDomainQuerySuspense` - Suspense-enabled query hook
  - `useAddCustomDomainMutation` - Mutation for adding domain with toast notifications
  - `useVerifyCustomDomainMutation` - Mutation for DNS verification with toast notifications
  - `useRemoveCustomDomainMutation` - Mutation for removing domain with toast notifications
- **Cache invalidation**: All mutations invalidate `trpc.brand.customDomains.get` query
- **Typecheck**: Passing
- **Lint**: Passing
- **Completed**: 2026-01-22

---

## Phase 7: UI Components

**Goal**: Create the UI components for custom domain management.

**Prerequisites**: Phase 6 complete

### Subtasks

#### 7.1 Create the settings block component

**File**: `apps/app/src/components/settings/set-domain.tsx`

**Action**: Create component that displays:
- **No domain**: Description text + "Configure" button
- **Pending**: Domain name + "Pending" status badge + "Configure" button
- **Verified**: Domain name + "Verified" status badge + "Configure" button
- **Failed**: Domain name + "Failed" status badge + "Configure" button

Clicking "Configure" opens the `CustomDomainModal`.

**Reference**: See spec section 7.2 for wireframes.

#### 7.2 Create the main configuration modal

**File**: `apps/app/src/components/modals/custom-domain-modal.tsx`

**Action**: Create modal with 4 states:

**State 1 - No Domain (Add Form)**:
- Domain input field
- Validation feedback
- "Cancel" and "Add Domain" buttons

**State 2 - Pending (DNS Instructions)**:
- Domain name with status badge
- CNAME record instructions with copy button
- TXT record instructions with copy button
- Propagation warning
- "Remove Domain" and "Verify Domain" buttons

**State 3 - Failed (Retry)**:
- Domain name with failed status
- Error message alert
- DNS instructions (same as pending)
- "Remove Domain" and "Try Again" buttons

**State 4 - Verified (Success)**:
- Domain name with verified status
- Verified date
- Example URLs
- Warning about keeping DNS records
- "Remove Domain" and "Done" buttons

**Reference**: See spec section 7.3 for detailed wireframes.

#### 7.3 Create the remove confirmation modal

**File**: `apps/app/src/components/modals/remove-domain-modal.tsx`

**Action**: Create confirmation dialog:
- Warning message about removal consequences
- "Cancel" and "Remove" buttons
- Loading state during removal

Pattern: Follow `delete-brand-modal.tsx` structure.

#### 7.4 Implement copy-to-clipboard functionality

**Action**: In `custom-domain-modal.tsx`, implement:
- Copy button for CNAME value (`dpp.avelero.com`)
- Copy button for TXT verification token
- Toast notification on copy success/failure

```typescript
async function handleCopy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard`);
  } catch {
    toast.error("Failed to copy. Please select and copy manually.");
  }
}
```

### Phase 7 Completion Criteria
- [ ] Settings block component displays all states correctly
- [ ] Main modal handles all 4 configuration states
- [ ] Remove modal follows existing patterns
- [ ] Copy functionality works with toast feedback
- [ ] All components use existing UI library components

---

## Phase 8: Settings Page Integration

**Goal**: Integrate the custom domain block into the Settings page.

**Prerequisites**: Phase 7 complete

### Subtasks

#### 8.1 Add prefetch to settings page

**File**: `apps/app/src/app/(dashboard)/(main)/(sidebar)/settings/page.tsx`

**Action**: Add custom domains query to `batchPrefetch`:
```typescript
batchPrefetch([
  // ... existing queries
  trpc.brand.customDomains.get.queryOptions(),
]);
```

#### 8.2 Add component to settings page

**File**: `apps/app/src/app/(dashboard)/(main)/(sidebar)/settings/page.tsx`

**Action**: Import and add `SetDomain` component:
```typescript
import { SetDomain } from "@/components/settings/set-domain";

// In render, between SetCountry and DeleteBrand:
<SetDomain />
```

**Order in settings page**:
1. SetLogo
2. SetName
3. SetSlug
4. SetEmail
5. SetCountry
6. **SetDomain** ← NEW
7. DeleteBrand

### Phase 8 Completion Criteria
- [ ] Query prefetched on server
- [ ] Component renders in correct position
- [ ] No hydration errors
- [ ] Page loads without issues

---

## Phase 9: Final Validation

**Goal**: Run comprehensive tests and validate the complete implementation.

**Prerequisites**: All previous phases complete

### Subtasks

#### 9.1 Run typecheck

**Command**:
```bash
bun typecheck
```

**Expected**: No TypeScript errors.

#### 9.2 Run linter

**Command**:
```bash
bun lint
```

**Expected**: No linting errors. If there are fixable errors, run:
```bash
bun format
```

#### 9.3 Run all custom domain tests

**Command**:
```bash
bun test apps/api/__tests__/unit/schemas/custom-domains.test.ts
bun test apps/api/__tests__/unit/utils/dns-verification.test.ts
bun test apps/api/__tests__/integration/trpc/custom-domains.test.ts
```

**Expected**: All tests pass.

#### 9.4 Run full test suite (relevant tests only)

**Command**:
```bash
bun test apps/api/__tests__/
```

**Expected**: All API tests pass, including new custom domain tests.

#### 9.5 Manual verification checklist

**Database**:
- [ ] Table `brand_custom_domains` exists with correct columns
- [ ] Indexes are created (brand_id unique, domain unique, domain, status)
- [ ] RLS policies are active

**API**:
- [ ] `brand.customDomains.get` returns null for brands without domain
- [ ] `brand.customDomains.add` creates pending domain with token
- [ ] `brand.customDomains.verify` updates status correctly
- [ ] `brand.customDomains.remove` deletes the domain
- [ ] Non-owners cannot add/verify/remove

**UI** (if dev server running):
- [ ] Settings page shows custom domain block
- [ ] Modal opens on "Configure" click
- [ ] Add domain flow works
- [ ] DNS instructions display correctly
- [ ] Copy buttons work
- [ ] Remove confirmation works

### Phase 9 Completion Criteria
- [ ] All type checks pass
- [ ] All lint checks pass
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual verification complete

---

## Implementation Notes

### Agent Instructions

1. **Test-Driven Development**: Always write tests before implementation. Tests define expected behavior.

2. **Test After Each Phase**: Run relevant tests after completing each phase:
   - Phase 3-4: `bun test apps/api/__tests__/unit/`
   - Phase 5: `bun test apps/api/__tests__/integration/trpc/custom-domains.test.ts`
   - Phase 9: Full test suite

3. **Do NOT Run Full Suite Mid-Implementation**: Only run tests for the specific file/feature being worked on. Full suite runs only in Phase 9.

4. **No UI Tests**: This implementation only includes unit and integration tests. UI testing is out of scope.

5. **Migration Commands**: Follow exact sequence:
   ```bash
   bun db:generate
   bun db:migrate
   cd packages/supabase && bun types:generate
   ```

6. **Error Handling**: Use existing error utilities (`badRequest`, `forbidden`, `wrapError`).

7. **Follow Existing Patterns**: Reference similar files in the codebase:
   - Schema: `brand-theme.ts`
   - Router: `brand/theme.ts`
   - Tests: `bulk-export.test.ts`
   - Components: `set-slug.tsx`
   - Hooks: `use-brand.ts`

### Dependencies Between Phases

```
Phase 1 (DB) ──► Phase 2 (Schemas) ──► Phase 3 (Unit Tests)
                                              │
                                              ▼
                                       Phase 4 (Router)
                                              │
                                              ▼
                                       Phase 5 (Integration)
                                              │
                                              ▼
                                       Phase 6 (Hooks)
                                              │
                                              ▼
                                       Phase 7 (UI)
                                              │
                                              ▼
                                       Phase 8 (Integration)
                                              │
                                              ▼
                                       Phase 9 (Validation)
```

---

*End of Implementation Plan*
