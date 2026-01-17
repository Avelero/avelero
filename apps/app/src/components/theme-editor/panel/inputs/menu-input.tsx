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
import { useDesignEditor } from "@/contexts/design-editor-provider";
import { scrapeUrlTitle } from "@/actions/design/scrape-url-title";
import { Icons } from "@v1/ui/icons";
import * as React from "react";
import { createPortal } from "react-dom";

// =============================================================================
// TYPES
// =============================================================================

interface MenuItem {
  label: string;
  url: string;
}

interface MenuItemInternal extends MenuItem {
  id: string;
  index: number; // Track original index for navigation
}

interface MenuInputProps {
  menuType: "primary" | "secondary";
  configPath: string; // e.g., "menus.primary"
}

type ViewState =
  | { type: "list" }
  | { type: "addUrl" }
  | { type: "loading"; url: string };

// =============================================================================
// DRAGGABLE MENU ITEM
// =============================================================================

function DraggableMenuItem({
  item,
  onEdit,
}: {
  item: MenuItemInternal;
  onEdit: (index: number) => void;
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

  const handleClick = () => {
    onEdit(item.index);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between border border-border pl-3 group bg-background hover:bg-accent cursor-pointer transition-colors duration-100"
      onClick={handleClick}
    >
      <div className="space-y-1 min-w-0 flex-1 overflow-hidden py-2">
        <p className="type-small text-foreground">{item.label || "Untitled"}</p>
        <p className="type-xsmall text-muted truncate">{item.url}</p>
      </div>
      <div
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[56px] w-[38px] items-center justify-center hover:cursor-grab active:cursor-grabbing"
      >
        <Icons.ChevronRight className="h-[14px] w-[14px] group-hover:hidden" />
        <Icons.GripVertical className="h-[14px] w-[14px] hidden group-hover:block" />
      </div>
    </div>
  );
}

// =============================================================================
// ADD BUTTON ROW
// =============================================================================

function AddButtonRow({ onClick }: { onClick: () => void }) {
  return (
    <div
      className="flex items-center justify-between border border-border pl-3 bg-background hover:bg-accent cursor-pointer transition-colors duration-100"
      onClick={onClick}
    >
      <div className="space-y-1 py-2">
        <p className="type-small text-foreground">Add button</p>
      </div>
      <div className="flex h-[56px] w-[38px] items-center justify-center">
        <Icons.Plus className="h-[14px] w-[14px]" />
      </div>
    </div>
  );
}

// =============================================================================
// ADD URL INPUT ROW
// =============================================================================

function AddUrlInputRow({
  onSubmit,
  onCancel,
}: {
  onSubmit: (url: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && url.trim()) {
      e.preventDefault();
      onSubmit(url.trim());
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleBlur = () => {
    // Small delay to allow click events to fire first
    setTimeout(() => {
      if (!url.trim()) {
        onCancel();
      }
    }, 150);
  };

  return (
    <div className="flex items-center justify-between border border-border pl-3 bg-background hover:bg-accent transition-colors duration-100">
      <div className="flex-1 py-2">
        <input
          ref={inputRef}
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="Add link URL"
          className="type-small text-foreground border-0 bg-transparent placeholder:text-muted focus-visible:outline-none focus-visible:ring-0 w-full"
        />
      </div>
      <div className="flex h-[56px] w-[38px] items-center justify-center">
        <Icons.Plus className="h-[14px] w-[14px]" />
      </div>
    </div>
  );
}

// =============================================================================
// LOADING ROW
// =============================================================================

function LoadingRow() {
  return (
    <div className="flex items-center justify-between border border-border pl-3 bg-background transition-colors duration-100">
      <div className="space-y-1 py-2">
        <p className="type-small text-muted">Searching URL...</p>
      </div>
      <div className="flex h-[56px] w-[38px] items-center justify-center">
        <Icons.Spinner className="h-[14px] w-[14px] animate-spin text-muted" />
      </div>
    </div>
  );
}

// =============================================================================
// MAIN MENU INPUT COMPONENT
// =============================================================================

export function MenuInput({ menuType, configPath }: MenuInputProps) {
  const { getConfigValue, updateConfigValue, navigateToMenuItemEdit } =
    useDesignEditor();
  const [viewState, setViewState] = React.useState<ViewState>({ type: "list" });
  const [activeId, setActiveId] = React.useState<string | null>(null);

  // Get current items from config
  const items = (getConfigValue(configPath) as MenuItem[] | undefined) ?? [];

  // Convert to internal items with IDs for drag-and-drop
  // Use only index for ID to allow duplicate label/url combinations
  const menuItemsWithIds = React.useMemo<MenuItemInternal[]>(
    () =>
      items.map((item, index) => ({
        id: `${menuType}-item-${index}`,
        label: item.label,
        url: item.url,
        index, // Store original index for navigation
      })),
    [items, menuType],
  );

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  const activeItem = React.useMemo(
    () => menuItemsWithIds.find((item) => item.id === activeId),
    [activeId, menuItemsWithIds],
  );

  // Handlers
  const handleDragStart = React.useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = menuItemsWithIds.findIndex((i) => i.id === active.id);
        const newIndex = menuItemsWithIds.findIndex((i) => i.id === over.id);

        const next = [...menuItemsWithIds];
        const [removed] = next.splice(oldIndex, 1);
        if (removed) {
          next.splice(newIndex, 0, removed);
        }

        // Convert back to external format and update config
        updateConfigValue(
          configPath,
          next.map(({ label, url }) => ({ label, url })),
        );
      }
      setActiveId(null);
    },
    [menuItemsWithIds, updateConfigValue, configPath],
  );

  const handleAddClick = () => {
    setViewState({ type: "addUrl" });
  };

  const handleAddUrlSubmit = async (url: string) => {
    let processedUrl = url;
    // Validate URL
    try {
      new URL(processedUrl);
    } catch {
      // If no protocol, try adding https://
      if (
        !processedUrl.startsWith("http://") &&
        !processedUrl.startsWith("https://")
      ) {
        processedUrl = `https://${processedUrl}`;
      }
      try {
        new URL(processedUrl);
      } catch {
        // Invalid URL, just use it as-is
        setViewState({ type: "list" });
        return;
      }
    }

    setViewState({ type: "loading", url: processedUrl });

    try {
      const result = await scrapeUrlTitle({ url: processedUrl });
      const title = result?.data?.title ?? "Link";

      // Add new item to config
      const newItems = [...items, { label: title, url: processedUrl }];
      updateConfigValue(configPath, newItems);
    } catch {
      // Fallback title
      const newItems = [...items, { label: "Link", url: processedUrl }];
      updateConfigValue(configPath, newItems);
    }

    setViewState({ type: "list" });
  };

  const handleAddUrlCancel = () => {
    setViewState({ type: "list" });
  };

  const handleEdit = (itemIndex: number) => {
    // Navigate to the menu item edit view using context
    navigateToMenuItemEdit(menuType, configPath, itemIndex);
  };

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={menuItemsWithIds.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          {menuItemsWithIds.map((item) => (
            <DraggableMenuItem key={item.id} item={item} onEdit={handleEdit} />
          ))}
        </SortableContext>

        {typeof window !== "undefined" &&
          createPortal(
            <DragOverlay dropAnimation={null}>
              {activeItem ? (
                <div className="flex items-center justify-between border border-border pl-3 bg-background shadow-lg">
                  <div className="space-y-1 min-w-0 flex-1 overflow-hidden py-2">
                    <p className="type-small text-foreground">
                      {activeItem.label || "Untitled"}
                    </p>
                    <p className="type-xsmall text-muted truncate">
                      {activeItem.url}
                    </p>
                  </div>
                  <div className="flex h-[56px] w-[38px] items-center justify-center">
                    <Icons.GripVertical className="h-[14px] w-[14px]" />
                  </div>
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>

      {/* State-dependent row - hide Add button when at max 5 items */}
      {viewState.type === "list" && items.length < 5 && (
        <AddButtonRow onClick={handleAddClick} />
      )}
      {viewState.type === "addUrl" && (
        <AddUrlInputRow
          onSubmit={handleAddUrlSubmit}
          onCancel={handleAddUrlCancel}
        />
      )}
      {viewState.type === "loading" && <LoadingRow />}
    </div>
  );
}
