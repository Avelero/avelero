"use client";

import { usePassportFormContext } from "@/components/passports/form/context/passport-form-context";
import { cn } from "@v1/ui/cn";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Textarea } from "@v1/ui/textarea";
import { useCallback, useEffect, useRef, useState } from "react";

export function BasicInfoSection() {
  const { formState, updateField, setImage } = usePassportFormContext();
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Local state for debounced inputs
  const [localTitle, setLocalTitle] = useState(formState.title);
  const [localDescription, setLocalDescription] = useState(formState.description);
  const titleTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const descriptionTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Sync local state when form state changes externally
  useEffect(() => {
    setLocalTitle(formState.title);
  }, [formState.title]);

  useEffect(() => {
    setLocalDescription(formState.description);
  }, [formState.description]);

  // Debounced update handlers
  const handleTitleChange = useCallback((value: string) => {
    setLocalTitle(value);
    if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
    titleTimerRef.current = setTimeout(() => {
      updateField("title", value);
    }, 200);
  }, [updateField]);

  const handleDescriptionChange = useCallback((value: string) => {
    setLocalDescription(value);
    if (descriptionTimerRef.current) clearTimeout(descriptionTimerRef.current);
    descriptionTimerRef.current = setTimeout(() => {
      updateField("description", value);
    }, 200);
  }, [updateField]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
      if (descriptionTimerRef.current) clearTimeout(descriptionTimerRef.current);
    };
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file?.type.startsWith("image/")) {
        setImage(file);
      }
    },
    [setImage],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file?.type.startsWith("image/")) {
        setImage(file);
      }
      // Clear input value so same file can be selected again
      e.target.value = "";
    },
    [setImage],
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div className="border border-border bg-background p-4 flex flex-col gap-3">
      {/* Title Input */}
      <div className="space-y-1.5">
        <Label>
          Title <span className="text-destructive">*</span>
        </Label>
        <Input
          value={localTitle}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Enter product title"
          className="h-9"
        />
        {formState.errors.title && (
          <p className="type-small text-destructive">{formState.errors.title}</p>
        )}
      </div>

      {/* Description Input */}
      <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                value={localDescription}
                onChange={(e) => handleDescriptionChange(e.target.value)}
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
          {formState.imagePreviewUrl ? (
            <img
              src={formState.imagePreviewUrl}
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
