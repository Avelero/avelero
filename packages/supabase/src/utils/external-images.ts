/**
 * External Image Download Utility
 *
 * Downloads images from external URLs and uploads them to Supabase storage.
 * Used by integrations (Shopify, etc.) and bulk import.
 */

import { createHash } from "node:crypto";
import { type StorageClient, upload } from "./storage";

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];
const FETCH_TIMEOUT_MS = 30_000; // 30 seconds

interface DownloadAndUploadOptions {
  /** External image URL to download */
  url: string;
  /** Supabase storage bucket */
  bucket: string;
  /** Path prefix (e.g., "brandId/products/productId") */
  pathPrefix: string;
  /** Max file size in bytes (default: 10MB) */
  maxBytes?: number;
}

/**
 * Download an image from an external URL and upload it to Supabase storage.
 *
 * Returns the storage path (not full URL) on success, or null on failure.
 * Does NOT throw - failures return null for graceful handling in bulk operations.
 */
export async function downloadAndUploadImage(
  client: StorageClient,
  options: DownloadAndUploadOptions,
): Promise<string | null> {
  const { url, bucket, pathPrefix, maxBytes = DEFAULT_MAX_BYTES } = options;

  if (!url || !url.startsWith("http")) return null;

  try {
    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) return null;

    // Validate content type
    const contentType = response.headers.get("content-type")?.split(";")[0];
    if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return null;
    }

    // Get body as buffer and validate size
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) return null;

    // Generate deterministic filename from URL hash + extension
    const urlHash = createHash("sha256").update(url).digest("hex").slice(0, 16);
    const ext = contentType.split("/")[1] || "jpg";
    const filename = `${urlHash}.${ext}`;
    const path = `${pathPrefix}/${filename}`;

    // Upload to Supabase
    const blob = new Blob([arrayBuffer], { type: contentType });
    const result = await upload(client, {
      file: blob,
      bucket,
      path,
      contentType,
      upsert: true,
    });

    return result.path;
  } catch {
    // Silently return null - caller decides how to handle
    return null;
  }
}

/**
 * Check if a value is an external URL (not a Supabase storage path).
 */
export function isExternalImageUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith("http://") || value.startsWith("https://");
}
