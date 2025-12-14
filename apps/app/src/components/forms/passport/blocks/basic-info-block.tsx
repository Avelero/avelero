"use client";

import { cn } from "@v1/ui/cn";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useEffect, useState, useRef } from "react";
import { ImageUploader } from "@/components/image-upload";
import { normalizeToDisplayUrl } from "@/utils/storage-urls";
import { BUCKETS } from "@/utils/storage-config";
import { generateProductHandle } from "@/utils/product-handle";

interface BasicInfoSectionProps {
  name: string;
  setName: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  existingImageUrl?: string | null;
  nameError?: string;
  nameInputRef?: React.RefObject<HTMLInputElement | null>;
  productHandle?: string;
  setProductHandle?: (value: string) => void;
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
  nameInputRef,
  productHandle,
  setProductHandle,
}: BasicInfoSectionProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(
    normalizeToDisplayUrl(BUCKETS.PRODUCTS, existingImageUrl),
  );
  // Track when we've just set imagePreview from user file selection
  const pendingUserSelection = useRef(false);
  
  // Track if user has ever defocused the name field (to stop syncing after first blur)
  const nameHasBeenBlurred = useRef(false);

  // Reset the blur tracking when form is reset (both name and handle are empty)
  useEffect(() => {
    if (!name && !productHandle) {
      nameHasBeenBlurred.current = false;
    }
  }, [name, productHandle]);

  // Keep preview in sync when editing existing products (but not when user just selected a file)
  useEffect(() => {
    if (pendingUserSelection.current) {
      pendingUserSelection.current = false;
      return;
    }
    setImagePreview(normalizeToDisplayUrl(BUCKETS.PRODUCTS, existingImageUrl));
  }, [existingImageUrl]);

  // Handle name change with real-time handle sync (until first blur)
  const handleNameChange = (value: string) => {
    setName(value);
    
    // Real-time sync: update handle from name if user hasn't blurred yet
    if (setProductHandle && productHandle !== undefined && !nameHasBeenBlurred.current && value.trim()) {
      const normalizedHandle = generateProductHandle(value);
      setProductHandle(normalizedHandle);
    }
  };

  // Stop syncing after user defocuses the name field
  const handleNameBlur = () => {
    nameHasBeenBlurred.current = true;
  };

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-3">
      {/* Name Input */}
      <div className="space-y-1.5">
        <Label>
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          ref={nameInputRef}
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          onBlur={handleNameBlur}
          placeholder="Enter product name"
          className={cn(
            "h-9",
            nameError &&
              "border-destructive focus-visible:border-destructive focus-visible:ring-2 focus-visible:ring-destructive",
          )}
          aria-invalid={Boolean(nameError)}
        />
        {nameError && (
          <p className="type-small text-destructive">{nameError}</p>
        )}
      </div>

      {/* Description Input */}
      <div className="space-y-1.5">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter product description"
          className="h-24"
        />
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
