"use client";

import { CSVRequirementsSection } from "@/components/import/csv-requirements-section";
import { FileDropzone } from "@/components/import/file-dropzone";
import { ValidationErrorList } from "@/components/import/validation-error-list";
import type { ValidationError } from "@/components/import/validation-error-list";
import { useImportProgress } from "@/contexts/import-progress-context";
import { useUserQuery } from "@/hooks/use-user";
import { validateImportFile } from "@/lib/csv-validation";
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

  // Start import mutation (validation now happens in background job)
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
      console.error("Upload blocked: missing file or brandId", {
        selectedFile: !!selectedFile,
        brandId,
      });
      toast.error("Cannot upload: missing file or brand information");
      return;
    }

    try {
      console.log("[CSV Upload] Starting upload process", {
        filename: selectedFile.name,
        brandId,
        size: selectedFile.size,
      });
      setIsUploading(true);
      setUploadError(null);
      setValidationErrors([]);

      // Step 1: Client-side validation (instant, no upload)
      const validationToastId = toast.loading("Validating file structure...");

      console.log("[CSV Upload] Starting client-side validation...");
      const clientValidation = await validateImportFile(selectedFile);
      console.log("[CSV Upload] Validation result:", clientValidation);

      toast.dismiss(validationToastId);

      if (!clientValidation.valid) {
        // Validation failed - show errors immediately
        const errorCount = clientValidation.errors.length;
        console.error(
          "[CSV Upload] Validation failed:",
          clientValidation.errors,
        );
        toast.error(
          `Validation failed: ${errorCount} error${errorCount !== 1 ? "s" : ""} found`,
        );

        // Convert client validation errors to component format
        const componentErrors: ValidationError[] = clientValidation.errors.map(
          (err) => ({
            type: err.type,
            message: err.message,
          }),
        );

        setValidationErrors(componentErrors);
        setUploadError(
          `${errorCount} critical error${errorCount !== 1 ? "s" : ""} must be fixed before proceeding`,
        );
        return;
      }

      console.log("[CSV Upload] Client validation passed");
      toast.success("File structure validated - uploading...");

      // Generate a temporary job ID for file storage
      const tempJobId = nanoid();

      // Step 2: Upload file to Supabase storage
      const uploadToastId = toast.loading("Uploading file...");

      console.log("[CSV Upload] Uploading to Supabase", {
        brandId,
        jobId: tempJobId,
        filename: selectedFile.name,
      });

      const supabaseClient = getSupabase();
      const session = await supabaseClient.auth.getSession();
      console.log("[CSV Upload] Auth status", {
        hasSession: !!session.data.session,
        userId: session.data.session?.user?.id,
        userEmail: session.data.session?.user?.email,
      });

      const uploadResult = await uploadImportFile(supabaseClient, {
        file: selectedFile,
        brandId,
        jobId: tempJobId,
        filename: selectedFile.name,
      });

      console.log("[CSV Upload] Upload successful", uploadResult);
      toast.success("File uploaded successfully", { id: uploadToastId });

      // Step 3: Start import job (full validation happens in background)
      const importToastId = toast.loading("Starting import validation...");

      const importResult = await startImportMutation.mutateAsync({
        fileId: uploadResult.path,
        filename: selectedFile.name,
      });

      toast.success("Import validation started", { id: importToastId });

      // Step 4: Trigger import progress tracking
      startImport(importResult.jobId, selectedFile.name);

      toast.success(
        "Import job started! Full validation is running in the background.",
      );

      // Step 5: Close sheet - floating widget will track progress
      setOpen(false);
    } catch (error) {
      console.error("[CSV Upload] Upload/import error:", error);
      console.error("[CSV Upload] Error details:", {
        error,
        brandId,
        filename: selectedFile?.name,
        errorType: error?.constructor?.name,
      });

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      toast.error(`Upload failed: ${errorMessage}`);

      setUploadError(errorMessage);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, brandId, startImportMutation, startImport]);

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
