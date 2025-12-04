/**
 * On-demand cache revalidation endpoint for DPP pages.
 *
 * This endpoint is called by the main API when product/brand data changes,
 * allowing cached DPP pages to be invalidated without requiring a full rebuild.
 *
 * Authentication: Uses a shared secret to prevent unauthorized revalidation.
 *
 * Cache tags supported:
 * - `dpp-product-{productUpid}` - Invalidate a specific product's DPP page
 * - `dpp-variant-{variantUpid}` - Invalidate a specific variant's DPP page
 * - `dpp-brand-{brandSlug}` - Invalidate all DPP pages for a brand
 */
import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";

const REVALIDATION_SECRET = process.env.DPP_REVALIDATION_SECRET;

export async function POST(request: NextRequest) {
  // Verify secret to prevent unauthorized revalidation
  const secret = request.headers.get("x-revalidation-secret");

  if (!REVALIDATION_SECRET) {
    console.error("[DPP Revalidate] DPP_REVALIDATION_SECRET not configured");
    return NextResponse.json(
      { error: "Revalidation not configured" },
      { status: 500 },
    );
  }

  if (secret !== REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { tags?: string[] };
    const { tags } = body;

    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid tags array" },
        { status: 400 },
      );
    }

    // Validate tag format (only allow expected prefixes)
    const validPrefixes = ["dpp-product-", "dpp-variant-", "dpp-brand-"];
    const invalidTags = tags.filter(
      (tag) => !validPrefixes.some((prefix) => tag.startsWith(prefix)),
    );

    if (invalidTags.length > 0) {
      return NextResponse.json(
        { error: `Invalid tag format: ${invalidTags.join(", ")}` },
        { status: 400 },
      );
    }

    // Revalidate each tag using stale-while-revalidate semantics
    // The "max" profile serves stale content while fetching fresh content in background
    for (const tag of tags) {
      revalidateTag(tag, "max");
    }

    console.log(`[DPP Revalidate] Invalidated ${tags.length} tags:`, tags);

    return NextResponse.json({
      revalidated: true,
      tags,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[DPP Revalidate] Error:", error);
    return NextResponse.json(
      { error: "Failed to parse request body" },
      { status: 400 },
    );
  }
}

