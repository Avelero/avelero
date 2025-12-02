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
import { Switch } from "@v1/ui/switch";
import * as React from "react";
import { createPortal } from "react-dom";

interface MenuItem {
  id: string;
  label: string;
  url: string;
}

interface SetMenuProps {
  menuType: "primary" | "secondary";
}

function DraggableMenuItem({
  item,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onSave,
  editLabel,
  editUrl,
  onEditLabelChange,
  onEditUrlChange,
}: {
  item: MenuItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (id: string, label: string, url: string) => void;
  onDelete: (id: string) => void;
  onSave: () => void;
  editLabel: string;
  editUrl: string;
  onEditLabelChange: (value: string) => void;
  onEditUrlChange: (value: string) => void;
}) {
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

  const handleContentClick = () => {
    if (!isExpanded) {
      onToggleExpand();
    }
  };

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isExpanded) {
      onSave();
    } else {
      onDelete(item.id);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="group/item relative">
      <div className="transition-[margin-right] duration-200 ease-in-out group-hover/item:mr-11">
        <div className="flex items-start">

          {/* Content */}
          <div
            className="relative flex flex-row items-start w-full border border-border bg-background cursor-pointer group"
            onClick={handleContentClick}
          >
            {/* Drag handle */}
            <div
                {...attributes}
                {...listeners}
                onClick={(e) => e.stopPropagation()}
                className="cursor-grab w-[34px] h-[34px] flex items-center justify-center bg-background active:cursor-grabbing text-tertiary hover:text-secondary transition-colors flex-shrink-0"
            >
                <Icons.GripVertical className="h-4 w-4" />
            </div>
            {isExpanded ? (
              <div className="flex flex-col pr-3 py-[7px] gap-2 w-full">
                <Input
                  value={editLabel}
                  onChange={(e) => onEditLabelChange(e.target.value)}
                  placeholder="Label"
                  onClick={(e) => e.stopPropagation()}
                  className="h-auto border-0 p-0 shadow-none focus-visible:ring-0 type-p text-primary placeholder:text-tertiary"
                  maxLength={50}
                />
                <Input
                  value={editUrl}
                  onChange={(e) => onEditUrlChange(e.target.value)}
                  placeholder="URL"
                  onClick={(e) => e.stopPropagation()}
                  className="h-auto border-0 p-0 shadow-none focus-visible:ring-0 type-p text-secondary placeholder:text-tertiary"
                  maxLength={200}
                />
              </div>
            ) : (
              <div className="flex items-center pr-3 h-[34px] gap-2">
                <span className={cn("type-p", item.label ? "text-primary" : "text-tertiary")}>
                  {item.label || "Untitled"}
                </span>
                <Icons.Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide-in action button */}
      <div className="absolute right-0 top-0 w-0 group-hover/item:w-9 overflow-hidden transition-[width] duration-200 ease-in-out">
        <Button
          type="button"
          variant="outline"
          onClick={handleActionClick}
          className={cn(
            "h-9 w-9 flex-shrink-0",
            isExpanded
              ? "text-brand hover:text-brand"
              : "text-tertiary hover:text-destructive"
          )}
        >
          {isExpanded ? (
            <Icons.Check className="h-4 w-4" />
          ) : (
            <Icons.X className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

export function SetMenu({ menuType }: SetMenuProps) {
  const [menuItems, setMenuItems] = React.useState<MenuItem[]>([]);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [editLabel, setEditLabel] = React.useState("");
  const [editUrl, setEditUrl] = React.useState("");
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const title = menuType === "primary" ? "Primary menu" : "Secondary menu";

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const activeItem = React.useMemo(
    () => menuItems.find((item) => item.id === activeId),
    [activeId, menuItems],
  );

  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = React.useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setMenuItems((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);

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

  const addMenuItem = () => {
    if (menuItems.length < 5) {
      const newItem: MenuItem = {
        id: Date.now().toString(),
        label: "",
        url: "",
      };
      setMenuItems((prev) => [...prev, newItem]);
    }
  };

  const updateMenuItem = (id: string, label: string, url: string) => {
    setMenuItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, label, url } : item)),
    );
  };

  const removeMenuItem = (id: string) => {
    setMenuItems((prev) => prev.filter((item) => item.id !== id));
    if (expandedId === id) {
      setExpandedId(null);
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      const item = menuItems.find((i) => i.id === id);
      if (item) {
        setEditLabel(item.label);
        setEditUrl(item.url);
      }
      setExpandedId(id);
    }
  };

  const handleSave = (id: string) => {
    updateMenuItem(id, editLabel, editUrl);
    setExpandedId(null);
  };

  const canAddMenuItem = menuItems.length < 5;

  return (
    <div className="border border-border bg-background">
      <div className="p-4 flex flex-col gap-3">
      <div className="flex flex-row justify-between items-center">
            <p className="type-p !font-medium text-primary">{title}</p>
            <Switch
                checked={true}
                onCheckedChange={() => {}}
                className="max-w-[250px]"
            />
        </div>

        {/* Menu items */}
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
            {menuItems.map((item) => (
              <DraggableMenuItem
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                onToggleExpand={() => toggleExpand(item.id)}
                onUpdate={updateMenuItem}
                onDelete={removeMenuItem}
                onSave={() => handleSave(item.id)}
                editLabel={editLabel}
                editUrl={editUrl}
                onEditLabelChange={setEditLabel}
                onEditUrlChange={setEditUrl}
              />
            ))}
          </SortableContext>
          {typeof window !== "undefined" &&
            createPortal(
              <DragOverlay dropAnimation={null}>
                {activeItem ? (
                  <div className="relative flex flex-row items-start w-full border border-border bg-background  shadow-lg">
                    <div className="h-[34px] w-[34px] flex items-center justify-center text-tertiary">
                      <Icons.GripVertical className="h-4 w-4" />
                    </div>
                    <div className="flex items-center pr-3 h-[34px]">
                      <span className={cn("type-p", activeItem.label ? "text-primary" : "text-tertiary")}>
                        {activeItem.label || "Untitled"}
                      </span>
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
