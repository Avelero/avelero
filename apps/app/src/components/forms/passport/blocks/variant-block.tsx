"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import {
    DndContext,
    type DragEndEvent,
    DragOverlay,
    type DragStartEvent,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@v1/ui/button";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@v1/ui/command";
import { Icons } from "@v1/ui/icons";
import { Label } from "@v1/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Select, type SelectOptionGroup } from "@v1/ui/select";
import Link from "next/link";
import * as React from "react";
import { createPortal } from "react-dom";
import { AttributeSelect } from "@/components/select/attribute-select";
import { VariantTable } from "@/components/tables/variants/variants";

// ============================================================================
// Types
// ============================================================================

export interface VariantDimension {
    id: string; // local id for dnd

    // For existing catalog attributes:
    attributeId: string | null; // null if selecting attribute for first time or custom inline
    attributeName: string;
    taxonomyAttributeId: string | null;
    /**
     * Array of brand attribute value IDs (for both taxonomy-linked and custom attributes).
     * The UI uses these IDs to look up display names and hex colors.
     */
    values: string[];

    // For custom inline (not yet saved to catalog):
    isCustomInline?: boolean;
    customAttributeName?: string;
    customValues?: string[]; // raw string values, created on passport save
}

export interface VariantMetadata {
    sku?: string;
    barcode?: string;
}

export interface ExplicitVariant {
    sku: string;
    barcode: string;
}

// ============================================================================
// Sortable Wrapper
// ============================================================================

interface SortableAttributeRowProps {
    dimension: VariantDimension;
    onChange: (updated: VariantDimension) => void;
    onDelete: () => void;
    isExpanded: boolean;
    setExpanded: (expanded: boolean) => void;
}

function SortableAttributeRow({
    dimension,
    onChange,
    onDelete,
    isExpanded,
    setExpanded,
}: SortableAttributeRowProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: dimension.id,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <AttributeSelect
                dimension={dimension}
                onChange={onChange}
                onDelete={onDelete}
                isExpanded={isExpanded}
                setExpanded={setExpanded}
                dragHandleProps={{ ...attributes, ...listeners }}
            />
        </div>
    );
}

// ============================================================================
// Main Component
// ============================================================================

interface VariantSectionProps {
    dimensions: VariantDimension[];
    setDimensions: React.Dispatch<React.SetStateAction<VariantDimension[]>>;
    variantMetadata: Record<string, VariantMetadata>;
    setVariantMetadata: React.Dispatch<
        React.SetStateAction<Record<string, VariantMetadata>>
    >;
    explicitVariants?: ExplicitVariant[];
    setExplicitVariants?: React.Dispatch<React.SetStateAction<ExplicitVariant[]>>;
    /** Set of pipe-separated value ID keys that are enabled */
    enabledVariantKeys: Set<string>;
    /** Setter for updating enabled variant keys */
    setEnabledVariantKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
    /** Whether in edit mode (variants are clickable and navigate to variant edit page) */
    isEditMode?: boolean;
    /** Product handle for building variant edit URLs */
    productHandle?: string;
    /** Saved variants with UPIDs and override status, keyed by the value id key (e.g., "valueId1|valueId2") */
    savedVariants?: Map<string, { upid: string; hasOverrides: boolean }>;
    /**
     * Whether this is a new product (no saved variants yet).
     * Used to determine matrix vs reality-based variant display and dimension change behavior.
     */
    isNewProduct?: boolean;
    /**
     * Optional callback for navigation. If provided, will be called instead of direct router.push.
     * This allows the parent to intercept navigation and show unsaved changes modal.
     */
    onNavigateToVariant?: (url: string) => void;
}

/**
 * Generates cartesian product of dimension values.
 * Returns array of pipe-separated keys.
 */
function generateAllCombinationKeys(dimensions: VariantDimension[]): string[] {
    // Get effective values for each dimension
    const effectiveDimensions = dimensions
        .map((dim) => {
            if (dim.isCustomInline) {
                return (dim.customValues ?? []).map((v) => v.trim()).filter(Boolean);
            }
            return dim.values ?? [];
        })
        .filter((vals) => vals.length > 0);

    if (effectiveDimensions.length === 0) return [];

    // Generate cartesian product
    const generateCombos = (dims: string[][]): string[][] => {
        if (dims.length === 0) return [[]];
        const [first, ...rest] = dims;
        const restCombos = generateCombos(rest);
        const result: string[][] = [];
        for (const value of first!) {
            for (const combo of restCombos) {
                result.push([value, ...combo]);
            }
        }
        return result;
    };

    return generateCombos(effectiveDimensions).map((combo) => combo.join("|"));
}

