import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

type StorageClient = Pick<SupabaseClient<Database>, "storage">;

/**
 * Returns a public URL for a given bucket/path. Assumes the bucket is public or has appropriate policies.
 */
export function getPublicUrl(
  client: StorageClient,
  bucket: string,
  path: string,
): string | null {
  if (!path) return null;
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data?.publicUrl ?? null;
}

/**
 * Returns a signed URL for a given bucket/path with an expiration in seconds.
 */
export async function getSignedUrl(
  client: StorageClient,
  bucket: string,
  path: string,
  expireInSeconds: number,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expireInSeconds);

  if (error) return null;
  return data?.signedUrl ?? null;
}
