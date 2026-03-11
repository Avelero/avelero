"use client";

/**
 * Layout tree for the passport theme editor.
 *
 * Renders fixed items alongside sortable section zones and keeps hover/selection
 * state in sync with the preview pane.
 */

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
import {
  COMPONENT_REGISTRY,
  MODAL_SCHEMA_REGISTRY,
  SECTION_REGISTRY,
  buildDppSelectableNodeId,
  type ComponentDefinition,
  type DppData,
  type Section,
  type SectionType,
  type ZoneId,
} from "@v1/dpp-components";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hasConfigContent, hasEditableContent } from "../../registry";
import { AddComponentPopover } from "./add-component-popover";

/**
 * Build the preview node id for a fixed component target.
 */
function getFixedNodeId(editorId: string): string {
  return buildDppSelectableNodeId({ kind: "fixed", editorId });
}

/**
 * Build the preview node id for a section target inside a specific section instance.
 */
function getSectionNodeId(
  zoneId: ZoneId,
  sectionId: string,
  editorId: string,
  kind: "section-root" | "section-child",
): string {
  return buildDppSelectableNodeId({ kind, editorId, sectionId, zoneId });
}

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
  getNodeId: (editorId: string) => string | null;
  expandedItems: Set<string>;
  onToggleExpand: (id: string) => void;
  onItemClick: (id: string, nodeId: string | null) => void;
  onItemHover: (nodeId: string | null) => void;
}

