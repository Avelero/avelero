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
} from "@/utils/image-upload";

interface UploadImageOptions {
  file: File;
  bucket: string;
  path: string[];
  isPublic?: boolean;
  metadata?: Record<string, string>;
  validate?: (file: File) => ImageValidationResult;
}

interface UploadImageResult {
  path: string[];
  storageUrl: string;
  displayUrl: string;
}

export function useImageUpload() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);

  const validate = useCallback(
    (file: File): ImageValidationResult => validateImageFile(file),
    [],
  );

  const uploadImage = useCallback(
    async ({
      file,
      bucket,
      path,
      isPublic = true,
      metadata,
      validate: validateOverride,
    }: UploadImageOptions): Promise<UploadImageResult> => {
      setError(null);
      setLoading(true);
      const validation = validateOverride ? validateOverride(file) : validate(file);
      if (!validation.valid) {
        setLoading(false);
        throw new Error(validation.error);
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
          storageUrl: result.path.join("/"),
          displayUrl,
        };
      } finally {
        setLoading(false);
      }
    },
    [validate],
  );

  const buildPath = useCallback(
    (parts: Array<string | null | undefined>, file: File) =>
      buildObjectPath([...parts, sanitizeFilename(file.name.toLowerCase())]),
    [],
  );

  return { uploadImage, buildPath, validate, error, isLoading, setError };
}
