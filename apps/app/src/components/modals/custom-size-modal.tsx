"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sizeGroups, calculateCustomSortIndex } from "@v1/selections";
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
import { Select, type SelectOptionGroup } from "@v1/ui/select";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

interface CustomSizeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSizeName?: string;
  onSave: (size: { id: string; name: string; sortIndex: number }) => void;
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
  const [referenceSortIndex, setReferenceSortIndex] = React.useState<string | null>(null);
  const [nameError, setNameError] = React.useState("");

  // API mutation for creating size
  const createSizeMutation = useMutation(
    trpc.brand.sizes.create.mutationOptions(),
  );

  // Convert sizeGroups to SelectOptionGroup format
  // Using sortIndex as value since it's unique across all size systems
  const sizeGroupOptions = React.useMemo<SelectOptionGroup[]>(() => {
    return Object.entries(sizeGroups).map(([groupName, sizes]) => ({
      label: groupName,
      options: sizes.map((size) => ({
        value: String(size.sortIndex),
        label: size.name,
      })),
    }));
  }, []);

  // Look up the selected reference size by sortIndex
  const referenceSize = React.useMemo(() => {
    if (!referenceSortIndex) return null;
    const sortIndex = Number(referenceSortIndex);
    for (const sizes of Object.values(sizeGroups)) {
      const found = sizes.find((s) => s.sortIndex === sortIndex);
      if (found) return found;
    }
    return null;
  }, [referenceSortIndex]);

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setSizeName(initialSizeName);
      setReferenceSortIndex(null);
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

  const handleSave = async () => {
    if (!sizeName.trim() || !referenceSize) return;

    // Validate name
    if (!validateName(sizeName)) {
      document.getElementById("size-name")?.focus();
      return;
    }

    // Calculate sortIndex for custom size based on reference
    const sortIndex = calculateCustomSortIndex(referenceSize.sortIndex);

    try {
      const result = await toast.loading(
        "Creating size...",
        createSizeMutation.mutateAsync({
          name: sizeName.trim(),
          sort_index: sortIndex,
        }),
        {
          delay: 500,
          successMessage: `Size "${sizeName.trim()}" created`,
        },
      );

      const createdSize = result?.data;
      if (!createdSize?.id) {
        throw new Error("No valid response returned from API");
      }

      // Optimistically update the cache immediately
      queryClient.setQueryData(
        trpc.composite.brandCatalogContent.queryKey(),
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
                  sort_index: createdSize.sort_index,
                },
              ],
            },
          };
        },
      );

      // Invalidate to trigger background refetch
      queryClient.invalidateQueries({
        queryKey: trpc.composite.brandCatalogContent.queryKey(),
      });

      // Call parent callback with created size
      onSave({
        id: createdSize.id,
        name: createdSize.name,
        sortIndex: createdSize.sort_index,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create size:", error);
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
        <div className="px-6 py-4 min-h-[160px] flex items-center">
          <div className="flex gap-4 w-full">
            {/* Size name input (required) */}
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="size-name">Size name <span className="text-destructive">*</span></Label>
              <Input
                id="size-name"
                value={sizeName}
                onChange={(e) => setSizeName(e.target.value)}
                placeholder="Enter size"
              />
            </div>

            {/* Reference size selector (required) */}
            <div className="flex-1 space-y-1.5">
              <Label>Equivalent to <span className="text-destructive">*</span></Label>
              <Select
                groups={sizeGroupOptions}
                value={referenceSortIndex}
                onValueChange={setReferenceSortIndex}
                placeholder="Select reference..."
                searchable
                searchPlaceholder="Search sizes..."
                emptyText="No sizes found."
                inline
              />
              <p className="type-small text-tertiary">
                Equivalents map to standards for better search and organization
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!sizeName.trim() || !referenceSortIndex || isCreating}>
            {isCreating ? "Creating..." : "Create size"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

