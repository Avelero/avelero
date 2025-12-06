"use client";

import { useCallback, useRef } from "react";
import { createClient } from "@v1/supabase/client";
import { ImageUploader } from "@/components/image-upload";
import { FieldWrapper } from "./field-wrapper";
import type { ContentField } from "../../registry/types";

interface ImageInputProps {
    field: ContentField;
    value: string;
    onChange: (url: string | null) => void;
    brandId?: string;
}

/**
 * Extract the storage path from a public Supabase URL.
 * Example: https://xxx.supabase.co/storage/v1/object/public/dpp-assets/brand-123/header-logo/logo.png
 * Returns: brand-123/header-logo/logo.png
 */
function extractPathFromUrl(url: string): string | null {
    try {
        const match = url.match(/\/dpp-assets\/(.+)$/);
        return match?.[1] ?? null;
    } catch {
        return null;
    }
}

/**
 * Image uploader input for content fields.
 * Handles upload, deletion of old images, and storage path management.
 */
export function ImageInput({ field, value, onChange, brandId }: ImageInputProps) {
    // Track the previous URL for deletion when image changes
    const previousUrlRef = useRef<string | null>(value || null);

    const handleImageChange = useCallback(
        async (url: string | null, _path: string[] | null) => {
            // Delete old image if we're replacing it
            if (previousUrlRef.current && previousUrlRef.current !== url) {
                try {
                    const supabase = createClient();
                    const oldPath = extractPathFromUrl(previousUrlRef.current);
                    if (oldPath) {
                        await supabase.storage.from("dpp-assets").remove([oldPath]);
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

    return (
        <FieldWrapper label={field.label}>
            <ImageUploader
                bucket="dpp-assets"
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
            />
        </FieldWrapper>
    );
}
