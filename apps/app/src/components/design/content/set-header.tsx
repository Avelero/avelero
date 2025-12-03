"use client";

import { useState } from "react";
import { ImageUploader } from "@/components/image-upload";
import { Label } from "@v1/ui/label";

export function SetHeader() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-4">
      <p className="type-p !font-medium text-primary">Header</p>

      {/* Logo */}
      <div className="flex flex-row justify-between items-center">
        <Label>Logo</Label>
        <ImageUploader
          bucket="products"
          mode="public"
          width={250}
          height={50}
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
