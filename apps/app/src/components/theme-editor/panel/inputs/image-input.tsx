"use client";

import { ImageUploader } from "@/components/image-upload";
import { BUCKETS, UPLOAD_CONFIGS } from "@/utils/storage-config";
import { buildPublicUrl } from "@/utils/storage-urls";
import { createClient } from "@v1/supabase/client";
import { useCallback, useRef } from "react";
import type { ContentField } from "../../registry/types";
import { FieldWrapper } from "./field-wrapper";

interface ImageInputProps {
  field: ContentField;
  value: string;
  onChange: (path: string | null) => void;
  brandId?: string;
}

/**
 * Image uploader input for content fields.
 * Handles upload, deletion of old images, and storage path management.
 *
 * IMPORTANT: This component stores STORAGE PATHS (not full URLs) in themeConfig.
 * Paths are resolved to full URLs at query time by the API endpoints.
 * This ensures URLs work correctly across different environments (dev/prod).
 */
export function ImageInput({
  field,
  value,
  onChange,
  brandId,
}: ImageInputProps) {
  // Track the previous path for deletion when image changes
  const previousPathRef = useRef<string | null>(value || null);

  const handleImageChange = useCallback(
    async (_url: string | null, pathArray: string[] | null) => {
      const storagePath = pathArray ? pathArray.join("/") : null;

      // Delete old image if we're replacing it
      if (previousPathRef.current && previousPathRef.current !== storagePath) {
        try {
          const supabase = createClient();
          await supabase.storage
            .from(BUCKETS.DPP_ASSETS)
            .remove([previousPathRef.current]);
        } catch (error) {
          console.error("Failed to delete old image:", error);
        }
      }

      previousPathRef.current = storagePath;
      // Store the path, not the URL - URLs are resolved at query time
      onChange(storagePath);
    },
    [onChange],
  );

  // Convert stored path to display URL for the uploader preview
  const getDisplayUrl = (path: string | undefined): string | undefined => {
    if (!path) return undefined;
    return buildPublicUrl(BUCKETS.DPP_ASSETS, path) ?? undefined;
  };

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
        initialUrl={getDisplayUrl(value)}
        buildPath={(file) => {
          if (!brandId)
            throw new Error("Brand ID is required for image upload");
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const timestamp = Date.now();
          return [brandId, folder, `${timestamp}-${safeName}`];
        }}
        uploadOnSelect={true}
        onChange={handleImageChange}
        validation={validation}
      />
    </FieldWrapper>
  );
}
