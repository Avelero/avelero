/**
 * External Image Utilities
 *
 * Handles external image URLs: validation, downloading, and uploading to Supabase storage.
 * Used by integrations (Shopify, etc.) and bulk import.
 *
 * Key principle: Image values from users must ALWAYS be full HTTP/HTTPS URLs.
 * Storage paths are NOT valid user input. The system downloads images from URLs,
 * re-uploads them to storage, and stores the resulting storage path internally.
 */

import { createHash } from "node:crypto";
import { type StorageClient, upload } from "./storage";

// =============================================================================
// CONSTANTS
// =============================================================================

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
 * Result of downloading and uploading an external image.
 * Returns detailed error information on failure for user feedback.
 */
export interface DownloadAndUploadResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Storage path on success, null on failure */
  path: string | null;
  /** Error message on failure (for user feedback) */
  error?: string;
}

/**
 * Download an image from an external URL and upload it to Supabase storage.
 *
 * Returns a result object with success status, path, and error details.
 * Does NOT throw - failures are returned in the result for graceful handling.
 */
export async function downloadAndUploadImage(
  client: StorageClient,
  options: DownloadAndUploadOptions,
): Promise<DownloadAndUploadResult> {
  const { url, bucket, pathPrefix, maxBytes = DEFAULT_MAX_BYTES } = options;

  if (!url || !url.startsWith("http")) {
    return { success: false, path: null, error: "Invalid URL format" };
  }

  try {
    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        path: null,
        error: `HTTP ${response.status}: URL not found or access denied`,
      };
    }

    // Validate content type
    const contentType = response.headers.get("content-type")?.split(";")[0];
    if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return {
        success: false,
        path: null,
        error: `Invalid content type: ${contentType || "unknown"}. Expected image.`,
      };
    }

    // Get body as buffer and validate size
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      const sizeMB = Math.round(arrayBuffer.byteLength / 1024 / 1024);
      const maxMB = maxBytes / 1024 / 1024;
      return {
        success: false,
        path: null,
        error: `File too large: ${sizeMB}MB (max ${maxMB}MB)`,
      };
    }

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

    return { success: true, path: result.path };
  } catch (error) {
    const message =
      error instanceof Error && error.name === "AbortError"
        ? "Request timed out"
        : "Network error or URL unreachable";
    return { success: false, path: null, error: message };
  }
}

/**
 * Check if a value is an external URL (not a Supabase storage path).
 */
export function isExternalImageUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.startsWith("http://") || value.startsWith("https://");
}

// =============================================================================
// URL VALIDATION
// =============================================================================

export interface ImageValidationResult {
  valid: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * Validates that an image URL is a valid HTTP/HTTPS URL.
 *
 * Use this for user-provided image URLs (e.g., bulk import).
 * Returns detailed error messages for user feedback.
 *
 * @param imagePath - The image URL to validate
 * @returns Validation result with valid flag and optional error message
 */
export function validateImageUrl(imagePath: string): ImageValidationResult {
  // Handle null, undefined, empty, or whitespace-only values
  if (!imagePath || imagePath.trim() === "") {
    return { valid: true, skipped: true };
  }

  const trimmedPath = imagePath.trim();

  // Check for data URLs (not supported)
  if (trimmedPath.startsWith("data:")) {
    return {
      valid: false,
      error: `Invalid image URL: "${trimmedPath}". data URLs are not supported. Use a regular URL instead. Field skipped.`,
    };
  }

  // Must be HTTP or HTTPS URL
  if (
    !trimmedPath.startsWith("http://") &&
    !trimmedPath.startsWith("https://")
  ) {
    return {
      valid: false,
      error: `Invalid image URL: "${trimmedPath}". Image URLs must be a full URL starting with http:// or https://. Field skipped.`,
    };
  }

  // Try to parse as URL
  try {
    new URL(trimmedPath);
    return { valid: true };
  } catch {
    return {
      valid: false,
      error: `Invalid image URL format: "${trimmedPath}". Field skipped.`,
    };
  }
}
