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
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import * as React from "react";
import { createPortal } from "react-dom";

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

function CheckboxLike({
  checked,
  onChange,
  ariaLabel,
}: { checked: boolean; onChange: (next: boolean) => void; ariaLabel: string }) {
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

function SortableRow({
  item,
  onToggle,
}: { item: RowState; onToggle: (id: string, next: boolean) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex h-10 items-center gap-3 px-3 border border-border bg-background"
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
      <div className="flex-1 truncate type-p text-primary">{item.label}</div>
      <CheckboxLike
        checked={item.checked}
        onChange={(n) => onToggle(item.id, n)}
        ariaLabel={`Toggle ${item.label}`}
      />
    </div>
  );
}

export function DisplayPopover({
  trigger,
  productLabel = "Product",
  allColumns,
  initialVisible,
  onSave,
}: DisplayPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<RowState[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const activeRow = React.useMemo(
    () => rows.find((r) => r.id === activeId),
    [activeId, rows],
  );

  const buildInitialRows = React.useCallback(() => {
    const visibleSet = new Set(initialVisible);
    const visibleOrdered = allColumns
      .filter((c) => visibleSet.has(c.id))
      .sort(
        (a, b) => initialVisible.indexOf(a.id) - initialVisible.indexOf(b.id),
      )
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

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }
    setRows((prev) => {
      const oldIndex = prev.findIndex((r) => r.id === active.id);
      const newIndex = prev.findIndex((r) => r.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
    setActiveId(null);
  }, []);

  const handleToggle = (id: string, next: boolean) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, checked: next } : r)),
    );
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
        <div className="flex flex-col max-h-[360px] p-2 gap-2 overflow-auto">
          {/* Locked Product row */}
          <div className="flex h-10 min-h-10 items-center gap-3 px-3 border border-border bg-background">
            <Icons.Lock className="h-4 w-4 text-tertiary" />
            <div className="flex-1 truncate type-p text-primary">
              {productLabel}
            </div>
            <div className="h-4 w-4" />
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={rows.map((r) => r.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {rows.map((item) => (
                  <SortableRow
                    key={item.id}
                    item={item}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </SortableContext>
            {typeof window !== "undefined" &&
              createPortal(
                <DragOverlay dropAnimation={null}>
                  {activeRow ? (
                    <div className="flex h-10 items-center gap-3 px-3 border border-border bg-background shadow-lg opacity-95">
                      <Icons.GripVertical className="h-4 w-4 text-tertiary" />
                      <div className="flex-1 truncate type-p text-primary">
                        {activeRow.label}
                      </div>
                      <CheckboxLike
                        checked={activeRow.checked}
                        onChange={() => {}}
                        ariaLabel={`Toggle ${activeRow.label}`}
                      />
                    </div>
                  ) : null}
                </DragOverlay>,
                document.body,
              )}
          </DndContext>
        </div>
        <div className="border-t border-border p-2">
          <Button
            variant="brand"
            size="sm"
            className="w-full"
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
