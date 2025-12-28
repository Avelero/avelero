"use client";

import { type TaxonomyValue, useBrandCatalog } from "@/hooks/use-brand-catalog";
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
import { Select, type SelectOption } from "@v1/ui/select";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

interface CreateValueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The attribute this value belongs to */
  attributeId: string;
  attributeName: string;
  /** If the attribute is linked to taxonomy, pass the taxonomy attribute ID */
  taxonomyAttributeId: string | null;
  /** Initial value name (from what user typed in search) */
  initialName?: string;
  /** Pre-selected taxonomy value ID (when selecting an uncovered taxonomy value) */
  initialTaxonomyValueId?: string | null;
  /** Callback when value is successfully created */
  onCreated: (value: {
    id: string;
    name: string;
    taxonomyValueId: string | null;
  }) => void;
}

export function CreateValueModal({
  open,
  onOpenChange,
  attributeId,
  attributeName,
  taxonomyAttributeId,
  initialName,
  initialTaxonomyValueId,
  onCreated,
}: CreateValueModalProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { taxonomyValuesByAttribute, brandAttributeValuesByAttribute } =
    useBrandCatalog();

  const [name, setName] = React.useState("");
  const [selectedTaxonomyValueId, setSelectedTaxonomyValueId] = React.useState<
    string | null
  >(null);
  const [nameError, setNameError] = React.useState("");

  // Get taxonomy values for this attribute (if linked to taxonomy)
  const taxonomyValues = taxonomyAttributeId
    ? taxonomyValuesByAttribute.get(taxonomyAttributeId) ?? []
    : [];

  // Get existing brand values for duplicate checking
  const existingBrandValues =
    brandAttributeValuesByAttribute.get(attributeId) ?? [];

  // Get hex color from taxonomy value metadata
  const getHex = (value: TaxonomyValue) => {
    if (value.metadata && typeof value.metadata === "object") {
      const m = value.metadata as Record<string, unknown>;
      if (typeof m.swatch === "string") return m.swatch;
      if (typeof m.hex === "string")
        return m.hex.startsWith("#") ? m.hex : `#${m.hex}`;
    }
    return null;
  };

  // Build select options for taxonomy values
  const taxonomySelectOptions: SelectOption[] = React.useMemo(() => {
    return taxonomyValues.map((v) => {
      const hex = getHex(v);
      return {
        value: v.id,
        label: v.name,
        icon: hex ? (
          <div
            className="h-3.5 w-3.5 rounded-full border border-border"
            style={{ backgroundColor: hex }}
          />
        ) : undefined,
      };
    });
  }, [taxonomyValues]);

  // API mutation for creating attribute value
  const createValueMutation = useMutation(
    trpc.catalog.attributeValues.create.mutationOptions(),
  );

  // Prefill name and taxonomy value when modal opens
  React.useEffect(() => {
    if (open) {
      setName(initialName ?? "");
      setSelectedTaxonomyValueId(initialTaxonomyValueId ?? null);
      setNameError("");
    }
  }, [open, initialName, initialTaxonomyValueId]);

  // Validate name - only check against EXISTING brand values in the database
  const validateName = (value: string): boolean => {
    const trimmedName = value.trim();

    if (!trimmedName) {
      setNameError("Value name is required");
      return false;
    }

    // Only check against existing brand values that are already in the database
    const isDuplicate = existingBrandValues.some(
      (v) => v.name.toLowerCase() === trimmedName.toLowerCase(),
    );

    if (isDuplicate) {
      setNameError("A value with this name already exists");
      return false;
    }

    setNameError("");
    return true;
  };

  const handleSave = async () => {
    const isNameValid = validateName(name);
    if (!isNameValid) {
      document.getElementById("value-name")?.focus();
      return;
    }

    // Taxonomy value is required when taxonomy-linked
    if (taxonomyAttributeId && !selectedTaxonomyValueId) {
      return;
    }

    await toast
      .loading(
        "Creating value...",
        (async () => {
          const result = await createValueMutation.mutateAsync({
            attribute_id: attributeId,
            name: name.trim(),
            taxonomy_value_id: selectedTaxonomyValueId,
          });

          const createdValue = result?.data;
          if (!createdValue?.id) {
            throw new Error("No valid response returned from API");
          }

          // Optimistically update the cache
          queryClient.setQueryData(
            trpc.composite.catalogContent.queryKey(),
            (old: any) => {
              if (!old) return old;
              return {
                ...old,
                brandCatalog: {
                  ...old.brandCatalog,
                  attributeValues: [
                    ...old.brandCatalog.attributeValues,
                    {
                      id: createdValue.id,
                      attributeId,
                      name: name.trim(),
                      taxonomyValueId: selectedTaxonomyValueId,
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

          // Close modal
          onOpenChange(false);

          // Notify parent
          onCreated({
            id: createdValue.id,
            name: name.trim(),
            taxonomyValueId: selectedTaxonomyValueId,
          });

          return result;
        })(),
        {
          delay: 500,
          successMessage: "Value created successfully",
          errorMessage: "Failed to create value",
        },
      )
      .catch((error) => {
        console.error("Failed to create value:", error);
      });
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setSelectedTaxonomyValueId(null);
      setNameError("");
    }
    onOpenChange(newOpen);
  };

  const isCreating = createValueMutation.isPending;
  const hasTaxonomyOptions = taxonomyValues.length > 0;

  // Determine if we can create
  const canCreate =
    name.trim() && (!taxonomyAttributeId || selectedTaxonomyValueId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[520px] p-0 gap-0 border border-border overflow-visible">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="text-foreground">
            Add {attributeName.toLowerCase()} value
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 min-h-[120px] space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Left side: Taxonomy value selector (required for taxonomy-linked) */}
            {hasTaxonomyOptions && (
              <div className="space-y-1.5">
                <Label>
                  Link to standard value{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedTaxonomyValueId}
                  onValueChange={setSelectedTaxonomyValueId}
                  options={taxonomySelectOptions}
                  placeholder="Select standard value"
                  searchable
                  searchPlaceholder="Search..."
                  emptyText="No values found"
                  inline
                />
              </div>
            )}

            {/* Right side: Value name input */}
            <div className="space-y-1.5">
              <Label htmlFor="value-name">
                Value name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="value-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) validateName(e.target.value);
                }}
                onBlur={() => validateName(name)}
                placeholder="Enter value name"
                maxLength={100}
                aria-required="true"
                required
              />
              {nameError && (
                <p className="type-small text-destructive">{nameError}</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-background">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canCreate || isCreating}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
