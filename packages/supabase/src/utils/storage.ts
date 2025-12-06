/**
 * Generic Storage Utilities
 *
 * Low-level functions for Supabase Storage operations.
 * Use these for any bucket - they're not bucket-specific.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

export type StorageClient = Pick<SupabaseClient<Database>, "storage">;

export const EMPTY_FOLDER_PLACEHOLDER_FILE_NAME = ".emptyFolderPlaceholder";

// ============================================================================
// Upload / Remove / Download
// ============================================================================

type UploadParams = {
  file: File | Blob;
  path: string | string[];
  bucket: string;
  contentType?: string;
  cacheControl?: string;
  upsert?: boolean;
  metadata?: Record<string, string>;
};

export async function upload(
  client: StorageClient,
  { file, path, bucket, contentType, cacheControl = "3600", upsert = true, metadata }: UploadParams,
): Promise<{ bucket: string; path: string }> {
  const storage = client.storage.from(bucket);
  const objectPath = Array.isArray(path) ? path.join("/") : path;

  const result = await storage.upload(objectPath, file, {
    upsert,
    cacheControl,
    contentType,
    metadata,
  });

  if (result.error) {
    throw new Error(`Upload failed: ${result.error.message}`);
  }

  return { bucket, path: objectPath };
}

export async function remove(
  client: StorageClient,
  bucket: string,
  paths: string | string[],
): Promise<void> {
  const pathArray = Array.isArray(paths) ? paths : [paths];
  const result = await client.storage.from(bucket).remove(pathArray);

  if (result.error) {
    throw new Error(`Remove failed: ${result.error.message}`);
  }
}

export async function download(
  client: StorageClient,
  bucket: string,
  path: string,
) {
  return client.storage.from(bucket).download(path);
}

// ============================================================================
// URL Helpers
// ============================================================================

/**
 * Get a public URL for a file. Works for public buckets.
 */
export function getPublicUrl(
  client: StorageClient,
  bucket: string,
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/**
 * Get a signed URL for temporary access. Works for private buckets.
 */
export async function getSignedUrl(
  client: StorageClient,
  bucket: string,
  path: string,
  expiresInSeconds: number,
  options?: { download?: boolean | string },
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds, options);

  if (error) return null;
  return data?.signedUrl ?? null;
}

// ============================================================================
// List / Exists
// ============================================================================

/**
 * List files in a folder.
 */
export async function listFiles(
  client: StorageClient,
  bucket: string,
  folderPath: string,
) {
  return client.storage.from(bucket).list(folderPath);
}