function ChildTreeItem({
  item,
  level,
  getNodeId,
  expandedItems,
  onToggleExpand,
  onItemClick,
  onItemHover,
}: ChildTreeItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  const isEditable = hasEditableContent(item) || hasConfigContent(item);
  const nodeId = getNodeId(item.id);

  const indentPx = level * 24;

  const handleClick = () => {
    if (isEditable) {
      onItemClick(item.id, nodeId);
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
        onMouseEnter={() => onItemHover(isEditable ? nodeId : null)}
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
              getNodeId={getNodeId}
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
// FIXED ITEM (Header / Product Image / Footer)
// =============================================================================

interface FixedItemProps {
  componentDef: ComponentDefinition;
  onItemHover: (nodeId: string | null) => void;
}

function FixedItem({ componentDef, onItemHover }: FixedItemProps) {
  const {
    navigateToComponent,
    expandedItems,
    setSelectedNodeId,
    toggleExpanded,
  } = useDesignEditor();
  const hasChildren = componentDef.children && componentDef.children.length > 0;
  const isExpanded = expandedItems.has(componentDef.id);
  const isEditable =
    hasEditableContent(componentDef) || hasConfigContent(componentDef);
  const rootNodeId = isEditable ? getFixedNodeId(componentDef.id) : null;

  const handleClick = () => {
    if (isEditable && rootNodeId) {
      setSelectedNodeId(rootNodeId);
      navigateToComponent(componentDef.id);
    }
  };

  const handleChildClick = (childId: string, nodeId: string | null) => {
    if (nodeId) {
      setSelectedNodeId(nodeId);
    }
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
        onMouseEnter={() => onItemHover(rootNodeId)}
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
              getNodeId={getFixedNodeId}
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
// MODAL PREVIEW ITEM (expandable with children + eye icon toggle)
// =============================================================================

/**
 * Check whether the current preview data has enough information
 * to render a meaningful modal for the given section type.
 */
function hasModalData(sectionType: string, data: DppData): boolean {
  switch (sectionType) {
    case "impact":
      return !!(
        data.environmental?.carbonEmissions || data.environmental?.waterUsage
      );
    case "description":
      // Description modal only needs the product to exist — always available.
      return true;
    case "details":
      return !!data.manufacturing?.manufacturer;
    case "materials":
      return !!(
        data.materials?.composition &&
        data.materials.composition.length > 0 &&
        data.materials.composition.some((m) => m.certification)
      );
    case "journey":
      return !!(
        data.manufacturing?.supplyChain &&
        data.manufacturing.supplyChain.length > 0
      );
    default:
      return true;
  }
}

/** Maps section types to their modal display names in the editor. */
const MODAL_PREVIEW_ITEMS: { sectionType: string; displayName: string }[] = [
  { sectionType: "impact", displayName: "Impact" },
  { sectionType: "description", displayName: "Description" },
  { sectionType: "details", displayName: "Manufacturer" },
  { sectionType: "materials", displayName: "Certificate" },
  { sectionType: "journey", displayName: "Operator" },
];

interface ModalPreviewItemProps {
  sectionType: string;
  displayName: string;
  modalChildren: ComponentDefinition[];
  disabled?: boolean;
  onItemHover: (nodeId: string | null) => void;
}

function ModalPreviewItem({
  sectionType,
  displayName,
  modalChildren,
  disabled,
  onItemHover,
}: ModalPreviewItemProps) {
  const {
    previewModalType,
    setPreviewModalType,
    expandedItems,
    toggleExpanded,
    navigateToComponent,
    setSelectedNodeId,
  } = useDesignEditor();
  const isActive = previewModalType === sectionType;
  const expandKey = `modal-preview-${sectionType}`;
  const isExpanded = expandedItems.has(expandKey) && !disabled;
  const hasChildren = modalChildren.length > 0;

  // Close preview if this modal becomes disabled while active.
  useEffect(() => {
    if (disabled && isActive) {
      setPreviewModalType(null);
    }
  }, [disabled, isActive, setPreviewModalType]);

  const handleRowClick = () => {
    if (disabled) return;
    if (hasChildren) {
      toggleExpanded(expandKey);
    }
  };

  const handleChildClick = (childId: string, nodeId: string | null) => {
    if (nodeId) {
      setSelectedNodeId(nodeId);
    }
    navigateToComponent(childId);
  };

  const row = (
    <div
      className={cn(
        "group/modal-item relative flex items-center w-full h-7 rounded",
        disabled ? "cursor-default" : "hover:bg-accent cursor-pointer",
      )}
      onClick={handleRowClick}
    >
      {hasChildren && !disabled ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleExpanded(expandKey);
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
        <Icons.GalleryVertical
          className={cn(
            "h-3 w-3",
            disabled ? "text-muted-foreground/50" : "text-tertiary",
          )}
        />
      </div>

      <div className="flex items-center px-2 h-7 flex-1 min-w-0">
        <span
          className={cn(
            "type-small truncate",
            disabled ? "text-muted-foreground" : "text-primary",
          )}
        >
          {displayName}
        </span>
      </div>

      {/* Eye icon: visible on hover when hidden, always visible when open */}
      {!disabled && (
        <div
          className={cn(
            "flex items-center pr-1",
            !isActive && "opacity-0 group-hover/modal-item:opacity-100",
          )}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewModalType(isActive ? null : sectionType);
            }}
            className="flex items-center justify-center w-6 h-6 hover:bg-accent-dark rounded"
            aria-label={isActive ? "Hide modal preview" : "Show modal preview"}
          >
            {isActive ? (
              <Icons.Eye className="h-3 w-3 text-tertiary" />
            ) : (
              <Icons.EyeOff className="h-3 w-3 text-tertiary" />
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col">
      {disabled ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{row}</TooltipTrigger>
            <TooltipContent side="right">Use mock data to view</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        row
      )}

      {isExpanded && hasChildren && (
        <div>
          {modalChildren.map((child) => (
            <ChildTreeItem
              key={child.id}
              item={child}
              level={1}
              getNodeId={getFixedNodeId}
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
  onItemHover: (nodeId: string | null) => void;
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
    setSelectedNodeId,
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
  const rootNodeId =
    rootIsEditable && editorTree
      ? getSectionNodeId(zoneId, section.id, editorTree.id, "section-root")
      : null;

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
    if (rootIsEditable && rootNodeId) {
      setSelectedNodeId(rootNodeId);
      navigateToSectionInstance(zoneId, section.id);
    } else if (hasChildren) {
      toggleExpanded(section.id);
    }
  };

  const handleChildClick = (childId: string, nodeId: string | null) => {
    // Set the section as active target first, then navigate to child
    if (nodeId) {
      setSelectedNodeId(nodeId);
    }
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
        onMouseEnter={() => onItemHover(rootNodeId)}
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
              getNodeId={(editorId) =>
                getSectionNodeId(zoneId, section.id, editorId, "section-child")
              }
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
  onItemHover: (nodeId: string | null) => void;
  showLabel?: boolean;
}

function ZoneSection({
  zoneId,
  sections,
  onItemHover,
  showLabel = true,
}: ZoneSectionProps) {
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
      {showLabel && (
        <div className="flex items-center h-8 px-1">
          <span className="type-small font-medium text-secondary">
            {ZONE_LABELS[zoneId]}
          </span>
        </div>
      )}

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
  const { passportDraft, setHoveredNodeId, dataSource, previewData } =
    useDesignEditor();

  const headerDef = COMPONENT_REGISTRY.header?.schema.editorTree;
  const productImageDef = COMPONENT_REGISTRY.productImage?.schema.editorTree;
  const footerDef = COMPONENT_REGISTRY.footer?.schema.editorTree;

  // Only show modal preview toggles for section types present in the passport
  const allSections = [...passportDraft.sidebar, ...passportDraft.canvas];
  const presentSectionTypes = new Set<string>(allSections.map((s) => s.type));
  const availableModalPreviews = MODAL_PREVIEW_ITEMS.filter((item) =>
    presentSectionTypes.has(item.sectionType),
  );

  const handleItemHover = useCallback(
    (nodeId: string | null) => {
      setHoveredNodeId(nodeId);
    },
    [setHoveredNodeId],
  );

  return (
    <div
      className="flex-1 p-2 overflow-y-auto scrollbar-hide"
      onMouseLeave={() => handleItemHover(null)}
    >
      {/* Layout — fixed structural components */}
      <div className="flex items-center h-8 px-1">
        <span className="type-small font-medium text-secondary">Layout</span>
      </div>
      {headerDef && (
        <FixedItem componentDef={headerDef} onItemHover={handleItemHover} />
      )}
      {productImageDef && (
        <FixedItem
          componentDef={productImageDef}
          onItemHover={handleItemHover}
        />
      )}
      {footerDef && (
        <FixedItem componentDef={footerDef} onItemHover={handleItemHover} />
      )}

      <div className="border-t my-1" />

      {/* Modals — per-type expandable items with preview toggles */}
      <div className="flex items-center h-8 px-1">
        <span className="type-small font-medium text-secondary">Modals</span>
      </div>
      {availableModalPreviews.map((item) => {
        const children =
          MODAL_SCHEMA_REGISTRY[item.sectionType]?.schema.editorTree.children ??
          [];
        const disabled =
          dataSource === "real" && !hasModalData(item.sectionType, previewData);
        return (
          <ModalPreviewItem
            key={item.sectionType}
            sectionType={item.sectionType}
            displayName={item.displayName}
            modalChildren={children}
            disabled={disabled}
            onItemHover={handleItemHover}
          />
        );
      })}

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
    </div>
  );
}
