"use client";

import { useTRPC } from "@/trpc/client";
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
  /** Product IDs to delete */
  productIds: string[];
  /** Optional callback after successful deletion */
  onSuccess?: () => void;
}

/**
 * Modal for confirming product deletion.
 * Supports both single and bulk product deletion.
 */
function DeleteProductsModal({
  open,
  onOpenChange,
  productIds,
  onSuccess,
}: DeleteProductsModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const isBulk = productIds.length > 1;
  const count = productIds.length;

  // Use bulk delete for multiple products, single delete for one
  const bulkDeleteMutation = useMutation(
    trpc.products.bulkDelete.mutationOptions({
      onSuccess: (result) => {
        if (result.success) {
          toast.success(
            `${result.deleted} ${result.deleted === 1 ? "product" : "products"} deleted`
          );
        } else {
          toast.error(
            `Deleted ${result.deleted} products, ${result.failed} failed`
          );
        }
        // Invalidate products list to refresh table
        void queryClient.invalidateQueries({ queryKey: [["products", "list"]] });
        void queryClient.invalidateQueries({ queryKey: [["summary"]] });
        void queryClient.invalidateQueries({ queryKey: [["composite"]] });
        onSuccess?.();
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete products");
      },
    })
  );

  const singleDeleteMutation = useMutation(
    trpc.products.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Product deleted");
        // Invalidate products list to refresh table
        void queryClient.invalidateQueries({ queryKey: [["products", "list"]] });
        void queryClient.invalidateQueries({ queryKey: [["summary"]] });
        void queryClient.invalidateQueries({ queryKey: [["composite"]] });
        onSuccess?.();
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete product");
      },
    })
  );

  const isDeleting = bulkDeleteMutation.isPending || singleDeleteMutation.isPending;

  function handleDelete() {
    if (isDeleting || productIds.length === 0) return;

    if (isBulk) {
      bulkDeleteMutation.mutate({ ids: productIds });
    } else {
      singleDeleteMutation.mutate({ id: productIds[0]! });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-none sm:rounded-none p-6 gap-6 border border-border focus:outline-none focus-visible:outline-none">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isBulk ? `Delete ${count} products?` : "Delete product?"}
          </DialogTitle>
          <DialogDescription className="text-secondary w-full whitespace-normal break-words">
            {isBulk
              ? `This will permanently delete ${count} products and all their associated data including variants and passport information. This action cannot be undone.`
              : "This will permanently delete this product and all its associated data including variants and passport information. This action cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex justify-end gap-2">
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
            disabled={isDeleting || productIds.length === 0}
          >
            {isDeleting ? "Deleting..." : isBulk ? `Delete ${count} products` : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DeleteProductsModal };


