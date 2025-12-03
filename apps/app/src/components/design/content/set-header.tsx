"use client";

import { useCallback, useRef } from "react";
import { ImageUploader } from "@/components/image-upload";
import { Label } from "@v1/ui/label";
import { createClient } from "@v1/supabase/client";

interface SetHeaderProps {
  logoUrl: string;
  onLogoChange: (url: string | null) => void;
  brandId?: string;
}

export function SetHeader({ logoUrl, onLogoChange, brandId }: SetHeaderProps) {
  // Track the previous URL for deletion when image changes
  const previousUrlRef = useRef<string | null>(logoUrl || null);

  const handleImageChange = useCallback(
    async (url: string | null, path: string[] | null) => {
      // Delete old image if we're replacing it
      if (previousUrlRef.current && previousUrlRef.current !== url) {
        try {
          const supabase = createClient();
          // Extract path from the old URL
          const oldPath = extractPathFromUrl(previousUrlRef.current);
          if (oldPath) {
            await supabase.storage.from("dpp-assets").remove([oldPath]);
          }
        } catch (error) {
          console.error("Failed to delete old image:", error);
        }
      }

      previousUrlRef.current = url;
      onLogoChange(url);
    },
    [onLogoChange],
  );

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-4">
      <p className="type-p !font-medium text-primary">Header</p>

      {/* Logo */}
      <div className="flex flex-row justify-between items-center">
        <Label>Logo</Label>
        <ImageUploader
          bucket="dpp-assets"
          mode="public"
          width={250}
          height={50}
          initialUrl={logoUrl || undefined}
          buildPath={(file) => {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const timestamp = Date.now();
            return [brandId!, "header-logo", `logo-${timestamp}-${safeName}`];
          }}
          uploadOnSelect={true}
          onChange={handleImageChange}
        />
      </div>
    </div>
  );
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
