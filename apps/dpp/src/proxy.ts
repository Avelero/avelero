/**
 * Next.js 16 Proxy - Domain and Route Detection
 *
 * Handles custom domain routing for DPP:
 * - Detects custom domains vs primary domain
 * - Routes GS1 Digital Link URLs (/01/{barcode}) to the appropriate handler
 * - Passes domain context to route handlers via search params
 *
 * This is the Next.js 16+ proxy file (renamed from middleware.ts).
 */
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the list of primary (non-custom) domains.
 * Duplicated from lib/domain.ts to avoid importing Node.js modules in Edge Runtime.
 */
function getPrimaryDomains(): string[] {
  const domains: string[] = [];

  if (process.env.PRIMARY_DOMAIN) {
    domains.push(process.env.PRIMARY_DOMAIN.toLowerCase());
  }

  if (process.env.VERCEL_URL) {
    domains.push(process.env.VERCEL_URL.toLowerCase());
  }

  if (domains.length === 0) {
    domains.push("localhost");
  }

  return domains;
}

// ─────────────────────────────────────────────────────────────────────────────
// Patterns
// ─────────────────────────────────────────────────────────────────────────────

/**
 * UPID pattern: exactly 16 alphanumeric characters
 */
const UPID_PATTERN = /^\/([a-zA-Z0-9]{16})$/;

/**
 * GS1 Digital Link pattern: /01/ followed by 8, 12, 13, or 14 digits
 * Following GS1 standard where 01 is the Application Identifier for GTIN
 */
const GS1_BARCODE_PATTERN = /^\/01\/(\d{8}|\d{12}|\d{13}|\d{14})$/;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalize host by removing port number and converting to lowercase
 */
function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/:\d+$/, "");
}

/**
 * Check if host is a custom domain (not primary or localhost)
 */
function isCustomDomain(host: string): boolean {
  const normalized = normalizeHost(host);
  const primaryDomains = getPrimaryDomains();

  return !primaryDomains.some(
    (primary) =>
      normalized === primary ||
      normalized.endsWith(`.${primary}`) ||
      (primary === "localhost" && normalized.startsWith("localhost")),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Proxy Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";

  // ─────────────────────────────────────────────────────────────────────────
  // GS1 Digital Link Pattern: /01/{barcode}
  // ─────────────────────────────────────────────────────────────────────────
  const barcodeMatch = pathname.match(GS1_BARCODE_PATTERN);
  if (barcodeMatch) {
    const barcode = barcodeMatch[1];

    // GS1 URLs only work on custom domains
    if (!isCustomDomain(host)) {
      return NextResponse.json(
        {
          error: "GS1 Digital Link URLs require a custom domain",
          code: "INVALID_PATH",
          hint: "Use passport.avelero.com/{upid} for direct passport access, or configure a custom domain for GS1 URLs",
        },
        { status: 404 },
      );
    }

    // Rewrite to GS1 route handler with domain context
    const url = request.nextUrl.clone();
    url.pathname = `/01/${barcode}`;
    url.searchParams.set("_domain", normalizeHost(host));
    return NextResponse.rewrite(url);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UPID Pattern: /{upid}
  // ─────────────────────────────────────────────────────────────────────────
  const upidMatch = pathname.match(UPID_PATTERN);
  if (upidMatch) {
    // UPID works on any domain - pass through
    // Optionally add domain context for analytics/logging
    if (isCustomDomain(host)) {
      const url = request.nextUrl.clone();
      url.searchParams.set("_domain", normalizeHost(host));
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Root Path: /
  // ─────────────────────────────────────────────────────────────────────────
  if (pathname === "/") {
    // Let the page.tsx handle root
    return NextResponse.next();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Unknown Path
  // ─────────────────────────────────────────────────────────────────────────
  // Let Next.js handle 404 for unknown paths
  return NextResponse.next();
}

// ─────────────────────────────────────────────────────────────────────────────
// Proxy Config
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    // Match all paths except:
    // - _next/static (static files)
    // - _next/image (image optimization)
    // - favicon.ico
    // - api routes
    // - public folder files (images, etc.)
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
