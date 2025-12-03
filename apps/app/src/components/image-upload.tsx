"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { useImageUpload } from "@/hooks/use-image-upload";
import {
  validateImageFile,
  type ImageValidationResult,
} from "@/utils/image-upload";
import { toast } from "@v1/ui/sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";

type UploaderMode = "public" | "private";

export interface ImageUploaderProps {
  bucket: string;
  buildPath: (file: File) => string[];
  onChange: (url: string | null, path: string[] | null) => void;
  initialUrl?: string | null;
  onFileSelected?: (file: File | null) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
  mode?: UploaderMode;
  width?: number | string;
  height?: number | string;
  validate?: (file: File) => ImageValidationResult;
  uploadOnSelect?: boolean;
}

export function ImageUploader({
  bucket,
  buildPath,
  onChange,
  initialUrl = null,
  label,
  helperText,
  disabled = false,
  className,
  mode = "public",
  width = 200,
  height = 200,
  validate,
  uploadOnSelect = true,
  onFileSelected,
}: ImageUploaderProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialUrl?.trim() || null,
  );
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadImage, isLoading } = useImageUpload();
  const lastObjectUrl = useRef<string | null>(null);

  useEffect(() => {
    setPreviewUrl(initialUrl?.trim() || null);
  }, [initialUrl]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const effectiveWidth = useMemo(
    () => (typeof width === "number" ? `${width}px` : width),
    [width],
  );
  const effectiveHeight = useMemo(
    () => (typeof height === "number" ? `${height}px` : height),
    [height],
  );

  const handleFile = useCallback(
    async (file: File) => {
      const validation = validate
        ? validate(file)
        : validateImageFile(file, { maxBytes: 10 * 1024 * 1024 });
      if (!validation.valid) {
        setError(validation.error);
        return;
      }
      setError(null);

      if (!uploadOnSelect) {
        if (lastObjectUrl.current) {
          URL.revokeObjectURL(lastObjectUrl.current);
        }
        const objectUrl = URL.createObjectURL(file);
        lastObjectUrl.current = objectUrl;
        setPreviewUrl(objectUrl);
        onFileSelected?.(file);
        onChange(objectUrl, null);
        return;
      }

      const path = buildPath(file);
      try {
        const { displayUrl, path: storagePath } = await uploadImage({
          file,
          bucket,
          path,
          isPublic: mode === "public",
          validate,
        });
        setPreviewUrl(displayUrl);
        onFileSelected?.(null);
        onChange(displayUrl, storagePath);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Upload failed. Please try again.",
        );
      }
    },
    [
      bucket,
      buildPath,
      mode,
      onChange,
      onFileSelected,
      uploadImage,
      uploadOnSelect,
      validate,
    ],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      e.target.value = "";
    },
    [handleFile],
  );

  useEffect(() => {
    return () => {
      if (lastObjectUrl.current) {
        URL.revokeObjectURL(lastObjectUrl.current);
        lastObjectUrl.current = null;
      }
    };
  }, []);

  const clearImage = useCallback(() => {
    setPreviewUrl(null);
    if (lastObjectUrl.current) {
      URL.revokeObjectURL(lastObjectUrl.current);
      lastObjectUrl.current = null;
    }
    onFileSelected?.(null);
    onChange(null, null);
  }, [onChange, onFileSelected]);

  const disabledUpload = disabled || isLoading;

  const handleContainerClick = () => {
    if (disabledUpload) return;
    if (previewUrl) {
      setPopoverOpen(true);
    } else {
      inputRef.current?.click();
    }
  };

  const handleChangeImage = () => {
    setPopoverOpen(false);
    inputRef.current?.click();
  };

  const handleDeleteImage = () => {
    setPopoverOpen(false);
    clearImage();
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <span className="type-small text-secondary">{label}</span>}
      <Popover
        open={popoverOpen}
        onOpenChange={(open) => {
          // Only allow opening if there's an image
          if (open && !previewUrl) return;
          setPopoverOpen(open);
        }}
      >
        <PopoverTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            style={{ width: effectiveWidth, height: effectiveHeight }}
            className={cn(
              "relative border transition-colors duration-200 cursor-pointer overflow-hidden group",
              previewUrl
                ? "border-border"
                : isDragging
                  ? "border-dashed border-brand bg-accent"
                  : "border-dashed border-border hover:border-tertiary hover:bg-accent",
              disabledUpload && "opacity-60 cursor-not-allowed bg-background",
            )}
            onClick={handleContainerClick}
            onKeyDown={(e) => {
              if (disabledUpload) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleContainerClick();
              }
            }}
            onDragOver={(e) => {
              if (disabledUpload) return;
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              if (disabledUpload) return;
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={disabledUpload ? undefined : handleDrop}
            aria-label={label}
          >
            {previewUrl ? (
              <div className="relative w-full h-full">
                {/* Image with inner shadow */}
                <div className="absolute inset-x-0 top-1 bottom-1 flex items-center justify-center">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-full w-auto max-w-none object-contain"
                  />
                </div>
                {/* Inner shadow overlay */}
                <div className="absolute inset-0 shadow-[inset_0_-24px_24px_rgba(0,0,0,0.12)] pointer-events-none" />
                {/* Hover overlay with "Change" text */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-150 flex items-center justify-center">
                  <span className="text-primary-foreground font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    Change
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-tertiary px-4">
                <p className="type-small text-center">
                  {disabledUpload
                    ? "Upload disabled"
                    : "Drop image here or click to upload."}
                </p>
              </div>
            )}

            {isLoading && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-[1px] flex items-center justify-center">
                <div className="flex items-center gap-2 type-small text-primary">
                  <Icons.Loader className="h-4 w-4 animate-spin" />
                  Uploading...
                </div>
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
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[140px]">
          <button
            type="button"
            onClick={handleChangeImage}
            className="w-full flex items-center gap-2 px-3 py-2 type-p text-primary hover:bg-accent transition-colors"
          >
            <Icons.Upload className="h-4 w-4" />
            Change
          </button>
          <button
            type="button"
            onClick={handleDeleteImage}
            className="w-full flex items-center gap-2 px-3 py-2 type-p text-destructive hover:bg-accent transition-colors"
          >
            <Icons.Trash2 className="h-4 w-4" />
            Delete
          </button>
        </PopoverContent>
      </Popover>

      {helperText && (
        <span className="type-small text-tertiary">{helperText}</span>
      )}
    </div>
  );
}
