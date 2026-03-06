"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import {
  type DragEndEvent,
  DndContext,
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
import type {
  ComponentType,
  LayoutComponentInstance,
  ZoneId,
} from "@v1/dpp-components";
import { COMPONENT_LIBRARY } from "@v1/dpp-components/lib/component-library";
import type { ComponentDefinition } from "@v1/dpp-components/lib/component-library-types";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COMPONENT_TREE,
  findComponentById,
  hasConfigContent,
  hasEditableContent,
} from "../../registry";
import { AddComponentPopover } from "./add-component-popover";

// =============================================================================
// INSERT LINE (blue line with + icon between items, Shopify-style)
// Shows on hover with 500ms debounce.
// =============================================================================

interface InsertLineProps {
  zoneId: ZoneId;
  position: number;
}

function InsertLine({ zoneId, position }: InsertLineProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addInstance } = useDesignEditor();

  const handleAdd = (componentType: ComponentType) => {
    addInstance(zoneId, componentType, position);
    setOpen(false);
    setVisible(false);
  };

  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setVisible(true);
    }, 500);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const isActive = visible || open;

  return (
    <div
      className="relative h-1 z-10"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* When visible, expand the hover hitbox to 8px so line doesn't flicker away */}
      {isActive && (
        <div
          className="absolute inset-x-0 -top-0.5 -bottom-0.5"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}
      {/* Visible line + popover trigger */}
      <AddComponentPopover
        zoneId={zoneId}
        open={open}
        onOpenChange={setOpen}
        onSelect={handleAdd}
      >
        <button
          type="button"
          className={cn(
            "absolute inset-x-2 top-1/2 -translate-y-1/2 flex items-center overflow-visible transition-opacity cursor-pointer",
            isActive ? "opacity-100" : "opacity-0 pointer-events-none",
          )}
        >
          <div className="flex-1 h-[2px] bg-brand" />
          <div className="flex items-center justify-center w-4 h-4 rounded-full bg-brand text-brand-foreground shrink-0">
            <Icons.Plus className="h-2.5 w-2.5" />
          </div>
          <div className="flex-1 h-[2px] bg-brand" />
        </button>
      </AddComponentPopover>
    </div>
  );
}

// =============================================================================
// CHILD TREE ITEM (recursive, for editorTree children)
// Matches the old main branch LayoutTreeItem style exactly.
// =============================================================================

interface ChildTreeItemProps {
  item: ComponentDefinition;
  level: number;
  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
  onItemClick: (id: string) => void;
  onItemHover: (id: string | null) => void;
}

