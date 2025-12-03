"use client";

import { useState } from "react";
import { ImageUploader } from "@/components/image-upload";
import { Label } from "@v1/ui/label";
import { Input } from "@v1/ui/input";
import { Switch } from "@v1/ui/switch";

export function SetBanner() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [headline, setHeadline] = useState<string>("");
  const [subheadline, setSubheadline] = useState<string>("");
  const [buttonLabel, setButtonLabel] = useState<string>("");
  const [buttonUrl, setButtonUrl] = useState<string>("");

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-3">
      <div className="flex flex-row justify-between items-center">
        <p className="type-p !font-medium text-primary">Banner</p>
        <Switch
          checked={true}
          onCheckedChange={() => {}}
          className="max-w-[250px]"
        />
      </div>

      {/* Headline */}
      <div className="space-y-1.5">
        <Label>Headline</Label>
        <Input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Headline"
          className="h-9"
        />
      </div>

      {/* Subheadline */}
      <div className="space-y-1.5">
        <Label>Subheadline</Label>
        <Input
          value={subheadline}
          onChange={(e) => setSubheadline(e.target.value)}
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
            onChange={(e) => setButtonLabel(e.target.value)}
            placeholder="Button label"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Button url</Label>
          <Input
            value={buttonUrl}
            onChange={(e) => setButtonUrl(e.target.value)}
            placeholder="Button url"
            className="h-9"
          />
        </div>
      </div>

      {/* Image Upload */}
      <div className="space-y-1.5">
        <Label>Background image</Label>
        <ImageUploader
          bucket="products"
          mode="public"
          width={250}
          height={100}
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
            setImagePreview(url);
          }}
        />
      </div>
    </div>
  );
}
