/**
 * Product Import Storage Utilities
 *
 * Helper functions for managing product import files in Supabase Storage.
 * Path structure: {brand_id}/{job_id}/{filename}
 *
 * Supported formats: CSV, XLSX
 * Max file size: 5GB (enforced by bucket configuration)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types";

const PRODUCT_IMPORTS_BUCKET = "product-imports" as const;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5GB
const ALLOWED_MIME_TYPES = [
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"] as const;

type UploadImportFileParams = {
  file: File;
  brandId: string;
  jobId: string;
  filename: string;
};

type UploadImportFileResult = {
  path: string;
  fullPath: string;
  bucket: string;
};

/**
 * Upload a product import file to Supabase Storage
 *
 * @param client - Supabase client instance
 * @param params - Upload parameters including file, brandId, jobId, and filename
 * @returns Object containing the file path and bucket information
 * @throws Error if file validation fails or upload fails
 *
 * @example
 * ```ts
 * const result = await uploadImportFile(supabase, {
 *   file: csvFile,
 *   brandId: "123e4567-e89b-12d3-a456-426614174000",
 *   jobId: "job-uuid",
 *   filename: "products.csv"
 * });
 * ```
 */
export async function uploadImportFile(
  client: Pick<SupabaseClient<Database>, "storage">,
  { file, brandId, jobId, filename }: UploadImportFileParams,
): Promise<UploadImportFileResult> {
  // Validate file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
    );
  }

  // Validate file type by MIME type
  if (
    !ALLOWED_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_MIME_TYPES)[number],
    )
  ) {
    throw new Error(
      `Invalid file type: ${file.type}. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
    );
  }

  // Validate file extension
  const fileExtension = filename.toLowerCase().slice(filename.lastIndexOf("."));
  if (
    !ALLOWED_EXTENSIONS.includes(
      fileExtension as (typeof ALLOWED_EXTENSIONS)[number],
    )
  ) {
    throw new Error(
      `Invalid file extension: ${fileExtension}. Allowed extensions: ${ALLOWED_EXTENSIONS.join(", ")}`,
    );
  }

  // Construct path: {brand_id}/{job_id}/{filename}
  const path = `${brandId}/${jobId}/${filename}`;

  const storage = client.storage.from(PRODUCT_IMPORTS_BUCKET);

  console.log("[Supabase Storage] Attempting upload", {
    bucket: PRODUCT_IMPORTS_BUCKET,
    path,
    fileSize: file.size,
    contentType: file.type,
  });

  const result = await storage.upload(path, file, {
    upsert: true,
    cacheControl: "3600",
    contentType: file.type,
  });

  if (result.error) {
    console.error("[Supabase Storage] Upload failed", {
      error: result.error,
      path,
      statusCode: result.error.statusCode,
      message: result.error.message,
    });
    throw new Error(`Failed to upload file: ${result.error.message}`);
  }

  console.log("[Supabase Storage] Upload succeeded", {
    path,
    fullPath: result.data.fullPath,
  });

  // Always return the path we constructed, not what Supabase returns
  // to ensure consistency across the application
  return {
    path: path, // Use our constructed path, not result.data.path
    fullPath: result.data.fullPath,
    bucket: PRODUCT_IMPORTS_BUCKET,
  };
}

type DownloadImportFileParams =
  | {
      brandId: string;
      jobId: string;
      filename: string;
    }
  | {
      path: string;
    };

/**
 * Download a product import file from Supabase Storage
 *
 * @param client - Supabase client instance
 * @param params - Download parameters including brandId, jobId, and filename
 * @returns File blob data
 * @throws Error if download fails
 *
 * @example
 * ```ts
 * const result = await downloadImportFile(supabase, {
 *   brandId: "123e4567-e89b-12d3-a456-426614174000",
 *   jobId: "job-uuid",
 *   filename: "products.csv"
 * });
 *
 * if (result.data) {
 *   const blob = new Blob([result.data]);
 *   // Process the file
 * }
 * ```
 */
export async function downloadImportFile(
  client: Pick<SupabaseClient<Database>, "storage">,
  params: DownloadImportFileParams,
) {
  const path =
    "path" in params
      ? params.path
      : `${params.brandId}/${params.jobId}/${params.filename}`;

  const storage = client.storage.from(PRODUCT_IMPORTS_BUCKET);
  const result = await storage.download(path);

  if (result.error) {
    throw new Error(`Failed to download file: ${result.error.message}`);
  }

  return result;
}

type DeleteImportFileParams = {
  brandId: string;
  jobId: string;
  filename: string;
};

/**
 * Delete a product import file from Supabase Storage
 *
 * @param client - Supabase client instance
 * @param params - Delete parameters including brandId, jobId, and filename
 * @returns void
 * @throws Error if deletion fails
 *
 * @example
 * ```ts
 * await deleteImportFile(supabase, {
 *   brandId: "123e4567-e89b-12d3-a456-426614174000",
 *   jobId: "job-uuid",
 *   filename: "products.csv"
 * });
 * ```
 */
export async function deleteImportFile(
  client: Pick<SupabaseClient<Database>, "storage">,
  { brandId, jobId, filename }: DeleteImportFileParams,
): Promise<void> {
  const path = `${brandId}/${jobId}/${filename}`;

  const storage = client.storage.from(PRODUCT_IMPORTS_BUCKET);
  const result = await storage.remove([path]);

  if (result.error) {
    throw new Error(`Failed to delete file: ${result.error.message}`);
  }
}

type DeleteImportJobFilesParams = {
  brandId: string;
  jobId: string;
};

/**
 * Delete all files associated with an import job
 *
 * @param client - Supabase client instance
 * @param params - Parameters including brandId and jobId
 * @returns Array of deleted file paths
 * @throws Error if deletion fails
 *
 * @example
 * ```ts
 * const deleted = await deleteImportJobFiles(supabase, {
 *   brandId: "123e4567-e89b-12d3-a456-426614174000",
 *   jobId: "job-uuid"
 * });
 * console.log(`Deleted ${deleted.length} files`);
 * ```
 */
export async function deleteImportJobFiles(
  client: Pick<SupabaseClient<Database>, "storage">,
  { brandId, jobId }: DeleteImportJobFilesParams,
): Promise<string[]> {
  const folderPath = `${brandId}/${jobId}`;

  const storage = client.storage.from(PRODUCT_IMPORTS_BUCKET);

  // List all files in the job folder
  const listResult = await storage.list(folderPath);

  if (listResult.error) {
    throw new Error(
      `Failed to list files for deletion: ${listResult.error.message}`,
    );
  }

  if (!listResult.data || listResult.data.length === 0) {
    return [];
  }

  // Build full paths for all files
  const filePaths = listResult.data.map((file) => `${folderPath}/${file.name}`);

  // Delete all files
  const deleteResult = await storage.remove(filePaths);

  if (deleteResult.error) {
    throw new Error(
      `Failed to delete job files: ${deleteResult.error.message}`,
    );
  }

  return filePaths;
}

type GeneratePresignedUrlParams = {
  brandId: string;
  jobId: string;
  filename: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
  download?: boolean; // force download vs inline display
};

type GeneratePresignedUrlResult = {
  signedUrl: string;
  expiresAt: Date;
};

/**
 * Generate a presigned URL for temporary file access
 *
 * @param client - Supabase client instance
 * @param params - Parameters including brandId, jobId, filename, and optional expiration
 * @returns Object containing the signed URL and expiration timestamp
 * @throws Error if URL generation fails
 *
 * @example
 * ```ts
 * const { signedUrl, expiresAt } = await generatePresignedUrl(supabase, {
 *   brandId: "123e4567-e89b-12d3-a456-426614174000",
 *   jobId: "job-uuid",
 *   filename: "products.csv",
 *   expiresIn: 3600, // 1 hour
 *   download: true
 * });
 *
 * // Use the signed URL in a link
 * <a href={signedUrl} download>Download Import File</a>
 * ```
 */
export async function generatePresignedUrl(
  client: Pick<SupabaseClient<Database>, "storage">,
  {
    brandId,
    jobId,
    filename,
    expiresIn = 3600,
    download = false,
  }: GeneratePresignedUrlParams,
): Promise<GeneratePresignedUrlResult> {
  const path = `${brandId}/${jobId}/${filename}`;

  const storage = client.storage.from(PRODUCT_IMPORTS_BUCKET);
  const result = await storage.createSignedUrl(path, expiresIn, {
    download: download ? filename : undefined,
  });

  if (result.error) {
    throw new Error(
      `Failed to generate presigned URL: ${result.error.message}`,
    );
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  return {
    signedUrl: result.data.signedUrl,
    expiresAt,
  };
}

/**
 * Get the public path for a product import file (for internal references)
 * Does not provide actual access - use generatePresignedUrl for access.
 *
 * @param brandId - Brand UUID
 * @param jobId - Import job UUID
 * @param filename - File name
 * @returns Storage path string
 *
 * @example
 * ```ts
 * const path = getImportFilePath(
 *   "123e4567-e89b-12d3-a456-426614174000",
 *   "job-uuid",
 *   "products.csv"
 * );
 * // Returns: "123e4567-e89b-12d3-a456-426614174000/job-uuid/products.csv"
 * ```
 */
export function getImportFilePath(
  brandId: string,
  jobId: string,
  filename: string,
): string {
  return `${brandId}/${jobId}/${filename}`;
}

/**
 * Validate file metadata before upload
 *
 * @param file - File object to validate
 * @returns Object with validation result and optional error message
 *
 * @example
 * ```ts
 * const validation = validateImportFile(file);
 * if (!validation.valid) {
 *   console.error(validation.error);
 * }
 * ```
 */
export function validateImportFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Check file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_FILE_SIZE_BYTES / 1024 / 1024}MB`,
    };
  }

  // Check MIME type
  if (
    !ALLOWED_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Allowed types: CSV, XLSX, XLS`,
    };
  }

  // Check file extension
  const fileExtension = file.name
    .toLowerCase()
    .slice(file.name.lastIndexOf("."));
  if (
    !ALLOWED_EXTENSIONS.includes(
      fileExtension as (typeof ALLOWED_EXTENSIONS)[number],
    )
  ) {
    return {
      valid: false,
      error: `Invalid file extension: ${fileExtension}. Allowed extensions: .csv, .xlsx, .xls`,
    };
  }

  return { valid: true };
}

// Export constants for external use
export const PRODUCT_IMPORT_CONSTANTS = {
  BUCKET: PRODUCT_IMPORTS_BUCKET,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB: MAX_FILE_SIZE_BYTES / 1024 / 1024,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
} as const;