function ChildTreeItem({
  item,
  level,
  expandedItems,
  onToggleExpand,
  onItemClick,
  onItemHover,
}: ChildTreeItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  const isEditable = hasEditableContent(item) || hasConfigContent(item);

  const indentPx = level * 24;

  const handleClick = () => {
    if (isEditable) {
      onItemClick(item.id);
    } else if (hasChildren) {
      onToggleExpand(item.id);
    }
  };

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "relative flex items-center w-full h-7 rounded hover:bg-accent",
          isEditable ? "cursor-pointer" : "cursor-default",
        )}
        style={{ paddingLeft: `${indentPx}px` }}
        onClick={handleClick}
        onMouseEnter={() => onItemHover(item.id)}
        onMouseLeave={() => onItemHover(null)}
      >
          {/* Expand/collapse chevron or spacer */}
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(item.id);
              }}
              className="flex items-center justify-center min-w-4 h-7 hover:bg-accent-dark rounded"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <Icons.ChevronRight
                className={cn(
                  "h-3 w-3 text-tertiary transition-transform duration-150",
                  isExpanded && "rotate-90",
                )}
              />
            </button>
          ) : (
            <div className="min-w-4" />
          )}

          {/* Icon */}
          <div className="flex items-center justify-center min-w-4 h-7">
            <Icons.GalleryVertical className="h-3 w-3 text-tertiary" />
          </div>

          {/* Label */}
          <div className="flex items-center px-2 h-7">
            <span className="type-small text-primary truncate">
              {item.displayName}
            </span>
          </div>
        </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {item.children!.map((child) => (
            <ChildTreeItem
              key={child.id}
              item={child}
              level={level + 1}
              expandedItems={expandedItems}
              onToggleExpand={onToggleExpand}
              onItemClick={onItemClick}
              onItemHover={onItemHover}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// FIXED ITEM (Header / Footer - with expandable children tree)
// =============================================================================

interface FixedItemProps {
  componentDef: ComponentDefinition;
  onItemHover: (id: string | null) => void;
}

function FixedItem({ componentDef, onItemHover }: FixedItemProps) {
  const { navigateToComponent, expandedItems, toggleExpanded } =
    useDesignEditor();
  const hasChildren =
    componentDef.children && componentDef.children.length > 0;
  const isExpanded = expandedItems.has(componentDef.id);
  const isEditable =
    hasEditableContent(componentDef) || hasConfigContent(componentDef);

  const handleClick = () => {
    if (isEditable) {
      navigateToComponent(componentDef.id);
    }
  };

  const handleChildClick = (childId: string) => {
    navigateToComponent(childId);
  };

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "relative flex items-center w-full h-7 rounded hover:bg-accent",
          isEditable ? "cursor-pointer" : "cursor-default",
        )}
        onClick={handleClick}
        onMouseEnter={() => onItemHover(componentDef.id)}
        onMouseLeave={() => onItemHover(null)}
      >
        {/* Expand/collapse chevron or spacer */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(componentDef.id);
            }}
            className="flex items-center justify-center min-w-4 h-7 hover:bg-accent-dark rounded"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <Icons.ChevronRight
              className={cn(
                "h-3 w-3 text-tertiary transition-transform duration-150",
                isExpanded && "rotate-90",
              )}
            />
          </button>
        ) : (
          <div className="min-w-4" />
        )}

        {/* Icon */}
        <div className="flex items-center justify-center min-w-4 h-7">
          <Icons.GalleryVertical className="h-3 w-3 text-tertiary" />
        </div>

        {/* Label */}
        <div className="flex items-center px-2 h-7">
          <span className="type-small text-primary truncate">
            {componentDef.displayName}
          </span>
        </div>
      </div>

      {/* Children tree */}
      {isExpanded && hasChildren && (
        <div>
          {componentDef.children!.map((child) => (
            <ChildTreeItem
              key={child.id}
              item={child}
              level={1}
              expandedItems={expandedItems}
              onToggleExpand={toggleExpanded}
              onItemClick={handleChildClick}
              onItemHover={onItemHover}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SORTABLE INSTANCE ITEM (with expandable editorTree children)
// =============================================================================

interface SortableInstanceItemProps {
  instance: LayoutComponentInstance;
  zoneId: ZoneId;
  onItemHover: (id: string | null) => void;
}

function SortableInstanceItem({
  instance,
  zoneId,
  onItemHover,
}: SortableInstanceItemProps) {
  const {
    navigateToInstance,
    deleteInstance,
    activeInstanceId,
    expandedItems,
    toggleExpanded,
    navigateToComponent,
  } = useDesignEditor();

  const entry = COMPONENT_LIBRARY[instance.componentType];
  const editorTree = entry?.editorTree as ComponentDefinition | undefined;
  const hasChildren = editorTree?.children && editorTree.children.length > 0;
  const isExpanded = expandedItems.has(instance.id);
  const isSelected = activeInstanceId === instance.id;

  const rootIsEditable = editorTree
    ? hasEditableContent(editorTree) || hasConfigContent(editorTree)
    : false;
  const isNavigable = rootIsEditable || hasChildren;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: instance.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleMainClick = () => {
    if (rootIsEditable) {
      navigateToInstance(zoneId, instance.id);
    } else if (hasChildren) {
      toggleExpanded(instance.id);
    }
  };

  const handleChildClick = (childId: string) => {
    navigateToComponent(childId);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex flex-col", isDragging && "opacity-50")}
    >
      {/* Main row */}
      <div
        className={cn(
          "group/instance relative flex items-center w-full h-7 rounded hover:bg-accent",
          isSelected && "bg-accent",
          isNavigable ? "cursor-pointer" : "cursor-default",
        )}
        onClick={handleMainClick}
        onMouseEnter={() => onItemHover(editorTree?.id ?? null)}
        onMouseLeave={() => onItemHover(null)}
      >
        {/* Expand/collapse chevron or spacer */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(instance.id);
            }}
            className="flex items-center justify-center min-w-4 h-7 hover:bg-accent-dark rounded"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            <Icons.ChevronRight
              className={cn(
                "h-3 w-3 text-tertiary transition-transform duration-150",
                isExpanded && "rotate-90",
              )}
            />
          </button>
        ) : (
          <div className="min-w-4" />
        )}

        {/* Icon: GalleryVertical by default, GripVertical on hover (drag handle) */}
        <div
          className="flex items-center justify-center min-w-4 h-7 touch-none rounded hover:bg-accent-dark"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <Icons.GalleryVertical className="h-3 w-3 text-tertiary group-hover/instance:hidden" />
          <Icons.GripVertical className="h-3 w-3 text-tertiary hidden group-hover/instance:block cursor-grab active:cursor-grabbing" />
        </div>

        {/* Label */}
        <div className="flex items-center px-2 h-7 flex-1 min-w-0">
          <span className="type-small text-primary truncate">
            {entry?.displayName ?? instance.componentType}
          </span>
        </div>

        {/* Right side: trash (on hover) */}
        <div className="flex items-center opacity-0 group-hover/instance:opacity-100 pr-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteInstance(zoneId, instance.id);
            }}
            className="flex items-center justify-center w-6 h-6 hover:bg-accent-dark rounded"
            aria-label="Delete component"
          >
            <Icons.Trash2 className="h-3 w-3 text-tertiary" />
          </button>
        </div>
      </div>

      {/* Children tree from editorTree */}
      {isExpanded && hasChildren && (
        <div>
          {editorTree!.children!.map((child) => (
            <ChildTreeItem
              key={child.id}
              item={child}
              level={1}
              expandedItems={expandedItems}
              onToggleExpand={toggleExpanded}
              onItemClick={handleChildClick}
              onItemHover={onItemHover}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// ZONE SECTION
// =============================================================================

const ZONE_LABELS: Record<ZoneId, string> = {
  "column-left": "Column (left)",
  "column-right": "Column (right)",
  content: "Content",
};

interface ZoneSectionProps {
  zoneId: ZoneId;
  instances: LayoutComponentInstance[];
  onItemHover: (id: string | null) => void;
}

function ZoneSection({ zoneId, instances, onItemHover }: ZoneSectionProps) {
  const { moveInstance } = useDesignEditor();
  const dndId = useMemo(() => `dnd-zone-${zoneId}`, [zoneId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = instances.findIndex((inst) => inst.id === active.id);
    const newIndex = instances.findIndex((inst) => inst.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    moveInstance(zoneId, active.id as string, newIndex);
  }

  return (
    <div className="flex flex-col">
      {/* Zone label */}
      <div className="flex items-center h-8 px-1">
        <span className="type-small font-medium text-secondary">
          {ZONE_LABELS[zoneId]}
        </span>
      </div>

      {/* Sortable instances with insert lines between them */}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={instances.map((inst) => inst.id)}
          strategy={verticalListSortingStrategy}
        >
          {instances.map((instance, index) => (
            <div key={instance.id}>
              {index > 0 && (
                <InsertLine zoneId={zoneId} position={index} />
              )}
              <SortableInstanceItem instance={instance} zoneId={zoneId} onItemHover={onItemHover} />
            </div>
          ))}
        </SortableContext>
      </DndContext>

      {/* Insert line between last item and Add section button */}
      {instances.length > 0 && (
        <InsertLine zoneId={zoneId} position={instances.length} />
      )}

      {/* Add section button */}
      <AddSectionButton zoneId={zoneId} instanceCount={instances.length} />
    </div>
  );
}

// =============================================================================
// ADD SECTION BUTTON
// =============================================================================

interface AddSectionButtonProps {
  zoneId: ZoneId;
  instanceCount: number;
}

function AddSectionButton({ zoneId, instanceCount }: AddSectionButtonProps) {
  const [open, setOpen] = useState(false);
  const { addInstance } = useDesignEditor();

  const handleAdd = (componentType: ComponentType) => {
    addInstance(zoneId, componentType, instanceCount);
    setOpen(false);
  };

  return (
    <AddComponentPopover
      zoneId={zoneId}
      open={open}
      onOpenChange={setOpen}
      onSelect={handleAdd}
    >
      <button
        type="button"
        className={cn(
          "flex items-center w-full h-7 rounded type-small text-link cursor-pointer hover:bg-accent",
          open && "bg-accent",
        )}
      >
        {/* Spacer matching chevron area */}
        <div className="min-w-4" />
        {/* Plus icon aligned with list item icons */}
        <div className="flex items-center justify-center min-w-4 h-7">
          <Icons.Plus className="h-3 w-3" />
        </div>
        <div className="flex items-center px-2 h-7">
          <span>Add section</span>
        </div>
      </button>
    </AddComponentPopover>
  );
}

// =============================================================================
// LAYOUT TREE (Main Export)
// =============================================================================

export function LayoutTree() {
  const {
    themeConfigDraft,
    setHoveredComponentId,
  } = useDesignEditor();
  const { zones } = themeConfigDraft.layout;

  const headerDef = COMPONENT_TREE.find((c) => c.id === "header");
  const footerDef = COMPONENT_TREE.find((c) => c.id === "footer");

  const handleItemHover = useCallback(
    (id: string | null) => {
      if (id === null) {
        setHoveredComponentId(null);
        return;
      }

      // Only highlight editable components in the preview
      const component = findComponentById(id);
      if (
        !component ||
        (!hasEditableContent(component) && !hasConfigContent(component))
      ) {
        setHoveredComponentId(null);
        return;
      }

      setHoveredComponentId(id);
    },
    [setHoveredComponentId],
  );

  return (
    <div
      className="flex-1 p-2 overflow-y-auto scrollbar-hide"
      onMouseLeave={() => handleItemHover(null)}
    >
      {/* Header section */}
      <div className="flex items-center h-8 px-1">
        <span className="type-small font-medium text-secondary">Header</span>
      </div>
      {headerDef && <FixedItem componentDef={headerDef} onItemHover={handleItemHover} />}

      <div className="border-t my-1" />

      {/* Column (left) zone */}
      <ZoneSection zoneId="column-left" instances={zones["column-left"]} onItemHover={handleItemHover} />

      <div className="border-t my-1" />

      {/* Column (right) zone */}
      <ZoneSection zoneId="column-right" instances={zones["column-right"]} onItemHover={handleItemHover} />

      <div className="border-t my-1" />

      {/* Content zone */}
      <ZoneSection zoneId="content" instances={zones.content} onItemHover={handleItemHover} />

      <div className="border-t my-1" />

      {/* Footer section */}
      <div className="flex items-center h-8 px-1">
        <span className="type-small font-medium text-secondary">Footer</span>
      </div>
      {footerDef && <FixedItem componentDef={footerDef} onItemHover={handleItemHover} />}
    </div>
  );
}
