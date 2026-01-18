"use client";

import { useTriggerExportProgress } from "@/hooks/use-job-progress";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FilterState,
  SelectionState,
} from "@/components/tables/passports/types";

// ============================================================================
// Types
// ============================================================================

interface ExportProductsModalProps {
  selection: SelectionState;
  selectedCount: number;
  filterState?: FilterState;
  searchValue?: string;
  disabled?: boolean;
}

interface ActiveExportRun {
  runId: string;
  accessToken: string;
}

// ============================================================================
// Component
// ============================================================================

export function ExportProductsModal({
  selection,
  selectedCount,
  filterState,
  searchValue,
  disabled = false,
}: ExportProductsModalProps) {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [activeExportRun, setActiveExportRun] =
    useState<ActiveExportRun | null>(null);
  const downloadTriggeredRef = useRef(false);

  const hasSelection = selectedCount > 0;
  const isButtonDisabled = disabled || !hasSelection;

  // Subscribe to real-time updates (only to detect completion)
  const { progress: exportProgress, runStatus: exportRunStatus } =
    useTriggerExportProgress(
      activeExportRun?.runId ?? null,
      activeExportRun?.accessToken ?? null,
    );

  // Start export mutation
  const startExportMutation = useMutation(
    trpc.bulk.export.start.mutationOptions({
      onSuccess: (data) => {
        if (data.runId && data.publicAccessToken) {
          setActiveExportRun({
            runId: data.runId,
            accessToken: data.publicAccessToken,
          });
          downloadTriggeredRef.current = false;
        }
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start export");
      },
    }),
  );

  // Auto-download when export completes
  const triggerDownload = useCallback((url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Watch for completion and trigger download
  // Guards: modal must be open AND we must have an active export run started this session
  useEffect(() => {
    if (
      open &&
      activeExportRun &&
      exportProgress?.status === "completed" &&
      exportProgress.downloadUrl &&
      !downloadTriggeredRef.current
    ) {
      downloadTriggeredRef.current = true;
      triggerDownload(exportProgress.downloadUrl);
    }
  }, [
    open,
    activeExportRun,
    exportProgress?.status,
    exportProgress?.downloadUrl,
    triggerDownload,
  ]);

  // Reset state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTimeout(() => {
        setActiveExportRun(null);
        startExportMutation.reset();
        downloadTriggeredRef.current = false;
      }, 350);
    }
    setOpen(newOpen);
  };

  const handleStartExport = () => {
    if (!hasSelection) return;

    const selectionInput =
      selection.mode === "all"
        ? { mode: "all" as const, excludeIds: selection.excludeIds }
        : { mode: "explicit" as const, includeIds: selection.includeIds };

    startExportMutation.mutate({
      selection: selectionInput,
      filterState: filterState ?? undefined,
      search: searchValue ?? undefined,
    });
  };

  // Simple state machine: initial -> exporting -> completed
  const isExporting =
    startExportMutation.isPending ||
    (activeExportRun &&
      exportProgress?.status !== "completed" &&
      exportRunStatus !== "completed" &&
      exportProgress?.status !== "failed" &&
      exportRunStatus !== "failed");
  const isCompleted =
    exportProgress?.status === "completed" || exportRunStatus === "completed";
  const isFailed =
    exportProgress?.status === "failed" ||
    exportRunStatus === "failed" ||
    startExportMutation.isError;
  const isInitial = !isExporting && !isCompleted && !isFailed;

  // The button element
  const buttonElement = (
    <Button variant="outline" size="default" disabled={isButtonDisabled}>
      <Icons.Download className="h-[14px] w-[14px]" />
      <span className="px-1">Export</span>
      {hasSelection && (
        <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 ml-1 rounded-sm bg-accent text-[12px] leading-[12px] text-foreground">
          {selectedCount}
        </span>
      )}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {isButtonDisabled && !hasSelection ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block">{buttonElement}</span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Select products to export
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <DialogTrigger asChild>{buttonElement}</DialogTrigger>
      )}
      <DialogContent size="xl" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>Export products</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6">
          {/* Initial state */}
          {isInitial && (
            <div className="space-y-4">
              <p className="type-p text-foreground">
                You are about to export{" "}
                <span className="font-medium">
                  {selectedCount.toLocaleString()} product
                  {selectedCount !== 1 ? "s" : ""}
                </span>
                .
              </p>
              <p className="type-small text-secondary">
                You can wait here for the export to complete and it will
                auto-download, or close this dialog and we'll send you an email
                when it's ready.
              </p>
            </div>
          )}

          {/* Exporting state */}
          {isExporting && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Icons.Loader className="w-5 h-5 animate-spin text-tertiary" />
              <p className="type-small text-secondary">Exporting...</p>
            </div>
          )}

          {/* Completed state */}
          {isCompleted && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                <Icons.Check className="w-6 h-6 text-brand" />
              </div>
              <div className="text-center">
                <p className="type-p text-foreground font-medium">
                  Export complete!
                </p>
                <p className="type-small text-secondary mt-1">
                  Your download should start automatically. If it doesn't,{" "}
                  {exportProgress?.downloadUrl ? (
                    <a
                      href={exportProgress.downloadUrl}
                      className="text-brand underline"
                      download
                    >
                      click here to download
                    </a>
                  ) : (
                    "check your email for the download link"
                  )}
                  .
                </p>
              </div>
            </div>
          )}

          {/* Failed state */}
          {isFailed && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <Icons.AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div className="text-center">
                <p className="type-p text-foreground font-medium">
                  Export failed
                </p>
                <p className="type-small text-secondary mt-1">
                  {exportProgress?.errorMessage ||
                    startExportMutation.error?.message ||
                    "An error occurred while preparing your export. Please try again."}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          {isInitial && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleStartExport}>Export</Button>
            </>
          )}

          {isExporting && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}

          {isCompleted && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}

          {isFailed && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setActiveExportRun(null);
                  startExportMutation.reset();
                  downloadTriggeredRef.current = false;
                  handleStartExport();
                }}
              >
                Try again
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Skeleton that matches the Export button appearance.
 * Shown in loading states - visually identical to the disabled Export button.
 */
export function ExportProductsModalSkeleton() {
  return (
    <Button variant="outline" size="default" disabled>
      <Icons.Download className="h-[14px] w-[14px]" />
      <span className="px-1">Export</span>
    </Button>
  );
}
