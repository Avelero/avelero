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
import {
    Select,
    SelectAction,
    SelectContent,
    SelectEmpty,
    SelectFooter,
    SelectGroup,
    SelectItem,
    SelectList,
    SelectSearch,
    SelectTrigger,
} from "@v1/ui/select";
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
// Utilities
// ============================================================================

/**
 * Gets the effective values for a dimension, handling both standard and custom inline attributes.
 */
function getEffectiveValues(dim: VariantDimension): string[] {
    if (dim.isCustomInline) {
        return (dim.customValues ?? []).map((v) => v.trim()).filter(Boolean);
    }
    return dim.values ?? [];
}

/**
 * Checks if a dimension has any values.
 */
function dimensionHasValues(dim: VariantDimension): boolean {
    return getEffectiveValues(dim).length > 0;
}

/**
 * Generates cartesian product of dimension values.
 * Returns array of pipe-separated keys.
 */
function generateAllCombinationKeys(dimensions: VariantDimension[]): string[] {
    // Get effective values for each dimension
    const effectiveDimensions = dimensions
        .map((dim) => getEffectiveValues(dim))
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
// Empty State Attribute Select
// ============================================================================

interface EmptyStateAttributeSelectProps {
    groups: { label: string; options: { value: string; label: string }[] }[];
    onSelectAttribute: (attrId: string) => void;
    onAddCustomAttribute: () => void;
}

function EmptyStateAttributeSelect({
    groups,
    onSelectAttribute,
    onAddCustomAttribute,
}: EmptyStateAttributeSelectProps) {
    const [open, setOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");

    const filteredGroups = React.useMemo(() => {
        if (!searchTerm.trim()) return groups;
        const query = searchTerm.toLowerCase().trim();
        return groups
            .map((g) => ({
                ...g,
                options: g.options.filter((o) =>
                    o.label.toLowerCase().includes(query),
                ),
            }))
            .filter((g) => g.options.length > 0);
    }, [groups, searchTerm]);

    const handleSelect = (attrId: string) => {
        onSelectAttribute(attrId);
        setOpen(false);
        setSearchTerm("");
    };

    const handleAddCustom = () => {
        onAddCustomAttribute();
        setOpen(false);
        setSearchTerm("");
    };

    return (
        <div className="space-y-1.5">
            <Label>Attribute</Label>
            <Select open={open} onOpenChange={setOpen}>
                <SelectTrigger asChild>
                    <Button
                        variant="outline"
                        size="default"
                        className="w-full justify-between"
                    >
                        <span className="truncate px-1 text-tertiary">
                            Select attribute
                        </span>
                        <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
                    </Button>
                </SelectTrigger>
                <SelectContent shouldFilter={false}>
                    <SelectSearch
                        placeholder="Search..."
                        value={searchTerm}
                        onValueChange={setSearchTerm}
                    />
                    <SelectList>
                        {filteredGroups.length > 0 ? (
                            filteredGroups.map((group) => (
                                <SelectGroup key={group.label || "default"} heading={group.label || undefined}>
                                    {group.options.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                            onSelect={() => handleSelect(option.value)}
                                        >
                                            <span className="type-p text-primary">
                                                {option.label}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            ))
                        ) : (
                            <SelectEmpty>No items found.</SelectEmpty>
                        )}
                    </SelectList>
                    <SelectFooter>
                        <SelectAction onSelect={handleAddCustom}>
                            <div className="flex items-center gap-2">
                                <Icons.Plus className="h-4 w-4" />
                                <span>Add custom attribute</span>
                            </div>
                        </SelectAction>
                    </SelectFooter>
                </SelectContent>
            </Select>
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
    const selectGroups = React.useMemo((): { label: string; options: { value: string; label: string }[] }[] => {
        const groups: { label: string; options: { value: string; label: string }[] }[] = [];

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
            .filter((item) => dimensionHasValues(item.dim));

        const newDimsWithValues = next
            .map((d, i) => ({ dim: d, originalIndex: i }))
            .filter((item) => dimensionHasValues(item.dim));

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
        const oldDimensionCount = dimensions.filter((d) => dimensionHasValues(d)).length;
        const oldDimension = dimensions[index];
        const oldValuesList = getEffectiveValues(oldDimension!);
        const oldValues = new Set(oldValuesList);

        setDimensions((prev) => {
            const next = [...prev];
            next[index] = updated;
            return next;
        });

        // Calculate new dimension info
        const newDimensions = [...dimensions];
        newDimensions[index] = updated;
        const newDimensionCount = newDimensions.filter((d) => dimensionHasValues(d)).length;
        const newValuesList = getEffectiveValues(updated);
        const newValues = new Set(newValuesList);
        const newKeys = generateAllCombinationKeys(newDimensions);
        const newKeysSet = new Set(newKeys);

        // For custom inline attributes, detect if values are being EDITED (same position, different content)
        // vs truly added/removed. When editing, we need to REMAP keys, not treat as removal+addition.
        const isCustomEdit = updated.isCustomInline &&
            oldValuesList.length === newValuesList.length &&
            oldValuesList.length > 0;

        // Build value remapping for custom edits (old value → new value at same index)
        const valueRemapping = new Map<string, string>();
        if (isCustomEdit) {
            for (let i = 0; i < oldValuesList.length; i++) {
                const oldVal = oldValuesList[i];
                const newVal = newValuesList[i];
                if (oldVal && newVal && oldVal !== newVal) {
                    valueRemapping.set(oldVal, newVal);
                }
            }
        }

        // If this is a pure custom value edit (no new values added, just renamed), handle with remapping
        if (isCustomEdit && valueRemapping.size > 0) {
            // Remap enabled keys
            setEnabledVariantKeys((prevEnabled) => {
                const nextEnabled = new Set<string>();
                for (const key of prevEnabled) {
                    let newKey = key;
                    for (const [oldVal, newVal] of valueRemapping) {
                        // Replace the old value with new value in the key
                        const keyParts = newKey.split("|");
                        const updatedParts = keyParts.map(part => part === oldVal ? newVal : part);
                        newKey = updatedParts.join("|");
                    }
                    if (newKeysSet.has(newKey)) {
                        nextEnabled.add(newKey);
                    }
                }
                return nextEnabled;
            });

            // Remap metadata
            setVariantMetadata((prev) => {
                const next: Record<string, VariantMetadata> = {};
                for (const [key, meta] of Object.entries(prev)) {
                    let newKey = key;
                    for (const [oldVal, newVal] of valueRemapping) {
                        const keyParts = newKey.split("|");
                        const updatedParts = keyParts.map(part => part === oldVal ? newVal : part);
                        newKey = updatedParts.join("|");
                    }
                    if (newKeysSet.has(newKey)) {
                        next[newKey] = meta;
                    }
                }
                return next;
            });

            // Remap collapsed variant mappings
            setCollapsedVariantMappings((prev) => {
                const next = new Map<string, { upid: string; hasOverrides: boolean }>();
                for (const [key, value] of prev) {
                    let newKey = key;
                    for (const [oldVal, newVal] of valueRemapping) {
                        const keyParts = newKey.split("|");
                        const updatedParts = keyParts.map(part => part === oldVal ? newVal : part);
                        newKey = updatedParts.join("|");
                    }
                    if (newKeysSet.has(newKey)) {
                        next.set(newKey, value);
                    }
                }
                return next;
            });

            return;
        }

        // Determine added and removed values (works for both standard AND custom attributes)
        const addedValues = [...newValues].filter((v) => !oldValues.has(v));
        const removedValues = [...oldValues].filter((v) => !newValues.has(v));

        // Check if we have any variants to preserve:
        // 1. Saved variants (from DB with UPIDs)
        // 2. Local variants with metadata (SKU or barcode entered by user)
        // 3. Currently enabled variants (even without metadata, we track which were selected)
        const hasSavedVariants = savedVariants && savedVariants.size > 0;
        const hasLocalVariantsWithData = Object.values(variantMetadata).some(
            (m) => m.sku || m.barcode
        );
        const hasEnabledVariants = enabledVariantKeys.size > 0;

        // For dimension count changes (adding/removing attributes), we should ALWAYS use
        // Shopify-like expansion to preserve which variants were enabled, even for new products.
        // Only use simple matrix behavior for same-dimension-count changes on new products with no data.
        const shouldUseMatrixBehavior = isNewProduct &&
            !hasSavedVariants &&
            !hasLocalVariantsWithData &&
            oldDimensionCount === newDimensionCount;

        // Pure new product with no data to preserve AND same dimension count - use matrix behavior
        if (shouldUseMatrixBehavior) {
            setEnabledVariantKeys((prevEnabled) => {
                const nextEnabled = new Set<string>();
                // Same dimension count - preserve existing enabled states
                for (const key of prevEnabled) {
                    if (newKeysSet.has(key)) {
                        nextEnabled.add(key);
                    }
                }
                // Add genuinely new keys (new values added to existing dimension)
                for (const key of newKeys) {
                    if (!prevEnabled.has(key)) {
                        nextEnabled.add(key);
                    }
                }
                return nextEnabled;
            });
            return;
        }

        // SHOPIFY-LIKE BEHAVIOR: Preserve variants and expand with new dimension values
        // When dimension count changes, we expand existing variants with the first new value
        // and create genuinely new variants for subsequent values.

        // Build a map of "variants to preserve" from all sources
        const variantsToPreserve = new Map<string, { upid: string | null; hasOverrides: boolean }>();

        // Add saved variants (from DB with UPIDs)
        if (savedVariants) {
            for (const [key, value] of savedVariants) {
                variantsToPreserve.set(key, value);
            }
        }

        // Add collapsed variant mappings (from previous dimension removals)
        for (const [key, value] of collapsedVariantMappings) {
            if (!variantsToPreserve.has(key)) {
                variantsToPreserve.set(key, value);
            }
        }

        // For dimension count changes, include ALL enabled variants for expansion
        // (even without metadata, we want to preserve which combinations were selected)
        const isDimensionCountChange = newDimensionCount !== oldDimensionCount;
        for (const key of enabledVariantKeys) {
            if (!variantsToPreserve.has(key)) {
                const meta = variantMetadata[key];
                // Include if has metadata OR if we're changing dimension count
                if (meta?.sku || meta?.barcode || isDimensionCountChange) {
                    variantsToPreserve.set(key, { upid: null, hasOverrides: false });
                }
            }
        }

        // Handle dimension count change (new dimension added with values)
        if (newDimensionCount > oldDimensionCount && addedValues.length > 0) {
            // A new dimension was added with values
            // Get the first value of the new dimension - this will be assigned to existing variants
            const firstNewValue = addedValues[0];
            if (!firstNewValue) return;
            const otherNewValues = addedValues.slice(1);

            // Calculate the correct insertion position for the key
            const newDimsWithValues = newDimensions.filter((d) => dimensionHasValues(d));
            const keyInsertPosition = newDimsWithValues.findIndex((d) => d.id === updated.id);
            if (keyInsertPosition === -1) return;

            // Build new enabled keys and update collapsed mappings
            const nextEnabled = new Set<string>();
            const nextExpandedMappings = new Map<string, { upid: string; hasOverrides: boolean }>();
            const nextMetadata: Record<string, { sku?: string; barcode?: string }> = {};

            // For each existing variant to preserve, expand it with the first new value
            for (const [originalKey, variantInfo] of variantsToPreserve) {
                const keyParts = originalKey.split("|");
                // Insert new value at the correct position
                const expandedKeyParts = [...keyParts];
                expandedKeyParts.splice(keyInsertPosition, 0, firstNewValue);
                const expandedKey = expandedKeyParts.join("|");

                if (newKeysSet.has(expandedKey)) {
                    nextEnabled.add(expandedKey);
                    // Preserve the UPID for the expanded key (if it has one)
                    if (variantInfo.upid) {
                        nextExpandedMappings.set(expandedKey, {
                            upid: variantInfo.upid,
                            hasOverrides: variantInfo.hasOverrides,
                        });
                    }
                    // Preserve metadata
                    const originalMeta = variantMetadata[originalKey];
                    if (originalMeta) {
                        nextMetadata[expandedKey] = originalMeta;
                    }
                }

                // For the other new values, create genuinely new variants (no UPID/metadata mapping)
                for (const otherValue of otherNewValues) {
                    const newKeyParts = [...keyParts];
                    newKeyParts.splice(keyInsertPosition, 0, otherValue);
                    const newKey = newKeyParts.join("|");
                    if (newKeysSet.has(newKey)) {
                        nextEnabled.add(newKey);
                        // Don't add to mappings or metadata - these are genuinely new variants
                    }
                }
            }

            // Also handle currently enabled keys that aren't in variantsToPreserve
            setEnabledVariantKeys((prevEnabled) => {
                for (const key of prevEnabled) {
                    if (variantsToPreserve.has(key)) continue;

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
            // Collapse enabled keys

            setEnabledVariantKeys((prevEnabled) => {
                const nextEnabled = new Set<string>();
                const seenCollapsedKeys = new Set<string>();

                for (const key of prevEnabled) {
                    const keyParts = key.split("|");
                    const containsRemovedValue = keyParts.some((part) => removedValues.includes(part));

                    if (containsRemovedValue) {
                        const collapsedParts = keyParts.filter((part) => !removedValues.includes(part));
                        const collapsedKey = collapsedParts.join("|");

                        if (newKeysSet.has(collapsedKey) && !seenCollapsedKeys.has(collapsedKey)) {
                            nextEnabled.add(collapsedKey);
                            seenCollapsedKeys.add(collapsedKey);
                        }
                    } else if (newKeysSet.has(key)) {
                        nextEnabled.add(key);
                    }
                }
                return nextEnabled;
            });

            // Update collapsed variant mappings to preserve UPIDs
            if (variantsToPreserve.size > 0) {
                const nextCollapsedMappings = new Map<string, { upid: string; hasOverrides: boolean }>();
                const seenCollapsedKeys = new Set<string>();

                for (const [originalKey, variantInfo] of variantsToPreserve) {
                    if (!variantInfo.upid) continue; // Only track variants with UPIDs

                    const keyParts = originalKey.split("|");
                    const containsRemovedValue = keyParts.some((part) => removedValues.includes(part));

                    if (containsRemovedValue) {
                        const collapsedParts = keyParts.filter((part) => !removedValues.includes(part));
                        const collapsedKey = collapsedParts.join("|");

                        if (newKeysSet.has(collapsedKey) && !seenCollapsedKeys.has(collapsedKey)) {
                            nextCollapsedMappings.set(collapsedKey, {
                                upid: variantInfo.upid,
                                hasOverrides: variantInfo.hasOverrides,
                            });
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

            // Also collapse metadata
            setVariantMetadata((prev) => {
                const nextMetadata: Record<string, { sku?: string; barcode?: string }> = {};
                const seenCollapsedKeys = new Set<string>();

                for (const [key, meta] of Object.entries(prev)) {
                    const keyParts = key.split("|");
                    const containsRemovedValue = keyParts.some((part) => removedValues.includes(part));

                    if (containsRemovedValue) {
                        const collapsedParts = keyParts.filter((part) => !removedValues.includes(part));
                        const collapsedKey = collapsedParts.join("|");

                        if (newKeysSet.has(collapsedKey) && !seenCollapsedKeys.has(collapsedKey)) {
                            nextMetadata[collapsedKey] = meta;
                            seenCollapsedKeys.add(collapsedKey);
                        }
                    } else if (newKeysSet.has(key)) {
                        nextMetadata[key] = meta;
                    }
                }
                return nextMetadata;
            });
        } else {
            // Same dimension count - handle value additions/removals
            setEnabledVariantKeys((prevEnabled) => {
                const nextEnabled = new Set<string>();

                // Start with existing enabled keys
                for (const key of prevEnabled) {
                    const keyParts = key.split("|");
                    const containsRemovedValue = keyParts.some((part) => removedValues.includes(part));
                    if (!containsRemovedValue && newKeysSet.has(key)) {
                        nextEnabled.add(key);
                    }
                }

                // For added values: expand existing variants like Shopify
                if (addedValues.length > 0 && newDimensionCount === oldDimensionCount) {
                    const dimsWithValues = newDimensions.filter((d) => dimensionHasValues(d));
                    const keyPosition = dimsWithValues.findIndex((d) => d.id === updated.id);
                    if (keyPosition === -1) return nextEnabled;

                    // Get existing variant patterns without the current dimension
                    const existingPatterns = new Set<string>();
                    for (const key of prevEnabled) {
                        const keyParts = key.split("|");
                        const patternParts = keyParts.filter((_, i) => i !== keyPosition);
                        if (patternParts.length > 0) {
                            existingPatterns.add(patternParts.join("|"));
                        }
                    }

                    // For each existing pattern, create combinations with new values
                    for (const pattern of existingPatterns) {
                        const patternParts = pattern.split("|");
                        for (const newValue of addedValues) {
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

            // Also update metadata when values are removed
            if (removedValues.length > 0) {
                setVariantMetadata((prev) => {
                    const nextMetadata: Record<string, { sku?: string; barcode?: string }> = {};
                    for (const [key, meta] of Object.entries(prev)) {
                        const keyParts = key.split("|");
                        const containsRemovedValue = keyParts.some((part) => removedValues.includes(part));
                        if (!containsRemovedValue && newKeysSet.has(key)) {
                            nextMetadata[key] = meta;
                        }
                    }
                    return nextMetadata;
                });
            }
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

        // SHOPIFY-LIKE BEHAVIOR: Collapse variants when dimension is removed
        // Build variantsToPreserve map from all sources, including all enabled variants
        // since deleting a dimension is a dimension count change
        const variantsToPreserve = new Map<string, { upid: string | null; hasOverrides: boolean }>();

        if (savedVariants) {
            for (const [key, value] of savedVariants) {
                variantsToPreserve.set(key, value);
            }
        }

        for (const [key, value] of collapsedVariantMappings) {
            if (!variantsToPreserve.has(key)) {
                variantsToPreserve.set(key, value);
            }
        }

        // Include ALL enabled variants for collapse (dimension count is changing)
        for (const key of enabledVariantKeys) {
            if (!variantsToPreserve.has(key)) {
                variantsToPreserve.set(key, { upid: null, hasOverrides: false });
            }
        }

        // Group variants by their collapsed key
        const collapsedGroups = new Map<string, Array<{
            originalKey: string;
            upid: string | null;
            hasOverrides: boolean;
        }>>();

        for (const [originalKey, variantInfo] of variantsToPreserve) {
            const keyParts = originalKey.split("|");
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

        // For each collapsed group, keep the first variant (preferring those with overrides/UPIDs)
        const nextEnabled = new Set<string>();
        const nextMetadata: Record<string, { sku?: string; barcode?: string }> = {};
        const nextCollapsedMappings = new Map<string, { upid: string; hasOverrides: boolean }>();

        for (const [collapsedKey, variants] of collapsedGroups) {
            // Sort: variants with UPIDs first, then those with overrides
            variants.sort((a, b) => {
                if (a.upid && !b.upid) return -1;
                if (!a.upid && b.upid) return 1;
                if (a.hasOverrides && !b.hasOverrides) return -1;
                if (!a.hasOverrides && b.hasOverrides) return 1;
                return 0;
            });

            const keptVariant = variants[0];
            if (keptVariant) {
                nextEnabled.add(collapsedKey);
                // Preserve metadata from the original key
                const originalMeta = variantMetadata[keptVariant.originalKey];
                if (originalMeta) {
                    nextMetadata[collapsedKey] = originalMeta;
                }
                // Store the collapsed mapping if it has a UPID
                if (keptVariant.upid) {
                    nextCollapsedMappings.set(collapsedKey, {
                        upid: keptVariant.upid,
                        hasOverrides: keptVariant.hasOverrides,
                    });
                }
            }
        }

        // Also handle local variants that weren't in variantsToPreserve
        setEnabledVariantKeys((prevEnabled) => {
            for (const key of prevEnabled) {
                if (variantsToPreserve.has(key)) continue;

                const keyParts = key.split("|");
                const collapsedParts = keyParts.filter((_, i) => i !== index);
                const collapsedKey = collapsedParts.join("|");

                if (newKeysSet.has(collapsedKey) && !nextEnabled.has(collapsedKey)) {
                    nextEnabled.add(collapsedKey);
                    const originalMeta = variantMetadata[key];
                    if (originalMeta) {
                        nextMetadata[collapsedKey] = originalMeta;
                    }
                }
            }
            return nextEnabled;
        });

        // Update variant metadata
        setVariantMetadata((prev) => {
            const merged = { ...nextMetadata };
            // Keep any metadata from previous that maps to valid keys and isn't overwritten
            for (const [key, meta] of Object.entries(prev)) {
                if (newKeysSet.has(key) && !merged[key]) {
                    merged[key] = meta;
                }
            }
            return merged;
        });

        // Update collapsed variant mappings
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
        dimensions.some((d) => dimensionHasValues(d)) ||
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
                    <EmptyStateAttributeSelect
                        groups={selectGroups}
                        onSelectAttribute={handleSelectAttribute}
                        onAddCustomAttribute={handleAddCustomAttribute}
                    />
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