export function VariantSection({
    dimensions,
    setDimensions,
    variantMetadata,
    setVariantMetadata,
    explicitVariants,
    setExplicitVariants,
    enabledVariantKeys,
    setEnabledVariantKeys,
    isEditMode = false,
    productHandle,
    savedVariants,
    isNewProduct = false,
    onNavigateToVariant,
}: VariantSectionProps) {
    const { taxonomyAttributes, brandAttributes } = useBrandCatalog();
    const [activeId, setActiveId] = React.useState<string | null>(null);
    const [expandedId, setExpandedId] = React.useState<string | null>(null);
    const [addPopoverOpen, setAddPopoverOpen] = React.useState(false);
    const [addSearchTerm, setAddSearchTerm] = React.useState("");

    // Track collapsed variant mappings when dimensions are removed locally
    // This maps new collapsed keys to the original UPID/override info
    const [collapsedVariantMappings, setCollapsedVariantMappings] = React.useState<
        Map<string, { upid: string; hasOverrides: boolean }>
    >(new Map());

    // Effective saved variants = original savedVariants + locally collapsed mappings
    const effectiveSavedVariants = React.useMemo(() => {
        const effective = new Map<string, { upid: string; hasOverrides: boolean }>();
        // Add original saved variants
        if (savedVariants) {
            for (const [key, value] of savedVariants) {
                effective.set(key, value);
            }
        }
        // Add collapsed mappings (these override if key collision, which shouldn't happen)
        for (const [key, value] of collapsedVariantMappings) {
            if (!effective.has(key)) {
                effective.set(key, value);
            }
        }
        return effective;
    }, [savedVariants, collapsedVariantMappings]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    );

    // Collect existing attribute IDs for filtering
    const existingAttributeIds = dimensions
        .map((d) => d.attributeId)
        .filter((id): id is string => id !== null);

    // Build attribute lookup map for resolving selections
    const attributeLookup = React.useMemo(() => {
        const map = new Map<
            string,
            { id: string; name: string; taxonomyId: string | null }
        >();

        // Custom brand attributes (no taxonomy link)
        for (const attr of brandAttributes) {
            if (!attr.taxonomyAttributeId) {
                map.set(attr.id, { id: attr.id, name: attr.name, taxonomyId: null });
            }
        }

        // Taxonomy attributes
        for (const attr of taxonomyAttributes) {
            const brandAttr = brandAttributes.find(
                (a) => a.taxonomyAttributeId === attr.id,
            );
            const attrId = brandAttr?.id ?? `tax:${attr.id}`;
            map.set(attrId, { id: attrId, name: attr.name, taxonomyId: attr.id });
        }

        return map;
    }, [taxonomyAttributes, brandAttributes]);

    // Build select groups for empty state Select
    const selectGroups = React.useMemo((): SelectOptionGroup[] => {
        const groups: SelectOptionGroup[] = [];

        // Custom attributes first
        const customOptions = brandAttributes
            .filter(
                (attr) =>
                    !attr.taxonomyAttributeId && !existingAttributeIds.includes(attr.id),
            )
            .map((attr) => ({ value: attr.id, label: attr.name }));

        if (customOptions.length > 0) {
            groups.push({ label: "Custom", options: customOptions });
        }

        // Standard taxonomy attributes
        const standardOptions = taxonomyAttributes
            .filter((attr) => {
                const brandAttr = brandAttributes.find(
                    (a) => a.taxonomyAttributeId === attr.id,
                );
                const attrId = brandAttr?.id ?? `tax:${attr.id}`;
                return !existingAttributeIds.includes(attrId);
            })
            .map((attr) => {
                const brandAttr = brandAttributes.find(
                    (a) => a.taxonomyAttributeId === attr.id,
                );
                return { value: brandAttr?.id ?? `tax:${attr.id}`, label: attr.name };
            });

        if (standardOptions.length > 0) {
            groups.push({
                label: customOptions.length > 0 ? "Standard" : "",
                options: standardOptions,
            });
        }

        return groups;
    }, [taxonomyAttributes, brandAttributes, existingAttributeIds]);

    // Filter for add popover
    const filteredCustomAttrs = React.useMemo(() => {
        return brandAttributes
            .filter(
                (attr) =>
                    !attr.taxonomyAttributeId && !existingAttributeIds.includes(attr.id),
            )
            .filter(
                (attr) =>
                    !addSearchTerm ||
                    attr.name.toLowerCase().includes(addSearchTerm.toLowerCase()),
            );
    }, [brandAttributes, existingAttributeIds, addSearchTerm]);

    const filteredTaxonomyAttrs = React.useMemo(() => {
        return taxonomyAttributes
            .filter((attr) => {
                const brandAttr = brandAttributes.find(
                    (a) => a.taxonomyAttributeId === attr.id,
                );
                const attrId = brandAttr?.id ?? `tax:${attr.id}`;
                return !existingAttributeIds.includes(attrId);
            })
            .filter(
                (attr) =>
                    !addSearchTerm ||
                    attr.name.toLowerCase().includes(addSearchTerm.toLowerCase()),
            );
    }, [
        taxonomyAttributes,
        brandAttributes,
        existingAttributeIds,
        addSearchTerm,
    ]);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over || active.id === over.id) return;

        const oldIndex = dimensions.findIndex((d) => d.id === active.id);
        const newIndex = dimensions.findIndex((d) => d.id === over.id);

        if (oldIndex === -1 || newIndex === -1) return;

        // Reorder dimensions
        const next = [...dimensions];
        const [removed] = next.splice(oldIndex, 1);
        if (removed) {
            next.splice(newIndex, 0, removed);
        }

        // Build old-to-new index mapping for dimensions WITH values
        // We need to map positions in the key (which only includes dimensions with values)
        const oldDimsWithValues = dimensions
            .map((d, i) => ({ dim: d, originalIndex: i }))
            .filter((item) => {
                const d = item.dim;
                return d.values.length > 0 ||
                    (d.isCustomInline && (d.customValues ?? []).some((v) => v.trim().length > 0));
            });

        const newDimsWithValues = next
            .map((d, i) => ({ dim: d, originalIndex: i }))
            .filter((item) => {
                const d = item.dim;
                return d.values.length > 0 ||
                    (d.isCustomInline && (d.customValues ?? []).some((v) => v.trim().length > 0));
            });

        // Create a mapping from old key position to new key position
        // Keys are structured as: value0|value1|value2 where position corresponds to dimension order
        const remapKey = (oldKey: string): string => {
            const parts = oldKey.split("|");
            if (parts.length !== oldDimsWithValues.length) {
                // Key doesn't match current dimension structure, can't remap
                return oldKey;
            }

            // Build mapping: for each position in the new order, find where it was in the old order
            const newParts: string[] = [];
            for (const newItem of newDimsWithValues) {
                const oldPosition = oldDimsWithValues.findIndex(
                    (oldItem) => oldItem.dim.id === newItem.dim.id
                );
                if (oldPosition !== -1 && parts[oldPosition]) {
                    newParts.push(parts[oldPosition]!);
                }
            }

            return newParts.join("|");
        };

        // Remap all keys if there are dimensions with values
        if (oldDimsWithValues.length > 0) {
            // Remap enabledVariantKeys
            setEnabledVariantKeys((prev) => {
                const remapped = new Set<string>();
                for (const key of prev) {
                    remapped.add(remapKey(key));
                }
                return remapped;
            });

            // Remap variantMetadata
            setVariantMetadata((prev) => {
                const remapped: Record<string, { sku?: string; barcode?: string }> = {};
                for (const [key, value] of Object.entries(prev)) {
                    remapped[remapKey(key)] = value;
                }
                return remapped;
            });

            // Remap collapsedVariantMappings
            setCollapsedVariantMappings((prev) => {
                const remapped = new Map<string, { upid: string; hasOverrides: boolean }>();
                for (const [key, value] of prev) {
                    remapped.set(remapKey(key), value);
                }
                return remapped;
            });
        }

        setDimensions(next);
    };

    // Add a standard attribute from select
    const handleSelectAttribute = (attrId: string) => {
        const attrData = attributeLookup.get(attrId);
        if (!attrData) return;

        // Close popover first
        setAddPopoverOpen(false);
        setAddSearchTerm("");

        const newDim: VariantDimension = {
            id: `dim-${Date.now()}`,
            attributeId: attrData.id,
            attributeName: attrData.name,
            taxonomyAttributeId: attrData.taxonomyId,
            values: [],
        };

        // Add dimension (values will be empty, so no combinations to enable yet)
        setDimensions((prev) => [...prev, newDim]);
        setExpandedId(newDim.id);
    };

    // Add a custom inline attribute
    const handleAddCustomAttribute = () => {
        // Close popover first
        setAddPopoverOpen(false);
        setAddSearchTerm("");

        const newDim: VariantDimension = {
            id: `dim-${Date.now()}`,
            attributeId: null,
            attributeName: "",
            taxonomyAttributeId: null,
            values: [],
            isCustomInline: true,
            customAttributeName: "",
            customValues: [],
        };
        setDimensions((prev) => [...prev, newDim]);
        setExpandedId(newDim.id);
    };

    const handleUpdateDimension = (index: number, updated: VariantDimension) => {
        // Get old dimension info before update
        const oldDimensionCount = dimensions.filter((d) =>
            d.values.length > 0 ||
            (d.isCustomInline && (d.customValues ?? []).some((v) => v.trim().length > 0))
        ).length;
        const oldDimension = dimensions[index];
        const oldValues = oldDimension?.isCustomInline
            ? new Set(oldDimension.customValues ?? [])
            : new Set(oldDimension?.values ?? []);

        setDimensions((prev) => {
            const next = [...prev];
            next[index] = updated;
            return next;
        });

        // Calculate new dimension info
        const newDimensions = [...dimensions];
        newDimensions[index] = updated;
        const newDimensionCount = newDimensions.filter((d) =>
            d.values.length > 0 ||
            (d.isCustomInline && (d.customValues ?? []).some((v) => v.trim().length > 0))
        ).length;
        const newValues = updated.isCustomInline
            ? new Set(updated.customValues ?? [])
            : new Set(updated.values);
        const newKeys = generateAllCombinationKeys(newDimensions);
        const newKeysSet = new Set(newKeys);

        // Check if this is genuinely a new product (no saved variants)
        const isExistingProduct = savedVariants && savedVariants.size > 0;

        if (isNewProduct || !isExistingProduct) {
            // NEW PRODUCT: Matrix behavior - all combinations enabled
            setEnabledVariantKeys((prevEnabled) => {
                const nextEnabled = new Set<string>();
                if (oldDimensionCount !== newDimensionCount) {
                    // Dimension count changed, add all new keys
                    for (const key of newKeys) {
                        nextEnabled.add(key);
                    }
                } else {
                    // Same dimension count - preserve existing enabled states
                    for (const key of prevEnabled) {
                        if (newKeysSet.has(key)) {
                            nextEnabled.add(key);
                        }
                    }
                    // Add genuinely new keys
                    for (const key of newKeys) {
                        if (!prevEnabled.has(key)) {
                            nextEnabled.add(key);
                        }
                    }
                }
                return nextEnabled;
            });
            return;
        }

        // EXISTING PRODUCT: Shopify-like behavior with UPID preservation
        // Determine added and removed values
        const addedValues = [...newValues].filter((v) => !oldValues.has(v));
        const removedValues = [...oldValues].filter((v) => !newValues.has(v));

        // Handle dimension count change (new dimension added)
        if (newDimensionCount > oldDimensionCount && addedValues.length > 0) {
            // A new dimension was added with values
            // Use effectiveSavedVariants which includes collapsed mappings
            const currentSavedVariants = effectiveSavedVariants;

            // Get the first value of the new dimension - this will be assigned to existing variants
            const firstNewValue = addedValues[0];
            if (!firstNewValue) return; // Type guard - should never happen due to length check above
            const otherNewValues = addedValues.slice(1);

            // Calculate the correct insertion position for the key
            // Keys only include dimensions with values, so we need to find where this dimension
            // falls among the dimensions-with-values in the NEW structure
            const newDimsWithValues = newDimensions.filter((d) =>
                d.values.length > 0 ||
                (d.isCustomInline && (d.customValues ?? []).some((v) => v.trim().length > 0))
            );
            const keyInsertPosition = newDimsWithValues.findIndex((d) => d.id === updated.id);
            if (keyInsertPosition === -1) return; // Shouldn't happen but guard anyway

            // Build new enabled keys and update collapsed mappings
            const nextEnabled = new Set<string>();
            const nextExpandedMappings = new Map<string, { upid: string; hasOverrides: boolean }>();
            const nextMetadata: Record<string, { sku?: string; barcode?: string }> = {};

            // For each existing saved variant, expand it with the first new value (preserve UPID)
            for (const [originalKey, variantInfo] of currentSavedVariants) {
                const keyParts = originalKey.split("|");
                // Insert new value at the correct position (based on dimensions-with-values order)
                const expandedKeyParts = [...keyParts];
                expandedKeyParts.splice(keyInsertPosition, 0, firstNewValue!);
                const expandedKey = expandedKeyParts.join("|");

                if (newKeysSet.has(expandedKey)) {
                    nextEnabled.add(expandedKey);
                    // Preserve the UPID for the expanded key
                    nextExpandedMappings.set(expandedKey, {
                        upid: variantInfo.upid,
                        hasOverrides: variantInfo.hasOverrides,
                    });
                    // Preserve metadata
                    const originalMeta = variantMetadata[originalKey];
                    if (originalMeta) {
                        nextMetadata[expandedKey] = originalMeta;
                    }
                }

                // For the other new values, create genuinely new variants (no UPID mapping)
                for (const otherValue of otherNewValues) {
                    const newKeyParts = [...keyParts];
                    newKeyParts.splice(keyInsertPosition, 0, otherValue);
                    const newKey = newKeyParts.join("|");
                    if (newKeysSet.has(newKey)) {
                        nextEnabled.add(newKey);
                        // Don't add to mappings - these are genuinely new variants
                    }
                }
            }

            // Also handle currently enabled keys that might not be saved yet
            setEnabledVariantKeys((prevEnabled) => {
                for (const key of prevEnabled) {
                    // Skip if already a saved variant (handled above)
                    if (currentSavedVariants.has(key)) continue;

                    const keyParts = key.split("|");
                    for (const newValue of addedValues) {
                        const expandedKeyParts = [...keyParts];
                        expandedKeyParts.splice(keyInsertPosition, 0, newValue);
                        const expandedKey = expandedKeyParts.join("|");
                        if (newKeysSet.has(expandedKey)) {
                            nextEnabled.add(expandedKey);
                        }
                    }
                }
                return nextEnabled;
            });

            // Update collapsed variant mappings
            setCollapsedVariantMappings((prev) => {
                const merged = new Map(prev);
                for (const [key, value] of nextExpandedMappings) {
                    merged.set(key, value);
                }
                return merged;
            });

            // Update metadata
            setVariantMetadata((prev) => {
                const merged = { ...prev };
                for (const [key, meta] of Object.entries(nextMetadata)) {
                    if (meta && !merged[key]) {
                        merged[key] = meta;
                    }
                }
                return merged;
            });
        } else if (newDimensionCount < oldDimensionCount) {
            // Dimension count DECREASED - a dimension lost all its values
            // Collapse enabled keys similar to handleDeleteDimension

            setEnabledVariantKeys((prevEnabled) => {
                const nextEnabled = new Set<string>();
                const seenCollapsedKeys = new Set<string>();

                for (const key of prevEnabled) {
                    const keyParts = key.split("|");
                    // Check if key contains any removed values at this dimension's position
                    const containsRemovedValue = keyParts.some((part) => removedValues.includes(part));

                    if (containsRemovedValue) {
                        // Collapse the key by removing the value at the empty dimension's position
                        const collapsedParts = keyParts.filter((part) => !removedValues.includes(part));
                        const collapsedKey = collapsedParts.join("|");

                        // Only add if valid and not already seen (deduplicate collapsed keys)
                        if (newKeysSet.has(collapsedKey) && !seenCollapsedKeys.has(collapsedKey)) {
                            nextEnabled.add(collapsedKey);
                            seenCollapsedKeys.add(collapsedKey);
                        }
                    } else if (newKeysSet.has(key)) {
                        // Key doesn't contain removed values and is still valid
                        nextEnabled.add(key);
                    }
                }
                return nextEnabled;
            });

            // Also update collapsed variant mappings to preserve UPIDs
            if (savedVariants && savedVariants.size > 0) {
                const nextCollapsedMappings = new Map<string, { upid: string; hasOverrides: boolean }>();
                const seenCollapsedKeys = new Set<string>();

                for (const [originalKey, variantInfo] of savedVariants) {
                    const keyParts = originalKey.split("|");
                    const containsRemovedValue = keyParts.some((part) => removedValues.includes(part));

                    if (containsRemovedValue) {
                        const collapsedParts = keyParts.filter((part) => !removedValues.includes(part));
                        const collapsedKey = collapsedParts.join("|");

                        if (newKeysSet.has(collapsedKey) && !seenCollapsedKeys.has(collapsedKey)) {
                            nextCollapsedMappings.set(collapsedKey, variantInfo);
                            seenCollapsedKeys.add(collapsedKey);
                        }
                    }
                }

                if (nextCollapsedMappings.size > 0) {
                    setCollapsedVariantMappings((prev) => {
                        const merged = new Map(prev);
                        for (const [key, value] of nextCollapsedMappings) {
                            merged.set(key, value);
                        }
                        return merged;
                    });
                }
            }
        } else {
            // Same dimension count - handle value additions/removals
            setEnabledVariantKeys((prevEnabled) => {
                const nextEnabled = new Set<string>();

                // Start with existing enabled keys
                for (const key of prevEnabled) {
                    const keyParts = key.split("|");
                    // Check if key contains any removed values
                    const containsRemovedValue = keyParts.some((part) => removedValues.includes(part));
                    // Check if key is still valid in new structure
                    if (!containsRemovedValue && newKeysSet.has(key)) {
                        nextEnabled.add(key);
                    }
                }

                // For added values: expand existing variants like Shopify
                // Create new combinations by adding new values to existing variant patterns
                if (addedValues.length > 0 && newDimensionCount === oldDimensionCount) {
                    // Calculate the correct position for this dimension among dimensions-with-values
                    const dimsWithValues = newDimensions.filter((d) =>
                        d.values.length > 0 ||
                        (d.isCustomInline && (d.customValues ?? []).some((v) => v.trim().length > 0))
                    );
                    const keyPosition = dimsWithValues.findIndex((d) => d.id === updated.id);
                    if (keyPosition === -1) return nextEnabled; // Guard

                    // Get existing variant patterns without the current dimension
                    const existingPatterns = new Set<string>();
                    for (const key of prevEnabled) {
                        const keyParts = key.split("|");
                        // Remove the value at the current dimension's key position
                        const patternParts = keyParts.filter((_, i) => i !== keyPosition);
                        if (patternParts.length > 0) {
                            existingPatterns.add(patternParts.join("|"));
                        }
                    }

                    // For each existing pattern, create combinations with new values
                    for (const pattern of existingPatterns) {
                        const patternParts = pattern.split("|");
                        for (const newValue of addedValues) {
                            // Insert new value at the correct key position
                            const newKeyParts = [...patternParts];
                            newKeyParts.splice(keyPosition, 0, newValue);
                            const newKey = newKeyParts.join("|");
                            if (newKeysSet.has(newKey)) {
                                nextEnabled.add(newKey);
                            }
                        }
                    }
                }

                return nextEnabled;
            });
        }
    };

    const handleDeleteDimension = (index: number) => {
        const dim = dimensions[index];
        if (dim && expandedId === dim.id) {
            setExpandedId(null);
        }

        // Calculate new dimensions after deletion
        const newDimensions = dimensions.filter((_, i) => i !== index);
        const newKeys = generateAllCombinationKeys(newDimensions);
        const newKeysSet = new Set(newKeys);

        setDimensions(newDimensions);

        // Check if this is an existing product with saved variants
        const isExistingProduct = savedVariants && savedVariants.size > 0;

        if (isNewProduct || !isExistingProduct) {
            // NEW PRODUCT: Matrix behavior - all combinations enabled
            setEnabledVariantKeys(new Set(newKeys));
            return;
        }

        // EXISTING PRODUCT: Preserve variants by collapsing and deduplicating
        // Group saved variants by their collapsed key (after removing the dimension)
        const collapsedGroups = new Map<string, Array<{
            originalKey: string;
            upid: string;
            hasOverrides: boolean;
        }>>();

        for (const [originalKey, variantInfo] of savedVariants) {
            const keyParts = originalKey.split("|");
            // Remove the value at the deleted dimension's position
            const collapsedParts = keyParts.filter((_, i) => i !== index);
            const collapsedKey = collapsedParts.join("|");

            if (!newKeysSet.has(collapsedKey)) continue;

            if (!collapsedGroups.has(collapsedKey)) {
                collapsedGroups.set(collapsedKey, []);
            }
            collapsedGroups.get(collapsedKey)!.push({
                originalKey,
                upid: variantInfo.upid,
                hasOverrides: variantInfo.hasOverrides,
            });
        }

        // For each collapsed group, keep the first variant (preferring those with overrides)
        // and update enabled keys
        const nextEnabled = new Set<string>();
        const nextMetadata: Record<string, { sku?: string; barcode?: string }> = {};
        const nextCollapsedMappings = new Map<string, { upid: string; hasOverrides: boolean }>();

        for (const [collapsedKey, variants] of collapsedGroups) {
            // Sort: variants with overrides first, then by original position
            variants.sort((a, b) => {
                if (a.hasOverrides && !b.hasOverrides) return -1;
                if (!a.hasOverrides && b.hasOverrides) return 1;
                return 0;
            });

            // Keep the first variant
            const keptVariant = variants[0];
            if (keptVariant) {
                nextEnabled.add(collapsedKey);
                // Preserve metadata from the original key
                const originalMeta = variantMetadata[keptVariant.originalKey];
                if (originalMeta) {
                    nextMetadata[collapsedKey] = originalMeta;
                }
                // Store the collapsed mapping so variants aren't marked as "new"
                nextCollapsedMappings.set(collapsedKey, {
                    upid: keptVariant.upid,
                    hasOverrides: keptVariant.hasOverrides,
                });
            }
        }

        // Also handle local (unsaved) variants that were enabled
        setEnabledVariantKeys((prevEnabled) => {
            for (const key of prevEnabled) {
                // Skip if this was a saved variant (already processed above)
                if (savedVariants.has(key)) continue;

                const keyParts = key.split("|");
                const collapsedParts = keyParts.filter((_, i) => i !== index);
                const collapsedKey = collapsedParts.join("|");

                // Only add if not already added from saved variants and is valid
                if (newKeysSet.has(collapsedKey) && !nextEnabled.has(collapsedKey)) {
                    nextEnabled.add(collapsedKey);
                    // Preserve metadata
                    const originalMeta = variantMetadata[key];
                    if (originalMeta) {
                        nextMetadata[collapsedKey] = originalMeta;
                    }
                }
            }
            return nextEnabled;
        });

        // Update variant metadata with collapsed keys
        setVariantMetadata((prev) => {
            const merged = { ...prev };
            // Add the new collapsed metadata entries
            for (const [key, meta] of Object.entries(nextMetadata)) {
                if (meta && !merged[key]) {
                    merged[key] = meta;
                }
            }
            return merged;
        });

        // Update collapsed variant mappings for proper "new" badge display
        setCollapsedVariantMappings((prev) => {
            const merged = new Map(prev);
            for (const [key, value] of nextCollapsedMappings) {
                merged.set(key, value);
            }
            return merged;
        });
    };

    const activeDimension = activeId
        ? dimensions.find((d) => d.id === activeId)
        : null;

    const hasVariants =
        dimensions.some(
            (d) =>
                d.values.length > 0 ||
                (d.isCustomInline &&
                    (d.customValues ?? []).some((v) => v.trim().length > 0)),
        ) ||
        (explicitVariants && explicitVariants.length > 0);

    const hasDimensions = dimensions.length > 0;

    return (
        <div className="border border-border bg-background">
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <p className="type-p !font-medium text-primary">Variants</p>
                {/* Add variant button - only in edit mode and when there's at least one saved variant with attributes */}
                {isEditMode && productHandle && savedVariants && savedVariants.size > 0 && (
                    <Button variant="outline" size="sm" asChild>
                        <Link href={`/passports/edit/${productHandle}/variant/new`}>
                            <Icons.Plus className="h-4 w-4" />
                            <span className="px-1">Add variant</span>
                        </Link>
                    </Button>
                )}
            </div>
            <div className="px-4 pb-4 flex flex-col gap-3">
                {hasDimensions ? (
                    // Has dimensions: show rows + add button
                    <div className="border border-border divide-y divide-border">
                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <SortableContext
                                items={dimensions.map((d) => d.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {dimensions.map((dim, idx) => (
                                    <SortableAttributeRow
                                        key={dim.id}
                                        dimension={dim}
                                        onChange={(updated) => handleUpdateDimension(idx, updated)}
                                        onDelete={() => handleDeleteDimension(idx)}
                                        isExpanded={expandedId === dim.id}
                                        setExpanded={(expanded) =>
                                            setExpandedId(expanded ? dim.id : null)
                                        }
                                    />
                                ))}
                            </SortableContext>

                            {typeof document !== "undefined" &&
                                createPortal(
                                    <DragOverlay>
                                        {activeDimension && (
                                            <div className="border border-border bg-background shadow-lg p-4">
                                                <p className="type-p !font-medium text-primary">
                                                    {activeDimension.isCustomInline
                                                        ? activeDimension.customAttributeName ||
                                                        "Custom attribute"
                                                        : activeDimension.attributeName || "New attribute"}
                                                </p>
                                            </div>
                                        )}
                                    </DragOverlay>,
                                    document.body,
                                )}
                        </DndContext>

                        {/* Add attribute button with popover - only when less than 3 */}
                        {dimensions.length < 3 && (
                            <Popover open={addPopoverOpen} onOpenChange={setAddPopoverOpen}>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        className="w-full flex items-center gap-1.5 px-4 py-3 text-left hover:bg-accent transition-colors"
                                    >
                                        <Icons.Plus className="h-4 w-4 text-tertiary" />
                                        <span className="px-1 type-p text-secondary">
                                            Add attribute
                                        </span>
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-0" align="start">
                                    <Command shouldFilter={false}>
                                        <CommandInput
                                            placeholder="Search attributes..."
                                            value={addSearchTerm}
                                            onValueChange={setAddSearchTerm}
                                        />
                                        <CommandList className="max-h-48">
                                            {/* Custom attributes first */}
                                            {filteredCustomAttrs.length > 0 && (
                                                <CommandGroup heading="Custom">
                                                    {filteredCustomAttrs.map((attr) => (
                                                        <CommandItem
                                                            key={attr.id}
                                                            onMouseDown={(e) => e.preventDefault()}
                                                            onSelect={() => handleSelectAttribute(attr.id)}
                                                        >
                                                            <span className="type-p text-primary">
                                                                {attr.name}
                                                            </span>
                                                        </CommandItem>
                                                    ))}
                                                </CommandGroup>
                                            )}

                                            {/* Standard taxonomy attributes */}
                                            {filteredTaxonomyAttrs.length > 0 && (
                                                <CommandGroup
                                                    heading={
                                                        filteredCustomAttrs.length > 0
                                                            ? "Standard"
                                                            : undefined
                                                    }
                                                >
                                                    {filteredTaxonomyAttrs.map((attr) => {
                                                        const brandAttr = brandAttributes.find(
                                                            (a) => a.taxonomyAttributeId === attr.id,
                                                        );
                                                        return (
                                                            <CommandItem
                                                                key={attr.id}
                                                                onMouseDown={(e) => e.preventDefault()}
                                                                onSelect={() =>
                                                                    handleSelectAttribute(
                                                                        brandAttr?.id ?? `tax:${attr.id}`,
                                                                    )
                                                                }
                                                            >
                                                                <span className="type-p text-primary">
                                                                    {attr.name}
                                                                </span>
                                                            </CommandItem>
                                                        );
                                                    })}
                                                </CommandGroup>
                                            )}

                                            {filteredTaxonomyAttrs.length === 0 &&
                                                filteredCustomAttrs.length === 0 && (
                                                    <CommandEmpty>No attributes found</CommandEmpty>
                                                )}
                                        </CommandList>

                                        {/* Add custom button - always visible at bottom */}
                                        <div className="border-t border-border">
                                            <button
                                                type="button"
                                                onMouseDown={(e) => e.preventDefault()}
                                                onClick={handleAddCustomAttribute}
                                                className="flex w-full items-center px-3 py-2 text-left type-p text-foreground hover:bg-accent transition-colors"
                                            >
                                                <Icons.Plus className="h-4 w-4" />
                                                <span className="px-1">Add custom attribute</span>
                                            </button>
                                        </div>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                ) : (
                    // Empty state: show simple attribute select with label
                    <div className="space-y-1.5">
                        <Label>Attribute</Label>
                        <Select
                            value={null}
                            onValueChange={handleSelectAttribute}
                            groups={selectGroups}
                            placeholder="Select attribute"
                            searchable
                            searchPlaceholder="Search attributes..."
                            emptyText="No attributes found"
                            footer={
                                <button
                                    type="button"
                                    onClick={handleAddCustomAttribute}
                                    className="flex w-full items-center px-3 py-2 text-left type-p text-foreground hover:bg-accent transition-colors"
                                >
                                    <Icons.Plus className="h-4 w-4" />
                                    <span className="px-1">Add custom attribute</span>
                                </button>
                            }
                        />
                    </div>
                )}
            </div>

            {/* Variant table */}
            {hasVariants && (
                <VariantTable
                    dimensions={dimensions}
                    variantMetadata={variantMetadata}
                    setVariantMetadata={setVariantMetadata}
                    explicitVariants={explicitVariants}
                    setExplicitVariants={setExplicitVariants}
                    enabledVariantKeys={enabledVariantKeys}
                    isEditMode={isEditMode}
                    productHandle={productHandle}
                    savedVariants={effectiveSavedVariants}
                    isNewProduct={isNewProduct}
                    onNavigateToVariant={onNavigateToVariant}
                />
            )}
        </div>
    );
}
