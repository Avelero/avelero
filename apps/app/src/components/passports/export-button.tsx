"use client";

import { ExportProductsModal } from "@/components/modals/export-products-modal";
import { ExportQrCodesModal } from "@/components/modals/export-qr-codes-modal";
import { useSelectionContextSafe } from "@/components/passports/selection-context";
import { useTRPC } from "@/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Client wrapper for the Export button in the layout header.
 * Reads selection state from the SelectionContext and opens either
 * product export or QR export modal via a chooser popover.
 */
export function ExportButton() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const context = useSelectionContextSafe();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [productsModalOpen, setProductsModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selection = context?.selection ?? {
    mode: "explicit" as const,
    includeIds: [],
    excludeIds: [],
  };
  const selectedCount = context?.selectedCount ?? 0;
  const filterState = context?.filterState;
  const searchValue = context?.searchValue ?? "";
  const disabled = context?.disabled ?? true;

  const hasSelection = selectedCount > 0;
  const isButtonDisabled = disabled || !hasSelection;
  const selectionSignature = useMemo(
    () =>
      selection.mode === "all"
        ? `all:${selection.excludeIds.join(",")}`
        : `explicit:${selection.includeIds.join(",")}`,
    [selection.mode, selection.includeIds, selection.excludeIds],
  );

  const countQueryInput = useMemo(() => {
    const selectionInput =
      selection.mode === "all"
        ? { mode: "all" as const, excludeIds: selection.excludeIds }
        : { mode: "explicit" as const, includeIds: selection.includeIds };

    // filters/search only matter for "all" mode
    if (selection.mode === "all") {
      return {
        selection: selectionInput,
        filterState: filterState ?? undefined,
        search: searchValue || undefined,
      };
    }

    return { selection: selectionInput };
  }, [
    selection.mode,
    selection.includeIds,
    selection.excludeIds,
    filterState,
    searchValue,
  ]);

  const latestCountInputRef = useRef(countQueryInput);
  useEffect(() => {
    latestCountInputRef.current = countQueryInput;
  }, [countQueryInput]);

  const { data: customDomainData } = useQuery({
    ...trpc.brand.customDomains.get.queryOptions(),
    // Always verify current status when component mounts, while still
    // using hydrated cache for immediate UI.
    staleTime: 0,
    refetchOnMount: "always",
  });
  const hasVerifiedCustomDomain =
    customDomainData?.domain?.status === "verified";

  const prefetchQrCounts = useCallback(() => {
    if (!hasSelection || !hasVerifiedCustomDomain) return;
    void queryClient.prefetchQuery(
      trpc.products.count.queryOptions(latestCountInputRef.current),
    );
  }, [hasSelection, hasVerifiedCustomDomain, queryClient, trpc]);

  // Debounced prefetch on selection changes only.
  useEffect(() => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }

    if (!hasSelection || !hasVerifiedCustomDomain) {
      return;
    }

    prefetchTimerRef.current = setTimeout(() => {
      prefetchQrCounts();
    }, 2000);

    return () => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current);
        prefetchTimerRef.current = null;
      }
    };
  }, [selectionSignature, hasSelection, hasVerifiedCustomDomain, prefetchQrCounts]);

  const buttonElement = (
    <Button
      variant="outline"
      size="default"
      disabled={isButtonDisabled}
      className="data-[state=open]:bg-accent"
    >
      <Icons.Download className="h-[14px] w-[14px]" />
      <span className="px-1">Export</span>
      {hasSelection && (
        <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 ml-1 rounded-sm bg-accent text-[12px] leading-[12px] text-foreground">
          {selectedCount}
        </span>
      )}
    </Button>
  );

  const openProductsExport = () => {
    setChooserOpen(false);
    setProductsModalOpen(true);
  };

  const openQrExport = () => {
    setChooserOpen(false);
    setQrModalOpen(true);
  };

  const handleChooserOpenChange = (open: boolean) => {
    setChooserOpen(open);

    if (!open) return;

    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current);
      prefetchTimerRef.current = null;
    }

    prefetchQrCounts();
  };

  return (
    <>
      <Popover
        open={isButtonDisabled ? false : chooserOpen}
        onOpenChange={handleChooserOpenChange}
      >
        {isButtonDisabled && !hasSelection ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-block">{buttonElement}</span>
              </TooltipTrigger>
              <TooltipContent side="top">Select products to export</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <PopoverTrigger asChild>{buttonElement}</PopoverTrigger>
        )}

        <PopoverContent className="w-[220px] p-1" align="start">
          <button
            type="button"
            className="relative flex w-full cursor-pointer select-none items-center gap-0.5 rounded-none px-2 h-[30px] !type-small outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
            onClick={openProductsExport}
          >
            <Icons.FileText className="h-[14px] w-[14px]" />
            <span className="px-1">Export Products</span>
          </button>

          <button
            type="button"
            className="relative flex w-full cursor-pointer select-none items-center gap-0.5 rounded-none px-2 h-[30px] !type-small outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground"
            onClick={openQrExport}
          >
            <Icons.QrCode className="h-[14px] w-[14px]" />
            <span className="px-1">Export QR Codes</span>
          </button>
        </PopoverContent>
      </Popover>

      <ExportProductsModal
        selection={selection}
        selectedCount={selectedCount}
        filterState={filterState}
        searchValue={searchValue}
        disabled={disabled}
        open={productsModalOpen}
        onOpenChange={setProductsModalOpen}
        hideTrigger
      />

      <ExportQrCodesModal
        selection={selection}
        selectedCount={selectedCount}
        filterState={filterState}
        searchValue={searchValue}
        hasVerifiedCustomDomain={hasVerifiedCustomDomain}
        disabled={disabled}
        open={qrModalOpen}
        onOpenChange={setQrModalOpen}
        hideTrigger
      />
    </>
  );
}
