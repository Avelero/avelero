"use client";

import { validateImportFile } from "@v1/supabase/utils/product-imports";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { FileSpreadsheet, X } from "lucide-react";
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useRef,
  useState,
} from "react";

// Custom Upload Icon Component
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="4.89" x2="12" y2="14" />
    </svg>
  );
}

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  disabled?: boolean;
  className?: string;
  selectedFile?: File | null;
  isUploading?: boolean;
  error?: string | null;
}

export function FileDropzone({
  onFileSelect,
  onFileRemove,
  disabled = false,
  className,
  selectedFile,
  isUploading = false,
  error,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isUploading) {
        setIsDragging(true);
      }
    },
    [disabled, isUploading],
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we're leaving the dropzone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validateAndSelectFile = useCallback(
    (file: File) => {
      setValidationError(null);

      // Validate file using the utility function
      const validation = validateImportFile(file);

      if (!validation.valid) {
        setValidationError(validation.error || "Invalid file");
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (disabled || isUploading) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0 && files[0]) {
        validateAndSelectFile(files[0]);
      }
    },
    [disabled, isUploading, validateAndSelectFile],
  );

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0 && files[0]) {
        validateAndSelectFile(files[0]);
      }
      // Reset input value so user can select the same file again if needed
      e.target.value = "";
    },
    [validateAndSelectFile],
  );

  const handleClick = useCallback(() => {
    if (!disabled && !isUploading) {
      inputRef.current?.click();
    }
  }, [disabled, isUploading]);

  const handleRemove = useCallback(() => {
    setValidationError(null);
    onFileRemove?.();
  }, [onFileRemove]);

  const displayError = error || validationError;
  const hasFile = !!selectedFile;

  return (
    <div className={cn("w-full", className)}>
      {/* Dropzone area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-all duration-200 cursor-pointer",
          "hover:border-brand/40 hover:bg-brand/10 hover:shadow-sm",
          isDragging &&
            "border-solid border-brand bg-brand/20 scale-[1.01] shadow-lg",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          isUploading && "cursor-wait",
          displayError && "border-solid border-destructive bg-destructive/5",
          hasFile && !displayError && "border-brand/40 bg-brand/10",
          !isDragging &&
            !disabled &&
            !isUploading &&
            !displayError &&
            !hasFile &&
            "border-border",
        )}
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        aria-label="Upload CSV or Excel file"
        aria-disabled={disabled || isUploading}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={handleFileInput}
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <>
            <div className="mb-4">
              <Icons.Loader className="h-12 w-12 text-brand animate-spin" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Uploading file...
            </p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              Please wait while we upload your file
            </p>
          </>
        ) : hasFile ? (
          <>
            <FileSpreadsheet className="h-12 w-12 text-brand mb-4" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {selectedFile.name}
            </p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            {onFileRemove && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
                className="mt-3"
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            )}
          </>
        ) : (
          <>
            {/* Upload icon - centralized and scaled */}
            <div className="flex justify-center mb-6">
              <UploadIcon
                className={cn(
                  "transition-all duration-200",
                  isDragging ? "text-brand scale-110" : "text-brand/40",
                )}
              />
            </div>

            {/* Text content */}
            <div className="text-center space-y-1">
              <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                {isDragging ? "Drop your file here" : "Upload file"}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                or drag & drop here
              </p>
            </div>

            {/* File info */}
            <div className="mt-4 text-xs text-gray-500 dark:text-gray-500">
              CSV, XLSX, XLS • Max 50MB
            </div>
          </>
        )}
      </div>

      {/* Error message - Basic display for client-side validation errors */}
      {displayError && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 p-3 border border-destructive/20">
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">
              {displayError}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
