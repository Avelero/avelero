"use client";

import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import * as React from "react";

export interface DisplayColumnItem {
  id: string;
  label: string;
}

interface DisplayPopoverProps {
  trigger: React.ReactNode;
  productLabel?: string;
  allColumns: DisplayColumnItem[]; // customizable only (excludes product & actions)
  initialVisible: string[]; // order matters; excludes product/actions
  onSave: (visibleOrdered: string[]) => void;
}

interface RowState extends DisplayColumnItem {
  checked: boolean;
}

function CheckboxLike({ checked, onChange, ariaLabel }: { checked: boolean; onChange: (next: boolean) => void; ariaLabel: string; }) {
  return (
    <div className="relative inline-flex h-4 w-4 items-center justify-center">
      <input
        type="checkbox"
        aria-label={ariaLabel}
        className="block h-4 w-4 shrink-0 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand cursor-pointer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />
      {checked && (
        <div className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center pointer-events-none">
          <div className="w-[10px] h-[10px] bg-brand" />
        </div>
      )}
    </div>
  );
}

function SortableRow({ item, onToggle }: { item: RowState; onToggle: (id: string, next: boolean) => void; }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex h-10 items-center gap-3 px-3",
        "border border-border bg-background",
      )}
    >
      <button
        type="button"
        aria-label="Drag"
        className="text-tertiary hover:text-secondary cursor-grab"
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
      >
        <Icons.GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 truncate text-p text-primary">{item.label}</div>
      <CheckboxLike checked={item.checked} onChange={(n) => onToggle(item.id, n)} ariaLabel={`Toggle ${item.label}`} />
    </div>
  );
}

export function DisplayPopover({ trigger, productLabel = "Product", allColumns, initialVisible, onSave }: DisplayPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<RowState[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const buildInitialRows = React.useCallback(() => {
    const visibleSet = new Set(initialVisible);
    const visibleOrdered = allColumns
      .filter((c) => visibleSet.has(c.id))
      .sort((a, b) => initialVisible.indexOf(a.id) - initialVisible.indexOf(b.id))
      .map((c) => ({ ...c, checked: true }));
    const hiddenOrdered = allColumns
      .filter((c) => !visibleSet.has(c.id))
      .sort((a, b) => a.label.localeCompare(b.label))
      .map((c) => ({ ...c, checked: false }));
    return [...visibleOrdered, ...hiddenOrdered];
  }, [allColumns, initialVisible]);

  React.useEffect(() => {
    if (open) setRows(buildInitialRows());
  }, [open, buildInitialRows]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rows.findIndex((r) => r.id === active.id);
    const newIndex = rows.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setRows((prev) => arrayMove(prev, oldIndex, newIndex));
  };

  const handleToggle = (id: string, next: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, checked: next } : r)));
  };

  const handleSave = () => {
    const nextVisible = rows.filter((r) => r.checked).map((r) => r.id);
    onSave(nextVisible);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex flex-col max-h-[360px] overflow-auto p-2 gap-2">
          {/* Locked Product row */}
        <div className="flex h-10 items-center gap-3 px-3 border border-border bg-background">
            <Icons.Lock className="h-4 w-4 text-tertiary" />
            <div className="flex-1 truncate text-p text-primary">{productLabel}</div>
            <div className="h-4 w-4" />
        </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2">
              {rows.map((item) => (
                  <SortableRow key={item.id} item={item} onToggle={handleToggle} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
        <div className="border-t border-border p-2">
          <Button variant="brand" size="sm" className="w-full" onClick={handleSave}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}


