/**
 * Server-side Google Maps Static API proxy for the DPP frontend.
 */

import type { NextRequest } from "next/server";

const DEFAULT_MAP_WIDTH = 640;
const DEFAULT_MAP_HEIGHT = 213;
const DEFAULT_MAP_ZOOM = 16;
const MIN_DIMENSION = 120;
const MAX_WIDTH = 1280;
const MAX_HEIGHT = 720;
const MIN_ZOOM = 1;
const MAX_ZOOM = 20;

function clampInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
): number {
  // Normalize untrusted query parameters into a bounded integer.
  const parsedValue = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsedValue));
}

function buildGoogleStaticMapUrl(
  query: string,
  apiKey: string,
  width: number,
  height: number,
  zoom: number,
): string {
  // Build the upstream Google Static Maps request using the server-side API key.
  const params = new URLSearchParams({
    center: query,
    format: "png",
    key: apiKey,
    markers: `color:red|${query}`,
    scale: "2",
    size: `${width}x${height}`,
    style: "feature:poi|visibility:off",
    zoom: `${zoom}`,
  });

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  // Proxy the map image so the browser never sees the Google Maps API key.
  const query = request.nextUrl.searchParams.get("q")?.trim();

  if (!query) {
    return new Response("Missing map query.", { status: 400 });
  }

  const apiKey =
    process.env.GOOGLE_MAPS_STATIC_API_KEY ??
    process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    return new Response("Google Maps API key is not configured.", {
      status: 500,
    });
  }

  const width = clampInteger(
    request.nextUrl.searchParams.get("width"),
    DEFAULT_MAP_WIDTH,
    MIN_DIMENSION,
    MAX_WIDTH,
  );
  const height = clampInteger(
    request.nextUrl.searchParams.get("height"),
    DEFAULT_MAP_HEIGHT,
    MIN_DIMENSION,
    MAX_HEIGHT,
  );
  const zoom = clampInteger(
    request.nextUrl.searchParams.get("zoom"),
    DEFAULT_MAP_ZOOM,
    MIN_ZOOM,
    MAX_ZOOM,
  );
  const upstreamUrl = buildGoogleStaticMapUrl(
    query,
    apiKey,
    width,
    height,
    zoom,
  );
  const upstreamResponse = await fetch(upstreamUrl, {
    next: { revalidate: 86400 },
  });

  if (!upstreamResponse.ok) {
    return new Response("Failed to load Google Maps static image.", {
      status: 502,
    });
  }

  return new Response(await upstreamResponse.arrayBuffer(), {
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Content-Type":
        upstreamResponse.headers.get("content-type") ?? "image/png",
    },
    status: 200,
  });
}
