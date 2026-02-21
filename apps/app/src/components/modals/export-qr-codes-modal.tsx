"use client";

import type {
  FilterState,
  SelectionState,
} from "@/components/tables/passports/types";
import { useTriggerQrExportProgress } from "@/hooks/use-job-progress";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

interface ExportQrCodesModalProps {
  selection: SelectionState;
  selectedCount: number;
  filterState?: FilterState;
  searchValue?: string;
  hasVerifiedCustomDomain?: boolean;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

type QrExportState = "summary" | "exporting" | "completed" | "failed";
const QR_EXPORT_REALTIME_ERROR_CODE = "QR_EXPORT_REALTIME_CREDENTIALS_MISSING";
const GENERIC_QR_EXPORT_ERROR_MESSAGE =
  "An error occurred while preparing your QR export. Please try again.";

export function ExportQrCodesModal({
  selection,
  selectedCount,
  filterState,
  searchValue,
  hasVerifiedCustomDomain = false,
  disabled = false,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: ExportQrCodesModalProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const [internalOpen, setInternalOpen] = useState(false);
  const [exportState, setExportState] = useState<QrExportState>("summary");
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

  const selectionInput =
    selection.mode === "all"
      ? { mode: "all" as const, excludeIds: selection.excludeIds }
      : { mode: "explicit" as const, includeIds: selection.includeIds };

  const countQueryInput =
    selection.mode === "all"
      ? {
          selection: selectionInput,
          filterState: filterState ?? undefined,
          search: searchValue || undefined,
        }
      : {
          selection: selectionInput,
        };

  const countQuery = useQuery({
    ...trpc.products.count.queryOptions(countQueryInput),
    enabled: open && hasSelection && hasVerifiedCustomDomain,
  });

  const summary = countQuery.data?.data;
  const variantsWithBarcode = summary?.variantsWithBarcode ?? 0;
  const isBlockedByMissingBarcodes =
    hasVerifiedCustomDomain &&
    !countQuery.isLoading &&
    !!summary &&
    variantsWithBarcode === 0;

  const { progress: exportProgress, runStatus: exportRunStatus } =
    useTriggerQrExportProgress(activeRunId, activeAccessToken);

  const startExportMutation = useMutation(
    trpc.bulk.qrExport.start.mutationOptions({
      onSuccess: (data) => {
        const hasRunId = !!data.runId;
        const hasPublicAccessToken = !!data.publicAccessToken;

        if (!hasRunId || !hasPublicAccessToken) {
          // Do not expose internal diagnostics to end users in production.
          console.error(QR_EXPORT_REALTIME_ERROR_CODE, {
            jobId: data.jobId,
            hasRunId,
            hasPublicAccessToken,
            selectionMode: selection.mode,
            selectedCount,
          });

          setActiveRunId(null);
          setActiveAccessToken(null);
          setExportState("failed");
          setErrorMessage(
            process.env.NODE_ENV === "production"
              ? GENERIC_QR_EXPORT_ERROR_MESSAGE
              : `${GENERIC_QR_EXPORT_ERROR_MESSAGE} (${QR_EXPORT_REALTIME_ERROR_CODE})`,
          );
          return;
        }

        setActiveRunId(data.runId);
        setActiveAccessToken(data.publicAccessToken);
        downloadTriggeredRef.current = false;
      },
      onError: (error) => {
        setErrorMessage(
          process.env.NODE_ENV === "production"
            ? GENERIC_QR_EXPORT_ERROR_MESSAGE
            : error.message || GENERIC_QR_EXPORT_ERROR_MESSAGE,
        );
        setExportState("failed");
      },
    }),
  );

  const canStartExport =
    hasVerifiedCustomDomain &&
    variantsWithBarcode > 0 &&
    !countQuery.isLoading &&
    !startExportMutation.isPending;

  useEffect(() => {
    if (exportState !== "exporting") return;

    if (exportProgress?.status === "completed" && exportProgress.downloadUrl) {
      setDownloadUrl(exportProgress.downloadUrl);
      setExportState("completed");
      return;
    }

    if (exportProgress?.status === "failed" || exportRunStatus === "failed") {
      setErrorMessage(
        exportProgress?.errorMessage ||
          GENERIC_QR_EXPORT_ERROR_MESSAGE,
      );
      setExportState("failed");
    }
  }, [exportState, exportProgress, exportRunStatus]);

  const triggerDownload = useCallback((url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

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

  const resetState = useCallback(() => {
    setExportState("summary");
    setActiveRunId(null);
    setActiveAccessToken(null);
    setDownloadUrl(null);
    setErrorMessage(null);
    startExportMutation.reset();
    downloadTriggeredRef.current = false;
  }, [startExportMutation]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && exportState !== "exporting") {
      setTimeout(() => {
        resetState();
      }, 350);
    }

    if (controlledOpen === undefined) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  const handleStartExport = () => {
    if (!canStartExport) return;

    setExportState("exporting");
    startExportMutation.mutate(
      selection.mode === "all"
        ? {
            selection: selectionInput,
            filterState: filterState ?? undefined,
            search: searchValue || undefined,
          }
        : {
            selection: selectionInput,
          },
    );
  };

  const handleRetry = () => {
    resetState();
    setTimeout(() => {
      handleStartExport();
    }, 0);
  };

  const handleGoToSettings = () => {
    handleOpenChange(false);
    router.push("/settings");
  };

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
      {!hideTrigger && (
        <DialogTrigger asChild>{buttonElement}</DialogTrigger>
      )}
      <DialogContent size="xl" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-1.5">
            <DialogTitle>Export QR codes</DialogTitle>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex h-4 w-4 translate-y-[1px] items-center justify-center align-text-top text-secondary">
                    <Icons.Info className="h-4 w-4" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-sm p-3">
                  <div className="space-y-2">
                    <p className="type-small font-medium text-foreground">
                      GS1 Digital Link QR codes
                    </p>
                    <p className="type-small text-secondary">
                      Avelero exports QR codes using the GS1 Digital Link
                      standard so digital product passports remain portable.{" "}
                      <a
                        href="https://www.gs1.org/standards/gs1-digital-link"
                        target="_blank"
                        rel="noreferrer"
                        className="text-foreground underline"
                      >
                        Read the standard
                      </a>
                      .
                    </p>
                    <p className="type-small text-secondary">
                      Variants must have barcodes, and your brand must have a
                      verified custom domain.
                    </p>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </DialogHeader>

        <div className="px-6 py-6">
          {exportState === "summary" && (
            <div className="space-y-4">
              {!hasVerifiedCustomDomain && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icons.AlertCircle className="h-4 w-4 text-destructive" />
                    <p className="type-p text-foreground font-medium">
                      Configure a verified custom domain first
                    </p>
                  </div>
                  <p className="type-small text-secondary">
                    You need to configure and verify a custom domain to generate
                    and export QR codes for your digital product passports.
                  </p>
                  <p className="type-small text-secondary">
                    We only export GS1 Digital Link QR codes in the format{" "}
                    <span className="font-mono">https://domain.com/01/barcode</span>{" "}
                    to keep passports portable across providers.
                  </p>
                </div>
              )}

              {hasVerifiedCustomDomain && countQuery.isLoading && (
                <div className="flex flex-col items-center justify-center py-8 gap-3">
                  <Icons.Loader className="w-5 h-5 animate-spin text-tertiary" />
                  <p className="type-small text-secondary">
                    Checking QR export eligibility...
                  </p>
                </div>
              )}

              {hasVerifiedCustomDomain && countQuery.isError && (
                <div className="space-y-2">
                  <p className="type-p text-foreground font-medium">
                    Failed to load QR export summary
                  </p>
                  <p className="type-small text-secondary">
                    Please try again.
                  </p>
                </div>
              )}

              {hasVerifiedCustomDomain && !countQuery.isLoading && summary && (
                <div className="space-y-4">
                  <p className="type-p text-foreground">
                    You selected{" "}
                    <span className="font-medium">
                      {summary.selectedProducts.toLocaleString()} products
                    </span>{" "}
                    with{" "}
                    <span className="font-medium">
                      {summary.selectedVariants.toLocaleString()} variants
                    </span>
                    .{" "}
                    <span className="font-medium">
                      {summary.variantsWithBarcode.toLocaleString()} variants
                    </span>{" "}
                    have barcodes and are eligible for QR code export.
                  </p>

                  <p className="type-small text-secondary">
                    You can wait here for the export to complete and it will
                    auto-download, or close this dialog and we&apos;ll send you
                    an email when it&apos;s ready.
                  </p>
                </div>
              )}
            </div>
          )}

          {exportState === "exporting" && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Icons.Loader className="w-5 h-5 animate-spin text-tertiary" />
              <div className="text-center">
                <p className="type-small text-secondary">
                  We&apos;re preparing your QR export in the background. You can
                  close this modal and we&apos;ll email you when it&apos;s ready,
                  or leave it open and the download will start automatically.
                </p>
              </div>
            </div>
          )}

          {exportState === "completed" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                <Icons.Check className="w-6 h-6 text-brand" />
              </div>
              <div className="text-center">
                <p className="type-p text-foreground font-medium">
                  QR export complete
                </p>
                <p className="type-small text-secondary mt-1">
                  Your download should start automatically.
                  {downloadUrl && (
                    <>
                      {" "}
                      If it doesn&apos;t,{" "}
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
                  We&apos;ve also sent you an email with the download link.
                </p>
              </div>
            </div>
          )}

          {exportState === "failed" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <Icons.AlertCircle className="w-6 h-6 text-destructive" />
              </div>
              <div className="text-center">
                <p className="type-p text-foreground font-medium">
                  QR export failed
                </p>
                <p className="type-small text-secondary mt-1">
                  {errorMessage ||
                    "An error occurred while preparing your QR export. Please try again."}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border">
          {exportState === "summary" && (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              {!hasVerifiedCustomDomain ? (
                <Button onClick={handleGoToSettings}>Go to settings</Button>
              ) : isBlockedByMissingBarcodes ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          onClick={handleStartExport}
                          disabled
                          aria-disabled
                        >
                          Export QR codes
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Add barcodes to selected variants to continue.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <Button
                  onClick={handleStartExport}
                  disabled={!canStartExport || countQuery.isError}
                >
                  Export QR codes
                </Button>
              )}
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
