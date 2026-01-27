"use client";

import { ImageUploader } from "@/components/image-upload";
import { generateProductHandle } from "@/utils/product-handle";
import { BUCKETS } from "@/utils/storage-config";
import { normalizeToDisplayUrl } from "@/utils/storage-urls";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useEffect, useRef, useState } from "react";

interface BasicInfoSectionProps {
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  existingImageUrl?: string | null;
  nameError?: string;
  descriptionError?: string;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  descriptionRef?: React.RefObject<HTMLTextAreaElement | null>;
  productHandle?: string;
  setProductHandle?: (value: string) => void;
  /** Whether the name field is required. Defaults to true for product forms. */
  required?: boolean;
}

export function BasicInfoSection({
  name,
  setName,
  description,
  setDescription,
  imageFile,
  setImageFile,
  existingImageUrl = null,
  nameError,
  descriptionError,
  nameInputRef,
  descriptionRef,
  productHandle,
  setProductHandle,
  required = true,
}: BasicInfoSectionProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(
    normalizeToDisplayUrl(BUCKETS.PRODUCTS, existingImageUrl),
  );
  // Track when we've just set imagePreview from user file selection
  const pendingUserSelection = useRef(false);

  // Track if syncing is enabled - only true when both fields were empty at focus time
  const syncEnabledRef = useRef(false);

  // Keep preview in sync when editing existing products (but not when user just selected a file)
  useEffect(() => {
    if (pendingUserSelection.current) {
      pendingUserSelection.current = false;
      return;
    }
    setImagePreview(normalizeToDisplayUrl(BUCKETS.PRODUCTS, existingImageUrl));
  }, [existingImageUrl]);

  // Enable sync only when both fields are empty at focus time
  const handleNameFocus = () => {
    if (!name && !productHandle) {
      syncEnabledRef.current = true;
    }
  };

  // Handle name change with real-time handle sync (only if sync is enabled)
  const handleNameChange = (value: string) => {
    setName(value);

    // Real-time sync: update handle from name if sync is enabled
    if (
      setProductHandle &&
      productHandle !== undefined &&
      syncEnabledRef.current &&
      value.trim()
    ) {
      const normalizedHandle = generateProductHandle(value);
      setProductHandle(normalizedHandle);
    }
  };

  // Stop syncing after user defocuses the name field
  const handleNameBlur = () => {
    syncEnabledRef.current = false;
  };

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-3">
      {/* Name Input */}
      <div className="space-y-1.5">
        <Label>
          Name {required && <span className="text-destructive">*</span>}
        </Label>
        <Input
          ref={nameInputRef}
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          onFocus={handleNameFocus}
          onBlur={handleNameBlur}
          placeholder="Enter product name"
          error={Boolean(nameError)}
          aria-invalid={Boolean(nameError)}
          aria-required={required}
        />
        {nameError && (
          <p className="type-small text-destructive">{nameError}</p>
        )}
      </div>

      {/* Description Input */}
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          ref={descriptionRef}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter product description"
          className="h-24"
          error={Boolean(descriptionError)}
          aria-invalid={Boolean(descriptionError)}
        />
        {descriptionError && (
          <p className="type-small text-destructive">{descriptionError}</p>
        )}
      </div>

      {/* Image Upload */}
      <div className="space-y-1.5">
        <Label>Image</Label>
        <ImageUploader
          bucket="products"
          mode="public"
          width={200}
          height={200}
          initialUrl={imagePreview ?? undefined}
          buildPath={(file) => {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            return ["products", safeName];
          }}
          uploadOnSelect={false}
          onFileSelected={(file) => {
            setImageFile(file);
            if (!file) {
              setImagePreview(null);
            }
          }}
          onChange={(url) => {
            // Mark that we're setting preview from user selection
            if (url) {
              pendingUserSelection.current = true;
            }
            setImagePreview(url);
          }}
        />
      </div>
    </div>
  );
}
