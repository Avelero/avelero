"use client";

import { useTRPC } from "@/trpc/client";
import type { SelectionState } from "@/components/tables/passports/types";
import type { FilterState } from "@/components/passports/filter-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { toast } from "@v1/ui/sonner";

interface DeleteProductsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Selection state for bulk operations */
  selection: SelectionState;
  /** Current filter state (used when selection.mode === 'all') */
  filterState?: FilterState;
  /** Current search term (used when selection.mode === 'all') */
  search?: string;
  /** Total count of products to be deleted (for display) */
  totalCount: number;
  /** Optional callback after successful deletion */
  onSuccess?: () => void;
}

/**
 * Modal for confirming product deletion.
 * Supports both single and bulk product deletion using the unified delete endpoint.
 *
 * Selection modes:
 * - 'explicit': Delete specific products by ID (manual selection)
 * - 'all': Delete all products matching filters, optionally excluding some IDs
 */
function DeleteProductsModal({
  open,
  onOpenChange,
  selection,
  filterState,
  search,
  totalCount,
  onSuccess,
}: DeleteProductsModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const isBulk = totalCount > 1;
  const count = totalCount;
  const isSingleExplicit =
    selection.mode === "explicit" && selection.includeIds.length === 1;

  // Use unified delete endpoint which supports both single and bulk operations
  const deleteMutation = useMutation(
    trpc.products.delete.mutationOptions({
      onSuccess: (result) => {
        // Check if this is a bulk result (has 'deleted' property) or single (has 'data')
        if ("deleted" in result) {
          toast.success(
            `${result.deleted} ${result.deleted === 1 ? "product" : "products"} deleted`,
          );
        } else {
          toast.success("Product deleted");
        }
        // Invalidate products list to refresh table
        void queryClient.invalidateQueries({
          queryKey: [["products", "list"]],
        });
        void queryClient.invalidateQueries({ queryKey: [["summary"]] });
        void queryClient.invalidateQueries({ queryKey: [["composite"]] });
        onSuccess?.();
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete products");
      },
    }),
  );

  const isDeleting = deleteMutation.isPending;

  function handleDelete() {
    if (isDeleting || totalCount === 0) return;

    // Single product via explicit selection
    if (isSingleExplicit) {
      deleteMutation.mutate({ id: selection.includeIds[0]! });
      return;
    }

    // Bulk delete based on selection mode
    if (selection.mode === "all") {
      // "Select all" mode: delete by filters, not by IDs
      deleteMutation.mutate({
        selection: {
          mode: "all",
          filters: filterState?.groups.length ? filterState : undefined,
          search: search?.trim() || undefined,
          excludeIds:
            selection.excludeIds.length > 0 ? selection.excludeIds : undefined,
        },
      });
    } else {
      // "Explicit" mode: delete specific IDs
      deleteMutation.mutate({
        selection: {
          mode: "explicit",
          ids: selection.includeIds,
        },
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">
            {isBulk ? `Delete ${count} products?` : "Delete product?"}
          </DialogTitle>
          <DialogDescription className="text-secondary">
            {isBulk
              ? `This will permanently delete ${count} products and all their associated data including variants and passport information. This action cannot be undone.`
              : "This will permanently delete this product and all its associated data including variants and passport information. This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 min-h-[60px]" />

        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button
            variant="outline"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || totalCount === 0}
          >
            {isDeleting
              ? "Deleting..."
              : isBulk
                ? `Delete ${count} products`
                : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DeleteProductsModal };
