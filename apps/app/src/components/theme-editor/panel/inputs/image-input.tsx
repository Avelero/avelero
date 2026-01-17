"use client";

import { useCallback, useRef } from "react";
import { createClient } from "@v1/supabase/client";
import { ImageUploader } from "@/components/image-upload";
import { FieldWrapper } from "./field-wrapper";
import type { ContentField } from "../../registry/types";
import {
  BUCKETS,
  extractPathFromUrl,
  UPLOAD_CONFIGS,
} from "@/utils/storage-config";

interface ImageInputProps {
  field: ContentField;
  value: string;
  onChange: (url: string | null) => void;
  brandId?: string;
}

/**
 * Image uploader input for content fields.
 * Handles upload, deletion of old images, and storage path management.
 */
export function ImageInput({
  field,
  value,
  onChange,
  brandId,
}: ImageInputProps) {
  // Track the previous URL for deletion when image changes
  const previousUrlRef = useRef<string | null>(value || null);

  const handleImageChange = useCallback(
    async (url: string | null, _path: string[] | null) => {
      // Delete old image if we're replacing it
      if (previousUrlRef.current && previousUrlRef.current !== url) {
        try {
          const supabase = createClient();
          const oldPath = extractPathFromUrl(
            previousUrlRef.current,
            BUCKETS.DPP_ASSETS,
          );
          if (oldPath) {
            await supabase.storage.from(BUCKETS.DPP_ASSETS).remove([oldPath]);
          }
        } catch (error) {
          console.error("Failed to delete old image:", error);
        }
      }

      previousUrlRef.current = url;
      onChange(url);
    },
    [onChange],
  );

  // Determine the folder based on the field path
  const getStorageFolder = (fieldPath: string): string => {
    if (fieldPath.includes("headerLogo") || fieldPath.includes("branding")) {
      return "header-logo";
    }
    if (fieldPath.includes("banner") || fieldPath.includes("cta")) {
      return "banner";
    }
    return "assets";
  };

  // Determine dimensions based on field path
  const getDimensions = (
    fieldPath: string,
  ): { width: number; height: number } => {
    if (fieldPath.includes("headerLogo") || fieldPath.includes("branding")) {
      return { width: 250, height: 50 };
    }
    if (fieldPath.includes("banner") || fieldPath.includes("cta")) {
      return { width: 250, height: 100 };
    }
    return { width: 250, height: 100 };
  };

  const folder = getStorageFolder(field.path);
  const dimensions = getDimensions(field.path);

  // Use appropriate validation based on folder type
  const validation =
    folder === "header-logo" ? UPLOAD_CONFIGS.logo : UPLOAD_CONFIGS.banner;

  return (
    <FieldWrapper label={field.label}>
      <ImageUploader
        bucket={BUCKETS.DPP_ASSETS}
        mode="public"
        width={dimensions.width}
        height={dimensions.height}
        initialUrl={value || undefined}
        buildPath={(file) => {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const timestamp = Date.now();
          return [brandId!, folder, `${timestamp}-${safeName}`];
        }}
        uploadOnSelect={true}
        onChange={handleImageChange}
        validation={validation}
      />
    </FieldWrapper>
  );
}
