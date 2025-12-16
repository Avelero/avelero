/**
 * Image Processing
 *
 * Handles downloading external images and uploading to storage.
 */

import {
  downloadAndUploadImage,
  isExternalImageUrl,
} from "@v1/supabase/utils/external-images";
import type { StorageClient } from "./types";

/**
 * Download external image and upload to storage if needed.
 * Returns the storage path, or null if download fails.
 * If the URL is already a storage path (not external), returns it unchanged.
 */
export async function processImageUrl(
  storageClient: StorageClient,
  brandId: string,
  productId: string,
  imageUrl: string | null | undefined
): Promise<string | null> {
  if (!imageUrl) return null;

  // If not an external URL, return as-is (already a storage path)
  if (!isExternalImageUrl(imageUrl)) return imageUrl;

  // Download and upload to our storage
  const storagePath = await downloadAndUploadImage(storageClient, {
    url: imageUrl,
    bucket: "products",
    pathPrefix: brandId,
  });

  return storagePath;
}
