"use client";

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
import { useBrandCatalog } from "@/hooks/use-brand-catalog";
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
import * as React from "react";
import type { VariantDimension } from "./types";

function ValueChip({ name, hex, onRemove }: { name: string; hex?: string | null; onRemove?: () => void }) {
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

      <p className={cn("type-small leading-none text-primary", hex && "ml-1.5")}>
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
        dragHandleProps={!disabled ? { ...attributes, ...listeners } : undefined}
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

  const normalizedNonEmptyValues = vals
    .map((v) => v.trim())
    .filter(Boolean);

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
        <div {...dragHandleProps} className="w-6 pt-2 flex items-center justify-center cursor-grab text-tertiary hover:text-secondary">
          <Icons.GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-4">
          <input
            type="text"
            value={dimension.customAttributeName ?? ""}
            onChange={(e) => onChange({ ...dimension, customAttributeName: e.target.value })}
            placeholder="Enter attribute"
            className="w-full h-9 px-3 border border-border bg-background type-p outline-none placeholder:text-tertiary"
          />
          <DndContext
            sensors={valueSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleValueDragEnd}
          >
            <SortableContext items={slotIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1.5">
                {slotIds.map((id, i) => {
                  const isNewSlot = i === vals.length;
                  return (
                    <SortableCustomValueRow
                      key={id}
                      id={id}
                      value={isNewSlot ? "" : (vals[i] ?? "")}
                      onChange={(newVal) => handleValueChange(i, newVal)}
                      onRemove={isNewSlot ? undefined : () => handleRemoveValue(i)}
                      placeholder="Enter value"
                      disabled={isNewSlot}
                      inputRef={isNewSlot ? newValueInputRef : undefined}
                      onKeyDown={
                        isNewSlot
                          ? undefined
                          : (e) => {
                              if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
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
                              const last = (lastNonEmptyByIdRef.current.get(id) ?? "").trim();
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
          {duplicateError && <p className="type-small text-destructive">{duplicateError}</p>}
          <div className="flex justify-between">
            <Button type="button" variant="outline" size="sm" onClick={onDelete} className="text-destructive">Delete</Button>
            <Button
              type="button"
              variant="brand"
              size="sm"
              onClick={handleDone}
              disabled={!(dimension.customAttributeName?.trim() && normalizedNonEmptyValues.length > 0)}
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

export function AttributeSelect({ dimension, onChange, onDelete, isExpanded, setExpanded, dragHandleProps }: AttributeSelectProps) {
  const { taxonomyAttributes, taxonomyValuesByAttribute, brandAttributeValuesByAttribute } = useBrandCatalog();
  const [valuesOpen, setValuesOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const taxonomyValues = dimension.taxonomyAttributeId ? taxonomyValuesByAttribute.get(dimension.taxonomyAttributeId) ?? [] : [];
  const brandValues = dimension.attributeId ? brandAttributeValuesByAttribute.get(dimension.attributeId) ?? [] : [];

  const getHex = (id: string) => {
    const v = taxonomyValues.find((t) => t.id === id);
    if (v?.metadata && typeof v.metadata === "object") {
      const m = v.metadata as Record<string, unknown>;
      if (typeof m.swatch === "string") return m.swatch;
      if (typeof m.hex === "string") return m.hex.startsWith("#") ? m.hex : `#${m.hex}`;
    }
    return null;
  };

  const getValueName = (val: string) => {
    if (dimension.isCustomInline) return val;
    if (dimension.pendingValues?.includes(val)) return val;
    const tv = taxonomyValues.find((t) => t.id === val);
    if (tv) return tv.name;
    const bv = brandValues.find((b) => b.id === val);
    return bv?.name ?? val;
  };

  const allValues = dimension.isCustomInline
    ? (dimension.customValues ?? []).map((v) => v.trim()).filter(Boolean)
    : [...(dimension.values ?? []), ...((dimension.pendingValues ?? []).map((v) => v.trim()).filter(Boolean))];
  const displayName = dimension.isCustomInline ? (dimension.customAttributeName || "Custom attribute") : dimension.attributeName;

  const toggleValue = (id: string) => {
    const has = dimension.values.includes(id);
    onChange({ ...dimension, values: has ? dimension.values.filter((v) => v !== id) : [...dimension.values, id] });
  };

  const removePending = (val: string) => {
    onChange({ ...dimension, pendingValues: (dimension.pendingValues ?? []).filter((v) => v !== val) });
  };

  const createPending = () => {
    const t = search.trim();
    if (!t) return;
    if (dimension.values.includes(t) || (dimension.pendingValues ?? []).includes(t)) return;
    if (dimension.taxonomyAttributeId) {
      const existing = taxonomyValues.find((v) => v.name.toLowerCase() === t.toLowerCase());
      if (existing) {
        toggleValue(existing.id);
        setSearch("");
        return;
      }
    } else {
      const existing = brandValues.find((v) => v.name.toLowerCase() === t.toLowerCase());
      if (existing) {
        toggleValue(existing.id);
        setSearch("");
        return;
      }
    }
    onChange({ ...dimension, pendingValues: [...(dimension.pendingValues ?? []), t] });
    setSearch("");
  };


  // Collapsed
  if (!isExpanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors">
        <div {...dragHandleProps} onClick={(e) => e.stopPropagation()} className="w-6 flex items-center justify-center cursor-grab text-tertiary hover:text-secondary">
          <Icons.GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="type-p text-foreground">{displayName || "Select attribute"}</p>
          {allValues.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {allValues.map((v, i) => <ValueChip key={`${i}-${v}`} name={getValueName(v)} hex={getHex(v)} />)}
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

  // Determine available options for the popover
  // For taxonomy-linked attributes: show taxonomy values
  // For custom brand attributes: show brand values
  const availableOptions = dimension.taxonomyAttributeId
    ? taxonomyValues.map((v) => ({ id: v.id, name: v.name, hex: getHex(v.id) }))
    : brandValues.map((v) => ({ id: v.id, name: v.name, hex: null }));

  const filteredOptions = availableOptions.filter(
    (v) => !search || v.name.toLowerCase().includes(search.toLowerCase())
  );

  const showCreateOption = search.trim() && 
    !availableOptions.some((v) => v.name.toLowerCase() === search.trim().toLowerCase()) && 
    !dimension.pendingValues?.includes(search.trim());

  // Expanded - Standard attribute
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div {...dragHandleProps} className="w-6 pt-2 flex items-center justify-center cursor-grab text-tertiary hover:text-secondary">
          <Icons.GripVertical className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="h-9 px-3 flex items-center border border-border bg-accent/50 type-p">{dimension.attributeName}</div>
          <Popover open={valuesOpen} onOpenChange={setValuesOpen}>
            <PopoverTrigger asChild>
              <div className="group flex flex-wrap items-center py-[5px] px-2 min-h-9 border border-border bg-background gap-1.5 cursor-pointer">
                {dimension.values.map((id) => <ValueChip key={id} name={getValueName(id)} hex={getHex(id)} onRemove={() => toggleValue(id)} />)}
                {(dimension.pendingValues ?? []).map((v) => <ValueChip key={`p-${v}`} name={v} onRemove={() => removePending(v)} />)}
                <span className="mx-1 border-b border-border type-p text-tertiary group-hover:text-secondary group-hover:border-secondary cursor-pointer transition-colors">
                  Add {dimension.attributeName.toLowerCase()}
                </span>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput placeholder="Search..." value={search} onValueChange={setSearch} />
                <CommandList className="max-h-48">
                  <CommandGroup>
                    {/* Show pending values first (marked as selected) */}
                    {(dimension.pendingValues ?? [])
                      .filter((v) => !search || v.toLowerCase().includes(search.toLowerCase()))
                      .map((v) => (
                        <CommandItem key={`pending-${v}`} onSelect={() => removePending(v)} className="justify-between">
                          <div className="flex items-center gap-2">
                            <span className="type-p">{v}</span>
                          </div>
                          <Icons.Check className="h-4 w-4" />
                        </CommandItem>
                      ))}
                    {/* Show existing options */}
                    {filteredOptions.map((v) => (
                      <CommandItem key={v.id} onSelect={() => toggleValue(v.id)} className="justify-between">
                        <div className="flex items-center gap-2">
                          {v.hex && <div className="h-3.5 w-3.5 rounded-full border border-border" style={{ backgroundColor: v.hex }} />}
                          <span className="type-p">{v.name}</span>
                        </div>
                        {dimension.values.includes(v.id) && <Icons.Check className="h-4 w-4" />}
                      </CommandItem>
                    ))}
                    {/* Create option */}
                    {showCreateOption && (
                      <CommandItem onSelect={createPending}>
                        <Icons.Plus className="h-3.5 w-3.5 mr-2" />
                        <span className="type-p">Create &quot;{search.trim()}&quot;</span>
                      </CommandItem>
                    )}
                    {filteredOptions.length === 0 && (dimension.pendingValues ?? []).length === 0 && !showCreateOption && (
                      <CommandEmpty>No values found</CommandEmpty>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <div className="flex justify-between">
            <Button type="button" variant="outline" size="sm" onClick={onDelete} className="text-destructive">Delete</Button>
            <Button type="button" variant="brand" size="sm" onClick={() => setExpanded(false)}>Done</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
