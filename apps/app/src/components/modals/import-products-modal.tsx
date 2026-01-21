"use client";

import { useNotificationsSuspense } from "@/hooks/use-notifications";
import { useUserQuerySuspense } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@v1/supabase/client";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@v1/ui/dialog";
import { Icons } from "@v1/ui/icons";
import { toast } from "@v1/ui/sonner";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ============================================================================
// Types & Constants
// ============================================================================

type ImportStep = "method" | "upload" | "options" | "confirmation";
type ImportMethod = "upload" | "integration" | null;
type ImportMode = "CREATE" | "CREATE_AND_ENRICH";

const TEMPLATE_URL = "/templates/avelero-bulk-import-template.xlsx";

// ============================================================================
// Component
// ============================================================================

function ImportProductsModalContent({
  onSuccess,
}: {
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: user } = useUserQuerySuspense();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ImportStep>("method");
  const [method, setMethod] = useState<ImportMethod>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("CREATE");
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);

  // Use the suspense notifications hook
  const { notifications, markAsSeen } = useNotificationsSuspense();

  // Find import failure notification (if any)
  const importFailureNotification = useMemo(() => {
    return notifications.find((n) => n.type === "import_failure" && !n.seenAt);
  }, [notifications]);

  // Query for recent imports to get the failed import details (for error report download)
  const recentImportsQuery = useQuery({
    ...trpc.bulk.import.getRecentImports.queryOptions({ limit: 1 }),
    // Only fetch when we have an import failure notification
    enabled: !!importFailureNotification,
  });

  // Get the recent failed import for the error report download
  const recentFailedImport = useMemo(() => {
    const job = recentImportsQuery.data?.jobs[0];
    if (!job?.hasExportableFailures) return null;
    if ((job.summary as Record<string, unknown>)?.dismissed) return null;
    return job;
  }, [recentImportsQuery.data]);

  // Show notification dot based on unread import failure notifications
  const showNotificationDot = !!importFailureNotification;

  // Track which notifications we've already initiated markAsSeen for
  // This prevents the loop caused by query invalidation + broadcast causing re-renders
  const markedAsSeenRef = useRef<Set<string>>(new Set());

  // Mark notification as seen when modal opens (only once per notification ID)
  useEffect(() => {
    if (
      open &&
      importFailureNotification &&
      !markedAsSeenRef.current.has(importFailureNotification.id)
    ) {
      markedAsSeenRef.current.add(importFailureNotification.id);
      markAsSeen.mutate({ id: importFailureNotification.id });
    }
  }, [open, importFailureNotification, markAsSeen]);

  // Helper function to download file using fetch + blob (same as template download)
  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Failed to download error report");
    }
  };

  // Mutation for exporting corrections
  const exportCorrectionsMutation = useMutation(
    trpc.bulk.import.exportCorrections.mutationOptions({
      onSuccess: async (data) => {
        if (data.status === "ready" && data.downloadUrl) {
          // Download using fetch + blob
          const filename = `${recentFailedImport?.filename ?? "import"}-corrections.xlsx`;
          await downloadFile(data.downloadUrl, filename);
          setIsDownloadingReport(false);
        } else if (data.status === "generating") {
          toast.success(
            "Error report is being generated. Check your email shortly.",
          );
          setIsDownloadingReport(false);
        }
      },
      onError: (error) => {
        toast.error(error.message || "Failed to download error report");
        setIsDownloadingReport(false);
      },
    }),
  );

  // Handler for downloading error report
  // Ref to track resetState timeout for cleanup
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const handleDownloadErrorReport = async () => {
    if (!recentFailedImport) return;

    // If URL exists and not expired, download directly using fetch + blob
    if (
      recentFailedImport.correctionDownloadUrl &&
      recentFailedImport.correctionExpiresAt
    ) {
      const expiresAt = new Date(recentFailedImport.correctionExpiresAt);
      if (expiresAt > new Date()) {
        setIsDownloadingReport(true);
        const filename = `${recentFailedImport.filename ?? "import"}-corrections.xlsx`;
        await downloadFile(recentFailedImport.correctionDownloadUrl, filename);
        setIsDownloadingReport(false);
        return;
      }
    }

    // Otherwise trigger generation
    setIsDownloadingReport(true);
    exportCorrectionsMutation.mutate({ jobId: recentFailedImport.id });
  };

  const resetState = useCallback(() => {
    // Clear any pending reset timeout
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
    }
    resetTimeoutRef.current = setTimeout(() => {
      setStep("method");
      setMethod(null);
      setFile(null);
      setUploadedFileId(null);
      setMode("CREATE");
      setIsUploading(false);
      setIsDragging(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      resetTimeoutRef.current = null;
    }, 350);
  }, []);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) resetState();
    setOpen(newOpen);
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch(TEMPLATE_URL);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "avelero-bulk-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download template");
    }
  };

  const startImportMutation = useMutation(
    trpc.bulk.import.start.mutationOptions({
      onSuccess: () => {
        toast.success("Import started successfully");
        void queryClient.invalidateQueries({
          queryKey: [["bulk", "import", "getRecentImports"]],
        });
        onSuccess?.();
        handleOpenChange(false);
      },
      onError: (error) =>
        toast.error(error.message || "Failed to start import"),
    }),
  );

  // Fetch preview data when on confirmation step
  const previewQuery = useQuery({
    ...trpc.bulk.import.preview.queryOptions({
      fileId: uploadedFileId ?? "",
      filename: file?.name ?? "",
    }),
    enabled: step === "confirmation" && !!uploadedFileId && !!file,
  });

  const validateAndUploadFile = async (selectedFile: File) => {
    const allowedExtensions = [".xlsx", ".xls"];
    if (
      !allowedExtensions.some((ext) =>
        selectedFile.name.toLowerCase().endsWith(ext),
      )
    ) {
      toast.error("Invalid file type - please upload .xlsx or .xls");
      return;
    }
    if (selectedFile.size > 50 * 1024 * 1024) {
      toast.error("File too large - please upload a file smaller than 50MB");
      return;
    }

    setIsUploading(true);
    try {
      if (!user?.brand_id) {
        throw new Error("No active brand selected");
      }
      const path = `${user.brand_id}/${Date.now()}-${selectedFile.name}`;
      const { data, error } = await supabase.storage
        .from("product-imports")
        .upload(path, selectedFile, {
          contentType: selectedFile.type,
          upsert: false,
        });
      if (error) throw new Error(`Upload failed: ${error.message}`);
      setFile(selectedFile);
      setUploadedFileId(data.path);
      setStep("options");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to upload file",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleNext = () => {
    if (step === "method") {
      if (method === "integration") {
        router.push("/settings/integrations");
        handleOpenChange(false);
      } else if (method === "upload") {
        setStep("upload");
      }
    } else if (step === "options") {
      setStep("confirmation");
    }
  };

  const handleBack = () => {
    if (step === "upload") {
      setStep("method");
      setMethod(null);
      setFile(null);
      setUploadedFileId(null);
    } else if (step === "options") {
      setStep("upload");
      setFile(null);
      setUploadedFileId(null);
    } else if (step === "confirmation") {
      setStep("options");
    }
  };

  const handleStartImport = () => {
    if (!uploadedFileId || !file) return;
    startImportMutation.mutate({
      fileId: uploadedFileId,
      filename: file.name,
      mode,
    });
  };

  const isImporting = startImportMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="default" className="relative">
          <Icons.Upload className="h-[14px] w-[14px]" />
          <span className="px-1">Import</span>
          {showNotificationDot && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-destructive rounded-full" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent size="xl" className="p-0 gap-0">
        {/* Step 1: Method Selection */}
        {step === "method" && (
          <>
            <DialogHeader className="px-6 py-4 border-b border-border">
              <DialogTitle>Import products</DialogTitle>
            </DialogHeader>

            <div className="px-6 py-4 space-y-4">
              <p className="type-p text-foreground">
                How do you want to import your products?
              </p>

              <div
                onClick={() => setMethod("upload")}
                className="w-full flex items-start gap-3 text-left cursor-pointer"
              >
                <div
                  className={cn(
                    "w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0",
                    method === "upload"
                      ? "border-foreground"
                      : "border-tertiary",
                  )}
                >
                  {method === "upload" && (
                    <div className="w-2 h-2 rounded-full bg-foreground" />
                  )}
                </div>
                <div>
                  <p className="type-p text-foreground">
                    Upload an Avelero-formatted Excel file
                  </p>
                  <p className="type-small text-secondary">
                    Import a file that's already formatted to fit Avelero's
                    template.{" "}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadTemplate();
                      }}
                      className="text-brand hover:underline"
                    >
                      Download sample Excel
                    </button>
                  </p>
                </div>
              </div>

              <div
                onClick={() => setMethod("integration")}
                className="w-full flex items-start gap-3 text-left cursor-pointer"
              >
                <div
                  className={cn(
                    "w-4 h-4 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0",
                    method === "integration"
                      ? "border-foreground"
                      : "border-tertiary",
                  )}
                >
                  {method === "integration" && (
                    <div className="w-2 h-2 rounded-full bg-foreground" />
                  )}
                </div>
                <div>
                  <p className="type-p text-foreground">
                    Import data from another platform
                  </p>
                  <p className="type-small text-secondary">
                    Import a copy of your data from another platform using one
                    of our integrations.
                  </p>
                </div>
              </div>

              {/* Recent Import Failures Banner */}
              {recentFailedImport && (
                <div className="mt-6 pt-6 border-t border-border">
                  <div className="flex items-start gap-3 p-4 bg-destructive/5 border border-destructive/20">
                    <Icons.AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="type-p text-foreground font-medium">
                        {(() => {
                          const summary = recentFailedImport.summary as Record<
                            string,
                            unknown
                          > | null;
                          const blocked =
                            (summary?.blockedProducts as number) ?? 0;
                          const warnings =
                            (summary?.warningProducts as number) ?? 0;
                          const totalIssues = blocked + warnings;
                          return `${totalIssues} product${totalIssues !== 1 ? "s" : ""} had issues during your most recent import`;
                        })()}
                      </p>
                      <p className="type-small text-secondary mt-1">
                        Download the error report to see which products need
                        corrections.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={handleDownloadErrorReport}
                        disabled={isDownloadingReport}
                      >
                        {isDownloadingReport ? (
                          <>
                            <Icons.Loader className="w-4 h-4 animate-spin mr-2" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Icons.Download className="w-4 h-4 mr-2" />
                            Download Error Report
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleNext} disabled={!method}>
                Next
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Step 2: File Upload */}
        {step === "upload" && (
          <>
            <DialogHeader className="px-6 py-4 border-b border-border">
              <DialogTitle>Import products by Excel</DialogTitle>
            </DialogHeader>

            <div className="px-6 py-4">
              <p className="type-small text-secondary mb-4">
                Upload your Avelero-formatted Excel file.
              </p>
              <div
                onClick={() => !isUploading && fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const f = e.dataTransfer.files[0];
                  if (f) void validateAndUploadFile(f);
                }}
                className={cn(
                  "border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
                  isDragging
                    ? "border-brand bg-accent"
                    : "border-border hover:border-tertiary hover:bg-accent",
                  isUploading && "opacity-50 cursor-not-allowed",
                )}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Icons.Loader className="w-8 h-8 animate-spin text-tertiary" />
                    <p className="type-small text-tertiary">Uploading...</p>
                  </div>
                ) : (
                  <>
                    <Icons.Upload className="w-8 h-8 mx-auto mb-2 text-tertiary" />
                    <p className="type-p text-foreground font-medium">
                      Drop your Excel file here, or click to browse.
                    </p>
                    <p className="type-small text-tertiary mt-1">
                      Accepts .xlsx and .xls files (50MB limit)
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void validateAndUploadFile(f);
                }}
                className="hidden"
                disabled={isUploading}
              />
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border flex">
              <div className="flex flex-row justify-between w-full">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1 type-small text-brand hover:underline"
                >
                  <Icons.Download className="w-4 h-4" />
                  Download template
                </button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                  <Button disabled>Next</Button>
                </div>
              </div>
            </DialogFooter>
          </>
        )}

        {/* Step 3: Import Options */}
        {step === "options" && file && (
          <>
            <DialogHeader className="px-6 py-4 border-b border-border">
              <DialogTitle>Import products by Excel</DialogTitle>
            </DialogHeader>

            <div className="px-6 py-4 space-y-6">
              <div className="flex items-center gap-3 p-3 bg-muted/50 border border-border">
                <Icons.Check className="w-4 h-4 text-brand shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">
                  {file.name}
                </span>
                <Button variant="outline" size="sm" onClick={handleBack}>
                  Replace file
                </Button>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <div
                  className="relative inline-flex h-4 w-4 items-center justify-center mt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={mode === "CREATE_AND_ENRICH"}
                    onChange={(e) =>
                      setMode(e.target.checked ? "CREATE_AND_ENRICH" : "CREATE")
                    }
                    className="block h-4 w-4 shrink-0 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand cursor-pointer outline-none focus:outline-none"
                  />
                  {mode === "CREATE_AND_ENRICH" && (
                    <div className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center pointer-events-none">
                      <div className="w-[10px] h-[10px] bg-brand" />
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <p className="type-small text-foreground">
                    Overwrite products with matching handles
                  </p>
                  <p className="type-xsmall text-secondary">
                    To enrich existing products, export your products first to
                    get the required variant UPIDs.
                  </p>
                </div>
              </label>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border flex">
              <div className="flex flex-row justify-between w-full">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-1 type-small text-brand hover:underline"
                >
                  <Icons.Download className="w-4 h-4" />
                  Download template
                </button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleBack}>
                    Back
                  </Button>
                  <Button onClick={handleNext}>Next</Button>
                </div>
              </div>
            </DialogFooter>
          </>
        )}

        {/* Step 4: Confirmation - Preview First Product */}
        {step === "confirmation" && file && (
          <>
            <DialogHeader className="px-6 py-4 border-b border-border">
              <DialogTitle>Preview your first product</DialogTitle>
            </DialogHeader>

            <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Loading state */}
              {previewQuery.isLoading && (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <Icons.Loader className="w-6 h-6 animate-spin text-tertiary" />
                  <p className="type-small text-tertiary">
                    Parsing your file...
                  </p>
                </div>
              )}

              {/* Error state */}
              {previewQuery.isError && (
                <div className="p-4 bg-destructive/10 border border-destructive/20">
                  <p className="type-small text-destructive">
                    {previewQuery.error?.message ||
                      "Failed to parse file. Please check your Excel format."}
                  </p>
                </div>
              )}

              {/* Preview data */}
              {previewQuery.data && (
                <>
                  {/* Summary text */}
                  <p className="type-p text-foreground">
                    You will be importing approximately{" "}
                    <span className="font-medium">
                      {previewQuery.data.summary.totalProducts} products
                    </span>{" "}
                    with a total of{" "}
                    <span className="font-medium">
                      {previewQuery.data.summary.totalVariants} variants
                    </span>
                    {previewQuery.data.summary.totalImages > 0 && (
                      <>
                        {" "}
                        and{" "}
                        <span className="font-medium">
                          {previewQuery.data.summary.totalImages} images
                        </span>
                      </>
                    )}
                    . Importing will{" "}
                    {mode === "CREATE_AND_ENRICH" ? (
                      <span className="font-medium">
                        overwrite any existing products
                      </span>
                    ) : (
                      <span className="font-medium">
                        not overwrite any existing products
                      </span>
                    )}{" "}
                    that have the same product handle.
                  </p>

                  {/* Product Details Table */}
                  <div className="border border-border divide-y divide-border">
                    <div className="p-3 flex">
                      <span className="type-small text-secondary w-[140px] shrink-0 font-medium">
                        Title
                      </span>
                      <span className="type-small text-foreground">
                        {previewQuery.data.firstProduct.title || "—"}
                      </span>
                    </div>
                    <div className="p-3 flex">
                      <span className="type-small text-secondary w-[140px] shrink-0 font-medium">
                        Handle
                      </span>
                      <span className="type-small text-foreground">
                        {previewQuery.data.firstProduct.handle || "—"}
                      </span>
                    </div>
                    <div className="p-3 flex">
                      <span className="type-small text-secondary w-[140px] shrink-0 font-medium">
                        Manufacturer
                      </span>
                      <span className="type-small text-foreground">
                        {previewQuery.data.firstProduct.manufacturer || "—"}
                      </span>
                    </div>
                    <div className="p-3 flex">
                      <span className="type-small text-secondary w-[140px] shrink-0 font-medium">
                        Description
                      </span>
                      <span className="type-small text-foreground line-clamp-2">
                        {previewQuery.data.firstProduct.description || "—"}
                      </span>
                    </div>
                    <div className="p-3 flex">
                      <span className="type-small text-secondary w-[140px] shrink-0 font-medium">
                        Status
                      </span>
                      <span className="type-small text-foreground">
                        {previewQuery.data.firstProduct.status || "Draft"}
                      </span>
                    </div>
                    <div className="p-3 flex">
                      <span className="type-small text-secondary w-[140px] shrink-0 font-medium">
                        Category
                      </span>
                      <span className="type-small text-foreground">
                        {previewQuery.data.firstProduct.category || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Variants Table */}
                  {previewQuery.data.variants.length > 0 && (
                    <div className="border border-border">
                      {/* Header */}
                      <div className="grid grid-cols-3 bg-muted/50 border-b border-border">
                        <div className="px-3 py-2">
                          <span className="type-xsmall text-secondary font-medium">
                            Variant
                          </span>
                        </div>
                        <div className="px-3 py-2">
                          <span className="type-xsmall text-secondary font-medium">
                            SKU
                          </span>
                        </div>
                        <div className="px-3 py-2">
                          <span className="type-xsmall text-secondary font-medium">
                            Barcode
                          </span>
                        </div>
                      </div>
                      {/* Rows */}
                      {previewQuery.data.variants.map((variant) => (
                        <div
                          key={`${variant.title}-${variant.sku}-${variant.barcode}`}
                          className="grid grid-cols-3 border-b border-border last:border-b-0"
                        >
                          <div className="px-3 py-2">
                            <span className="type-small text-foreground">
                              {variant.title}
                            </span>
                          </div>
                          <div className="px-3 py-2">
                            <span className="type-small text-foreground">
                              {variant.sku || "—"}
                            </span>
                          </div>
                          <div className="px-3 py-2">
                            <span className="type-small text-foreground">
                              {variant.barcode || "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Background note */}
                  <p className="type-small text-tertiary">
                    The import will run in the background. You'll be notified
                    when it completes.
                  </p>
                </>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t border-border">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isImporting}
              >
                Back
              </Button>
              <Button
                onClick={handleStartImport}
                disabled={
                  isImporting || previewQuery.isLoading || previewQuery.isError
                }
              >
                {isImporting ? "Starting..." : "Import products"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Skeleton that matches the Import button appearance.
 * Shown while user/notification data loads.
 * Exported for use in layout-level Suspense boundaries.
 */
export function ImportProductsModalSkeleton() {
  return (
    <Button variant="outline" size="default" className="relative" disabled>
      <Icons.Upload className="h-[14px] w-[14px]" />
      <span className="px-1">Import</span>
    </Button>
  );
}

/**
 * Import Products Modal.
 * Uses suspense queries - must be wrapped in a Suspense boundary by the parent.
 */
export function ImportProductsModal({ onSuccess }: { onSuccess?: () => void }) {
  return <ImportProductsModalContent onSuccess={onSuccess} />;
}
