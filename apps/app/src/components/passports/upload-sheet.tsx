"use client";

import { CSVRequirementsSection } from "@/components/import/csv-requirements-section";
import { FileDropzone } from "@/components/import/file-dropzone";
import { ValidationErrorList } from "@/components/import/validation-error-list";
import type { ValidationError } from "@/components/import/validation-error-list";
import { useImportProgress } from "@/contexts/import-progress-context";
import { useUserQuery } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { createClient } from "@v1/supabase/client";
import { uploadImportFile } from "@v1/supabase/utils/product-imports";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import {
  Sheet,
  SheetBreadcrumbHeader,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetTrigger,
} from "@v1/ui/sheet";
import { nanoid } from "nanoid";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export function PassportsUploadSheet() {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    [],
  );

  const trpc = useTRPC();
  const { data: user } = useUserQuery();
  const brandId = user?.brand_id;
  const { startImport } = useImportProgress();

  // Lazy-initialize supabase client only when needed (client-side only)
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const getSupabase = () => {
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    return supabaseRef.current;
  };

  // Reset state when sheet closes
  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset state when closing
      setSelectedFile(null);
      setUploadError(null);
      setValidationErrors([]);
    }
  }, []);

  // Validate import mutation
  const validateImportMutation = useMutation(
    trpc.bulk.import.validate.mutationOptions(),
  );

  // Start import mutation
  const startImportMutation = useMutation(
    trpc.bulk.import.start.mutationOptions(),
  );

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    setSelectedFile(file);
    setUploadError(null);
    setValidationErrors([]);
  }, []);

  // Handle file removal
  const handleFileRemove = useCallback(() => {
    setSelectedFile(null);
    setUploadError(null);
    setValidationErrors([]);
  }, []);

  // Handle upload and import workflow
  const handleUpload = useCallback(async () => {
    if (!selectedFile || !brandId) {
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      // Generate a temporary job ID for file storage
      const tempJobId = nanoid();

      // Step 1: Upload file to Supabase storage
      const uploadToastId = toast.loading("Uploading file...");

      const uploadResult = await uploadImportFile(getSupabase(), {
        file: selectedFile,
        brandId,
        jobId: tempJobId,
        filename: selectedFile.name,
      });

      toast.success("File uploaded successfully", { id: uploadToastId });

      // Step 2: Validate import file
      const validateToastId = toast.loading("Validating file...");

      const validationResult = await validateImportMutation.mutateAsync({
        fileId: uploadResult.path,
        filename: selectedFile.name,
      });

      toast.dismiss(validateToastId);

      // Step 3: Check validation result
      if (!validationResult.valid) {
        // Validation failed - show errors
        const errorCount = validationResult.errors.length;
        toast.error(
          `Validation failed: ${errorCount} error${errorCount !== 1 ? "s" : ""} found`,
        );

        // Store detailed validation errors for display
        setValidationErrors(validationResult.errors || []);
        setUploadError(
          `${errorCount} critical error${errorCount !== 1 ? "s" : ""} must be fixed before proceeding`,
        );
        return;
      }

      // Validation passed - show success message
      if (validationResult.warnings.length > 0) {
        toast.warning(
          `Validation passed with ${validationResult.warnings.length} warning${validationResult.warnings.length !== 1 ? "s" : ""}`,
        );
      } else {
        toast.success("Validation passed - starting import...");
      }

      // Step 4: Auto-start import (no user approval needed for valid files)
      const importResult = await startImportMutation.mutateAsync({
        fileId: uploadResult.path,
        filename: selectedFile.name,
      });

      // Step 5: Trigger import progress tracking
      startImport(importResult.jobId, selectedFile.name);

      toast.success("Import started successfully");

      // Step 6: Close sheet - floating widget will track progress
      setOpen(false);
    } catch (error) {
      console.error("Upload/import error:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      toast.error(`Upload failed: ${errorMessage}`);

      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  }, [
    selectedFile,
    brandId,
    validateImportMutation,
    startImportMutation,
    startImport,
  ]);

  const hasFile = !!selectedFile;
  const canProceed = hasFile && !isUploading && !uploadError;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="default"
          iconPosition="left"
          icon={<Icons.Upload />}
          className="min-w-[100px]"
        >
          Upload
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex flex-col p-0 gap-0 w-full sm:w-[480px] lg:w-[560px] m-6 h-[calc(100vh-48px)]"
        hideDefaultClose
      >
        <SheetBreadcrumbHeader
          pages={["Bulk Product Import"]}
          currentPageIndex={0}
        />

        {/* File upload content */}
        <div className="flex-1 px-6 py-6 overflow-y-auto">
          <div className="space-y-4">
            {/* File dropzone */}
            <FileDropzone
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              selectedFile={selectedFile}
              isUploading={isUploading}
              error={uploadError}
              disabled={isUploading}
            />

            {/* Validation errors - show detailed errors when validation fails */}
            {validationErrors.length > 0 && (
              <ValidationErrorList errors={validationErrors} />
            )}

            {/* CSV Requirements - show when no file is selected */}
            {!hasFile && !isUploading && <CSVRequirementsSection />}
          </div>
        </div>

        {/* Footer */}
        <SheetFooter>
          <SheetClose asChild>
            <Button
              variant="outline"
              size="default"
              disabled={isUploading}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
          </SheetClose>
          <Button
            variant="brand"
            size="default"
            disabled={!canProceed}
            onClick={handleUpload}
          >
            {isUploading ? "Uploading..." : "Upload & Start Import"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
