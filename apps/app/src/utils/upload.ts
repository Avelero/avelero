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

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export type ValidationConfig = {
  maxBytes: number;
  allowedMime: readonly string[];
};

// ============================================================================
// Font Constants
// ============================================================================

export const FONT_EXTENSIONS = ["woff2", "woff", "ttf", "otf"] as const;
export type FontExtension = (typeof FONT_EXTENSIONS)[number];

/**
 * Validate a file against a config.
 * Use UPLOAD_CONFIGS from storage-config.ts to get the right config for each use case.
 */
export function validateFile(
  file: File,
  config: ValidationConfig,
): ValidationResult {
  if (!config.allowedMime.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: ${config.allowedMime.join(", ")}`,
    };
  }

  if (file.size > config.maxBytes) {
    return {
      valid: false,
      error: `File is too large (max ${(config.maxBytes / 1024 / 1024).toFixed(0)}MB).`,
    };
  }

  return { valid: true };
}

/**
 * Validate an image file against a config.
 * Stricter version of validateFile that also checks the file is an image.
 */
export function validateImageFile(
  file: File,
  config: ValidationConfig,
): ValidationResult {
  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "Please upload an image file." };
  }

  return validateFile(file, config);
}

/**
 * Validate a font file by extension.
 *
 * Uses extension-based validation instead of MIME type because font MIME types
 * are inconsistent across browsers (e.g., some report "application/octet-stream").
 */
export function validateFontFile(
  file: File,
  config?: { maxBytes: number },
): ValidationResult {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (!ext || !FONT_EXTENSIONS.includes(ext as FontExtension)) {
    return {
      valid: false,
      error: `Invalid font format. Allowed: ${FONT_EXTENSIONS.join(", ")}`,
    };
  }

  if (config && file.size > config.maxBytes) {
    return {
      valid: false,
      error: `File is too large (max ${(config.maxBytes / 1024 / 1024).toFixed(0)}MB).`,
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

export function sanitizeFilename(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const base = parts.join(".").replace(/[^a-zA-Z0-9_-]/g, "_");
  const timestamp = Date.now();
  return `${base || "file"}-${timestamp}${ext ? `.${ext}` : ""}`;
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
