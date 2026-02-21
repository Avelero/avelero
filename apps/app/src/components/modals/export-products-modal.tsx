"use client";

import type {
  FilterState,
  SelectionState,
} from "@/components/tables/passports/types";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Types
// ============================================================================

interface ExportProductsModalProps {
  selection: SelectionState;
  selectedCount: number;
  filterState?: FilterState;
  searchValue?: string;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

type ExportState = "initial" | "exporting" | "completed" | "failed";

// ============================================================================
// Component
// ============================================================================

export function ExportProductsModal({
  selection,
  selectedCount,
  filterState,
  searchValue,
  disabled = false,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: ExportProductsModalProps) {
  const trpc = useTRPC();
  const [internalOpen, setInternalOpen] = useState(false);
  const [exportState, setExportState] = useState<ExportState>("initial");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeAccessToken, setActiveAccessToken] = useState<string | null>(
    null,
  );
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const downloadTriggeredRef = useRef(false);

  const hasSelection = selectedCount > 0;
  const isButtonDisabled = disabled || !hasSelection;
  const open = controlledOpen ?? internalOpen;

  // Subscribe to real-time updates
  const { progress: exportProgress, runStatus: exportRunStatus } =
    useTriggerExportProgress(activeRunId, activeAccessToken);

  // Start export mutation
  const startExportMutation = useMutation(
    trpc.bulk.export.start.mutationOptions({
      onSuccess: (data) => {
        if (data.runId && data.publicAccessToken) {
          setActiveRunId(data.runId);
          setActiveAccessToken(data.publicAccessToken);
          downloadTriggeredRef.current = false;
        }
      },
      onError: (error) => {
        setErrorMessage(error.message || "Failed to start export");
        setExportState("failed");
      },
    }),
  );

  // Watch for real-time updates and transition states
  useEffect(() => {
    if (exportState !== "exporting") return;

    // Only transition to completed when we have the download URL
    if (exportProgress?.status === "completed" && exportProgress.downloadUrl) {
      setDownloadUrl(exportProgress.downloadUrl);
      setExportState("completed");
    } else if (
      exportProgress?.status === "failed" ||
      exportRunStatus === "failed"
    ) {
      setErrorMessage(
        exportProgress?.errorMessage ||
          "An error occurred while preparing your export. Please try again.",
      );
      setExportState("failed");
    }
  }, [exportState, exportProgress, exportRunStatus]);

  // Auto-download when export completes
  const triggerDownload = useCallback((url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  // Trigger download when completed
  useEffect(() => {
    if (
      open &&
      exportState === "completed" &&
      downloadUrl &&
      !downloadTriggeredRef.current
    ) {
      downloadTriggeredRef.current = true;
      triggerDownload(downloadUrl);
    }
  }, [open, exportState, downloadUrl, triggerDownload]);

  // Reset state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTimeout(() => {
        setExportState("initial");
        setActiveRunId(null);
        setActiveAccessToken(null);
        setDownloadUrl(null);
        setErrorMessage(null);
        startExportMutation.reset();
        downloadTriggeredRef.current = false;
      }, 350);
    }

    if (controlledOpen === undefined) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  const handleStartExport = () => {
    if (!hasSelection) return;

    setExportState("exporting");

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

  const handleRetry = () => {
    setExportState("initial");
    setActiveRunId(null);
    setActiveAccessToken(null);
    setDownloadUrl(null);
    setErrorMessage(null);
    startExportMutation.reset();
    downloadTriggeredRef.current = false;
    // Small delay to ensure state is reset before starting again
    setTimeout(handleStartExport, 0);
  };

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
      {!hideTrigger &&
        (isButtonDisabled && !hasSelection ? (
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
        ))}
      <DialogContent size="xl" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>Export products</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6">
          {/* Initial state */}
          {exportState === "initial" && (
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
          {exportState === "exporting" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Icons.Loader className="w-5 h-5 animate-spin text-tertiary" />
              <p className="type-small text-secondary">Exporting...</p>
            </div>
          )}

          {/* Completed state */}
          {exportState === "completed" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                <Icons.Check className="w-6 h-6 text-brand" />
              </div>
              <div className="text-center">
                <p className="type-p text-foreground font-medium">
                  Export complete!
                </p>
                <p className="type-small text-secondary mt-1">
                  Your download should start automatically.
                  {downloadUrl && (
                    <>
                      {" "}
                      If it doesn't,{" "}
                      <a
                        href={downloadUrl}
                        className="text-brand underline"
                        download
                      >
                        click here to download
                      </a>
                      .
                    </>
                  )}
                </p>
                <p className="type-small text-secondary mt-1">
                  We've also sent you an email with the download link.
                </p>
              </div>
            </div>
          )}

          {/* Failed state */}
          {exportState === "failed" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <Icons.AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div className="text-center">
                <p className="type-p text-foreground font-medium">
                  Export failed
                </p>
                <p className="type-small text-secondary mt-1">
                  {errorMessage ||
                    "An error occurred while preparing your export. Please try again."}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          {exportState === "initial" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleStartExport}>Export</Button>
            </>
          )}

          {exportState === "exporting" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}

          {exportState === "completed" && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}

          {exportState === "failed" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleRetry}>Try again</Button>
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
