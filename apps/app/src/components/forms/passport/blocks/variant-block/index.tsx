"use client";

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
import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { cn } from "@v1/ui/cn";
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
import * as React from "react";
import { createPortal } from "react-dom";
import { AttributeSelect } from "./attribute-select";
import type { ExplicitVariant, VariantDimension, VariantMetadata } from "./types";
import { VariantTable } from "./variant-table";

// Re-export types
export type { ExplicitVariant, VariantDimension, VariantMetadata } from "./types";

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

function SortableAttributeRow({ dimension, onChange, onDelete, isExpanded, setExpanded }: SortableAttributeRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
  setVariantMetadata: React.Dispatch<React.SetStateAction<Record<string, VariantMetadata>>>;
  explicitVariants?: ExplicitVariant[];
  setExplicitVariants?: React.Dispatch<React.SetStateAction<ExplicitVariant[]>>;
}

export function VariantSection({
  dimensions,
  setDimensions,
  variantMetadata,
  setVariantMetadata,
  explicitVariants,
  setExplicitVariants,
}: VariantSectionProps) {
  const { taxonomyAttributes, brandAttributes } = useBrandCatalog();
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [addPopoverOpen, setAddPopoverOpen] = React.useState(false);
  const [addSearchTerm, setAddSearchTerm] = React.useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  // Collect existing attribute IDs for filtering
  const existingAttributeIds = dimensions
    .map((d) => d.attributeId)
    .filter((id): id is string => id !== null);

  // Build attribute lookup map for resolving selections
  const attributeLookup = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; taxonomyId: string | null }>();
    
    // Custom brand attributes (no taxonomy link)
    for (const attr of brandAttributes) {
      if (!attr.taxonomyAttributeId) {
        map.set(attr.id, { id: attr.id, name: attr.name, taxonomyId: null });
      }
    }
    
    // Taxonomy attributes
    for (const attr of taxonomyAttributes) {
      const brandAttr = brandAttributes.find((a) => a.taxonomyAttributeId === attr.id);
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
      .filter((attr) => !attr.taxonomyAttributeId && !existingAttributeIds.includes(attr.id))
      .map((attr) => ({ value: attr.id, label: attr.name }));
    
    if (customOptions.length > 0) {
      groups.push({ label: "Custom", options: customOptions });
    }
    
    // Standard taxonomy attributes
    const standardOptions = taxonomyAttributes
      .filter((attr) => {
        const brandAttr = brandAttributes.find((a) => a.taxonomyAttributeId === attr.id);
        const attrId = brandAttr?.id ?? `tax:${attr.id}`;
        return !existingAttributeIds.includes(attrId);
      })
      .map((attr) => {
        const brandAttr = brandAttributes.find((a) => a.taxonomyAttributeId === attr.id);
        return { value: brandAttr?.id ?? `tax:${attr.id}`, label: attr.name };
      });
    
    if (standardOptions.length > 0) {
      groups.push({ label: customOptions.length > 0 ? "Standard" : "", options: standardOptions });
    }
    
    return groups;
  }, [taxonomyAttributes, brandAttributes, existingAttributeIds]);

  // Filter for add popover
  const filteredCustomAttrs = React.useMemo(() => {
    return brandAttributes
      .filter((attr) => !attr.taxonomyAttributeId && !existingAttributeIds.includes(attr.id))
      .filter((attr) => !addSearchTerm || attr.name.toLowerCase().includes(addSearchTerm.toLowerCase()));
  }, [brandAttributes, existingAttributeIds, addSearchTerm]);

  const filteredTaxonomyAttrs = React.useMemo(() => {
    return taxonomyAttributes
      .filter((attr) => {
        const brandAttr = brandAttributes.find((a) => a.taxonomyAttributeId === attr.id);
        const attrId = brandAttr?.id ?? `tax:${attr.id}`;
        return !existingAttributeIds.includes(attrId);
      })
      .filter((attr) => !addSearchTerm || attr.name.toLowerCase().includes(addSearchTerm.toLowerCase()));
  }, [taxonomyAttributes, brandAttributes, existingAttributeIds, addSearchTerm]);

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

    const next = [...dimensions];
    const [removed] = next.splice(oldIndex, 1);
    if (removed) {
      next.splice(newIndex, 0, removed);
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
    setDimensions((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  };

  const handleDeleteDimension = (index: number) => {
    const dim = dimensions[index];
    if (dim && expandedId === dim.id) {
      setExpandedId(null);
    }
    setDimensions((prev) => prev.filter((_, i) => i !== index));
  };

  const activeDimension = activeId ? dimensions.find((d) => d.id === activeId) : null;

  const hasVariants =
    dimensions.some(
      (d) =>
        d.values.length > 0 ||
        (d.pendingValues?.length ?? 0) > 0 ||
        (d.isCustomInline && (d.customValues ?? []).some((v) => v.trim().length > 0)),
    ) ||
    (explicitVariants && explicitVariants.length > 0);

  const hasDimensions = dimensions.length > 0;

  return (
    <div className={cn("border border-border bg-background", hasVariants && "border-b-0")}>
      {/* Header */}
      <div className="p-4 flex flex-col gap-3">
        <p className="type-p !font-medium text-primary">Variants</p>
        
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
                    setExpanded={(expanded) => setExpandedId(expanded ? dim.id : null)}
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
                            ? (activeDimension.customAttributeName || "Custom attribute")
                            : (activeDimension.attributeName || "New attribute")}
                        </p>
                      </div>
                    )}
                  </DragOverlay>,
                  document.body
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
                    <span className="px-1 type-p text-secondary">Add attribute</span>
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
                              <span className="type-p text-primary">{attr.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}

                      {/* Standard taxonomy attributes */}
                      {filteredTaxonomyAttrs.length > 0 && (
                        <CommandGroup heading={filteredCustomAttrs.length > 0 ? "Standard" : undefined}>
                          {filteredTaxonomyAttrs.map((attr) => {
                            const brandAttr = brandAttributes.find((a) => a.taxonomyAttributeId === attr.id);
                            return (
                              <CommandItem
                                key={attr.id}
                                onMouseDown={(e) => e.preventDefault()}
                                onSelect={() => handleSelectAttribute(brandAttr?.id ?? `tax:${attr.id}`)}
                              >
                                <span className="type-p text-primary">{attr.name}</span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      )}

                      {filteredTaxonomyAttrs.length === 0 && filteredCustomAttrs.length === 0 && (
                        <CommandEmpty>No attributes found</CommandEmpty>
                      )}
                    </CommandList>

                    {/* Add custom button - always visible at bottom */}
                    <div className="border-t border-border">
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleAddCustomAttribute}
                        className="flex w-full items-center gap-2 px-2 py-1.5 text-left type-p text-secondary hover:bg-accent hover:text-foreground transition-colors"
                      >
                        <Icons.Plus className="h-4 w-4" />
                        Add custom attribute
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
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left type-p text-secondary hover:bg-accent hover:text-foreground transition-colors"
                >
                  <Icons.Plus className="h-4 w-4" />
                  Add custom attribute
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
        />
      )}
    </div>
  );
}
