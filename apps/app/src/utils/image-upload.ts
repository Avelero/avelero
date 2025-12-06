import { createClient } from "@v1/supabase/client";

// Re-export URL utilities from storage-urls.ts for backward compatibility
export {
  encodePath,
  buildPublicUrl,
  buildProxyUrl,
  buildStorageUrl,
  isFullUrl,
  normalizeToDisplayUrl,
  getSupabaseUrl,
} from "./storage-urls";

// Import for internal use
import {
  encodePath,
  buildPublicUrl,
  buildProxyUrl,
  getSupabaseUrl,
} from "./storage-urls";

export type ImageValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export type ImageValidationConfig = {
  maxBytes: number;
  allowedMime: readonly string[];
};

/**
 * Validate an image file against a config.
 * Use UPLOAD_CONFIGS from storage-config.ts to get the right config for each use case.
 */
export function validateImageFile(
  file: File,
  config: ImageValidationConfig,
): ImageValidationResult {
  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "Please upload an image file." };
  }

  if (!config.allowedMime.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid image type. Allowed: ${config.allowedMime.join(", ")}`,
    };
  }

  if (file.size > config.maxBytes) {
    return {
      valid: false,
      error: `Image is too large (max ${(config.maxBytes / 1024 / 1024).toFixed(0)}MB).`,
    };
  }

  return { valid: true };
}

export function buildObjectPath(
  parts: Array<string | undefined | null>,
): string[] {
  return parts
    .filter(Boolean)
    .map((part) => part!.trim())
    .filter((part) => part.length > 0);
}

/**
 * Build a display URL for a storage path.
 * @deprecated Use buildPublicUrl or buildProxyUrl from storage-urls.ts instead
 */
export function buildDisplayUrl(params: {
  bucket: string;
  path: string | string[];
  isPublic?: boolean;
  supabaseUrl?: string | null;
}) {
  const { bucket, path, isPublic = true } = params;
  const joinedPath = Array.isArray(path) ? path.join("/") : path;

  if (isPublic) {
    return buildPublicUrl(bucket, joinedPath) ?? "";
  }

  return buildProxyUrl(bucket, joinedPath) ?? "";
}

export function sanitizeFilename(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const base = parts.join(".").replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = Date.now();
  return `${base || "image"}-${timestamp}${ext ? `.${ext}` : ""}`;
}

/**
 * Optional helper to clear an entire folder in a bucket.
 */
export async function removeFolderContents(bucket: string, folderPath: string) {
  const supabase = createClient();
  const { data: existingFiles } = await supabase.storage
    .from(bucket)
    .list(folderPath);
  if (!existingFiles || existingFiles.length === 0) return;
  const filePaths = existingFiles.map((file) => `${folderPath}/${file.name}`);
  await supabase.storage.from(bucket).remove(filePaths);
}
