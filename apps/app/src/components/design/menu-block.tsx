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
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import * as React from "react";
import { createPortal } from "react-dom";

interface MenuItem {
  id: string;
  label: string;
  url: string;
}

function DraggableMenuItem({
  menuItem,
  onLabelChange,
  onUrlChange,
  onRemove,
  isDragging,
}: {
  menuItem: MenuItem;
  onLabelChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onRemove: () => void;
  isDragging: boolean;
}) {
  const [urlPopoverOpen, setUrlPopoverOpen] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: menuItem.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  // Freeze hover state when popover is open
  const shouldShowButtons = isHovered || urlPopoverOpen;

  // Reset hover state when popover closes
  const handlePopoverOpenChange = (open: boolean) => {
    setUrlPopoverOpen(open);
    if (!open) {
      setIsHovered(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group/menuItem relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        if (!urlPopoverOpen) {
          setIsHovered(false);
        }
      }}
    >
      <div
        className={cn(
          "transition-[margin-right] duration-200 ease-in-out",
          shouldShowButtons ? "mr-[96px]" : "mr-0"
        )}
      >
        <div className="relative">
          {/* Drag handle inside input field (like checkmark was) */}
          <div
            {...attributes}
            {...listeners}
            role="button"
            aria-label="Drag to reorder menu item"
            tabIndex={0}
            className="absolute left-2 top-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing text-tertiary hover:text-secondary transition-colors z-10 pointer-events-auto"
          >
            <Icons.GripVertical className="h-4 w-4" />
          </div>

          {/* Input field */}
          <Input
            value={menuItem.label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="Enter menu item label..."
            className="h-9 w-full pl-8 pr-8"
            maxLength={50}
          />

          {/* Chevron on the right (always visible, primary color) */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icons.ChevronRight className="h-4 w-4 text-primary" />
          </div>
        </div>
      </div>

      {/* Action buttons (Link and X) with spacing */}
      <div
        className={cn(
          "absolute right-0 top-0 flex gap-2 overflow-hidden transition-[width] duration-200 ease-in-out items-center pl-2",
          shouldShowButtons ? "w-[96px]" : "w-0"
        )}
      >
        {/* Link button */}
        <Popover open={urlPopoverOpen} onOpenChange={handlePopoverOpenChange}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              onClick={() => setUrlPopoverOpen(true)}
              className="h-9 w-9 text-tertiary hover:text-primary flex-shrink-0"
            >
              <Icons.Link className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-4"
            align="end"
            sideOffset={4}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor={`url-${menuItem.id}`} className="type-small text-secondary">
                URL
              </Label>
              <Input
                id={`url-${menuItem.id}`}
                value={menuItem.url}
                onChange={(e) => onUrlChange(e.target.value)}
                placeholder="Enter URL..."
                className="h-9"
              />
            </div>
          </PopoverContent>
        </Popover>

        {/* X button */}
        <Button
          type="button"
          variant="outline"
          onClick={onRemove}
          className="h-9 w-9 text-tertiary hover:text-destructive flex-shrink-0"
        >
          <Icons.X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function MenuBlock() {
  // Initialize with a single empty menu item
  const [menuItems, setMenuItems] = React.useState<MenuItem[]>(() => [
    {
      id: Date.now().toString(),
      label: "",
      url: "",
    },
  ]);

  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const addMenuItem = () => {
    setMenuItems((prev) => {
      if (prev.length < 5) {
        const newMenuItem: MenuItem = {
          id: Date.now().toString(),
          label: "",
          url: "",
        };
        return [...prev, newMenuItem];
      }
      return prev;
    });
  };

  const updateMenuItemLabel = (id: string, value: string) => {
    // Limit to 50 characters
    if (value.length <= 50) {
      setMenuItems((prev) =>
        prev.map((menuItem) => (menuItem.id === id ? { ...menuItem, label: value } : menuItem)),
      );
    }
  };

  const updateMenuItemUrl = (id: string, value: string) => {
    setMenuItems((prev) =>
      prev.map((menuItem) => (menuItem.id === id ? { ...menuItem, url: value } : menuItem)),
    );
  };

  const removeMenuItem = (id: string) => {
    setMenuItems((prev) => prev.filter((menuItem) => menuItem.id !== id));
  };

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }

    const oldIndex = menuItems.findIndex((item) => item.id === active.id);
    const newIndex = menuItems.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      setActiveId(null);
      return;
    }

    const next = [...menuItems];
    const [removed] = next.splice(oldIndex, 1);
    if (removed) {
      next.splice(newIndex, 0, removed);
    }

    setMenuItems(next);
    setActiveId(null);
  }, [menuItems]);

  const activeItem = React.useMemo(
    () => menuItems.find((item) => item.id === activeId),
    [activeId, menuItems],
  );

  const canAddMenuItem = menuItems.length < 5;

  return (
    <div className="border border-border bg-background">
      <div className="p-4 flex flex-col gap-3">
        <p className="type-p !font-medium text-primary">Menu</p>

        {/* Menu items with drag and drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={menuItems.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {menuItems.map((menuItem) => (
              <DraggableMenuItem
                key={menuItem.id}
                menuItem={menuItem}
                onLabelChange={(value) => updateMenuItemLabel(menuItem.id, value)}
                onUrlChange={(value) => updateMenuItemUrl(menuItem.id, value)}
                onRemove={() => removeMenuItem(menuItem.id)}
                isDragging={activeId === menuItem.id}
              />
            ))}
          </SortableContext>
          {typeof window !== "undefined" &&
            createPortal(
              <DragOverlay dropAnimation={null}>
                {activeItem ? (
                  <div className="relative flex items-center bg-background shadow-lg border border-border opacity-95">
                    <div className="w-10 h-9 flex items-center justify-center flex-shrink-0">
                      <Icons.GripVertical className="h-4 w-4 text-tertiary" />
                    </div>
                    <div className="h-9 flex-1 flex items-center px-3">
                      <span className="type-p text-primary">
                        {activeItem.label || "Enter menu item label..."}
                      </span>
                    </div>
                    <div className="absolute right-0 top-0 h-9 flex items-center justify-center pr-2">
                      <Icons.ChevronRight className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )}
        </DndContext>
      </div>

      {/* Footer with Add Button */}
      {canAddMenuItem && (
        <div className="border-t border-border px-4 py-3 bg-accent-light">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addMenuItem}
            icon={<Icons.Plus className="h-4 w-4" />}
            iconPosition="left"
          >
            Add menu item
          </Button>
        </div>
      )}
    </div>
  );
}
