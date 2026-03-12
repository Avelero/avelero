"use client";

/**
 * Layout tree for the passport theme editor.
 *
 * Renders a flat list of fixed items, modal previews, and sortable section zones.
 * Every item navigates to a detail page on click — no expand/collapse.
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
  type Section,
  type SectionType,
  type ZoneId,
} from "@v1/dpp-components";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { useCallback, useMemo, useRef, useState } from "react";
import { hasConfigContent, hasEditableContent } from "../../registry";
import { AddComponentPopover } from "./add-component-popover";

/**
 * Build the preview node id for a fixed component target.
 */
function getFixedNodeId(editorId: string): string {
  return buildDppSelectableNodeId({ kind: "fixed", editorId });
}

/**
 * Build the preview node id for a section root target.
 */
function getSectionRootNodeId(
  zoneId: ZoneId,
  sectionId: string,
  editorId: string,
): string {
  return buildDppSelectableNodeId({
    kind: "section-root",
    editorId,
    sectionId,
    zoneId,
  });
}

/**
 * Resolve the row background treatment for hover and selected states.
 */
function getTreeRowStateClass(isSelected: boolean, isHovered: boolean): string {
  if (isSelected) return "bg-accent-blue";
  if (isHovered) return "bg-accent";
  return "";
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
// FIXED ITEM (Header / Product Image / Footer)
// =============================================================================

interface FixedItemProps {
  componentDef: ComponentDefinition;
  onItemHover: (nodeId: string | null) => void;
}

function FixedItem({ componentDef, onItemHover }: FixedItemProps) {
  const { hoveredNodeId, navigateToComponent, navigation, setSelectedNodeId } =
    useDesignEditor();
  const isEditable =
    hasEditableContent(componentDef) || hasConfigContent(componentDef);
  const rootNodeId = isEditable ? getFixedNodeId(componentDef.id) : null;
  const isHovered = rootNodeId !== null && hoveredNodeId === rootNodeId;
  const isSelected =
    navigation.level === "component" &&
    navigation.section === "layout" &&
    !!navigation.componentId &&
    (navigation.componentId === componentDef.id ||
      navigation.componentId.startsWith(`${componentDef.id}.`));

  const handleClick = () => {
    if (isEditable && rootNodeId) {
      setSelectedNodeId(rootNodeId);
      navigateToComponent(componentDef.id);
    }
  };

  return (
    <div
      className={cn(
        "relative flex items-center w-full h-7 rounded",
        getTreeRowStateClass(isSelected, isHovered),
        isEditable ? "cursor-pointer" : "cursor-default",
      )}
      onClick={handleClick}
      onMouseEnter={() => onItemHover(rootNodeId)}
      onMouseLeave={() => onItemHover(null)}
    >
      <div className="min-w-4" />

      <div className="flex items-center justify-center min-w-4 h-7">
        <Icons.GalleryVertical className="h-3 w-3 text-tertiary" />
      </div>

      <div className="flex items-center px-2 h-7 flex-1 min-w-0">
        <span className="type-small text-primary truncate">
          {componentDef.displayName}
        </span>
      </div>

      {isEditable && (
        <div className="flex items-center pr-1">
          <Icons.ChevronRight className="h-3 w-3 text-tertiary" />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SHARED MODAL ITEM
// =============================================================================

interface SharedModalItemProps {
  onItemHover: (nodeId: string | null) => void;
}

function SharedModalItem({ onItemHover }: SharedModalItemProps) {
  const {
    hoveredNodeId,
    navigation,
    previewModalType,
    setPreviewModalType,
    navigateToComponent,
    setSelectedNodeId,
  } = useDesignEditor();
  const modalSchema = MODAL_SCHEMA_REGISTRY.modal?.schema;
  const editorTree = modalSchema?.editorTree;
  const isEditable = editorTree
    ? hasEditableContent(editorTree) || hasConfigContent(editorTree)
    : false;
  const rootNodeId = editorTree ? getFixedNodeId(editorTree.id) : null;
  const isPreviewActive = previewModalType === editorTree?.id;
  const isHovered = rootNodeId !== null && hoveredNodeId === rootNodeId;
  const isSelected =
    navigation.level === "component" &&
    navigation.section === "layout" &&
    !!navigation.componentId &&
    (navigation.componentId === editorTree?.id ||
      navigation.componentId === "modal" ||
      navigation.componentId.startsWith("modal."));

  const handleRowClick = () => {
    if (!isEditable || !editorTree || !rootNodeId) return;

    // Toggle the shared modal preview and route the detail panel to the modal editor.
    setPreviewModalType(isPreviewActive ? null : editorTree.id);
    setSelectedNodeId(rootNodeId);
    navigateToComponent(editorTree.id);
  };

  return (
    <div
      className={cn(
        "relative flex items-center w-full h-7 rounded",
        getTreeRowStateClass(isSelected || isPreviewActive, isHovered),
        isEditable ? "cursor-pointer" : "cursor-default",
      )}
      onClick={handleRowClick}
      onMouseEnter={() => onItemHover(rootNodeId)}
      onMouseLeave={() => onItemHover(null)}
    >
      <div className="min-w-4" />

      <div className="flex items-center justify-center min-w-4 h-7">
        <Icons.GalleryVertical className="h-3 w-3 text-tertiary" />
      </div>

      <div className="flex items-center px-2 h-7 flex-1 min-w-0">
        <span className="type-small text-primary truncate">Modal</span>
      </div>

      {isEditable && (
        <div className="flex items-center pr-1">
          <Icons.ChevronRight className="h-3 w-3 text-tertiary" />
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
    hoveredNodeId,
    navigateToSectionInstance,
    deleteSection,
    activeSectionId,
    setSelectedNodeId,
  } = useDesignEditor();

  const entry = SECTION_REGISTRY[section.type as SectionType];
  const editorTree = entry?.schema.editorTree as
    | ComponentDefinition
    | undefined;

  const rootIsEditable = editorTree
    ? hasEditableContent(editorTree) || hasConfigContent(editorTree)
    : false;
  const rootNodeId =
    rootIsEditable && editorTree
      ? getSectionRootNodeId(zoneId, section.id, editorTree.id)
      : null;

  const isSelected = activeSectionId === section.id;
  const isHovered = rootNodeId !== null && hoveredNodeId === rootNodeId;

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
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex flex-col", isDragging && "opacity-50")}
    >
      <div
        className={cn(
          "group/instance relative flex items-center w-full h-7 rounded",
          getTreeRowStateClass(isSelected, isHovered),
          rootIsEditable ? "cursor-pointer" : "cursor-default",
        )}
        onClick={handleMainClick}
        onMouseEnter={() => onItemHover(rootNodeId)}
        onMouseLeave={() => onItemHover(null)}
      >
        <div className="min-w-4" />

        <div
          className="flex items-center justify-center min-w-4 h-7 touch-none rounded hover:bg-accent-dark cursor-grab active:cursor-grabbing"
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

        {rootIsEditable && (
          <div className="flex items-center pr-1">
            <Icons.ChevronRight className="h-3 w-3 text-tertiary" />
          </div>
        )}
      </div>
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
  // Keep the add affordance visible before the sortable list while preserving in-list insert handles.
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
    <div className={cn("flex flex-col", zoneId === "canvas" && "pb-4")}>
      {showLabel && (
        <div className="flex items-center h-8 px-1">
          <span className="type-small font-medium text-secondary">
            {ZONE_LABELS[zoneId]}
          </span>
        </div>
      )}

      <AddSectionButton zoneId={zoneId} sectionCount={sections.length} />

      {sections.length > 0 && <InsertLine zoneId={zoneId} position={0} />}

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
  const { passportDraft, setHoveredNodeId } = useDesignEditor();

  const headerDef = COMPONENT_REGISTRY.header?.schema.editorTree;
  const productImageDef = COMPONENT_REGISTRY.productImage?.schema.editorTree;
  const footerDef = COMPONENT_REGISTRY.footer?.schema.editorTree;

  const handleItemHover = useCallback(
    (nodeId: string | null) => {
      setHoveredNodeId(nodeId);
    },
    [setHoveredNodeId],
  );

  return (
    <div
      className="flex-1 overflow-y-auto scrollbar-hide px-2 pt-2 pb-4"
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

      {/* Modal — shared modal preview and editor target */}
      <div className="flex items-center h-8 px-1">
        <span className="type-small font-medium text-secondary">Modal</span>
      </div>
      <SharedModalItem onItemHover={handleItemHover} />

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
