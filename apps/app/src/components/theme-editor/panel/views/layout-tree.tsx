"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import * as React from "react";
import { useCallback, useRef } from "react";
import {
  COMPONENT_TREE,
  type ComponentDefinition,
  findComponentById,
  getComponentAncestry,
  hasConfigContent,
  hasEditableContent,
} from "../../registry";

/**
 * Debounce delay for triggering live preview highlight when hovering layout tree items (ms).
 * Hover shows after cursor has been on an item for this duration.
 */
const PREVIEW_HIGHLIGHT_DEBOUNCE_MS = 20;

// =============================================================================
// VISIBILITY TOGGLE BUTTON
// =============================================================================

interface VisibilityToggleProps {
  visibilityKey: NonNullable<ComponentDefinition["visibilityKey"]>;
}

function VisibilityToggle({ visibilityKey }: VisibilityToggleProps) {
  const { themeConfigDraft, toggleSectionVisibility } = useDesignEditor();

  const isVisible = themeConfigDraft.sections[visibilityKey];

  const handleClick = (e: React.MouseEvent) => {
    // Prevent the click from bubbling to the parent button (which navigates)
    e.stopPropagation();
    toggleSectionVisibility(visibilityKey);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex items-center justify-center min-w-7 h-7 transition-colors duration-100 hover:bg-accent-dark",
        // Show on hover UNLESS hidden (then always show so user remembers)
        isVisible ? "opacity-0 group-hover:opacity-100" : "opacity-100",
      )}
      aria-label={isVisible ? "Hide section" : "Show section"}
      title={isVisible ? "Hide section" : "Show section"}
    >
      {isVisible ? (
        <Icons.Eye className="h-3.5 w-3.5 text-tertiary" />
      ) : (
        <Icons.EyeOff className="h-3.5 w-3.5 text-tertiary" />
      )}
    </button>
  );
}

// =============================================================================
// LAYOUT TREE ITEM
// =============================================================================

interface LayoutTreeItemProps {
  item: ComponentDefinition;
  level: number;
  expandedItems: Set<string>;
  highlightedId: string | null;
  onToggleExpand: (id: string) => void;
  onItemClick: (id: string) => void;
  onItemHover: (id: string | null) => void;
}

