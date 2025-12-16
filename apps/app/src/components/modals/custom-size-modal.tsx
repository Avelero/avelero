"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

interface CustomSizeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSizeName?: string;
  onSave: (size: { id: string; name: string }) => void;
}

export function CustomSizeModal({
  open,
  onOpenChange,
  initialSizeName = "",
  onSave,
}: CustomSizeModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { sizeOptions: existingSizes } = useBrandCatalog();

  const [sizeName, setSizeName] = React.useState(initialSizeName);
  const [nameError, setNameError] = React.useState("");

  // API mutation for creating size
  const createSizeMutation = useMutation(
    trpc.catalog.sizes.create.mutationOptions(),
  );

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setSizeName(initialSizeName);
      setNameError("");
    }
  }, [open, initialSizeName]);

  // Validation function for size name
  const validateName = (value: string): boolean => {
    const trimmedName = value.trim();

    if (!trimmedName) {
      setNameError("Size name is required");
      return false;
    }

    const isDuplicate = existingSizes.some(
      (size) => size.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (isDuplicate) {
      setNameError("A size with this name already exists");
      return false;
    }

    setNameError("");
    return true;
  };

  /**
   * Creates the custom size immediately via API.
   *
   * This is INTENTIONAL - when a user manually creates a custom size,
   * it should be persisted immediately because they've shown explicit intent.
   * This is different from selecting a default size, which is stored locally
   * and only created when the product is saved.
   */
  const handleSave = async () => {
    if (!sizeName.trim()) return;

    // Validate name
    if (!validateName(sizeName)) {
      document.getElementById("size-name")?.focus();
      return;
    }

    try {
      // Create size immediately via API - this persists even if product creation is cancelled
      const result = await toast.loading(
        "Creating size...",
        createSizeMutation.mutateAsync({
          name: sizeName.trim(),
        }),
        {
          delay: 500,
          successMessage: `Size "${sizeName.trim()}" created`,
          errorMessage: `Failed to create size "${sizeName.trim()}"`,
        },
      );

      const createdSize = result?.data;
      if (!createdSize?.id) {
        throw new Error("No valid response returned from API");
      }

      // Optimistically update the cache immediately
      queryClient.setQueryData(
        trpc.composite.catalogContent.queryKey(),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            brandCatalog: {
              ...old.brandCatalog,
              sizes: [
                ...(old.brandCatalog.sizes || []),
                {
                  id: createdSize.id,
                  name: createdSize.name,
                },
              ],
            },
          };
        },
      );

      // Invalidate to trigger background refetch
      queryClient.invalidateQueries({
        queryKey: trpc.composite.catalogContent.queryKey(),
      });

      // Call parent callback with created size
      onSave({
        id: createdSize.id,
        name: createdSize.name,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create size:", error);
      // Error toast is already shown by toast.loading errorMessage option
    }
  };

  const isCreating = createSizeMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-0 gap-0 border border-border overflow-visible">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">Create custom size</DialogTitle>
        </DialogHeader>

        {/* Main content */}
        <div className="px-6 py-4 min-h-[120px] flex items-center">
          <div className="w-full space-y-1.5">
            <Label htmlFor="size-name">Size name <span className="text-destructive">*</span></Label>
            <Input
              id="size-name"
              value={sizeName}
              onChange={(e) => setSizeName(e.target.value)}
              placeholder="Enter size"
              className={nameError ? "border-destructive" : ""}
              onKeyDown={(e) => {
                if (e.key === "Enter" && sizeName.trim()) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            {nameError && (
              <p className="type-small text-destructive">{nameError}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!sizeName.trim() || isCreating}>
            {isCreating ? "Creating..." : "Create size"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

