"use client";

/**
 * VariantsOverview
 *
 * Left sidebar for the variant edit page showing:
 * - Product thumbnail + name
 * - Scrollable list of variants with attribute labels
 * - Selected variant highlighted with accent background
 * - Override indicator next to variant label
 * - Three-dot menu on the right for delete action
 * - Clicking navigates between variants (with unsaved changes check)
 * - Hovering prefetches variant data for fast navigation
 */

import { useTRPC } from "@/trpc/client";
import { BUCKETS } from "@/utils/storage-config";
import { normalizeToDisplayUrl } from "@/utils/storage-urls";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import { toast } from "@v1/ui/sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

interface VariantInfo {
  upid: string;
  attributeLabel: string; // e.g., "Black / S"
  hasOverrides?: boolean; // Whether this variant has override data
}

interface VariantsOverviewProps {
  productHandle: string;
  productName: string;
  productImage: string | null;
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
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const imageUrl = normalizeToDisplayUrl(BUCKETS.PRODUCTS, productImage);

  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [variantToDelete, setVariantToDelete] = React.useState<string | null>(null);

  // Delete variant mutation
  const deleteVariantMutation = useMutation(
    trpc.products.variants.delete.mutationOptions()
  );

  const handleDeleteClick = (upid: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setVariantToDelete(upid);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!variantToDelete) return;

    try {
      await deleteVariantMutation.mutateAsync({
        productHandle,
        variantUpid: variantToDelete,
      });

      // Invalidate queries
      await queryClient.invalidateQueries({
        queryKey: trpc.products.get.queryKey({
          handle: productHandle,
          includeVariants: true,
          includeAttributes: true,
        }),
      });

      toast.success("Variant deleted successfully");
      setDeleteDialogOpen(false);
      setVariantToDelete(null);

      // If we deleted the currently selected variant, navigate to product page
      if (variantToDelete === selectedUpid) {
        router.push(`/passports/edit/${productHandle}`);
      }
    } catch (error) {
      console.error("Failed to delete variant:", error);
      toast.error("Failed to delete variant");
    }
  };

  return (
    <>
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
              <div
                key={variant.upid}
                className={cn(
                  "px-4 py-3 flex items-center justify-between gap-2 border-b border-border last:border-b-0",
                  isSelected ? "bg-accent" : "hover:bg-accent",
                )}
                onMouseEnter={() => onVariantHover?.(variant.upid)}
              >
                {/* Left side: Link with label + override indicator */}
                <Link
                  href={`/passports/edit/${productHandle}/variant/${variant.upid}`}
                  className="flex items-center gap-2 min-w-0 flex-1"
                >
                  <span
                    className={cn(
                      "type-p truncate",
                      isSelected ? "text-primary font-medium" : "text-primary",
                    )}
                  >
                    {variant.attributeLabel}
                  </span>

                  {/* Override indicator - next to text */}
                  {variant.hasOverrides && (
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
                </Link>

                {/* Right side: Three-dot menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Variant options"
                      className="h-6 w-6 flex items-center justify-center shrink-0 text-tertiary hover:text-primary transition-colors"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Icons.EllipsisVertical className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => handleDeleteClick(variant.upid, e)}
                    >
                      <Icons.Trash2 className="h-4 w-4 mr-2" />
                      Delete variant
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}

          {variants.length === 0 && (
            <div className="px-4 py-8 text-center text-tertiary type-small">
              No variants found
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-none sm:rounded-none p-6 gap-6 border border-border focus:outline-none focus-visible:outline-none">
          <DialogHeader>
            <DialogTitle className="text-foreground">Delete variant</DialogTitle>
            <DialogDescription className="text-secondary">
              Are you sure you want to delete this variant? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setDeleteDialogOpen(false);
                setVariantToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleteVariantMutation.isPending}
            >
              {deleteVariantMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
