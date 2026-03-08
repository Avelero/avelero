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
import type { Section, SectionType, ZoneId } from "@v1/dpp-components";
import { SECTION_REGISTRY, type ComponentDefinition } from "@v1/dpp-components";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  COMPONENT_TREE,
  findComponentById,
  hasConfigContent,
  hasEditableContent,
} from "../../registry";
import { AddComponentPopover } from "./add-component-popover";

// =============================================================================
// INSERT LINE
// =============================================================================

interface InsertLineProps {
  zoneId: ZoneId;
  position: number;
}

function InsertLine({ zoneId, position }: InsertLineProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { addSection } = useDesignEditor();

  const handleAdd = (sectionType: SectionType) => {
    addSection(zoneId, sectionType, position);
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

  const isActive = visible || open;

  return (
    <div
      className="relative h-1 z-10"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isActive && (
        <div
          className="absolute inset-x-0 -top-0.5 -bottom-0.5"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}
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

        <div className="flex items-center justify-center min-w-4 h-7">
          <Icons.GalleryVertical className="h-3 w-3 text-tertiary" />
        </div>

        <div className="flex items-center px-2 h-7">
          <span className="type-small text-primary truncate">
            {item.displayName}
          </span>
        </div>
      </div>

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
// FIXED ITEM (Header / Footer)
// =============================================================================

interface FixedItemProps {
  componentDef: ComponentDefinition;
  onItemHover: (id: string | null) => void;
}

function FixedItem({ componentDef, onItemHover }: FixedItemProps) {
  const { navigateToComponent, expandedItems, toggleExpanded } =
    useDesignEditor();
  const hasChildren = componentDef.children && componentDef.children.length > 0;
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

        <div className="flex items-center justify-center min-w-4 h-7">
          <Icons.GalleryVertical className="h-3 w-3 text-tertiary" />
        </div>

        <div className="flex items-center px-2 h-7">
          <span className="type-small text-primary truncate">
            {componentDef.displayName}
          </span>
        </div>
      </div>

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
// SORTABLE SECTION ITEM
// =============================================================================

interface SortableSectionItemProps {
  section: Section;
  zoneId: ZoneId;
  onItemHover: (id: string | null) => void;
}

function SortableSectionItem({
  section,
  zoneId,
  onItemHover,
}: SortableSectionItemProps) {
  const {
    navigateToSectionInstance,
    deleteSection,
    activeSectionId,
    expandedItems,
    toggleExpanded,
    navigateToComponent,
  } = useDesignEditor();

  const entry = SECTION_REGISTRY[section.type as SectionType];
  const editorTree = entry?.schema.editorTree as
    | ComponentDefinition
    | undefined;
  const hasChildren = editorTree?.children && editorTree.children.length > 0;
  const isExpanded = expandedItems.has(section.id);
  const isSelected = activeSectionId === section.id;

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
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleMainClick = () => {
    if (rootIsEditable) {
      navigateToSectionInstance(zoneId, section.id);
    } else if (hasChildren) {
      toggleExpanded(section.id);
    }
  };

  const handleChildClick = (childId: string) => {
    // Set the section as active target first, then navigate to child
    navigateToSectionInstance(zoneId, section.id);
    navigateToComponent(childId);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex flex-col", isDragging && "opacity-50")}
    >
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
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(section.id);
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

        <div
          className="flex items-center justify-center min-w-4 h-7 touch-none rounded hover:bg-accent-dark"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <Icons.GalleryVertical className="h-3 w-3 text-tertiary group-hover/instance:hidden" />
          <Icons.GripVertical className="h-3 w-3 text-tertiary hidden group-hover/instance:block cursor-grab active:cursor-grabbing" />
        </div>

        <div className="flex items-center px-2 h-7 flex-1 min-w-0">
          <span className="type-small text-primary truncate">
            {entry?.schema.displayName ?? section.type}
          </span>
        </div>

        <div className="flex items-center opacity-0 group-hover/instance:opacity-100 pr-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              deleteSection(zoneId, section.id);
            }}
            className="flex items-center justify-center w-6 h-6 hover:bg-accent-dark rounded"
            aria-label="Delete section"
          >
            <Icons.Trash2 className="h-3 w-3 text-tertiary" />
          </button>
        </div>
      </div>

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
  sidebar: "Sidebar",
  canvas: "Canvas",
};

interface ZoneSectionProps {
  zoneId: ZoneId;
  sections: Section[];
  onItemHover: (id: string | null) => void;
}

function ZoneSection({ zoneId, sections, onItemHover }: ZoneSectionProps) {
  const { moveSection } = useDesignEditor();
  const dndId = useMemo(() => `dnd-zone-${zoneId}`, [zoneId]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    moveSection(zoneId, active.id as string, newIndex);
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center h-8 px-1">
        <span className="type-small font-medium text-secondary">
          {ZONE_LABELS[zoneId]}
        </span>
      </div>

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sections.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {sections.map((section, index) => (
            <div key={section.id}>
              {index > 0 && <InsertLine zoneId={zoneId} position={index} />}
              <SortableSectionItem
                section={section}
                zoneId={zoneId}
                onItemHover={onItemHover}
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>

      {sections.length > 0 && (
        <InsertLine zoneId={zoneId} position={sections.length} />
      )}

      <AddSectionButton zoneId={zoneId} sectionCount={sections.length} />
    </div>
  );
}

// =============================================================================
// ADD SECTION BUTTON
// =============================================================================

interface AddSectionButtonProps {
  zoneId: ZoneId;
  sectionCount: number;
}

function AddSectionButton({ zoneId, sectionCount }: AddSectionButtonProps) {
  const [open, setOpen] = useState(false);
  const { addSection } = useDesignEditor();

  const handleAdd = (sectionType: SectionType) => {
    addSection(zoneId, sectionType, sectionCount);
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
        <div className="min-w-4" />
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
  const { passportDraft, setHoveredComponentId } = useDesignEditor();

  const headerDef = COMPONENT_TREE.find((c) => c.id === "header");
  const footerDef = COMPONENT_TREE.find((c) => c.id === "footer");

  const handleItemHover = useCallback(
    (id: string | null) => {
      if (id === null) {
        setHoveredComponentId(null);
        return;
      }

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
      {headerDef && (
        <FixedItem componentDef={headerDef} onItemHover={handleItemHover} />
      )}

      <div className="border-t my-1" />

      {/* Sidebar zone */}
      <ZoneSection
        zoneId="sidebar"
        sections={passportDraft.sidebar}
        onItemHover={handleItemHover}
      />

      <div className="border-t my-1" />

      {/* Canvas zone */}
      <ZoneSection
        zoneId="canvas"
        sections={passportDraft.canvas}
        onItemHover={handleItemHover}
      />

      <div className="border-t my-1" />

      {/* Footer section */}
      <div className="flex items-center h-8 px-1">
        <span className="type-small font-medium text-secondary">Footer</span>
      </div>
      {footerDef && (
        <FixedItem componentDef={footerDef} onItemHover={handleItemHover} />
      )}
    </div>
  );
}
