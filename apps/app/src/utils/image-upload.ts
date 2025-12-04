import { createClient } from "@v1/supabase/client";

export const DEFAULT_MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB
export const DEFAULT_ALLOWED_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/svg+xml",
] as const;

export type ImageValidationResult =
  | { valid: true }
  | { valid: false; error: string };

export function validateImageFile(
  file: File,
  opts?: {
    maxBytes?: number;
    allowedMime?: readonly string[];
  },
): ImageValidationResult {
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_IMAGE_BYTES;
  const allowedMime = opts?.allowedMime ?? DEFAULT_ALLOWED_MIME;

  if (!file.type.startsWith("image/")) {
    return { valid: false, error: "Please upload an image file." };
  }

  if (!allowedMime.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid image type. Allowed: ${allowedMime.join(", ")}`,
    };
  }

  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Image is too large (max ${(maxBytes / 1024 / 1024).toFixed(0)}MB).`,
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

export function encodePath(path: string | string[]): string {
  const joined = Array.isArray(path) ? path.join("/") : path;
  return joined
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function buildDisplayUrl(params: {
  bucket: string;
  path: string | string[];
  isPublic?: boolean;
  supabaseUrl?: string | null;
}) {
  const { bucket, path, isPublic = true, supabaseUrl } = params;
  const encodedPath = encodePath(path);

  if (isPublic) {
    if (supabaseUrl) {
      return `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
    }
    return `/storage/v1/object/public/${bucket}/${encodedPath}`;
  }

  return `/api/storage/${bucket}/${encodedPath}`;
}

export function getSupabaseUrl(): string | null {
  if (typeof window === "undefined") return null;
  return process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
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
