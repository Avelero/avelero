import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

export const EMPTY_FOLDER_PLACEHOLDER_FILE_NAME = ".emptyFolderPlaceholder";

type UploadParams = {
  file: File;
  path: string[];
  bucket: string;
  metadata?: Record<string, string>;
};

export async function upload(
  client: Pick<SupabaseClient<Database>, "storage">,
  { file, path, bucket, metadata }: UploadParams,
): Promise<{ bucket: string; path: string[] }> {
  const storage = client.storage.from(bucket);
  const objectPath = path.join("/");

  const result = await storage.upload(objectPath, file, {
    upsert: true,
    cacheControl: "3600",
    metadata,
  });

  if (!result.error) {
    return { bucket, path };
  }

  throw result.error;
}

type RemoveParams = {
  path: string[];
  bucket: string;
};

export async function remove(
  client: Pick<SupabaseClient<Database>, "storage">,
  { bucket, path }: RemoveParams,
) {
  return client.storage
    .from(bucket)
    .remove([decodeURIComponent(path.join("/"))]);
}

type DownloadParams = {
  path: string;
  bucket: string;
};

export async function download(
  client: Pick<SupabaseClient<Database>, "storage">,
  { bucket, path }: DownloadParams,
) {
  return client.storage.from(bucket).download(path);
}

type SignedUrlParams = {
  path: string;
  bucket: string;
  expireIn: number;
  options?: {
    download?: boolean;
  };
};

export async function signedUrl(
  client: Pick<SupabaseClient<Database>, "storage">,
  { bucket, path, expireIn, options }: SignedUrlParams,
) {
  return client.storage.from(bucket).createSignedUrl(path, expireIn, options);
}
