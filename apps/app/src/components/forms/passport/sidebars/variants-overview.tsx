"use client";

/**
 * VariantsOverview
 *
 * Left sidebar for the variant edit page showing:
 * - Product thumbnail + name
 * - Scrollable list of variants with attribute labels
 * - Selected variant highlighted with accent background
 * - Clicking navigates between variants (with unsaved changes check)
 * - Hovering prefetches variant data for fast navigation
 */

import { BUCKETS } from "@/utils/storage-config";
import { normalizeToDisplayUrl } from "@/utils/storage-urls";
import { cn } from "@v1/ui/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import Link from "next/link";

interface VariantInfo {
  upid: string;
  attributeLabel: string; // e.g., "Black / S"
  hasOverrides?: boolean; // Whether this variant has override data
}

interface VariantsOverviewProps {
  productHandle: string;
  productName: string;
  productImage: string | null;
  productStatus: "draft" | "published" | "archived";
  variants: VariantInfo[];
  selectedUpid: string;
  /** Called when hovering a variant row - used for prefetching */
  onVariantHover?: (upid: string) => void;
}

export function VariantsOverview({
  productHandle,
  productName,
  productImage,
  variants,
  selectedUpid,
  onVariantHover,
}: VariantsOverviewProps) {
  const imageUrl = normalizeToDisplayUrl(BUCKETS.PRODUCTS, productImage);

  return (
    <div className="border border-border bg-background flex flex-col">
      {/* Product Overview Header */}
      <div className="p-4 border-b border-border">
        <div className="flex gap-3">
          {/* Product Thumbnail */}
          <div className="w-16 h-16 bg-accent-light border border-border shrink-0 overflow-hidden">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={productName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-tertiary">
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Product Info - just name and variant count */}
          <div className="flex flex-col justify-center gap-0.5 min-w-0">
            <p className="type-p font-medium text-primary truncate">
              {productName}
            </p>
            <span className="type-small text-tertiary">
              {variants.length} variant{variants.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Variant List */}
      <div className="flex flex-col max-h-[400px] overflow-y-auto">
        {variants.map((variant) => {
          const isSelected = variant.upid === selectedUpid;

          return (
            <Link
              key={variant.upid}
              href={`/passports/edit/${productHandle}/variant/${variant.upid}`}
              className={cn(
                "px-4 py-3 flex items-center justify-between gap-2 border-b border-border last:border-b-0 cursor-pointer",
                isSelected ? "bg-accent" : "hover:bg-accent",
              )}
              onMouseEnter={() => onVariantHover?.(variant.upid)}
            >
              {/* Variant label */}
              <span
                className={cn(
                  "type-p truncate",
                  isSelected ? "text-primary font-medium" : "text-primary",
                )}
              >
                {variant.attributeLabel}
              </span>

              {/* Override indicator */}
              {variant.hasOverrides && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-4 h-4 flex items-center justify-center shrink-0">
                        <div className="w-2 h-2 rounded-full bg-brand" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Contains variant-specific overrides
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </Link>
          );
        })}

        {variants.length === 0 && (
          <div className="px-4 py-8 text-center text-tertiary type-small">
            No variants found
          </div>
        )}
      </div>
    </div>
  );
}
