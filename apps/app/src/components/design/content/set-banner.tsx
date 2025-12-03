"use client";

import { useCallback, useRef } from "react";
import { ImageUploader } from "@/components/image-upload";
import { Label } from "@v1/ui/label";
import { Input } from "@v1/ui/input";
import { Switch } from "@v1/ui/switch";
import { createClient } from "@v1/supabase/client";

interface SetBannerProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  headline: string;
  subheadline: string;
  buttonLabel: string;
  buttonUrl: string;
  backgroundImageUrl: string;
  onHeadlineChange: (value: string) => void;
  onSubheadlineChange: (value: string) => void;
  onButtonLabelChange: (value: string) => void;
  onButtonUrlChange: (value: string) => void;
  onBackgroundImageChange: (url: string | null) => void;
  brandId?: string;
}

export function SetBanner({
  enabled,
  onEnabledChange,
  headline,
  subheadline,
  buttonLabel,
  buttonUrl,
  backgroundImageUrl,
  onHeadlineChange,
  onSubheadlineChange,
  onButtonLabelChange,
  onButtonUrlChange,
  onBackgroundImageChange,
  brandId,
}: SetBannerProps) {
  // Track the previous URL for deletion when image changes
  const previousUrlRef = useRef<string | null>(backgroundImageUrl || null);

  const handleImageChange = useCallback(
    async (url: string | null, path: string[] | null) => {
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
      onBackgroundImageChange(url);
    },
    [onBackgroundImageChange],
  );

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-3">
      <div className="flex flex-row justify-between items-center">
        <p className="type-p !font-medium text-primary">Banner</p>
        <Switch
          checked={enabled}
          onCheckedChange={onEnabledChange}
          className="max-w-[250px]"
        />
      </div>

      {/* Headline */}
      <div className="space-y-1.5">
        <Label>Headline</Label>
        <Input
          value={headline}
          onChange={(e) => onHeadlineChange(e.target.value)}
          placeholder="Headline"
          className="h-9"
        />
      </div>

      {/* Subheadline */}
      <div className="space-y-1.5">
        <Label>Subheadline</Label>
        <Input
          value={subheadline}
          onChange={(e) => onSubheadlineChange(e.target.value)}
          placeholder="Subheadline"
          className="h-9"
        />
      </div>

      {/* Button */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Button label</Label>
          <Input
            value={buttonLabel}
            onChange={(e) => onButtonLabelChange(e.target.value)}
            placeholder="Button label"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Button url</Label>
          <Input
            value={buttonUrl}
            onChange={(e) => onButtonUrlChange(e.target.value)}
            placeholder="Button url"
            className="h-9"
          />
        </div>
      </div>

      {/* Image Upload */}
      <div className="space-y-1.5">
        <Label>Background image</Label>
        <ImageUploader
          bucket="dpp-assets"
          mode="public"
          width={250}
          height={100}
          initialUrl={backgroundImageUrl || undefined}
          buildPath={(file) => {
            const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
            const timestamp = Date.now();
            return [brandId!, "banner", `bg-${timestamp}-${safeName}`];
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
 */
function extractPathFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/dpp-assets\/(.+)$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
