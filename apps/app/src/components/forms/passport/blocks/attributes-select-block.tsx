"use client";

/**
 * AttributesSelectBlock
 *
 * Block component for creating a new variant by selecting one value
 * per attribute dimension. Used only in create mode.
 */

import { CreateValueModal } from "@/components/forms/passport/blocks/variant-block/create-value-modal";
import { useAttributes } from "@/hooks/use-attributes";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@v1/ui/label";
import { Select, type SelectOption } from "@v1/ui/select";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

interface AttributeDimension {
    attributeId: string;
    attributeName: string;
    taxonomyAttributeId: string | null;
}

interface AttributesSelectBlockProps {
    /** Extracted dimensions from existing variants */
    dimensions: AttributeDimension[];
    /** Existing variant attribute combinations (sorted pipe-separated value IDs) */
    existingCombinations: Set<string>;
    /** Selected value IDs (one per dimension, keyed by attributeId) */
    selectedValues: Record<string, string>;
    /** Called when selection changes */
    onSelectionChange: (selections: Record<string, string>) => void;
    /** Whether the current selection is a duplicate */
    isDuplicate: boolean;
}

function DimensionSelect({
    dimension,
    selectedValueId,
    onValueChange,
}: {
    dimension: AttributeDimension;
    selectedValueId: string | undefined;
    onValueChange: (valueId: string | null) => void;
}) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    // Use the shared hook for deduplicated attribute value options
    const {
        options: availableOptions,
        hasTaxonomy,
        brandValues,
    } = useAttributes({
        brandAttributeId: dimension.attributeId,
        taxonomyAttributeId: dimension.taxonomyAttributeId,
    });

    const [createValueModalOpen, setCreateValueModalOpen] = React.useState(false);
    const [createValueInitialName, setCreateValueInitialName] = React.useState("");
    const [createValueInitialTaxonomyId, setCreateValueInitialTaxonomyId] =
        React.useState<string | null>(null);
    const [isCreatingValue, setIsCreatingValue] = React.useState(false);

    // Mutation for creating attribute values without modal (custom attributes)
    const createValueMutation = useMutation(
        trpc.catalog.attributeValues.create.mutationOptions(),
    );

    // Convert to Select options format with color swatch icons
    const selectOptions: SelectOption[] = React.useMemo(() => {
        return availableOptions.map((opt) => ({
            value: opt.id,
            label: opt.name,
            icon: opt.hex ? (
                <div
                    className="h-3.5 w-3.5 rounded-full border border-border"
                    style={{ backgroundColor: opt.hex }}
                />
            ) : undefined,
        }));
    }, [availableOptions]);

    // Create a custom value directly (no modal needed when no taxonomy)
    const createValueDirectly = async (valueName: string) => {
        if (!dimension.attributeId || isCreatingValue) return;

        // Check for duplicates
        const isDuplicate = brandValues.some(
            (v) => v.name.toLowerCase() === valueName.toLowerCase(),
        );
        if (isDuplicate) {
            toast.error("A value with this name already exists");
            return;
        }

        setIsCreatingValue(true);
        try {
            const result = await createValueMutation.mutateAsync({
                attribute_id: dimension.attributeId,
                name: valueName,
                taxonomy_value_id: null,
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
                                    attributeId: dimension.attributeId,
                                    name: valueName,
                                    taxonomyValueId: null,
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

            // Select the newly created value
            onValueChange(createdValue.id);
            toast.success(`Created "${valueName}"`);
        } catch (error) {
            console.error("Failed to create value:", error);
            toast.error("Failed to create value");
        } finally {
            setIsCreatingValue(false);
        }
    };

    const handleCreateNew = (searchTerm: string) => {
        // If attribute has no taxonomy, create the value directly (no modal needed)
        if (!hasTaxonomy) {
            createValueDirectly(searchTerm);
            return;
        }

        // Otherwise, open modal so user can link to a standard taxonomy value
        setCreateValueInitialName(searchTerm);
        setCreateValueInitialTaxonomyId(null);
        setCreateValueModalOpen(true);
    };

    const handleValueCreated = (created: {
        id: string;
        name: string;
        taxonomyValueId: string | null;
    }) => {
        // Select the newly created value
        onValueChange(created.id);
    };

    return (
        <div className="space-y-1.5">
            <Label>{dimension.attributeName}</Label>
            <Select
                value={selectedValueId ?? null}
                onValueChange={onValueChange}
                options={selectOptions}
                placeholder={`Select ${dimension.attributeName.toLowerCase()}`}
                searchable
                searchPlaceholder={`Search ${dimension.attributeName.toLowerCase()}...`}
                emptyText="No values found"
                hasCreateOption
                onCreateNew={handleCreateNew}
                createLabel="Create"
            />

            {/* Create value modal (only for taxonomy-linked attributes) */}
            {dimension.attributeId && hasTaxonomy && (
                <CreateValueModal
                    open={createValueModalOpen}
                    onOpenChange={setCreateValueModalOpen}
                    attributeId={dimension.attributeId}
                    attributeName={dimension.attributeName}
                    taxonomyAttributeId={dimension.taxonomyAttributeId}
                    initialName={createValueInitialName}
                    initialTaxonomyValueId={createValueInitialTaxonomyId}
                    onCreated={handleValueCreated}
                />
            )}
        </div>
    );
}

export function AttributesSelectBlock({
    dimensions,
    existingCombinations,
    selectedValues,
    onSelectionChange,
    isDuplicate,
}: AttributesSelectBlockProps) {
    const handleValueChange = (attributeId: string, valueId: string | null) => {
        const newSelections = { ...selectedValues };
        if (valueId) {
            newSelections[attributeId] = valueId;
        } else {
            delete newSelections[attributeId];
        }
        onSelectionChange(newSelections);
    };

    // Check if all dimensions have been selected
    const allSelected = dimensions.every(
        (dim) => selectedValues[dim.attributeId]
    );

    if (dimensions.length === 0) {
        return (
            <div className="border border-border bg-background">
                <div className="p-4 flex flex-col gap-3">
                    <p className="type-p !font-medium text-primary">Attributes</p>
                    <p className="type-small text-secondary">
                        This product has no variant attributes defined. Please add variant
                        dimensions from the product edit page first.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="border border-border bg-background">
            <div className="p-4 flex flex-col gap-3">
                <p className="type-p !font-medium text-primary">Attributes</p>

                {dimensions.map((dimension) => (
                    <DimensionSelect
                        key={dimension.attributeId}
                        dimension={dimension}
                        selectedValueId={selectedValues[dimension.attributeId]}
                        onValueChange={(valueId) =>
                            handleValueChange(dimension.attributeId, valueId)
                        }
                    />
                ))}

                {/* Duplicate warning */}
                {isDuplicate && allSelected && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 flex gap-2">
                        <span className="text-destructive type-small">
                            A variant with this attribute combination already exists.
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Extracts dimensions from product variants for the attributes select block.
 * Groups attributes by attribute_id to get unique dimensions.
 */
export function extractDimensionsFromVariants(
    variants: Array<{
        attributes: Array<{
            attribute_id: string;
            attribute_name: string;
            taxonomy_attribute_id: string | null;
        }>;
    }>
): AttributeDimension[] {
    if (!variants || variants.length === 0) {
        return [];
    }

    // Group by attribute_id - we just need the dimension info, not the values
    const dimensionMap = new Map<
        string,
        {
            attributeName: string;
            taxonomyAttributeId: string | null;
        }
    >();

    // Use a consistent order based on the first variant's attribute order
    const orderedAttributeIds: string[] = [];

    for (const variant of variants) {
        for (const attr of variant.attributes) {
            if (!dimensionMap.has(attr.attribute_id)) {
                dimensionMap.set(attr.attribute_id, {
                    attributeName: attr.attribute_name,
                    taxonomyAttributeId: attr.taxonomy_attribute_id,
                });
                orderedAttributeIds.push(attr.attribute_id);
            }
        }
    }

    // Return dimensions in order
    return orderedAttributeIds.map((attrId) => {
        const data = dimensionMap.get(attrId)!;
        return {
            attributeId: attrId,
            attributeName: data.attributeName,
            taxonomyAttributeId: data.taxonomyAttributeId,
        };
    });
}

/**
 * Builds a set of existing variant combinations as sorted pipe-separated value IDs.
 */
export function buildExistingCombinations(
    variants: Array<{
        attributes: Array<{
            value_id: string;
        }>;
    }>
): Set<string> {
    const combinations = new Set<string>();

    for (const variant of variants) {
        if (variant.attributes && variant.attributes.length > 0) {
            // Sort value IDs to ensure consistent comparison
            const sortedIds = variant.attributes
                .map((a) => a.value_id)
                .sort()
                .join("|");
            combinations.add(sortedIds);
        }
    }

    return combinations;
}

/**
 * Checks if a selection is a duplicate of an existing combination.
 */
export function isSelectionDuplicate(
    selections: Record<string, string>,
    existingCombinations: Set<string>
): boolean {
    const values = Object.values(selections);
    if (values.length === 0) return false;

    const sortedKey = values.sort().join("|");
    return existingCombinations.has(sortedKey);
}
