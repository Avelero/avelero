import { createClient } from "@v1/supabase/server";
import { NextResponse } from "next/server";

const ALLOWED_BUCKETS = new Set(["avatars", "brand-avatars"]);

export async function GET(
  request: Request,
  context: { params: Promise<{ bucket: string; path: string[] }> },
) {
  const { bucket, path } = await context.params;

  if (!bucket || !ALLOWED_BUCKETS.has(bucket)) {
    return new NextResponse("Invalid bucket", { status: 400 });
  }

  const objectPath = Array.isArray(path) ? path.join("/") : String(path || "");
  if (!objectPath) {
    return new NextResponse("Missing path", { status: 400 });
  }

  try {
    // Use admin client so optimizer/internal fetches (without cookies) can read avatars
    const supabase = await createClient({ admin: true });

    const { data, error } = await supabase.storage
      .from(bucket)
      .download(objectPath);

    if (error || !data) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Infer content type from the Blob if available
    const contentType =
      (data as unknown as Blob).type || "application/octet-stream";

    // Cache for 1 hour, allow stale while revalidating for a week
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=604800",
    };

    return new NextResponse(data as unknown as ReadableStream, { headers });
  } catch (_e) {
    return new NextResponse("Server error", { status: 500 });
  }
}
