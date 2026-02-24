"use client";

import type { VariantDimension } from "@/components/forms/passport/blocks/variant-block";
import { useAttributes } from "@/hooks/use-attributes";
import { useTRPC } from "@/trpc/client";
import {
  DndContext,
  type DragEndEvent,
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { allColors } from "@v1/selections";
import { Button } from "@v1/ui/button";
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
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

function ValueChip({
  name,
  hex,
  onRemove,
}: { name: string; hex?: string | null; onRemove?: () => void }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <div
      className="relative flex items-center justify-center px-2 h-6 border border-border rounded-full bg-background box-border"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hex && (
        <div className="flex items-center justify-center h-[12px] w-[12px]">
          <div
            className="h-2.5 w-2.5 rounded-full border-[0.5px] border-border"
            style={{ backgroundColor: hex }}
          />
        </div>
      )}

      <p
        className={cn("type-small leading-none text-primary", hex && "ml-1.5")}
      >
        {name}
      </p>

      {/* Copy TagSelect chip remove affordance: absolute overlay (no layout shift) */}
      {hovered && onRemove && (
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center">
          <div className="w-3 h-3 bg-gradient-to-r from-transparent to-background" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="w-4 h-4 flex rounded-r-full rounded-l-md items-center justify-center bg-background text-tertiary hover:text-destructive transition-colors"
          >
            <Icons.X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function CustomValueInput({
  value,
  onChange,
  onRemove,
  placeholder,
  dragHandleProps,
  dragDisabled = false,
  inputRef,
  onKeyDown,
  onBlur,
}: {
  value: string;
  onChange: (newValue: string) => void;
  onRemove?: () => void;
  placeholder?: string;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  dragDisabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}) {
  const showRemove = !!onRemove;

  // Copy the eco-claims pattern from environment-block:
  // - shift content to the left on hover (mr-11)
  // - slide in the remove button with width transition (w-0 -> w-9)
  return (
    <div className="group/value relative">
      <div
        className={cn(
          "flex items-center h-9 border border-border bg-background",
          "transition-[margin-right] duration-200 ease-in-out",
          showRemove && "group-hover/value:mr-11",
        )}
      >
        <div
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            "w-8 h-full flex items-center justify-center text-tertiary border-r border-border",
            dragHandleProps && !dragDisabled
              ? "cursor-grab hover:text-secondary"
              : "opacity-30 cursor-default",
          )}
        >
          <Icons.GripVertical className="h-3.5 w-3.5" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          placeholder={placeholder}
          className="flex-1 h-full px-3 bg-transparent type-p outline-none placeholder:text-tertiary"
        />
      </div>

      {showRemove && (
        <div className="absolute right-0 top-0 w-0 group-hover/value:w-9 overflow-hidden transition-[width] duration-200 ease-in-out">
          <Button
            type="button"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="h-9 w-9 text-tertiary hover:text-destructive flex-shrink-0"
          >
            <Icons.X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

function SortableCustomValueRow({
  id,
  value,
  onChange,
  onRemove,
  placeholder,
  disabled = false,
  inputRef,
  onKeyDown,
  onBlur,
}: {
  id: string;
  value: string;
  onChange: (newValue: string) => void;
  onRemove?: () => void;
  placeholder?: string;
  disabled?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CustomValueInput
        value={value}
        onChange={onChange}
        onRemove={onRemove}
        placeholder={placeholder}
        dragHandleProps={
          !disabled ? { ...attributes, ...listeners } : undefined
        }
        dragDisabled={disabled}
        inputRef={inputRef}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      />
    </div>
  );
}

// Separate component to manage stable keys for custom value inputs
function CustomInlineExpanded({
  dimension,
  onChange,
  onDelete,
  setExpanded,
  dragHandleProps,
}: {
  dimension: VariantDimension;
  onChange: (updated: VariantDimension) => void;
  onDelete: () => void;
  setExpanded: (expanded: boolean) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}) {
  const vals = dimension.customValues ?? [];
  const newValueInputRef = React.useRef<HTMLInputElement>(null);
  const lastNonEmptyByIdRef = React.useRef<Map<string, string>>(new Map());
  const [showValidationErrors, setShowValidationErrors] = React.useState(false);
  // Use a counter to generate stable keys - only increments, never reused
  const keyCounterRef = React.useRef(0);
  const keysRef = React.useRef<string[]>([]);

  // Ensure we have exactly enough keys for all values + 1 for the new input slot
  if (keysRef.current.length > vals.length + 1) {
    keysRef.current = keysRef.current.slice(0, vals.length + 1);
  }
  while (keysRef.current.length < vals.length + 1) {
    keysRef.current.push(`custom-value-${keyCounterRef.current++}`);
  }

  const valueSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const slotIds = keysRef.current.slice(0, vals.length + 1);
  const newSlotId = slotIds[slotIds.length - 1]!;
  const valueIds = slotIds.slice(0, -1);

  const normalizedNonEmptyValues = vals.map((v) => v.trim()).filter(Boolean);

  const duplicateNormalizedValues = (() => {
    const counts = new Map<string, { count: number; display: string }>();
    for (const v of normalizedNonEmptyValues) {
      const k = v.toLowerCase();
      const entry = counts.get(k);
      if (entry) {
        entry.count += 1;
      } else {
        counts.set(k, { count: 1, display: v });
      }
    }
    return Array.from(counts.values())
      .filter((v) => v.count > 1)
      .map((v) => v.display);
  })();

  const duplicateError =
    showValidationErrors && duplicateNormalizedValues.length > 0
      ? `Duplicate values: ${duplicateNormalizedValues.join(", ")}`
      : null;

  const handleValueDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const from = valueIds.indexOf(activeId);
    if (from === -1) return;

    let to = valueIds.indexOf(overId);
    if (to === -1) {
      if (overId === newSlotId) {
        to = valueIds.length - 1;
      } else {
        return;
      }
    }

    if (from === to) return;

    const nextVals = [...vals];
    const [movedVal] = nextVals.splice(from, 1);
    if (!movedVal) return;
    nextVals.splice(to, 0, movedVal);

    const nextValueIds = [...valueIds];
    const [movedId] = nextValueIds.splice(from, 1);
    if (!movedId) return;
    nextValueIds.splice(to, 0, movedId);

    keysRef.current = [...nextValueIds, newSlotId];
    onChange({ ...dimension, customValues: nextVals });
  };

  const focusNewValueInput = () => {
    // Defer to avoid fighting with React state updates from onChange handlers.
    requestAnimationFrame(() => {
      newValueInputRef.current?.focus();
    });
  };

  const handleValueChange = (index: number, newValue: string) => {
    const newVals = [...vals];
    if (index < vals.length) {
      newVals[index] = newValue;
    } else {
      // Adding to the empty slot
      if (newValue) {
        newVals.push(newValue);
      }
    }

    const slotId = keysRef.current[index];
    if (slotId && newValue.trim().length > 0) {
      lastNonEmptyByIdRef.current.set(slotId, newValue);
    }

    onChange({ ...dimension, customValues: newVals });
  };

  const handleRemoveValue = (index: number) => {
    const idToRemove = keysRef.current[index];
    if (idToRemove) {
      lastNonEmptyByIdRef.current.delete(idToRemove);
    }
    const newVals = vals.filter((_, i) => i !== index);
    keysRef.current.splice(index, 1);
    onChange({ ...dimension, customValues: newVals });
  };

  const handleDone = () => {
    setShowValidationErrors(true);

    // Restore empty rows to their last non-empty value (typically the "last letter")
    const restoredPairs = valueIds.map((id, i) => {
      const current = (vals[i] ?? "").trim();
      if (current) {
        lastNonEmptyByIdRef.current.set(id, current);
        return { id, value: current };
      }
      const last = (lastNonEmptyByIdRef.current.get(id) ?? "").trim();
      return { id, value: last };
    });

    const cleanedPairs = restoredPairs.filter((p) => p.value);

    // If no values remain (and no attribute name), auto-delete the dimension
    if (cleanedPairs.length === 0) {
      onDelete();
      return;
    }

    // Duplicate check (case-insensitive)
    const counts = new Map<string, number>();
    for (const p of cleanedPairs) {
      const k = p.value.toLowerCase();
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const hasDuplicates = Array.from(counts.values()).some((n) => n > 1);
    if (hasDuplicates) {
      return;
    }

    // Keep IDs aligned with remaining values
    keysRef.current = [...cleanedPairs.map((p) => p.id), newSlotId];
    onChange({ ...dimension, customValues: cleanedPairs.map((p) => p.value) });
    setExpanded(false);
  };

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div
          {...dragHandleProps}
          className="w-6 pt-2 flex items-center justify-center cursor-grab text-tertiary hover:text-secondary"
        >
          <Icons.GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-4">
          <input
            type="text"
            value={dimension.customAttributeName ?? ""}
            onChange={(e) =>
              onChange({ ...dimension, customAttributeName: e.target.value })
            }
            placeholder="Enter attribute"
            className="w-full h-9 px-3 border border-border bg-background type-p outline-none placeholder:text-tertiary"
          />
          <DndContext
            sensors={valueSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleValueDragEnd}
          >
            <SortableContext
              items={slotIds}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1.5">
                {slotIds.map((id, i) => {
                  const isNewSlot = i === vals.length;
                  return (
                    <SortableCustomValueRow
                      key={id}
                      id={id}
                      value={isNewSlot ? "" : vals[i] ?? ""}
                      onChange={(newVal) => handleValueChange(i, newVal)}
                      onRemove={
                        isNewSlot ? undefined : () => handleRemoveValue(i)
                      }
                      placeholder="Enter value"
                      disabled={isNewSlot}
                      inputRef={isNewSlot ? newValueInputRef : undefined}
                      onKeyDown={
                        isNewSlot
                          ? undefined
                          : (e) => {
                              if (
                                e.key === "Enter" ||
                                (e.key === "Tab" && !e.shiftKey)
                              ) {
                                e.preventDefault();
                                focusNewValueInput();
                              }
                            }
                      }
                      onBlur={
                        isNewSlot
                          ? undefined
                          : () => {
                              const current = (vals[i] ?? "").trim();
                              if (current) return;
                              const last = (
                                lastNonEmptyByIdRef.current.get(id) ?? ""
                              ).trim();
                              if (last) {
                                handleValueChange(i, last);
                              }
                            }
                      }
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
          {duplicateError && (
            <p className="type-small text-destructive">{duplicateError}</p>
          )}
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-destructive"
            >
              Delete
            </Button>
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={handleDone}
              disabled={
                !(
                  dimension.customAttributeName?.trim() &&
                  normalizedNonEmptyValues.length > 0
                )
              }
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface AttributeSelectProps {
  dimension: VariantDimension;
  onChange: (updated: VariantDimension) => void;
  onDelete: () => void;
  isExpanded: boolean;
  setExpanded: (expanded: boolean) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function AttributeSelect({
  dimension,
  onChange,
  onDelete,
  isExpanded,
  setExpanded,
  dragHandleProps,
}: AttributeSelectProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Use the shared hook for deduplicated attribute value options
  const {
    options: availableOptions,
    getValueName,
    getValueHex: getHex,
    brandValues,
  } = useAttributes({
    brandAttributeId: dimension.attributeId,
  });

  const [valuesOpen, setValuesOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [valuesView, setValuesView] = React.useState<"main" | "color-picker">(
    "main",
  );
  const [pendingColorValueName, setPendingColorValueName] = React.useState("");
  const [isCreatingValue, setIsCreatingValue] = React.useState(false);
  const latestDimensionRef = React.useRef(dimension);

  React.useEffect(() => {
    latestDimensionRef.current = dimension;
  }, [dimension]);

  // Mutation for creating attribute values without modal (custom attributes)
  const createValueMutation = useMutation(
    trpc.catalog.attributeValues.create.mutationOptions(),
  );

  const allValues = dimension.isCustomInline
    ? (dimension.customValues ?? []).map((v) => v.trim()).filter(Boolean)
    : dimension.values ?? [];
  const displayName = dimension.isCustomInline
    ? dimension.customAttributeName || "Custom attribute"
    : dimension.attributeName;

  const toggleValue = (id: string) => {
    const has = dimension.values.includes(id);
    onChange({
      ...dimension,
      values: has
        ? dimension.values.filter((v) => v !== id)
        : [...dimension.values, id],
    });
  };

  // Handle selecting an existing brand value
  const handleSelectOption = (option: { id: string }) => {
    toggleValue(option.id);
  };

  const isColorAttribute = React.useMemo(() => {
    const normalized = dimension.attributeName.trim().toLowerCase();
    return (
      normalized === "color" ||
      normalized === "colors" ||
      normalized === "colour" ||
      normalized === "colours"
    );
  }, [dimension.attributeName]);

  const createValueDirectly = async (
    valueName: string,
    opts?: { metadata?: Record<string, unknown> },
  ) => {
    if (!dimension.attributeId || isCreatingValue) return;

    const trimmedName = valueName.trim();
    if (!trimmedName) return;

    // Check for duplicates
    const isDuplicate = brandValues.some(
      (v) => v.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (isDuplicate) {
      toast.error("A value with this name already exists");
      return;
    }

    setIsCreatingValue(true);
    const tempId = `temp-attr-value-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const optimisticMetadata = opts?.metadata ?? {};

    // Optimistically add to catalog cache so the chip label/swatch resolve immediately.
    queryClient.setQueryData(trpc.composite.catalogContent.queryKey(), (old: any) => {
      if (!old?.brandCatalog) return old;
      return {
        ...old,
        brandCatalog: {
          ...old.brandCatalog,
          attributeValues: [
            ...old.brandCatalog.attributeValues,
            {
              id: tempId,
              attributeId: dimension.attributeId,
              name: trimmedName,
              taxonomyValueId: null,
              metadata: optimisticMetadata,
              sortOrder: null,
            },
          ],
        },
      };
    });

    // Optimistically select it so it appears instantly in the chip row and variant table.
    onChange({
      ...dimension,
      values: [...dimension.values, tempId],
    });

    try {
      const result = await createValueMutation.mutateAsync({
        attribute_id: dimension.attributeId,
        name: trimmedName,
        taxonomy_value_id: null,
        metadata: opts?.metadata,
      });

      const createdValue = result?.data;
      if (!createdValue?.id) {
        throw new Error("No valid response returned from API");
      }

      // Replace optimistic temp row with the persisted row id.
      queryClient.setQueryData(
        trpc.composite.catalogContent.queryKey(),
        (old: any) => {
          if (!old?.brandCatalog) return old;
          return {
            ...old,
            brandCatalog: {
              ...old.brandCatalog,
              attributeValues: (old.brandCatalog.attributeValues ?? []).map(
                (value: any) =>
                  value.id === tempId
                    ? {
                        ...value,
                        id: createdValue.id,
                        name: trimmedName,
                        metadata: optimisticMetadata,
                        taxonomyValueId: null,
                        sortOrder: null,
                      }
                    : value,
              ),
            },
          };
        },
      );

      // Replace temp selection id with the persisted id.
      const latest = latestDimensionRef.current;
      if (latest?.id === dimension.id) {
        onChange({
          ...latest,
          values: (latest.values ?? []).map((id) =>
            id === tempId ? createdValue.id : id,
          ),
        });
      }

      // Invalidate to trigger background refetch
      queryClient.invalidateQueries({
        queryKey: trpc.composite.catalogContent.queryKey(),
      });
    } catch (error) {
      // Roll back optimistic cache + selection on failure.
      queryClient.setQueryData(
        trpc.composite.catalogContent.queryKey(),
        (old: any) => {
          if (!old?.brandCatalog) return old;
          return {
            ...old,
            brandCatalog: {
              ...old.brandCatalog,
              attributeValues: (old.brandCatalog.attributeValues ?? []).filter(
                (value: any) => value.id !== tempId,
              ),
            },
          };
        },
      );

      const latest = latestDimensionRef.current;
      if (latest?.id === dimension.id) {
        onChange({
          ...latest,
          values: (latest.values ?? []).filter((id) => id !== tempId),
        });
      }

      console.error("Failed to create value:", error);
      toast.error("Failed to create value");
    } finally {
      setIsCreatingValue(false);
      setSearch("");
      setValuesView("main");
      setPendingColorValueName("");
    }
  };

  const handleCreateValue = () => {
    const t = search.trim();
    if (!t) return;

    // Check if value already exists in available options by name
    const existing = availableOptions.find(
      (v) => v.name.toLowerCase() === t.toLowerCase(),
    );
    if (existing) {
      handleSelectOption(existing);
      setSearch("");
      return;
    }

    if (isColorAttribute) {
      setPendingColorValueName(t);
      setValuesView("color-picker");
      setSearch("");
      return;
    }

    setValuesOpen(false);
    void createValueDirectly(t);
  };

  const handleColorPickForNewValue = (hex: string) => {
    const valueName = pendingColorValueName.trim();
    if (!valueName) return;

    setValuesOpen(false);
    void createValueDirectly(valueName, {
      metadata: { hex: hex.toUpperCase() },
    });
  };

  React.useEffect(() => {
    if (!valuesOpen) {
      setValuesView("main");
      setPendingColorValueName("");
      setSearch("");
    }
  }, [valuesOpen]);

  const filteredColors = React.useMemo(() => {
    const term = search.trimEnd().toLowerCase();
    if (!term) return allColors;
    return allColors.filter(
      (color) =>
        color.name.toLowerCase().includes(term) ||
        color.hex.toLowerCase().includes(term.replace("#", "")),
    );
  }, [search]);

  // Collapsed
  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors"
      >
        <div
          {...dragHandleProps}
          onClick={(e) => e.stopPropagation()}
          className="w-6 flex items-center justify-center cursor-grab text-tertiary hover:text-secondary"
        >
          <Icons.GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="type-p text-foreground">
            {displayName || "Select attribute"}
          </p>
          {allValues.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {allValues.map((v, i) => (
                <ValueChip
                  key={`${i}-${v}`}
                  name={getValueName(v)}
                  hex={getHex(v)}
                />
              ))}
            </div>
          )}
        </div>
      </button>
    );
  }

  // Expanded - Custom inline
  if (dimension.isCustomInline) {
    return (
      <CustomInlineExpanded
        dimension={dimension}
        onChange={onChange}
        onDelete={onDelete}
        setExpanded={setExpanded}
        dragHandleProps={dragHandleProps}
      />
    );
  }

  // Filter options by search
  const normalizedSearch = search.trim();
  const filterQuery = search.trimEnd().toLowerCase();
  const filteredOptions = availableOptions.filter(
    (v) => !filterQuery || v.name.toLowerCase().includes(filterQuery),
  );

  // Show create option if search doesn't match any existing option
  const showCreateOption =
    normalizedSearch &&
    !availableOptions.some(
      (v) => v.name.toLowerCase() === normalizedSearch.toLowerCase(),
    );

  // Expanded - Standard attribute
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div
          {...dragHandleProps}
          className="w-6 pt-2 flex items-center justify-center cursor-grab text-tertiary hover:text-secondary"
        >
          <Icons.GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="h-9 px-3 flex items-center border border-border bg-accent/50 type-p">
            {dimension.attributeName}
          </div>
          <Popover open={valuesOpen} onOpenChange={setValuesOpen}>
            <PopoverTrigger asChild>
              <div className="group flex flex-wrap items-center py-[5px] px-2 min-h-9 border border-border bg-background gap-1.5 cursor-pointer">
                {dimension.values.map((id) => (
                  <ValueChip
                    key={id}
                    name={getValueName(id)}
                    hex={getHex(id)}
                    onRemove={() => toggleValue(id)}
                  />
                ))}
                <span className="mx-1 border-b border-border type-p text-tertiary group-hover:text-secondary group-hover:border-secondary group-data-[state=open]:border-secondary group-data-[state=open]:text-secondary cursor-pointer transition-colors">
                  Add {dimension.attributeName.toLowerCase()}
                </span>
              </div>
            </PopoverTrigger>
            <PopoverContent
              className="w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px] p-0"
              align="start"
            >
              {valuesView === "main" ? (
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search..."
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList className="max-h-48">
                    <CommandGroup>
                      {/* Show existing options */}
                      {filteredOptions.map((v) => (
                        <CommandItem
                          key={v.id}
                          onSelect={() => handleSelectOption(v)}
                          className="justify-between"
                        >
                          <div className="flex items-center gap-2">
                            {v.hex && (
                              <div
                                className="h-3.5 w-3.5 rounded-full border border-border"
                                style={{ backgroundColor: v.hex }}
                              />
                            )}
                            <span className="type-p">{v.name}</span>
                          </div>
                          {dimension.values.includes(v.id) && (
                            <Icons.Check className="h-4 w-4" />
                          )}
                        </CommandItem>
                      ))}
                      {filteredOptions.length === 0 && showCreateOption && (
                        <CommandItem
                          value={normalizedSearch}
                          onSelect={handleCreateValue}
                        >
                          <div className="flex items-center gap-2">
                            <Icons.Plus className="h-3.5 w-3.5" />
                            <span>Create &quot;{normalizedSearch}&quot;</span>
                          </div>
                        </CommandItem>
                      )}
                      {filteredOptions.length === 0 && !showCreateOption && (
                        <CommandEmpty>No values found</CommandEmpty>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              ) : (
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder={`Pick a color for "${pendingColorValueName}"`}
                    value={search}
                    onValueChange={setSearch}
                  />
                    <CommandList className="max-h-48">
                      <CommandGroup>
                      {filteredColors.map((color) => (
                        <CommandItem
                          key={`${color.name}-${color.hex}`}
                          value={`${color.name}-${color.hex}`}
                          onSelect={() => handleColorPickForNewValue(color.hex)}
                          disabled={isCreatingValue}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="h-3.5 w-3.5 rounded-full border border-border"
                              style={{ backgroundColor: `#${color.hex}` }}
                            />
                            <span className="type-p">{color.name}</span>
                            <span className="type-small text-tertiary uppercase">
                              #{color.hex}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                      {filteredColors.length === 0 && (
                        <CommandEmpty>No colors found</CommandEmpty>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}
            </PopoverContent>
          </Popover>
          <div className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-destructive"
            >
              Delete
            </Button>
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={() => {
                // If no values selected, auto-delete the dimension
                if (dimension.values.length === 0) {
                  onDelete();
                } else {
                  setExpanded(false);
                }
              }}
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
