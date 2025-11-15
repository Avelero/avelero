"use client";

import { cn } from "@v1/ui/cn";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useCallback, useEffect, useRef, useState } from "react";

interface BasicInfoSectionProps {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
}

export function BasicInfoSection({
  title,
  setTitle,
  description,
  setDescription,
  imageFile,
  setImageFile,
}: BasicInfoSectionProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync imagePreview from imageFile prop
  useEffect(() => {
    if (imageFile) {
      const objectUrl = URL.createObjectURL(imageFile);
      setImagePreview(objectUrl);
      // Cleanup: revoke the URL when component unmounts or imageFile changes
      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }
    setImagePreview(null);
  }, [imageFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      setImageFile(file);
    }
  }, [setImageFile]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file?.type.startsWith("image/")) {
        setImageFile(file);
      }
      // Clear input value so same file can be selected again
      e.target.value = "";
    },
    [setImageFile],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-3">
      {/* Title Input */}
      <div className="space-y-1.5">
        <Label>Title <span className="text-destructive">*</span></Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter product title"
          className="h-9"
          required
        />
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
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative w-[200px] aspect-square border border-dashed transition-colors duration-200 cursor-pointer",
            isDragging
              ? "border-brand bg-accent"
              : "border-border hover:border-tertiary hover:bg-accent",
          )}
          role="button"
          tabIndex={0}
          aria-label="Upload image"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
        >
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Product preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-tertiary">
              <p className="type-small text-center px-4">
                Drop image here or click to upload.
              </p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </div>
    </div>
  );
}
