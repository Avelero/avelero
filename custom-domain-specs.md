# Custom Domain Management - Technical Specification

> **Status**: Draft
> **Author**: Engineering Team
> **Related Issue**: Custom Domain Management (Linear)
> **Parent Feature**: QR Code Generation for Digital Product Passports

---

## Table of Contents

1. [Overview](#1-overview)
2. [Motivation & Requirements](#2-motivation--requirements)
3. [Architecture & Data Model](#3-architecture--data-model)
4. [DNS Verification Flow](#4-dns-verification-flow)
5. [URL Structure & Routing](#5-url-structure--routing)
6. [API Design](#6-api-design)
7. [UI/UX Design](#7-uiux-design)
8. [Security Considerations](#8-security-considerations)
9. [Edge Cases & Error Handling](#9-edge-cases--error-handling)
10. [Test Cases (TDD)](#10-test-cases-tdd)
11. [File Structure & Changes](#11-file-structure--changes)
12. [Migration Strategy](#12-migration-strategy)
13. [Future Considerations](#13-future-considerations)

---

## 1. Overview

Custom domain management enables brands to configure their own domain for hosting GS1-compliant Digital Product Passport (DPP) QR codes. This is a foundational dependency for the larger QR code generation feature.

### 1.1 What This Feature Does

- Allows brand owners to add a custom domain (e.g., `passport.nike.com`)
- Provides DNS verification via TXT record to prove domain ownership
- Stores verified domains for use in GS1-compliant QR code URL generation
- Enables brands to have portable QR codes that work beyond Avelero

### 1.2 What This Feature Does NOT Do (Scope Boundaries)

- **Does NOT** handle SSL certificate provisioning (handled by infrastructure/CDN)
- **Does NOT** handle DNS record configuration (brands configure their own DNS)
- **Does NOT** handle actual QR code generation (separate feature)
- **Does NOT** handle the DPP routing logic for custom domains (separate PR)
- **Does NOT** handle GS1 URL formatting or GTIN validation (separate feature)
- **Does NOT** support multiple domains per brand (one domain only)

### 1.3 Feature Flag / Gating

This feature will be available to all brands but is a prerequisite for GS1-compliant QR codes. Brands without a verified custom domain can still use Avelero-based QR codes (`passport.avelero.com/{upid}`).

---

## 2. Motivation & Requirements

### 2.1 Business Requirements

1. **GS1 Digital Link Compliance**: GS1-compliant QR codes require a brand-controlled domain
2. **Portability**: QR codes should work even if a brand leaves Avelero (with proper redirect setup)
3. **Brand Identity**: Custom domains reinforce brand ownership of product passports
4. **Trust**: Consumers see a brand's domain, not a third-party service

### 2.2 GS1 Digital Link Context

> **Note**: GS1 URL formatting and routing is out of scope for this PR. This section provides context only.

A verified custom domain enables GS1-compliant QR codes:
```
https://passport.nike.com/01/{barcode}
```

Without a custom domain, brands can only use Avelero-based URLs:
```
https://passport.avelero.com/{upid}
```

The GS1 format provides portability and industry compliance, which is why custom domains are a prerequisite for this feature.

### 2.3 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Brand owners can add a custom domain | Must Have |
| FR-2 | System generates unique DNS TXT verification token | Must Have |
| FR-3 | Brand owners can trigger DNS verification check | Must Have |
| FR-4 | System validates domain ownership via DNS TXT lookup | Must Have |
| FR-5 | Brand owners can remove a verified domain | Must Have |
| FR-6 | System enforces one custom domain per brand | Must Have |
| FR-7 | Only brand owners (not members) can manage domains | Must Have |
| FR-8 | Domain verification status is visible in UI | Must Have |
| FR-9 | System shows clear instructions for DNS configuration | Should Have |
| FR-10 | Failed verification shows helpful error messages | Should Have |

### 2.4 Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-1 | DNS verification response time | < 10 seconds |
| NFR-2 | Domain validation (format check) | < 100ms |
| NFR-3 | Verification token entropy | 256-bit secure random |
| NFR-4 | Domain uniqueness | Global (no two brands same domain) |

---

## 3. Architecture & Data Model

### 3.1 Database Schema

**File**: `packages/db/src/schema/brands/brand-custom-domains.ts`

```typescript
import { sql } from "drizzle-orm";
import {
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

/**
 * Custom domains for brands.
 *
 * Each brand can have at most one verified custom domain.
 * Domains are verified via DNS TXT record lookup.
 *
 * Status flow:
 *   pending -> verified (success)
 *   pending -> failed (DNS check failed, can retry)
 *   verified -> (cannot change, must delete and re-add)
 */
export const brandCustomDomains = pgTable(
  "brand_custom_domains",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),

    /** Brand that owns this domain */
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),

    /**
     * The custom domain (e.g., "passport.nike.com")
     * Stored normalized (lowercase, no trailing dot)
     */
    domain: text("domain").notNull(),

    /**
     * Verification status:
     * - 'pending': Domain added, awaiting DNS verification
     * - 'verified': DNS TXT record confirmed
     * - 'failed': DNS verification failed (can retry)
     */
    status: text("status").notNull().default("pending"),

    /**
     * DNS TXT verification token.
     * Brand must add TXT record: _avelero-verification.{domain} = {token}
     */
    verificationToken: text("verification_token").notNull(),

    /**
     * Timestamp of last verification attempt.
     * Null if never attempted.
     */
    lastVerificationAttempt: timestamp("last_verification_attempt", {
      withTimezone: true,
      mode: "string",
    }),

    /**
     * Error message from last failed verification.
     * Null if pending or verified.
     */
    verificationError: text("verification_error"),

    /**
     * Timestamp when domain was successfully verified.
     * Null if not yet verified.
     */
    verifiedAt: timestamp("verified_at", {
      withTimezone: true,
      mode: "string",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // One domain per brand (enforced at DB level)
    uniqueIndex("brand_custom_domains_brand_id_unq").on(table.brandId),

    // Global domain uniqueness (no two brands can claim the same domain)
    uniqueIndex("brand_custom_domains_domain_unq").on(table.domain),

    // Index for lookups by domain (used by DPP routing)
    index("idx_brand_custom_domains_domain").on(table.domain),

    // Index for status (useful for admin queries)
    index("idx_brand_custom_domains_status").on(table.status),

    // RLS: Only brand members can read their domain config
    pgPolicy("brand_custom_domains_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),

    // RLS: Only brand owners can insert domains
    pgPolicy("brand_custom_domains_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_owner(brand_id)`,
    }),

    // RLS: Only brand owners can update domains
    pgPolicy("brand_custom_domains_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_owner(brand_id)`,
      withCheck: sql`is_brand_owner(brand_id)`,
    }),

    // RLS: Only brand owners can delete domains
    pgPolicy("brand_custom_domains_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_owner(brand_id)`,
    }),
  ],
);

/** Type for a custom domain record */
export type BrandCustomDomain = typeof brandCustomDomains.$inferSelect;

/** Type for inserting a custom domain */
export type BrandCustomDomainInsert = typeof brandCustomDomains.$inferInsert;
```

### 3.2 Status State Machine

```
                    ┌─────────────────┐
                    │                 │
    ┌───────────────▶    pending      │◀──────────────┐
    │               │                 │               │
    │               └────────┬────────┘               │
    │                        │                        │
    │                   verify()                      │
    │                        │                        │
    │                        ▼                        │
    │               ┌─────────────────┐               │
    │               │  DNS Lookup     │               │
    │               │  TXT Record     │               │
    │               └────────┬────────┘               │
    │                        │                        │
    │           ┌────────────┴────────────┐           │
    │           │                         │           │
    │      TXT found &              TXT not found     │
    │      token matches           or mismatch        │
    │           │                         │           │
    │           ▼                         ▼           │
    │  ┌─────────────────┐       ┌─────────────────┐  │
    │  │                 │       │                 │  │
    │  │    verified     │       │     failed      │──┘
    │  │                 │       │                 │ retry()
    │  └─────────────────┘       └─────────────────┘
    │
    │ delete() + re-add()
    │
    └─────────────────────────────────────────────────
```

### 3.3 DNS Records Overview

For a custom domain to fully work, brands need to add **two DNS records**:

| Record | Purpose | When Checked |
|--------|---------|--------------|
| **TXT** | Ownership verification | During "Verify Domain" step |
| **CNAME** | Traffic routing | By infrastructure (not this PR) |

#### Why Both Records?

1. **TXT Record (Verification)**: Proves the brand owns the domain. Without this, anyone could claim `passport.nike.com` is theirs. This is the industry standard approach (Google, Vercel, Supabase all use TXT for verification).

2. **CNAME Record (Routing)**: Points the domain to our DPP servers so visitors actually reach us. Without this, `passport.nike.com` would go nowhere (or to wherever it currently points).

**This PR focuses on the TXT verification.** The CNAME routing is handled by infrastructure (CDN/edge) and is documented for user instructions but not verified by our application.

### 3.4 Verification Token Format

The verification token is a cryptographically secure random string:

```typescript
// Format: avelero-verify-{random}
// Example: avelero-verify-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

function generateVerificationToken(): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const hex = Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return `avelero-verify-${hex}`;
}
```

### 3.5 DNS Records Brands Must Add

#### Record 1: TXT (Ownership Verification)

| Field | Value |
|-------|-------|
| Type | `TXT` |
| Name/Host | `_avelero-verification` |
| Value | `{verificationToken}` |
| TTL | 300 (or Auto) |

**Example for `passport.nike.com`:**
- Name: `_avelero-verification.passport`
- Type: `TXT`
- Value: `avelero-verify-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`

*Note: The full record becomes `_avelero-verification.passport.nike.com`*

#### Record 2: CNAME (Traffic Routing)

| Field | Value |
|-------|-------|
| Type | `CNAME` |
| Name/Host | `passport` (or whatever subdomain) |
| Value | `dpp.avelero.com` (our edge) |
| TTL | 300 (or Auto) |

**Example for `passport.nike.com`:**
- Name: `passport`
- Type: `CNAME`
- Value: `dpp.avelero.com`

*Note: This makes `passport.nike.com` route to our DPP infrastructure.*

### 3.6 Verification Flow

We only programmatically verify the TXT record. The CNAME is assumed to be configured correctly if traffic reaches us (infrastructure responsibility).

```
Brand adds domain in UI
        │
        ▼
System generates TXT verification token
        │
        ▼
Brand adds TXT record to DNS
        │
        ▼
Brand adds CNAME record to DNS (for routing)
        │
        ▼
Brand clicks "Verify Domain"
        │
        ▼
System does DNS TXT lookup ─────► Success: status = verified
        │                         Failure: status = failed
        ▼
Domain ready for use
```

---

## 4. DNS Verification Flow

### 4.1 Sequence Diagram

```
┌──────┐          ┌──────┐          ┌──────┐          ┌──────────┐
│ User │          │  UI  │          │  API │          │ DNS (ext)│
└──┬───┘          └──┬───┘          └──┬───┘          └────┬─────┘
   │                 │                 │                   │
   │ Add Domain      │                 │                   │
   │─────────────────▶                 │                   │
   │                 │ POST /domain    │                   │
   │                 │─────────────────▶                   │
   │                 │                 │ Validate format   │
   │                 │                 │ Check uniqueness  │
   │                 │                 │ Generate token    │
   │                 │                 │ Store (pending)   │
   │                 │◀────────────────│                   │
   │                 │ {token, status} │                   │
   │◀─────────────────                 │                   │
   │ Show DNS instructions             │                   │
   │                 │                 │                   │
   │ (User adds DNS TXT record)        │                   │
   │                 │                 │                   │
   │ Verify Domain   │                 │                   │
   │─────────────────▶                 │                   │
   │                 │ POST /verify    │                   │
   │                 │─────────────────▶                   │
   │                 │                 │ DNS TXT lookup    │
   │                 │                 │───────────────────▶
   │                 │                 │◀───────────────────
   │                 │                 │ Compare token     │
   │                 │                 │ Update status     │
   │                 │◀────────────────│                   │
   │                 │ {status: verified}                  │
   │◀─────────────────                 │                   │
   │ Success!        │                 │                   │
```

### 4.2 DNS Lookup Implementation

```typescript
import { resolveTxt } from "node:dns/promises";

interface DnsVerificationResult {
  success: boolean;
  error?: string;
  foundRecords?: string[];
}

async function verifyDomainDns(
  domain: string,
  expectedToken: string
): Promise<DnsVerificationResult> {
  const txtHost = `_avelero-verification.${domain}`;

  try {
    // DNS TXT lookup with timeout
    const records = await Promise.race([
      resolveTxt(txtHost),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS_TIMEOUT")), 10000)
      ),
    ]);

    // Flatten TXT record arrays (DNS TXT can be chunked)
    const flatRecords = records.map(chunks => chunks.join(""));

    // Check if any record matches the token
    const found = flatRecords.some(
      record => record.trim() === expectedToken
    );

    if (found) {
      return { success: true, foundRecords: flatRecords };
    }

    return {
      success: false,
      error: "TXT record found but token does not match",
      foundRecords: flatRecords,
    };
  } catch (err) {
    const error = err as NodeJS.ErrnoException;

    if (error.code === "ENOTFOUND" || error.code === "ENODATA") {
      return {
        success: false,
        error: "No TXT record found. Please add the DNS record and wait for propagation.",
      };
    }

    if (error.message === "DNS_TIMEOUT") {
      return {
        success: false,
        error: "DNS lookup timed out. Please try again.",
      };
    }

    return {
      success: false,
      error: `DNS lookup failed: ${error.message}`,
    };
  }
}
```

### 4.3 Rate Limiting (Future)

> **Note**: Rate limiting is out of scope for this PR. Will be added when Redis infrastructure is configured.

For future implementation:
- Per domain: Maximum 10 verification attempts per hour
- Per brand: Maximum 20 verification attempts per hour
- Implementation: Redis-based counter with TTL

---

## 5. URL Structure & Routing (Context Only - Out of Scope)

> **Note**: This section provides context for future work. URL routing is NOT part of this PR. This PR only handles custom domain configuration and verification.

### 5.1 Passport URL Access Patterns

There are two ways to access a Digital Product Passport:

| URL Pattern | Where it Works | Example |
|-------------|----------------|---------|
| `/{upid}` | Avelero domain AND custom domains | `passport.avelero.com/ABC123XYZ` or `passport.nike.com/ABC123XYZ` |
| `/01/{gtin}` | Custom domains ONLY | `passport.nike.com/01/00012345678905` |

### 5.2 Security Rationale for URL Restrictions

**Why `/01/{gtin}` only works on custom domains:**

The GS1 format (`/01/{barcode}`) uses the product's barcode (GTIN) in the URL. If we allowed this on `passport.avelero.com`, there's no way to verify which brand owns that barcode - a malicious brand could claim another brand's barcode.

By restricting `/01/{gtin}` to custom domains:
- The domain itself proves brand ownership (via our verification)
- We can ensure the barcode belongs to that brand's products
- GS1 compliance is maintained (brand-controlled domain)

**Why `/{upid}` works everywhere:**

The UPID (Unique Product Identifier) is generated by Avelero and is globally unique across all brands. There's no risk of collision or impersonation, so it's safe to use on both:
- `passport.avelero.com/{upid}` (Avelero-based)
- `passport.nike.com/{upid}` (custom domain)

### 5.3 Future Routing Work (Separate PR)

The DPP app will need updates to:
1. Resolve brand from host header (for custom domains)
2. Support both `/{upid}` and `/01/{gtin}` URL patterns
3. Validate that GTIN belongs to the resolved brand

This is NOT part of the current PR.

---

## 6. API Design

### 6.1 Router Structure

**File**: `apps/api/src/trpc/routers/brand/custom-domains.ts`

```typescript
import { createTRPCRouter } from "../../init.js";

export const brandCustomDomainsRouter = createTRPCRouter({
  /** Get the brand's custom domain (if any) */
  get: customDomainGetProcedure,

  /** Add a new custom domain (generates verification token) */
  add: customDomainAddProcedure,

  /** Trigger DNS verification check */
  verify: customDomainVerifyProcedure,

  /** Remove the custom domain */
  remove: customDomainRemoveProcedure,
});
```

### 6.2 API Endpoints

#### 6.2.1 `brand.customDomains.get`

**Purpose**: Retrieve the brand's custom domain configuration.

**Authorization**: Brand member (read) or owner (full)

**Input**: None (uses active brand from context)

**Output**:
```typescript
type GetOutput = {
  domain: {
    id: string;
    domain: string;
    status: "pending" | "verified" | "failed";
    verificationToken: string;
    verificationError: string | null;
    verifiedAt: string | null;
    createdAt: string;
  } | null;
};
```

**Implementation Notes**:
- Returns `null` if no domain configured
- Token is returned to allow displaying DNS instructions

---

#### 6.2.2 `brand.customDomains.add`

**Purpose**: Add a new custom domain for the brand.

**Authorization**: Brand owner only

**Input**:
```typescript
const customDomainAddSchema = z.object({
  domain: z
    .string()
    .min(4)
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i)
    .transform(val => val.toLowerCase()),
});
```

**Output**:
```typescript
type AddOutput = {
  id: string;
  domain: string;
  status: "pending";
  verificationToken: string;
  dnsInstructions: {
    recordType: "TXT";
    host: string;      // _avelero-verification.{domain}
    value: string;     // verificationToken
    ttl: number;       // Recommended: 300
  };
};
```

**Error Cases**:
| Code | Description |
|------|-------------|
| `DOMAIN_ALREADY_CONFIGURED` | Brand already has a domain (delete first) |
| `DOMAIN_ALREADY_CLAIMED` | Another brand has claimed this domain |
| `INVALID_DOMAIN_FORMAT` | Domain format validation failed |
| `RESERVED_DOMAIN` | Domain is on reserved list (e.g., avelero.com) |

**Implementation Notes**:
- Normalize domain to lowercase before storage
- Generate cryptographically secure verification token
- Check against reserved domain list
- Check global uniqueness

---

#### 6.2.3 `brand.customDomains.verify`

**Purpose**: Trigger DNS verification for the pending domain.

**Authorization**: Brand owner only

**Input**: None (operates on brand's current domain)

**Output**:
```typescript
type VerifyOutput = {
  success: boolean;
  status: "verified" | "failed";
  error?: string;
  verifiedAt?: string;
};
```

**Error Cases**:
| Code | Description |
|------|-------------|
| `NO_DOMAIN_CONFIGURED` | Brand has no domain to verify |
| `ALREADY_VERIFIED` | Domain is already verified |
| `RATE_LIMITED` | Too many verification attempts |

**Implementation Notes**:
- Perform DNS TXT lookup
- Update status to `verified` or `failed`
- Record `lastVerificationAttempt` timestamp
- Store error message if failed
- Enforce rate limiting

---

#### 6.2.4 `brand.customDomains.remove`

**Purpose**: Remove the brand's custom domain.

**Authorization**: Brand owner only

**Input**: None (operates on brand's current domain)

**Output**:
```typescript
type RemoveOutput = {
  success: boolean;
};
```

**Error Cases**:
| Code | Description |
|------|-------------|
| `NO_DOMAIN_CONFIGURED` | Brand has no domain to remove |

**Implementation Notes**:
- Hard delete (not soft delete) - domain can be reclaimed
- Requires confirmation in UI
- Consider: Warn if domain is in use by existing QR codes

---

### 6.3 Zod Schemas

**File**: `apps/api/src/schemas/custom-domains.ts`

```typescript
import { z } from "zod";

/**
 * Domain format validation.
 * Accepts: subdomain.domain.tld, domain.tld
 * Rejects: IP addresses, localhost, ports, protocols
 */
export const domainSchema = z
  .string()
  .min(4, "Domain must be at least 4 characters")
  .max(253, "Domain must be at most 253 characters")
  .regex(
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i,
    "Invalid domain format"
  )
  .transform(val => val.toLowerCase())
  .refine(
    val => !val.includes(".."),
    "Domain cannot contain consecutive dots"
  )
  .refine(
    val => !reservedDomains.some(r => val === r || val.endsWith(`.${r}`)),
    "This domain is reserved"
  );

export const customDomainAddSchema = z.object({
  domain: domainSchema,
});

export const customDomainStatusSchema = z.enum([
  "pending",
  "verified",
  "failed",
]);

/**
 * Reserved domains that cannot be claimed.
 */
const reservedDomains = [
  "avelero.com",
  "avelero.io",
  "avelero.app",
  "passport.avelero.com",
  "localhost",
  "example.com",
  "test.com",
];
```

---

## 7. UI/UX Design

### 7.1 Location in Settings

The custom domain configuration lives within the **General** tab of Settings (not a separate tab). This is because:
- Only one domain per brand is allowed
- A dedicated "Domains" tab would be overkill and misleading (plural implies multiple)
- It's a configuration setting, fitting naturally with other brand settings

```
Settings
├── General        ← Custom Domain block lives here
│   ├── Logo
│   ├── Name
│   ├── Slug
│   ├── Email
│   ├── Country
│   ├── Custom Domain   ← NEW BLOCK
│   └── Delete Brand
├── Members
└── Integrations
```

### 7.2 Settings Block (General Tab)

The custom domain block displays current status and opens a modal for configuration:

#### No Domain Configured

```
┌────────────────────────────────────────────────────────────┐
│  Custom Domain                                             │
│                                                            │
│  Configure a custom domain to enable GS1-compliant        │
│  QR codes for your digital product passports.             │
│                                                            │
│                                         [ Configure ]      │
└────────────────────────────────────────────────────────────┘
```

#### Domain Pending

```
┌────────────────────────────────────────────────────────────┐
│  Custom Domain                                             │
│                                                            │
│  passport.nike.com                         ○ Pending      │
│                                                            │
│                                         [ Configure ]      │
└────────────────────────────────────────────────────────────┘
```

#### Domain Verified

```
┌────────────────────────────────────────────────────────────┐
│  Custom Domain                                             │
│                                                            │
│  passport.nike.com                         ✓ Verified     │
│                                                            │
│                                         [ Configure ]      │
└────────────────────────────────────────────────────────────┘
```

### 7.3 Configuration Modal

Clicking "Configure" opens a modal with the full configuration flow:

#### Modal State 1: No Domain - Add Form

```
┌──────────────────────────────────────────────────────────────┐
│  Configure Custom Domain                              [ X ] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Add a custom domain to enable GS1-compliant QR codes.      │
│                                                              │
│  Domain                                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  passport.yourbrand.com                                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Example: passport.nike.com, dpp.mybrand.com                │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                    [ Cancel ]  [ Add Domain ]│
└──────────────────────────────────────────────────────────────┘
```

#### Modal State 2: Pending - DNS Instructions

```
┌──────────────────────────────────────────────────────────────┐
│  Configure Custom Domain                              [ X ] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  passport.nike.com                            ○ Pending     │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Step 1: Add DNS Records                                    │
│                                                              │
│  Add these records in your DNS provider:                    │
│                                                              │
│  CNAME Record (for traffic routing)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Name:  passport                                     │   │
│  │  Type:  CNAME                                        │   │
│  │  Value: dpp.avelero.com                       [Copy] │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  TXT Record (for verification)                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Name:  _avelero-verification.passport               │   │
│  │  Type:  TXT                                          │   │
│  │  Value: avelero-verify-a1b2c3...              [Copy] │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  DNS propagation may take up to 48 hours.                   │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Step 2: Verify Domain                                      │
│                                                              │
│  After adding the DNS records, verify ownership:            │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [ Remove Domain ]                          [ Verify Domain ]│
└──────────────────────────────────────────────────────────────┘
```

#### Modal State 3: Failed - Retry

```
┌──────────────────────────────────────────────────────────────┐
│  Configure Custom Domain                              [ X ] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  passport.nike.com                            ✕ Failed      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ ⚠ Verification failed                                  │ │
│  │                                                        │ │
│  │ No TXT record found. Please check your DNS settings    │ │
│  │ and wait for propagation before trying again.          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Required DNS Records:                                      │
│                                                              │
│  (same DNS instructions as pending state)                   │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [ Remove Domain ]                              [ Try Again ]│
└──────────────────────────────────────────────────────────────┘
```

#### Modal State 4: Verified - Success

```
┌──────────────────────────────────────────────────────────────┐
│  Configure Custom Domain                              [ X ] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  passport.nike.com                            ✓ Verified    │
│  Verified on Jan 15, 2026                                   │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  Your custom domain is active and ready for use.            │
│                                                              │
│  Digital product passports can now be accessed at:          │
│  • https://passport.nike.com/{upid}                         │
│  • https://passport.nike.com/01/{barcode}  (GS1 format)     │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  ⓘ Keep your DNS records in place. Removing them will       │
│    make your custom domain URLs inaccessible.               │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  [ Remove Domain ]                                  [ Done ] │
└──────────────────────────────────────────────────────────────┘
```

### 7.4 Component Structure

```
apps/app/src/components/
├── settings/
│   ├── set-domain.tsx                 # Block in General settings
│   └── ...existing...
└── modals/
    ├── custom-domain-modal.tsx        # Main modal (add, DNS instructions, status - all inline)
    ├── remove-domain-modal.tsx        # Confirmation modal (similar to unsaved-changes-modal)
    └── ...existing...
```

**Notes:**
- The modal handles everything inline: domain input, DNS instructions, verification status
- No separate form/instructions/status components needed
- `remove-domain-modal.tsx` follows same pattern as existing confirmation modals

### 7.5 Copy to Clipboard UX

Both the CNAME value and TXT verification token have copy buttons:

```typescript
async function handleCopy(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied to clipboard`);
  } catch {
    // Fallback for older browsers
    toast.error("Failed to copy. Please select and copy manually.");
  }
}

// Usage:
// handleCopy("dpp.avelero.com", "CNAME value")
// handleCopy("avelero-verify-...", "Verification token")
```

---

## 8. Security Considerations

### 8.1 Domain Ownership Verification

- **Why TXT records?**: Industry standard for domain verification (used by Google, Microsoft, etc.)
- **Token entropy**: 256-bit random token prevents guessing
- **Token uniqueness**: Each token is unique per domain add attempt
- **Timing attacks**: DNS lookups are external, no timing information leaked

### 8.2 Reserved Domains

Prevent claiming of:
- Avelero-owned domains (`avelero.com`, `passport.avelero.com`, etc.)
- Common test domains (`localhost`, `example.com`, `test.com`)
- IP addresses (rejected by regex)

### 8.3 Rate Limiting (Future)

> **Note**: Rate limiting will be added when Redis infrastructure is configured.

Planned limits:
- Verification attempts per domain: 10/hour
- Verification attempts per brand: 20/hour
- Domain adds per brand: 5/hour

### 8.4 RLS Policies

- **SELECT**: Brand members can read (for display in UI)
- **INSERT/UPDATE/DELETE**: Brand owners only

### 8.5 Audit Logging (Future)

Consider logging:
- Domain added
- Verification attempted (success/failure)
- Domain removed

---

## 9. Edge Cases & Error Handling

### 9.1 Domain Format Edge Cases

| Input | Valid? | Reason |
|-------|--------|--------|
| `nike.com` | Yes | Simple domain |
| `passport.nike.com` | Yes | Subdomain |
| `a.b.c.nike.com` | Yes | Deep subdomain |
| `NIKE.COM` | Yes | Normalized to lowercase |
| `nike..com` | No | Consecutive dots |
| `nike` | No | No TLD |
| `-nike.com` | No | Starts with hyphen |
| `nike-.com` | No | Ends with hyphen |
| `192.168.1.1` | No | IP address (no dots between labels) |
| `nike.com:8080` | No | Port number |
| `https://nike.com` | No | Protocol |
| `nike.com/path` | No | Path |

### 9.2 DNS Verification Edge Cases

| Scenario | Behavior |
|----------|----------|
| TXT record not found | Status: `failed`, Error: "No TXT record found..." |
| TXT record wrong value | Status: `failed`, Error: "TXT record found but token does not match" |
| DNS timeout (10s) | Status: `failed`, Error: "DNS lookup timed out..." |
| Multiple TXT records | Check all, succeed if any match |
| Chunked TXT record | Concatenate chunks before comparison |
| Unicode in domain | Rejected by regex (ASCII only) |

### 9.3 Concurrent Access

| Scenario | Behavior |
|----------|----------|
| Two users add same domain simultaneously | First insert wins, second gets `DOMAIN_ALREADY_CLAIMED` |
| User adds domain while another removes | Transaction isolation prevents conflict |
| Verification during removal | Verification fails with `NO_DOMAIN_CONFIGURED` |

### 9.4 Error Messages (User-Facing)

```typescript
const errorMessages = {
  DOMAIN_ALREADY_CONFIGURED:
    "You already have a custom domain configured. Remove it first to add a new one.",
  DOMAIN_ALREADY_CLAIMED:
    "This domain is already in use by another brand.",
  INVALID_DOMAIN_FORMAT:
    "Please enter a valid domain (e.g., passport.yourbrand.com).",
  RESERVED_DOMAIN:
    "This domain is reserved and cannot be used.",
  NO_DOMAIN_CONFIGURED:
    "No custom domain is configured for your brand.",
  ALREADY_VERIFIED:
    "Your domain is already verified.",
  RATE_LIMITED:
    "Too many verification attempts. Please wait before trying again.",
  DNS_VERIFICATION_FAILED:
    "DNS verification failed. Please check your DNS settings and try again.",
};
```

---

## 10. Test Cases (TDD)

Following Test-Driven Development principles, all test cases are defined before implementation.

### 10.1 Schema Validation Tests

**File**: `apps/api/__tests__/unit/schemas/custom-domains.test.ts`

```typescript
describe("customDomainAddSchema", () => {
  describe("valid domains", () => {
    it("accepts simple domain: nike.com", () => {});
    it("accepts subdomain: passport.nike.com", () => {});
    it("accepts deep subdomain: eu.passport.nike.com", () => {});
    it("accepts domain with numbers: nike123.com", () => {});
    it("accepts domain with hyphens: my-brand.com", () => {});
    it("normalizes uppercase to lowercase: NIKE.COM -> nike.com", () => {});
  });

  describe("invalid domains", () => {
    it("rejects empty string", () => {});
    it("rejects domain without TLD: nike", () => {});
    it("rejects domain with consecutive dots: nike..com", () => {});
    it("rejects domain starting with hyphen: -nike.com", () => {});
    it("rejects domain ending with hyphen: nike-.com", () => {});
    it("rejects domain with port: nike.com:8080", () => {});
    it("rejects domain with protocol: https://nike.com", () => {});
    it("rejects domain with path: nike.com/path", () => {});
    it("rejects IP address format: 192.168.1.1", () => {});
    it("rejects domain exceeding 253 characters", () => {});
    it("rejects domain shorter than 4 characters", () => {});
  });

  describe("reserved domains", () => {
    it("rejects avelero.com", () => {});
    it("rejects passport.avelero.com", () => {});
    it("rejects subdomain of avelero.com: foo.avelero.com", () => {});
    it("rejects localhost", () => {});
    it("rejects example.com", () => {});
  });
});
```

### 10.2 DNS Verification Tests

**File**: `apps/api/__tests__/unit/utils/dns-verification.test.ts`

```typescript
describe("verifyDomainDns", () => {
  describe("successful verification", () => {
    it("returns success when TXT record matches token", () => {});
    it("returns success when one of multiple TXT records matches", () => {});
    it("handles chunked TXT records by concatenating", () => {});
    it("trims whitespace from TXT record value", () => {});
  });

  describe("failed verification", () => {
    it("returns failure when no TXT record exists (ENOTFOUND)", () => {});
    it("returns failure when no TXT record exists (ENODATA)", () => {});
    it("returns failure when TXT record exists but token mismatches", () => {});
    it("returns failure with found records for debugging", () => {});
  });

  describe("error handling", () => {
    it("returns failure on DNS timeout (10s)", () => {});
    it("returns failure on DNS resolution error", () => {});
    it("includes error message in response", () => {});
  });
});
```

### 10.3 Router Integration Tests

**File**: `apps/api/__tests__/integration/trpc/custom-domains.test.ts`

```typescript
describe("Custom Domains Router", () => {
  describe("customDomains.get", () => {
    it("returns null when no domain configured", () => {});
    it("returns domain config for brand member", () => {});
    it("includes verification token for pending domain", () => {});
    it("includes verifiedAt for verified domain", () => {});
    it("includes error message for failed domain", () => {});
    it("denies access to non-brand members", () => {});
  });

  describe("customDomains.add", () => {
    describe("success cases", () => {
      it("creates domain with pending status", () => {});
      it("generates unique verification token", () => {});
      it("returns DNS instructions", () => {});
      it("normalizes domain to lowercase", () => {});
    });

    describe("authorization", () => {
      it("allows brand owner", () => {});
      it("denies brand member (non-owner)", () => {});
      it("denies unauthenticated user", () => {});
    });

    describe("validation", () => {
      it("rejects invalid domain format", () => {});
      it("rejects reserved domain", () => {});
    });

    describe("uniqueness constraints", () => {
      it("rejects if brand already has domain", () => {});
      it("rejects if domain claimed by another brand", () => {});
    });
  });

  describe("customDomains.verify", () => {
    describe("success cases", () => {
      it("updates status to verified on success", () => {});
      it("sets verifiedAt timestamp", () => {});
      it("clears verificationError on success", () => {});
    });

    describe("failure cases", () => {
      it("updates status to failed on DNS failure", () => {});
      it("stores error message", () => {});
      it("updates lastVerificationAttempt", () => {});
    });

    describe("edge cases", () => {
      it("returns error when no domain configured", () => {});
      it("returns error when already verified", () => {});
    });
  });

  describe("customDomains.remove", () => {
    it("deletes pending domain", () => {});
    it("deletes verified domain", () => {});
    it("deletes failed domain", () => {});
    it("returns error when no domain configured", () => {});
    it("allows brand owner only", () => {});
    it("allows domain to be reclaimed after removal", () => {});
  });
});
```

### 10.4 UI Component Tests (Future)

> **Note**: UI component tests are out of scope for this PR. Test infrastructure for React components has not been configured yet.

### 10.5 End-to-End Tests (Future)

> **Note**: E2E tests are out of scope for this PR.

---

## 11. File Structure & Changes

### 11.1 New Files to Create

```
packages/db/src/schema/brands/
└── brand-custom-domains.ts           # Database schema

apps/api/src/schemas/
└── custom-domains.ts                 # Zod validation schemas

apps/api/src/trpc/routers/brand/
└── custom-domains.ts                 # tRPC router

apps/api/src/utils/
└── dns-verification.ts               # DNS lookup utility

apps/api/__tests__/unit/schemas/
└── custom-domains.test.ts            # Schema validation tests

apps/api/__tests__/unit/utils/
└── dns-verification.test.ts          # DNS utility tests

apps/api/__tests__/integration/trpc/
└── custom-domains.test.ts            # Router integration tests

apps/app/src/components/settings/
└── set-domain.tsx                    # Block in General settings

apps/app/src/components/modals/
├── custom-domain-modal.tsx           # Main modal (all states inline)
└── remove-domain-modal.tsx           # Confirmation modal

apps/app/src/hooks/
└── use-custom-domain.ts              # React Query hooks
```

### 11.2 Existing Files to Modify

```
packages/db/src/schema/index.ts
  + export * from "./brands/brand-custom-domains";

apps/api/src/trpc/routers/brand/index.ts
  + import { brandCustomDomainsRouter } from "./custom-domains.js";
  + customDomains: brandCustomDomainsRouter,

apps/app/src/app/(dashboard)/(main)/(sidebar)/settings/page.tsx
  + import { SetDomain } from "@/components/settings/set-domain";
  + <SetDomain />  (add between SetCountry and DeleteBrand)
  + Add trpc.brand.customDomains.get.queryOptions() to batchPrefetch
```

### 11.3 Migration Files (Auto-generated)

After creating the schema, run:
```bash
bun db:generate    # Creates migration file
bun db:migrate     # Applies migration
cd packages/supabase && bun types:generate  # Updates types
```

---

## 12. Migration Strategy

### 12.1 Database Migration

The migration will create:
1. `brand_custom_domains` table
2. Unique indexes for `brand_id` and `domain`
3. RLS policies

No data migration needed (new table).

### 12.2 Rollback Plan

If issues arise:
1. Disable the Domains tab in UI (feature flag)
2. Drop the `brand_custom_domains` table
3. Revert code changes

---

## 13. Future Considerations

### 13.1 Out of Scope (Future PRs)

1. **SSL Certificate Provisioning**: Will be handled by infrastructure (Cloudflare/Vercel)
2. **DPP Routing Updates**: Separate PR to update `apps/dpp` for custom domain routing
3. **QR Code Generation**: Separate feature that will use verified domains
4. **Automatic Re-verification**: Periodic checks to ensure domain still belongs to brand
5. **Multiple Domains per Brand**: Currently limited to one
6. **Domain Transfer**: Moving domain between brands

### 13.2 Infrastructure Dependencies

For custom domains to actually serve DPP content:
1. DNS CNAME pointing to Avelero's edge (e.g., `dpp.avelero-edge.com`)
2. SSL certificate (auto-provisioned via Let's Encrypt on edge)
3. DPP app routing logic to resolve brand from host header

### 13.3 Analytics & Monitoring

Consider adding:
- Domain verification success/failure rates
- Time to verification (add -> verify)
- Most common verification errors
- Domain removal rates

---

## Appendix A: GS1 Digital Link Reference (Context Only)

> **Note**: GS1 URL handling is out of scope for this PR. This provides context for future work.

### URL Format

For Avelero DPP, we will use:
```
https://{custom-domain}/01/{barcode}
```

Where `/01/` is the GS1 Application Identifier for GTIN (Global Trade Item Number).

### Why Custom Domains Matter for GS1

GS1 Digital Link requires that the domain in the URL is controlled by the brand. This ensures:
1. **Authenticity**: The URL proves the brand published the passport
2. **Portability**: The brand controls the domain even if they leave Avelero
3. **Compliance**: Meets GS1 Digital Link standard requirements

### References

- [GS1 Digital Link Standard](https://www.gs1.org/standards/gs1-digital-link)

---

*End of Specification*
