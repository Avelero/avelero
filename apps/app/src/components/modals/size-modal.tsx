"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@v1/ui/dialog";
import { Label } from "@v1/ui/label";
import { Input } from "@v1/ui/input";
import { Button } from "@v1/ui/button";
import { Select } from "@v1/ui/select";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CategorySelect } from "../select/category-select";
import { 
  getLevel2CategoryPath, 
  getSizesForCategory,
  getCategoryKey 
} from "@v1/selections/sizes";

interface SizeRow {
  id: string;
  value: string;
}

interface SizeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategory?: string; // Full category path (e.g., "Men's / Tops / Jerseys")
  onSave: (sizes: string[], categoryKey: string) => void; // Save with category key
  prefillSize?: string | null;
}

function DraggableSizeRow({
  row,
  onUpdate,
  onDelete,
}: {
  row: SizeRow;
  onUpdate: (id: string, value: string) => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab h-9 w-9 flex items-center justify-center border-y border-l border-border bg-background active:cursor-grabbing text-tertiary hover:text-secondary transition-colors flex-shrink-0"
      >
        <Icons.GripVertical className="h-4 w-4" />
      </div>
      <div className="relative flex-1 group/field">
        <div className="transition-[margin-right] duration-200 ease-in-out group-hover/field:mr-11">
          <Input
            value={row.value}
            onChange={(e) => onUpdate(row.id, e.target.value)}
            placeholder="Enter size"
            className="h-9"
          />
        </div>
        <div className="absolute right-0 top-0 w-0 group-hover/field:w-9 overflow-hidden transition-[width] duration-200 ease-in-out">
          <Button
            type="button"
            variant="outline"
            onClick={() => onDelete(row.id)}
            className="h-9 w-9 text-tertiary hover:text-destructive flex-shrink-0"
          >
            <Icons.X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function SizeModal({ open, onOpenChange, selectedCategory, onSave, prefillSize }: SizeModalProps) {
  // Automatically trim to level 2 category
  const level2Category = React.useMemo(() => {
    return getLevel2CategoryPath(selectedCategory || "");
  }, [selectedCategory]);

  const [category, setCategory] = React.useState(level2Category);
  const [rows, setRows] = React.useState<SizeRow[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const activeRow = React.useMemo(
    () => rows.find((row) => row.id === activeId),
    [activeId, rows]
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setRows((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over?.id);

        const next = [...items];
        const [removed] = next.splice(oldIndex, 1);
        if (removed) {
          next.splice(newIndex, 0, removed);
        }
        return next;
      });
    }
    setActiveId(null);
  }, []);

  const updateRow = (id: string, value: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, value } : row)));
  };

  const deleteRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const addRow = () => {
    const newRow: SizeRow = {
      id: Date.now().toString(),
      value: "",
    };
    setRows((prev) => [...prev, newRow]);
  };

  const handleSave = () => {
    const sizeValues = rows.map((r) => r.value).filter((v) => v.trim());
    const categoryKey = getCategoryKey(category);
    
    if (categoryKey) {
      // Save with the category key (e.g., "mens-tops")
      onSave(sizeValues, categoryKey);
    }
    
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  // Initialize rows based on category's default sizes
  React.useEffect(() => {
    if (open) {
      const level2 = getLevel2CategoryPath(selectedCategory || "");
      setCategory(level2);
      
      // Load default sizes for this category
      const defaultSizes = getSizesForCategory(level2);
      const initialRows: SizeRow[] = defaultSizes.map((size, index) => ({
        id: `${index}-${size}`,
        value: size,
      }));

      // If prefillSize is provided, add it to the end
      if (prefillSize?.trim()) {
        initialRows.push({ 
          id: Date.now().toString(), 
          value: prefillSize 
        });
      }

      setRows(initialRows);
    }
  }, [open, selectedCategory, prefillSize]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px]">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Size system</DialogTitle>
        </DialogHeader>

        <div className="px-6 flex flex-col gap-2 items-start">
          {/* Category Dropdown - Read-only, shows level 2 category */}
          <CategorySelect value={category} onChange={setCategory} className="w-full" />
          
          {/* Info message explaining level 2 category system */}
          {category !== "Select category" && (
            <div className="w-full space-y-1.5">
              <p className="type-small text-tertiary">
                You're editing the size system for <span className="font-medium text-primary">{category}</span>.
              </p>
              {selectedCategory && level2Category !== selectedCategory && (
                <p className="type-small text-tertiary">
                  This will apply to all subcategories under {category}.
                </p>
              )}
            </div>
          )}

          {/* Draggable Size Rows */}
          {category !== "Select category" && (
            <div className="flex flex-col gap-2 w-full mt-2">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                  {rows.map((row) => (
                    <DraggableSizeRow
                      key={row.id}
                      row={row}
                      onUpdate={updateRow}
                      onDelete={deleteRow}
                    />
                  ))}
                </SortableContext>
                {typeof window !== "undefined" &&
                  createPortal(
                    <DragOverlay dropAnimation={null}>
                      {activeRow ? (
                        <div className="flex items-center shadow-lg opacity-95">
                          <div className="h-9 w-9 flex items-center justify-center border-y border-l border-border bg-background text-tertiary">
                            <Icons.GripVertical className="h-4 w-4" />
                          </div>
                          <div className="flex-1">
                            <Input
                              value={activeRow.value}
                              readOnly
                              className="h-9 pointer-events-none"
                            />
                          </div>
                        </div>
                      ) : null}
                    </DragOverlay>,
                    document.body
                  )}
              </DndContext>
            </div>
          )}

          {/* Add Size Button */}
          {category !== "Select category" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addRow}
              icon={<Icons.Plus className="h-4 w-4" />}
              iconPosition="left"
            >
              Add size
            </Button>
          )}
        </div>

        <DialogFooter className="px-6 pb-6 pt-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

