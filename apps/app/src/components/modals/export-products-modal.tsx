"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import { useEffect, useState, useRef } from "react";
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
  const [jobId, setJobId] = useState<string | null>(null);
  const downloadTriggeredRef = useRef(false);

  const hasSelection = selectedCount > 0;
  const isButtonDisabled = disabled || !hasSelection;

  // Reset state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTimeout(() => {
        setJobId(null);
        downloadTriggeredRef.current = false;
      }, 350);
    }
    setOpen(newOpen);
  };

  // Start export mutation
  const startExportMutation = useMutation(
    trpc.bulk.export.start.mutationOptions({
      onSuccess: (data) => {
        setJobId(data.jobId);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to start export");
      },
    }),
  );

  // Poll for export status
  const statusQuery = useQuery({
    ...trpc.bulk.export.status.queryOptions({ jobId: jobId ?? "" }),
    enabled: !!jobId,
    refetchInterval: (data) => {
      if (!data?.state?.data) return 2000;
      const status = data.state.data.status;
      // Stop polling when complete or failed
      if (status === "COMPLETED" || status === "FAILED") return false;
      return 2000; // Poll every 2 seconds
    },
  });

  // Auto-download when complete (only once)
  useEffect(() => {
    if (
      statusQuery.data?.status === "COMPLETED" &&
      statusQuery.data?.downloadUrl &&
      !downloadTriggeredRef.current
    ) {
      downloadTriggeredRef.current = true;
      // Trigger download
      const a = document.createElement("a");
      a.href = statusQuery.data.downloadUrl;
      a.download = `product-export-${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success("Export downloaded successfully");
    }
  }, [statusQuery.data?.status, statusQuery.data?.downloadUrl]);

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

  const handleManualDownload = () => {
    if (!statusQuery.data?.downloadUrl) return;
    const a = document.createElement("a");
    a.href = statusQuery.data.downloadUrl;
    a.download = `product-export-${Date.now()}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Determine state - use explicit state tracking to avoid gaps
  const isComplete = statusQuery.data?.status === "COMPLETED";
  const isFailed = statusQuery.data?.status === "FAILED";
  // Processing state: from when we start the mutation until we get a terminal status
  const isProcessing = !!jobId && !isComplete && !isFailed;
  // Initial state: before any export has been started
  const isInitial = !jobId && !startExportMutation.isPending;

  // The button element used for both enabled and disabled states
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
      {/* Show tooltip when disabled due to no selection */}
      {isButtonDisabled && !hasSelection ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Wrapper div needed for tooltip to work on disabled button */}
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
          {/* State 1: Initial - Before export starts */}
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
                Your export will be prepared in the background. You can wait
                here for the download to complete automatically, or close this
                dialog and continue working — we'll send you an email with the
                download link when it's ready.
              </p>
            </div>
          )}

          {/* State 2: Processing - Export in progress (includes mutation pending) */}
          {(startExportMutation.isPending || isProcessing) && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Icons.Loader className="w-5 h-5 animate-spin text-tertiary" />
              <p className="type-small text-secondary">Exporting...</p>
            </div>
          )}

          {/* State 3: Complete */}
          {isComplete && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                <Icons.Check className="w-6 h-6 text-brand" />
              </div>
              <div className="text-center">
                <p className="type-p text-foreground font-medium">
                  Export complete!
                </p>
                <p className="type-small text-secondary mt-1">
                  Your download should start automatically. A copy has also been
                  sent to your email.
                </p>
              </div>
              {statusQuery.data?.downloadUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualDownload}
                >
                  <Icons.Download className="w-4 h-4 mr-2" />
                  Download again
                </Button>
              )}
            </div>
          )}

          {/* State: Failed */}
          {isFailed && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <Icons.X className="w-6 h-6 text-destructive" />
              </div>
              <div className="text-center">
                <p className="type-p text-foreground font-medium">
                  Export failed
                </p>
                <p className="type-small text-destructive mt-1">
                  {((statusQuery.data?.summary as Record<string, unknown>)
                    ?.error as string) || "An unexpected error occurred"}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          {/* Initial state: Cancel + Export buttons */}
          {isInitial && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleStartExport}>Export</Button>
            </>
          )}

          {/* Processing state: Close button */}
          {(startExportMutation.isPending || isProcessing) && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Close
            </Button>
          )}

          {/* Complete/Failed state: Done button */}
          {(isComplete || isFailed) && (
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
