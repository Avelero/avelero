"use client";

import { useState, useCallback } from "react";
import { createClient } from "@v1/supabase/client";
import { upload } from "@v1/supabase/storage";
import {
  buildObjectPath,
  buildProxyUrl,
  buildPublicUrl,
  sanitizeFilename,
  validateFile,
  validateImageFile,
  type ValidationResult,
  type ValidationConfig,
} from "@/utils/upload";

interface UploadOptions {
  file: File;
  bucket: string;
  path: string[];
  isPublic?: boolean;
  metadata?: Record<string, string>;
  /** Validation config or custom validate function */
  validation: ValidationConfig | ((file: File) => ValidationResult);
}

interface UploadResult {
  path: string[];
  storageUrl: string;
  displayUrl: string;
}

/**
 * Generic upload hook for any file type.
 * For image-specific uploads with stricter validation, use useImageUpload().
 */
export function useUpload() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);

  const uploadFile = useCallback(
    async ({
      file,
      bucket,
      path,
      isPublic = true,
      metadata,
      validation,
    }: UploadOptions): Promise<UploadResult> => {
      setError(null);
      setLoading(true);

      // Support both config object and custom function
      const validationResult =
        typeof validation === "function"
          ? validation(file)
          : validateFile(file, validation);

      if (!validationResult.valid) {
        setLoading(false);
        throw new Error(validationResult.error);
      }

      try {
        const supabase = createClient();
        const result = await upload(supabase, { file, bucket, path, metadata });
        const joinedPath = path.join("/");
        const displayUrl = isPublic
          ? buildPublicUrl(bucket, joinedPath) ?? ""
          : buildProxyUrl(bucket, joinedPath) ?? "";

        return {
          path: buildObjectPath(path),
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

  return { uploadFile, buildPath, error, isLoading, setError };
}

/**
 * Image-specific upload hook with stricter validation.
 * Wraps useUpload() and uses validateImageFile which ensures the file is an image.
 */
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
    }: UploadOptions): Promise<UploadResult> => {
      setError(null);
      setLoading(true);

      // Support both config object and custom function
      // For config objects, use stricter image validation
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
        const joinedPath = path.join("/");
        const displayUrl = isPublic
          ? buildPublicUrl(bucket, joinedPath) ?? ""
          : buildProxyUrl(bucket, joinedPath) ?? "";

        return {
          path: buildObjectPath(path),
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

