# Future API Integration Guide

## Current State (Mock Data)

The DPP application currently uses mock data for all product and theme information:
- All product data comes from `src/lib/mock-data/products.ts`
- All theme/styling data comes from `src/lib/mock-data/themes.ts`
- No external API calls are made
- Pages are statically generated using mock data

## Data Architecture

### Two-Tiered Data System

**1. Public Product Data (Future REST API)**
- Will contain: product info, materials, journey, impact metrics, similar products
- Should be publicly accessible with rate limiting
- Cacheable for performance

**2. Private Theme Data (Future tRPC API)**
- Will contain: colors, fonts, spacing, section visibility, branding assets
- Should be server-side only (not exposed to clients)
- Fetched during page generation

## Future Integration Steps

### 1. REST API for Public Data

**Location:** `apps/api/src/` (new REST endpoints)

**Endpoint Structure:**
```
GET /api/public/dpp/{upid}
```

**Implementation:**
- Create public REST API endpoints in the existing API app
- Add rate limiting (e.g., 100 requests/minute per IP)
- Return `DppData` structure matching `src/types/dpp-data.ts`
- No authentication required (public data)

**Replace in DPP app:**
```typescript
// Current: src/lib/mock-data/products.ts
export const mockProducts = { ... }

// Future: src/lib/api/rest-client.ts
export async function fetchDPPData(upid: string): Promise<DppData> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_REST_API_URL}/api/public/dpp/${upid}`);
  return response.json();
}
```

### 2. tRPC for Private Theme Data

**Location:** `apps/api/src/trpc/routers/dpp.ts`

**Implementation:**
```typescript
export const dppRouter = createTRPCRouter({
  getThemeByBrandSlug: publicProcedure
    .input(z.object({ 
      brandSlug: z.string(),
      productSlug: z.string() 
    }))
    .query(async ({ ctx, input }) => {
      // 1. Look up brand by vanity_url
      const brand = await ctx.db.query.brands.findFirst({
        where: eq(brands.vanityUrl, input.brandSlug),
      });
      
      // 2. Look up passport and get template
      const passport = await ctx.db.query.passports.findFirst({
        where: eq(passports.slug, input.productSlug),
        with: { template: true },
      });
      
      // 3. Return theme config
      return passport.template.theme as ThemeConfig;
    }),
});
```

**Replace in DPP app:**
```typescript
// Current: src/lib/mock-data/themes.ts
export const mockThemes = { ... }

// Future: src/lib/api/trpc-server.ts
import { createTRPCClient, httpBatchLink } from '@trpc/client';

export async function fetchThemeData(brand: string, upid: string) {
  const trpc = createTRPCClient({
    links: [httpBatchLink({ url: process.env.NEXT_PUBLIC_API_URL })],
  });
  
  return trpc.dpp.getThemeByBrandSlug.query({ brandSlug: brand, productSlug: upid });
}
```

### 3. Database Schema Changes

**Add to `packages/db/src/schema/core/brands.ts`:**
```sql
ALTER TABLE brands 
ADD COLUMN vanity_url TEXT UNIQUE;

CREATE INDEX idx_brands_vanity_url ON brands(vanity_url);
```

**Add to `packages/db/src/schema/passports/passports.ts`:**
```sql
ALTER TABLE passports
ADD COLUMN data_hash TEXT NOT NULL DEFAULT '',
ADD COLUMN last_generated_at TIMESTAMP,
ADD COLUMN generation_count INTEGER DEFAULT 0;

CREATE INDEX idx_passports_slug_hash ON passports(slug, data_hash);
```

### 4. Hash-Based ISR (Future Performance Optimization)

**When products are updated:**
```typescript
// Compute hash of product data
const dataHash = createHash('sha256')
  .update(JSON.stringify(productData))
  .digest('hex')
  .slice(0, 16);

// Update passport hash (marks as dirty)
await db.passports.update({
  where: { productId },
  data: { dataHash },
});
```

**Add middleware:** `apps/dpp/middleware.ts`
```typescript
export async function middleware(request: NextRequest) {
  // Check if data hash changed
  const currentHash = await db.getDataHash(upid);
  
  // If hash matches cached version, serve from cache
  // If hash differs, regenerate page
}
```

**Add revalidation webhook:** `apps/dpp/src/app/api/revalidate/route.ts`
```typescript
export async function POST(request: Request) {
  const { brand, upid, secret } = await request.json();
  
  if (secret !== process.env.REVALIDATION_SECRET) {
    return Response.json({ error: 'Invalid secret' }, { status: 401 });
  }
  
  await revalidatePath(`/${brand}/${upid}`);
  return Response.json({ revalidated: true });
}
```

### 5. Update Main DPP Page

**Current:** `apps/dpp/src/app/[brand]/[upid]/page.tsx`
```typescript
// Uses mock data
const productData = mockProducts[upid];
const themeData = mockThemes[brand];
```

**Future:**
```typescript
// Fetches real data
const productData = await fetchDPPData(upid);
const themeData = await fetchThemeData(brand, upid);

// Add revalidation
export const revalidate = false; // On-demand only
export const dynamicParams = true;
```

## Environment Variables

Add to `apps/dpp/.env`:
```bash
# API URLs
NEXT_PUBLIC_API_URL=https://api.avelero.com
NEXT_PUBLIC_REST_API_URL=https://api.avelero.com/public

# Revalidation
REVALIDATION_SECRET=your-secret-here

# Database (for middleware hash checks)
DATABASE_URL=postgresql://...
```

## Deployment Configuration

**Vercel Setup:**
- Create new Vercel project for `apps/dpp`
- Set domain: `passports.avelero.com`
- Add environment variables
- Build command: `cd ../.. && turbo build --filter=@v1/dpp`
- Output directory: `apps/dpp/.next`

## Testing Strategy

1. **Mock Data Phase (Current):**
   - Test all UI components
   - Verify theme system works
   - Test responsive layouts
   - Test interactive features (show more, carousel)

2. **API Integration Phase:**
   - Test REST API endpoint returns correct data
   - Test tRPC theme endpoint
   - Verify data structure matches types
   - Test error handling (404, 500)

3. **Performance Phase:**
   - Test ISR generation
   - Test hash-based invalidation
   - Measure page load times
   - Test with 1000+ products

## Migration Checklist

- [ ] Create REST API endpoints
- [ ] Create tRPC DPP router
- [ ] Add database columns (vanity_url, data_hash)
- [ ] Update DPP page to use real API
- [ ] Add middleware for hash checking
- [ ] Add revalidation webhook
- [ ] Configure Vercel deployment
- [ ] Test with production data
- [ ] Monitor performance metrics
- [ ] Set up error tracking

## Notes

- Keep mock data for development/testing
- Implement feature flags to switch between mock and real data
- Add proper error boundaries for API failures
- Consider adding loading states for better UX
- Plan for incremental rollout to production


