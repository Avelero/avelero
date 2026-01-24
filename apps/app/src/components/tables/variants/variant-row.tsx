"use client";

import { useDebounce } from "@/hooks/use-debounce";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import * as React from "react";

/** GS1 GTIN barcode format: 8, 12, 13, or 14 digits */
const BARCODE_REGEX = /^(\d{8}|\d{12}|\d{13}|\d{14})$/;

/**
 * Badge component to indicate a new variant that hasn't been saved yet.
 * Styled like TagLabel from tag-select.tsx
 */
const NewBadge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>((props, ref) => {
  return (
    <span
      ref={ref}
      {...props}
      className={cn(
        "inline-flex items-center rounded-full bg-[#E1F0FF] px-1.5 text-[12px] font-regular leading-[20px] text-brand flex-shrink-0 cursor-default",
        props.className,
      )}
    >
      New
    </span>
  );
});
NewBadge.displayName = "NewBadge";

export interface VariantRowProps {
  /** Unique key for this variant (pipe-separated value IDs) */
  variantKey: string;
  /** Display label for the variant */
  label: string;
  /** Optional hex color for color swatch */
  hex?: string | null;
  /** Whether this variant is new (not yet saved) */
  isNew: boolean;
  /** Whether this variant has overrides */
  hasOverrides: boolean;
  /** Current SKU value */
  sku: string;
  /** Current barcode value */
  barcode: string;
  /** Callback to update SKU */
  onSkuChange: (value: string) => void;
  /** Callback to update barcode */
  onBarcodeChange: (value: string) => void;
  /** Whether the row is clickable (edit mode with saved variant) */
  isClickable: boolean;
  /** Callback when row is clicked (for navigation) */
  onClick?: () => void;
  /** Whether this is the last row (removes bottom border) */
  isLastRow?: boolean;
  /** Variant ID (for excluding from uniqueness check on updates) */
  variantId?: string;
}

export function VariantRow({
  variantKey,
  label,
  hex,
  isNew,
  hasOverrides,
  sku,
  barcode,
  onSkuChange,
  onBarcodeChange,
  isClickable,
  onClick,
  isLastRow = false,
  variantId,
}: VariantRowProps) {
  const trpc = useTRPC();

  // Debounce barcode for availability check (500ms delay)
  const trimmedBarcode = barcode.trim();
  const debouncedBarcode = useDebounce(trimmedBarcode, 500);

  // Barcode format validation
  const isEmpty = trimmedBarcode.length === 0;
  const isFormatValid = isEmpty || BARCODE_REGEX.test(trimmedBarcode);

  // Check barcode availability using tRPC query
  const barcodeCheckQuery = useQuery({
    ...trpc.products.variants.checkBarcode.queryOptions({
      barcode: debouncedBarcode,
      excludeVariantId: variantId,
    }),
    enabled: Boolean(
      debouncedBarcode &&
        isFormatValid &&
        debouncedBarcode.length >= 8 &&
        // Only check when debounce has settled
        debouncedBarcode === trimmedBarcode,
    ),
    staleTime: 10000, // Cache for 10 seconds
  });

  // Determine if we're currently checking availability
  const isChecking =
    barcodeCheckQuery.isLoading ||
    (trimmedBarcode !== debouncedBarcode && !isEmpty && isFormatValid);

  const isAvailable = barcodeCheckQuery.data?.available ?? null;
  const isTaken = isAvailable === false;

  // Only show availability status when we have a valid barcode that has been checked
  const showStatus =
    !isEmpty &&
    isFormatValid &&
    debouncedBarcode === trimmedBarcode &&
    !isChecking;

  return (
    <div
      key={variantKey}
      className={cn(
        "grid grid-cols-[minmax(100px,1fr)_minmax(140px,1fr)_minmax(140px,1fr)] h-10 border-b border-border group",
        isClickable && "cursor-pointer hover:bg-accent",
        isLastRow && "border-b-0",
      )}
      onClick={isClickable ? onClick : undefined}
    >
      <div className="px-4 flex items-center gap-2 group/variant">
        <div className="flex items-center gap-2 min-w-0">
          {hex && (
            <div
              className="h-3.5 w-3.5 rounded-full border border-border shrink-0"
              style={{ backgroundColor: hex }}
            />
          )}
          <span
            className={cn(
              "type-p text-primary truncate",
              isClickable && "group-hover/variant:underline",
            )}
          >
            {label}
          </span>
          {/* New variant indicator */}
          {isNew && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <NewBadge />
                </TooltipTrigger>
                <TooltipContent side="top">
                  This variant will be created on save
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {/* Override indicator */}
          {hasOverrides && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-4 h-4 flex items-center justify-center shrink-0">
                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Contains variant-specific overrides
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
      <div
        className="border-l border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          value={sku}
          onChange={(e) => onSkuChange(e.target.value)}
          placeholder="SKU"
          className="h-full w-full rounded-none border-0 bg-transparent type-p px-4 focus-visible:ring-[1.5px] focus-visible:ring-brand"
        />
      </div>
      <div
        className="border-l border-border relative"
        onClick={(e) => e.stopPropagation()}
      >
        <Input
          value={barcode}
          onChange={(e) => onBarcodeChange(e.target.value)}
          placeholder="Barcode"
          className={cn(
            "h-full w-full rounded-none border-0 bg-transparent type-p px-4 pr-10 focus-visible:ring-[1.5px] focus-visible:ring-brand",
            !isFormatValid && "text-destructive",
            isTaken && showStatus && "text-destructive",
          )}
        />
        {/* Loading spinner */}
        {isChecking && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Icons.Loader2 className="h-4 w-4 animate-spin text-secondary" />
          </div>
        )}
        {/* Error indicator - taken barcode */}
        {showStatus && isTaken && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Icons.AlertCircle className="h-4 w-4 text-destructive" />
                </div>
              </TooltipTrigger>
              <TooltipContent>Barcode already in use</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {/* Error indicator - invalid format */}
        {!isEmpty && !isFormatValid && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Icons.AlertCircle className="h-4 w-4 text-destructive" />
                </div>
              </TooltipTrigger>
              <TooltipContent>Must be 8, 12, 13, or 14 digits</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
