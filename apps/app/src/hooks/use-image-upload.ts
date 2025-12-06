"use client";

import { useState, useCallback } from "react";
import { createClient } from "@v1/supabase/client";
import { upload } from "@v1/supabase/storage";
import {
  buildDisplayUrl,
  buildObjectPath,
  getSupabaseUrl,
  sanitizeFilename,
  validateImageFile,
  type ImageValidationResult,
  type ImageValidationConfig,
} from "@/utils/image-upload";

interface UploadImageOptions {
  file: File;
  bucket: string;
  path: string[];
  isPublic?: boolean;
  metadata?: Record<string, string>;
  /** Validation config from UPLOAD_CONFIGS, or custom validate function */
  validation: ImageValidationConfig | ((file: File) => ImageValidationResult);
}

interface UploadImageResult {
  path: string[];
  storageUrl: string;
  displayUrl: string;
}

export function useImageUpload() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);

  const uploadImage = useCallback(
    async ({
      file,
      bucket,
      path,
      isPublic = true,
      metadata,
      validation,
    }: UploadImageOptions): Promise<UploadImageResult> => {
      setError(null);
      setLoading(true);

      // Support both config object and custom function
      const validationResult =
        typeof validation === "function"
          ? validation(file)
          : validateImageFile(file, validation);

      if (!validationResult.valid) {
        setLoading(false);
        throw new Error(validationResult.error);
      }

      try {
        const supabase = createClient();
        const result = await upload(supabase, { file, bucket, path, metadata });
        const supabaseUrl = getSupabaseUrl();
        const displayUrl = buildDisplayUrl({
          bucket,
          path,
          isPublic,
          supabaseUrl,
        });

        return {
          path: buildObjectPath(path),
          // result.path is already a string from upload()
          storageUrl: result.path,
          displayUrl,
        };
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const buildPath = useCallback(
    (parts: Array<string | null | undefined>, file: File) =>
      buildObjectPath([...parts, sanitizeFilename(file.name.toLowerCase())]),
    [],
  );

  return { uploadImage, buildPath, error, isLoading, setError };
}
