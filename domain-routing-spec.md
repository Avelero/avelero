# Domain Routing - Technical Specification

> **Status**: Draft
> **Author**: Engineering Team
> **Prerequisite**: Custom Domain Management (complete)
> **Related**: [custom-domain-specs.md](./custom-domain-specs.md)

---

## Table of Contents

1. [Overview](#1-overview)
2. [URL Patterns & Routing Logic](#2-url-patterns--routing-logic)
3. [Architecture](#3-architecture)
4. [Infrastructure Setup](#4-infrastructure-setup)
5. [Implementation Details](#5-implementation-details)
6. [Database Queries](#6-database-queries)
7. [Security Considerations](#7-security-considerations)
8. [Edge Cases & Error Handling](#8-edge-cases--error-handling)
9. [Test Cases (TDD)](#9-test-cases-tdd)
10. [File Structure & Changes](#10-file-structure--changes)
11. [Deployment & Rollout](#11-deployment--rollout)

---

## 1. Overview

### 1.1 What This Feature Does

This feature enables routing for Digital Product Passports (DPP) across multiple URL patterns and domains:

1. **Standard UPID URLs** - `passport.avelero.com/{upid}` (already working)
2. **Custom Domain UPID URLs** - `{custom-domain}/{upid}` (new)
3. **GS1 Digital Link URLs** - `{custom-domain}/01/{gtin}` (new, custom domains only)

### 1.2 What This Feature Does NOT Do

- **Does NOT** handle custom domain verification (done in previous PR)
- **Does NOT** generate QR codes (separate feature)
- **Does NOT** handle GS1 resolver registration (future consideration)
- **Does NOT** support additional GS1 Application Identifiers beyond `/01/` (GTIN)

### 1.3 Prerequisites

- Custom Domain Management feature complete (brands can add/verify domains)
- Vercel project configured for custom domains
- DNS CNAME records pointing to Vercel

---

## 2. URL Patterns & Routing Logic

### 2.1 Supported URL Patterns

| Pattern | Example | Domain Restriction | Lookup Method |
|---------|---------|-------------------|---------------|
| `/{upid}` | `passport.avelero.com/ABC123XYZ456DEFG` | Any | Direct UPID lookup |
| `/{upid}` | `passport.nike.com/ABC123XYZ456DEFG` | Any | Direct UPID lookup |
| `/01/{gtin}` | `passport.nike.com/01/00012345678905` | Custom domains only | Brand-scoped barcode lookup |

### 2.2 Why `/01/{gtin}` Only Works on Custom Domains

**Security rationale**: The barcode/GTIN is not globally unique across brands. Multiple brands could theoretically have products with the same barcode. Without a custom domain:

1. We cannot determine which brand owns the barcode
2. A malicious brand could claim another brand's barcode
3. GS1 compliance requires brand-controlled domains

**With a custom domain**:
1. The domain itself identifies the brand (via `brand_custom_domains` table)
2. We scope the barcode lookup to that brand's products only
3. GS1 Digital Link compliance is maintained

### 2.3 UPID vs Barcode

| Identifier | Uniqueness | Domain Agnostic | Use Case |
|------------|------------|-----------------|----------|
| **UPID** | Globally unique | Yes | Works everywhere |
| **Barcode/GTIN** | Unique per brand | No (needs brand context) | Custom domains only |

### 2.4 Routing Decision Tree

```
Request arrives
    │
    ├─► Parse URL path
    │
    ├─► Is path `/01/{gtin}` format?
    │   │
    │   ├─► YES: Is host a custom domain?
    │   │   │
    │   │   ├─► YES: Resolve brand from domain
    │   │   │       Lookup passport by barcode + brand
    │   │   │       └─► Render passport (or 404)
    │   │   │
    │   │   └─► NO (passport.avelero.com):
    │   │           Return 404 with helpful error
    │   │           "GS1 URLs require a custom domain"
    │   │
    │   └─► NO: Is path `/{upid}` format?
    │       │
    │       ├─► YES: Lookup passport by UPID (global)
    │       │       └─► Render passport (or 404)
    │       │
    │       └─► NO: Return 404 (invalid path)
```

---

## 3. Architecture

### 3.1 Current Architecture (Before)

```
┌─────────────────────────────────────────────────────────┐
│                    passport.avelero.com                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   GET /{upid}                                            │
│       │                                                  │
│       ▼                                                  │
│   [upid]/page.tsx                                        │
│       │                                                  │
│       ▼                                                  │
│   tRPC: dppPublic.getByPassportUpid                      │
│       │                                                  │
│       ▼                                                  │
│   Database: product_passports.upid                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 3.2 New Architecture (After)

```
┌─────────────────────────────────────────────────────────┐
│     passport.avelero.com  OR  passport.nike.com          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   proxy.ts (Next.js 16 Middleware)                       │
│       │                                                  │
│       ├─► Detect host (custom domain vs avelero)         │
│       ├─► Parse path (/{upid} vs /01/{gtin})             │
│       └─► Route to appropriate handler                   │
│                                                          │
│   ┌───────────────────┬───────────────────────────────┐  │
│   │                   │                               │  │
│   │  /{upid}          │  /01/{gtin}                   │  │
│   │  (any domain)     │  (custom domain only)         │  │
│   │                   │                               │  │
│   │  [upid]/page.tsx  │  01/[gtin]/page.tsx           │  │
│   │       │           │       │                       │  │
│   │       ▼           │       ▼                       │  │
│   │  getByUpid        │  getByBarcode(brand, gtin)    │  │
│   │                   │                               │  │
│   └───────────────────┴───────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 3.3 Component Overview

| Component | Purpose | Location |
|-----------|---------|----------|
| `proxy.ts` | Request routing & domain detection | `apps/dpp/src/proxy.ts` |
| `[upid]/page.tsx` | UPID-based passport rendering | `apps/dpp/src/app/[upid]/page.tsx` (existing) |
| `01/[gtin]/page.tsx` | GS1 barcode-based passport rendering | `apps/dpp/src/app/01/[gtin]/page.tsx` (new) |
| `lib/domain.ts` | Domain resolution utilities | `apps/dpp/src/lib/domain.ts` (new) |
| tRPC router | New query for barcode lookup | `apps/api/src/trpc/routers/dpp-public/` |

---

## 4. Infrastructure Setup

### 4.1 DNS Configuration (Brand Responsibility)

Brands must add a CNAME record pointing their subdomain to `cname.avelero.com`:

| Field | Value |
|-------|-------|
| Type | `CNAME` |
| Name/Host | `passport` (or chosen subdomain) |
| Value | `cname.avelero.com` |
| TTL | 300 (or Auto) |

**Example for `passport.nike.com`:**
```
passport.nike.com.  300  IN  CNAME  cname.avelero.com.
```

### 4.1.1 One-Time Setup (Avelero Side)

You need to set up `cname.avelero.com` as an alias to your Vercel project:

1. In your DNS provider (for avelero.com), add:
   ```
   cname.avelero.com.  300  IN  CNAME  cname.vercel-dns.com.
   ```

2. In Vercel Dashboard → DPP Project → Settings → Domains, add `cname.avelero.com`

This creates the chain: `passport.nike.com` → `cname.avelero.com` → Vercel

Users only see `cname.avelero.com` in their instructions (branded), never Vercel.

### 4.2 Vercel Custom Domain Configuration

Custom domains must be added to the Vercel project. This can be done:

**Option A: Vercel Dashboard (Manual)**
1. Go to Project Settings → Domains
2. Add domain (e.g., `passport.nike.com`)
3. Vercel automatically provisions SSL certificate

**Option B: Vercel API (Automated)**

When a domain is verified in our app, we can automatically add it to Vercel:

```typescript
// Pseudocode - called after domain verification succeeds
async function addDomainToVercel(domain: string) {
  const response = await fetch(
    `https://api.vercel.com/v10/projects/${PROJECT_ID}/domains`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: domain }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to add domain to Vercel");
  }
}
```

**Decision needed**: Manual (simpler) vs Automated (better UX)?

### 4.3 SSL Certificate Provisioning

**Vercel handles this automatically:**
1. When a domain is added to the project, Vercel requests a certificate from Let's Encrypt
2. Certificate is provisioned within minutes
3. Auto-renewal is handled by Vercel
4. No application code needed

**Verification flow:**
1. Brand adds CNAME record → `passport.nike.com` → `cname.avelero.com` → Vercel
2. Domain is added to Vercel project (via API after TXT verification)
3. Vercel verifies DNS and provisions SSL certificate
4. HTTPS traffic flows to our DPP app

### 4.4 Environment Variables

Add to `apps/dpp/.env`:

```env
# For automated Vercel domain management (Option B)
VERCEL_TOKEN=xxx
VERCEL_PROJECT_ID=xxx

# Primary domain (for detecting custom vs default)
PRIMARY_DOMAIN=passport.avelero.com
```

---

## 5. Implementation Details

### 5.1 Next.js 16 Proxy File

**File**: `apps/dpp/src/proxy.ts`

The proxy file in Next.js 16 intercepts all requests before they reach the route handlers. It's similar to middleware but with more control over the request/response cycle.

```typescript
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Regex patterns
const UPID_PATTERN = /^\/([a-zA-Z0-9]{16})$/;
const GS1_GTIN_PATTERN = /^\/01\/(\d{8}|\d{12}|\d{13}|\d{14})$/;

export async function proxy(request: NextRequest) {
  const { pathname, host } = request.nextUrl;
  const primaryDomain = process.env.PRIMARY_DOMAIN || "passport.avelero.com";

  const isCustomDomain = host !== primaryDomain;

  // Match GS1 GTIN pattern: /01/{gtin}
  const gtinMatch = pathname.match(GS1_GTIN_PATTERN);
  if (gtinMatch) {
    const gtin = gtinMatch[1];

    if (!isCustomDomain) {
      // GS1 URLs only work on custom domains
      return new NextResponse(
        JSON.stringify({
          error: "GS1 Digital Link URLs require a custom domain",
          hint: "Use passport.avelero.com/{upid} or configure a custom domain",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Rewrite to GS1 route handler with domain context
    const url = request.nextUrl.clone();
    url.pathname = `/01/${gtin}`;
    url.searchParams.set("_domain", host);
    return NextResponse.rewrite(url);
  }

  // Match UPID pattern: /{upid}
  const upidMatch = pathname.match(UPID_PATTERN);
  if (upidMatch) {
    // UPID works on any domain - no changes needed
    return NextResponse.next();
  }

  // Handle root path
  if (pathname === "/") {
    // Could show a landing page or redirect
    return NextResponse.next();
  }

  // Unknown path - let Next.js handle 404
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and API routes
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
```

### 5.2 Domain Resolution Utility

**File**: `apps/dpp/src/lib/domain.ts`

```typescript
import { cache } from "react";

export interface ResolvedDomain {
  brandId: string;
  brandSlug: string;
  domain: string;
  isVerified: boolean;
}

/**
 * Resolve a custom domain to its brand.
 * Uses React cache for request deduplication.
 */
export const resolveDomain = cache(
  async (domain: string): Promise<ResolvedDomain | null> => {
    try {
      const response = await fetch(
        `${process.env.API_URL}/api/trpc/dppPublic.resolveDomain?` +
          new URLSearchParams({
            batch: "1",
            input: JSON.stringify({ "0": { domain } }),
          }),
        {
          next: { tags: [`domain-${domain}`], revalidate: 300 },
        }
      );

      if (!response.ok) return null;

      const data = await response.json();
      return data[0]?.result?.data ?? null;
    } catch {
      return null;
    }
  }
);

/**
 * Check if a host is a custom domain (not the primary Avelero domain).
 */
export function isCustomDomain(host: string): boolean {
  const primaryDomain = process.env.PRIMARY_DOMAIN || "passport.avelero.com";
  return host !== primaryDomain;
}
```

### 5.3 GS1 Route Handler

**File**: `apps/dpp/src/app/01/[gtin]/page.tsx`

```typescript
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { PassportPage } from "@/components/passport-page";
import { fetchPassportByBarcode } from "@/lib/api";
import { resolveDomain } from "@/lib/domain";
import { isValidGtin } from "@/lib/validation";

interface Params {
  gtin: string;
}

export default async function GS1PassportPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { gtin } = await params;

  // Validate GTIN format (8, 12, 13, or 14 digits)
  if (!isValidGtin(gtin)) {
    notFound();
  }

  // Get domain from header (set by proxy)
  const headersList = await headers();
  const domain = headersList.get("x-custom-domain");

  if (!domain) {
    // This shouldn't happen if proxy is configured correctly
    notFound();
  }

  // Resolve domain to brand
  const resolvedDomain = await resolveDomain(domain);

  if (!resolvedDomain || !resolvedDomain.isVerified) {
    notFound();
  }

  // Fetch passport by barcode within this brand
  const passport = await fetchPassportByBarcode(
    resolvedDomain.brandId,
    gtin
  );

  if (!passport || !passport.found) {
    notFound();
  }

  return <PassportPage data={passport} />;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  // Similar to [upid]/page.tsx but with barcode lookup
  // ...
}
```

### 5.4 Validation Utilities

**File**: `apps/dpp/src/lib/validation.ts` (extend existing)

```typescript
// Existing
export function isValidUpid(upid: string): boolean {
  return /^[a-zA-Z0-9]{16}$/.test(upid);
}

// New
export function isValidGtin(gtin: string): boolean {
  // GTIN-8, GTIN-12 (UPC), GTIN-13 (EAN), GTIN-14
  return /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(gtin);
}

/**
 * Normalize GTIN to 14 digits (GTIN-14 format).
 * Pads shorter GTINs with leading zeros.
 */
export function normalizeGtin(gtin: string): string {
  return gtin.padStart(14, "0");
}
```

### 5.5 API Client Extensions

**File**: `apps/dpp/src/lib/api.ts` (extend existing)

```typescript
// Existing
export async function fetchPassportDpp(upid: string): Promise<PassportDppApiResponse | null> {
  // ...
}

// New
export async function fetchPassportByBarcode(
  brandId: string,
  barcode: string
): Promise<PassportDppApiResponse | null> {
  try {
    const response = await fetch(
      `${process.env.API_URL}/api/trpc/dppPublic.getByBarcode?` +
        new URLSearchParams({
          batch: "1",
          input: JSON.stringify({ "0": { brandId, barcode } }),
        }),
      {
        next: {
          tags: [`dpp-barcode-${brandId}-${barcode}`],
          revalidate: 60,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data[0]?.result?.data ?? null;
  } catch {
    return null;
  }
}
```

---

## 6. Database Queries

### 6.1 New tRPC Procedures

**File**: `apps/api/src/trpc/routers/dpp-public/index.ts`

Add two new procedures:

#### 6.1.1 `resolveDomain` - Resolve custom domain to brand

```typescript
resolveDomain: publicProcedure
  .input(z.object({ domain: z.string() }))
  .query(async ({ ctx, input }) => {
    const result = await ctx.db
      .select({
        brandId: brandCustomDomains.brandId,
        brandSlug: brands.slug,
        domain: brandCustomDomains.domain,
        status: brandCustomDomains.status,
      })
      .from(brandCustomDomains)
      .innerJoin(brands, eq(brands.id, brandCustomDomains.brandId))
      .where(eq(brandCustomDomains.domain, input.domain.toLowerCase()))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const { brandId, brandSlug, domain, status } = result[0];

    return {
      brandId,
      brandSlug,
      domain,
      isVerified: status === "verified",
    };
  }),
```

#### 6.1.2 `getByBarcode` - Get passport by barcode within a brand

```typescript
getByBarcode: publicProcedure
  .input(z.object({
    brandId: z.string().uuid(),
    barcode: z.string().min(8).max(14).regex(/^\d+$/),
  }))
  .query(async ({ ctx, input }) => {
    // Normalize barcode (pad to 14 digits for consistent lookup)
    const normalizedBarcode = input.barcode.padStart(14, "0");

    // Also try original barcode (some may be stored without padding)
    const barcodes = [input.barcode, normalizedBarcode];

    const result = await ctx.db
      .select({
        id: productPassports.id,
        upid: productPassports.upid,
        brandId: productPassports.brandId,
        currentVersionId: productPassports.currentVersionId,
        workingVariantId: productPassports.workingVariantId,
        barcode: productPassports.barcode,
      })
      .from(productPassports)
      .where(
        and(
          eq(productPassports.brandId, input.brandId),
          inArray(productPassports.barcode, barcodes),
          isNotNull(productPassports.currentVersionId) // Must be published
        )
      )
      .limit(1);

    if (result.length === 0) {
      return { found: false };
    }

    const passport = result[0];

    // Fetch version and theme (same as getByPassportUpid)
    // ... rest of the implementation

    return {
      found: true,
      upid: passport.upid,
      // ... same structure as getByPassportUpid
    };
  }),
```

### 6.2 Database Index Recommendations

Add index for barcode lookups by brand:

```sql
-- Index for barcode lookup within a brand
CREATE INDEX idx_product_passports_brand_barcode
ON product_passports (brand_id, barcode)
WHERE barcode IS NOT NULL AND current_version_id IS NOT NULL;
```

**Migration file**: Will be auto-generated by Drizzle.

### 6.3 Query Performance

| Query | Expected Performance | Index Used |
|-------|---------------------|------------|
| Domain resolution | < 5ms | `brand_custom_domains_domain_unq` |
| Barcode lookup | < 10ms | `idx_product_passports_brand_barcode` |
| UPID lookup | < 5ms | `product_passports.upid` (unique) |

---

## 7. Security Considerations

### 7.1 Domain Spoofing Prevention

- **Host header validation**: Only accept requests where the Host header matches either:
  - The primary domain (`passport.avelero.com`)
  - A verified custom domain in `brand_custom_domains`
- **Unverified domain rejection**: Domains with `status !== 'verified'` return 404

### 7.2 Barcode Scoping

- **Brand isolation**: Barcode lookups are ALWAYS scoped to the brand identified by the custom domain
- **No cross-brand access**: A barcode on `passport.nike.com` cannot access Adidas products, even if they share the same barcode

### 7.3 Rate Limiting (Future)

Consider rate limiting on:
- Domain resolution: 1000 req/min per domain
- Barcode lookups: 100 req/min per IP
- Invalid domain attempts: 10 req/min per IP

### 7.4 Cache Considerations

- **Domain resolution**: Cache for 5 minutes (brands rarely change domains)
- **Barcode lookups**: Cache for 1 minute (passports may be updated)
- **Cache invalidation**: Tag-based invalidation when domains/passports change

---

## 8. Edge Cases & Error Handling

### 8.1 Domain Edge Cases

| Scenario | Behavior |
|----------|----------|
| Unknown custom domain | 404 with "Domain not configured" message |
| Unverified domain | 404 with "Domain pending verification" message |
| Domain verified but removed from Vercel | SSL error (Vercel level) |
| Domain in `brand_custom_domains` but brand deleted | 404 (FK cascade deletes domain record) |

### 8.2 Barcode Edge Cases

| Scenario | Behavior |
|----------|----------|
| Barcode not found for brand | 404 |
| Barcode exists but passport unpublished | 404 |
| Multiple passports with same barcode | Return first (shouldn't happen with proper validation) |
| GTIN-8 vs GTIN-14 for same product | Normalize and match |
| Barcode with leading zeros stripped | Try both original and padded versions |

### 8.3 UPID Edge Cases

| Scenario | Behavior |
|----------|----------|
| Valid UPID format but doesn't exist | 404 |
| UPID exists but orphaned | Render with "inactive" indicator |
| UPID accessed via wrong custom domain | Still works (UPID is global) |

### 8.4 Error Response Format

```typescript
// 404 responses should be JSON for API consumers
interface ErrorResponse {
  error: string;
  code: "DOMAIN_NOT_FOUND" | "DOMAIN_NOT_VERIFIED" | "PASSPORT_NOT_FOUND" | "INVALID_PATH";
  hint?: string;
}

// Example: GS1 URL on primary domain
{
  "error": "GS1 Digital Link URLs require a custom domain",
  "code": "INVALID_PATH",
  "hint": "Configure a custom domain at passport.avelero.com/settings"
}
```

---

## 9. Test Cases (TDD)

### 9.1 Proxy/Middleware Tests

**File**: `apps/dpp/__tests__/proxy.test.ts`

```typescript
describe("proxy", () => {
  describe("path detection", () => {
    it("recognizes valid UPID path: /ABC123XYZ456DEFG", () => {});
    it("recognizes valid GS1 path: /01/00012345678905", () => {});
    it("recognizes GTIN-8: /01/12345678", () => {});
    it("recognizes GTIN-12: /01/123456789012", () => {});
    it("recognizes GTIN-13: /01/1234567890123", () => {});
    it("recognizes GTIN-14: /01/12345678901234", () => {});
    it("rejects invalid UPID: /ABC123 (too short)", () => {});
    it("rejects invalid GTIN: /01/12345 (wrong length)", () => {});
    it("rejects non-numeric GTIN: /01/ABC12345678905", () => {});
  });

  describe("domain detection", () => {
    it("identifies passport.avelero.com as primary domain", () => {});
    it("identifies passport.nike.com as custom domain", () => {});
    it("handles www prefix correctly", () => {});
  });

  describe("GS1 routing", () => {
    it("allows /01/{gtin} on custom domains", () => {});
    it("rejects /01/{gtin} on primary domain with 404", () => {});
    it("includes domain in rewritten URL", () => {});
  });

  describe("UPID routing", () => {
    it("allows /{upid} on primary domain", () => {});
    it("allows /{upid} on custom domains", () => {});
  });
});
```

### 9.2 Domain Resolution Tests

**File**: `apps/api/__tests__/integration/trpc/domain-routing.test.ts`

```typescript
describe("dppPublic.resolveDomain", () => {
  it("returns brand info for verified domain", () => {});
  it("returns null for unknown domain", () => {});
  it("returns isVerified=false for pending domain", () => {});
  it("returns isVerified=false for failed domain", () => {});
  it("normalizes domain to lowercase", () => {});
  it("handles domain with trailing dot", () => {});
});
```

### 9.3 Barcode Lookup Tests

**File**: `apps/api/__tests__/integration/trpc/domain-routing.test.ts`

```typescript
describe("dppPublic.getByBarcode", () => {
  describe("success cases", () => {
    it("finds passport by exact barcode match", () => {});
    it("finds passport by normalized GTIN-14", () => {});
    it("returns full passport data with snapshot", () => {});
    it("includes brand theme in response", () => {});
  });

  describe("brand scoping", () => {
    it("only returns passports from specified brand", () => {});
    it("returns not found for barcode from different brand", () => {});
  });

  describe("failure cases", () => {
    it("returns found=false for unknown barcode", () => {});
    it("returns found=false for unpublished passport", () => {});
    it("returns found=false for orphaned passport", () => {});
  });

  describe("validation", () => {
    it("rejects invalid UUID for brandId", () => {});
    it("rejects non-numeric barcode", () => {});
    it("rejects barcode shorter than 8 digits", () => {});
    it("rejects barcode longer than 14 digits", () => {});
  });
});
```

### 9.4 End-to-End Tests

**File**: `apps/dpp/__tests__/e2e/routing.test.ts`

```typescript
describe("E2E: Custom Domain Routing", () => {
  describe("GS1 Digital Link", () => {
    it("resolves passport.nike.com/01/1234567890123 to correct passport", () => {});
    it("returns 404 for passport.avelero.com/01/1234567890123", () => {});
    it("returns 404 for unverified domain", () => {});
    it("returns 404 for barcode not belonging to brand", () => {});
  });

  describe("UPID on custom domain", () => {
    it("resolves passport.nike.com/{upid} same as passport.avelero.com/{upid}", () => {});
    it("works even for UPID belonging to different brand", () => {});
  });
});
```

### 9.5 Validation Tests

**File**: `apps/dpp/__tests__/unit/validation.test.ts`

```typescript
describe("isValidGtin", () => {
  it("accepts GTIN-8: 12345678", () => {});
  it("accepts GTIN-12: 123456789012", () => {});
  it("accepts GTIN-13: 1234567890123", () => {});
  it("accepts GTIN-14: 12345678901234", () => {});
  it("rejects 7 digits", () => {});
  it("rejects 9 digits", () => {});
  it("rejects 15 digits", () => {});
  it("rejects non-numeric", () => {});
  it("rejects alphanumeric", () => {});
});

describe("normalizeGtin", () => {
  it("pads GTIN-8 to 14 digits", () => {});
  it("pads GTIN-12 to 14 digits", () => {});
  it("pads GTIN-13 to 14 digits", () => {});
  it("keeps GTIN-14 unchanged", () => {});
});
```

---

## 10. File Structure & Changes

### 10.1 New Files to Create

```
apps/dpp/src/
├── proxy.ts                           # Next.js 16 proxy/middleware
├── app/
│   └── 01/
│       └── [gtin]/
│           └── page.tsx               # GS1 Digital Link route
├── lib/
│   └── domain.ts                      # Domain resolution utilities

apps/api/src/
├── trpc/routers/dpp-public/
│   └── index.ts                       # Add resolveDomain, getByBarcode

packages/db/src/
├── schema/brands/
│   └── brand-custom-domains.ts        # Add index for barcode lookup

apps/dpp/__tests__/
├── proxy.test.ts                      # Proxy unit tests
├── unit/
│   └── validation.test.ts             # GTIN validation tests
└── e2e/
    └── routing.test.ts                # End-to-end routing tests

apps/api/__tests__/integration/trpc/
└── domain-routing.test.ts             # API integration tests
```

### 10.2 Existing Files to Modify

```
apps/dpp/src/lib/validation.ts
  + isValidGtin()
  + normalizeGtin()

apps/dpp/src/lib/api.ts
  + fetchPassportByBarcode()

apps/dpp/next.config.mjs
  + Configure proxy.ts

apps/api/src/trpc/routers/dpp-public/index.ts
  + resolveDomain procedure
  + getByBarcode procedure
```

### 10.3 Summary of Changes

| Type | Count | Files |
|------|-------|-------|
| **NEW** | 7 | proxy.ts, GS1 route, domain utils, tests |
| **MODIFIED** | 4 | validation.ts, api.ts, next.config, dpp-public router |

---

## 11. Deployment & Rollout

### 11.1 Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Database migration applied (barcode index)
- [ ] Environment variables configured
- [ ] Vercel project configured for custom domains

### 11.2 Vercel Configuration

Add to `vercel.json` (if not already present):

```json
{
  "rewrites": [
    { "source": "/01/:gtin", "destination": "/01/:gtin" }
  ]
}
```

Or configure via Vercel dashboard.

### 11.3 Rollout Strategy

**Phase 1: Internal Testing**
1. Deploy to staging
2. Add test custom domain
3. Verify all URL patterns work

**Phase 2: Limited Rollout**
1. Deploy to production
2. Enable for 1-2 pilot brands
3. Monitor for errors

**Phase 3: General Availability**
1. Enable domain routing for all verified domains
2. Update documentation
3. Announce feature to users

### 11.4 Monitoring & Alerts

Set up alerts for:
- Domain resolution failures (> 1% error rate)
- Barcode lookup latency (> 500ms p99)
- SSL certificate errors
- 404 spike on custom domains

### 11.5 Rollback Plan

If issues arise:
1. Disable proxy.ts (revert to direct routing)
2. GS1 URLs will 404, UPID URLs continue to work
3. No data loss (read-only feature)

---

## Appendix A: GS1 Digital Link Reference

### A.1 URL Structure

```
https://{domain}/01/{gtin}
        └──┬───┘ └┬┘└──┬──┘
           │      │    │
           │      │    └── Global Trade Item Number (barcode)
           │      └─────── GS1 Application Identifier for GTIN
           └────────────── Brand-controlled resolver domain
```

### A.2 Supported GTIN Formats

| Format | Digits | Example | Common Use |
|--------|--------|---------|------------|
| GTIN-8 | 8 | `12345678` | Small items |
| GTIN-12 | 12 | `123456789012` | UPC (North America) |
| GTIN-13 | 13 | `1234567890123` | EAN (International) |
| GTIN-14 | 14 | `12345678901234` | Cases/pallets |

### A.3 References

- [GS1 Digital Link Standard](https://www.gs1.org/standards/gs1-digital-link)
- [GS1 Application Identifiers](https://www.gs1.org/standards/barcodes/application-identifiers)

---

## Appendix B: Decision Log

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|--------|-----------|
| Vercel domain management | Manual vs API | TBD | Need to discuss with team |
| GTIN normalization | Store normalized vs lookup both | Lookup both | Backward compatibility |
| Cache duration | 1min vs 5min vs 30min | 1-5min | Balance freshness vs performance |

---

*End of Specification*