function LayoutTreeItem({
  item,
  level,
  expandedItems,
  highlightedId,
  onToggleExpand,
  onItemClick,
  onItemHover,
}: LayoutTreeItemProps) {
  const isHighlighted = item.id === highlightedId;
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  // A component is editable if it has EITHER style fields OR config fields
  const isEditable = hasEditableContent(item) || hasConfigContent(item);

  // Calculate indentation - 24px per level
  const indentPx = level * 24;

  /**
   * Handle click on the main item area:
   * - If item has editable content → navigate to editor
   * - If item only has children → toggle expand/collapse
   */
  const handleMainClick = () => {
    if (isEditable) {
      onItemClick(item.id);
    } else if (hasChildren) {
      onToggleExpand(item.id);
    }
  };

  return (
    <div className="flex flex-col">
      {/* Item row */}
      <div
        className="flex items-center h-8 group"
        onMouseEnter={() => onItemHover(item.id)}
        onMouseLeave={() => onItemHover(null)}
      >
        {/* Inner container with h-7 hover background */}
        <div
          className={cn(
            "relative flex items-center w-full h-7 group-hover:bg-accent",
            isHighlighted && "bg-accent",
          )}
          style={{ paddingLeft: `${indentPx}px` }}
        >
          {/* Expand/collapse chevron or spacer */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleExpand(item.id)}
              className="flex items-center justify-center min-w-4 h-7 hover:bg-accent-dark transition-colors duration-100"
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

          {/* Item label - main clickable area */}
          <button
            type="button"
            onClick={handleMainClick}
            className={cn(
              "flex flex-row items-center text-left h-7 flex-1 type-small text-primary",
              // Only show cursor-pointer for editable items
              isEditable ? "cursor-pointer" : "cursor-default",
            )}
          >
            <div className="flex items-center truncate">
              <div className="flex items-center justify-center min-w-4 h-7">
                <Icons.GalleryVertical className="h-3 w-3 text-tertiary" />
              </div>
              <div className="flex items-center px-2 h-7">
                {item.displayName}
              </div>
            </div>
          </button>

          {/* Right side controls - outside the main button to avoid nesting */}
          <div className="flex items-center">
            {/* Visibility eye toggle - shows on hover, always visible if section is hidden */}
            {item.visibilityKey && (
              <VisibilityToggle visibilityKey={item.visibilityKey} />
            )}
            {/* Navigation chevron - only show for editable items, shows on hover */}
            {isEditable ? (
              <div className="flex items-center justify-center min-w-7 h-7 opacity-0 group-hover:opacity-100">
                <Icons.ChevronRight className="h-3.5 w-3.5 text-primary" />
              </div>
            ) : (
              /* Spacer to maintain alignment when no chevron */
              item.visibilityKey && <div className="min-w-7 h-7" />
            )}
          </div>
        </div>
      </div>

      {/* Children - render when expanded */}
      {isExpanded && hasChildren && (
        <div>
          {item.children!.map((child) => (
            <LayoutTreeItem
              key={child.id}
              item={child}
              level={level + 1}
              expandedItems={expandedItems}
              highlightedId={highlightedId}
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
// HELPER: Find visible parent for highlighting
// =============================================================================

/**
 * Given a hovered component ID and the current expanded items,
 * find which tree item should be highlighted.
 * If the hovered component is visible (all ancestors expanded), return it.
 * Otherwise, return the deepest visible ancestor.
 */
function findVisibleHighlightTarget(
  hoveredId: string | null,
  expandedItems: Set<string>,
): string | null {
  if (!hoveredId) return null;

  const ancestry = getComponentAncestry(hoveredId);
  if (!ancestry || ancestry.length === 0) return null;

  // Walk through the ancestry from root to target
  // The last item where all its ancestors are expanded is the visible one
  let lastVisible: string | null = null;

  for (let i = 0; i < ancestry.length; i++) {
    const component = ancestry[i];
    if (!component) continue;

    // Check if all parents up to this point are expanded
    const parentsExpanded = ancestry
      .slice(0, i)
      .every((parent) => expandedItems.has(parent.id));

    if (i === 0 || parentsExpanded) {
      lastVisible = component.id;
    } else {
      // Parent is not expanded, so this component is not visible
      break;
    }
  }

  return lastVisible;
}

// =============================================================================
// LAYOUT TREE (Main Export)
// =============================================================================

export function LayoutTree() {
  const {
    expandedItems,
    toggleExpanded,
    navigateToComponent,
    hoveredComponentId,
    setHoveredComponentId,
  } = useDesignEditor();

  // Debounce timer for hover from layout tree
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHoverRef = useRef<string | null>(null);

  const handleItemClick = (id: string) => {
    navigateToComponent(id);
  };

  /**
   * Handle hover on layout tree items.
   * Uses a short debounce so highlight shows after cursor has been on an item for a moment.
   * Only triggers preview highlight for editable components (not grouping items).
   */
  const handleItemHover = useCallback(
    (id: string | null) => {
      // If same as what we're already tracking, do nothing
      if (id === pendingHoverRef.current) {
        return;
      }

      // Clear any pending timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      pendingHoverRef.current = id;

      // If leaving (id is null), clear immediately
      if (id === null) {
        setHoveredComponentId(null);
        return;
      }

      // Only trigger preview highlight for components with editable content or config content
      const component = findComponentById(id);
      if (
        !component ||
        (!hasEditableContent(component) && !hasConfigContent(component))
      ) {
        // Clear hover when hovering non-editable items
        setHoveredComponentId(null);
        return;
      }

      // Start debounce timer - will fire if cursor stays on this item
      debounceTimerRef.current = setTimeout(() => {
        if (pendingHoverRef.current === id) {
          setHoveredComponentId(id);
        }
        debounceTimerRef.current = null;
      }, PREVIEW_HIGHLIGHT_DEBOUNCE_MS);
    },
    [setHoveredComponentId],
  );

  // Cleanup debounce timer and hover state on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      pendingHoverRef.current = null;
      setHoveredComponentId(null);
    };
  }, [setHoveredComponentId]);

  // Determine which item should be highlighted based on hover
  const highlightedId = findVisibleHighlightTarget(
    hoveredComponentId,
    expandedItems,
  );

  // Filter out hidden components (feature flag support)
  const visibleComponents = COMPONENT_TREE.filter((item) => !item.hidden);

  return (
    <div
      className="flex-1 p-2 overflow-y-auto scrollbar-hide"
      onMouseLeave={() => handleItemHover(null)}
    >
      {visibleComponents.map((item) => (
        <LayoutTreeItem
          key={item.id}
          item={item}
          level={0}
          expandedItems={expandedItems}
          highlightedId={highlightedId}
          onToggleExpand={toggleExpanded}
          onItemClick={handleItemClick}
          onItemHover={handleItemHover}
        />
      ))}
    </div>
  );
}
