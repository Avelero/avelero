"use client";

import * as React from "react";
import { useState, useRef, useCallback } from "react";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";
import {
  COMPONENT_TREE,
  type ComponentDefinition,
  getComponentAncestry,
  hasEditableContent,
} from "../../registry/component-registry";
import { useDesignEditor } from "@/contexts/design-editor-provider";

/** 
 * Debounce delay for triggering live preview highlight when hovering layout tree items (ms).
 * The layout tree item's own CSS hover is instant, this only affects the preview.
 */
const PREVIEW_HIGHLIGHT_DEBOUNCE_MS = 100;

// =============================================================================
// LAYOUT TREE ITEM
// =============================================================================

interface LayoutTreeItemProps {
  item: ComponentDefinition;
  level: number;
  expandedItems: Set<string>;
  hiddenItems: Set<string>;
  highlightedId: string | null;
  onToggleExpand: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onItemClick: (id: string) => void;
  onItemHover: (id: string | null) => void;
}

function LayoutTreeItem({
  item,
  level,
  expandedItems,
  hiddenItems,
  highlightedId,
  onToggleExpand,
  onToggleVisibility,
  onItemClick,
  onItemHover,
}: LayoutTreeItemProps) {
  const isHighlighted = item.id === highlightedId;
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  const isHidden = hiddenItems.has(item.id);
  const isEditable = hasEditableContent(item);

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
            isHighlighted && "bg-accent"
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
                  isExpanded && "rotate-90"
                )}
              />
            </button>
          ) : (
            <div className="min-w-4" />
          )}

          {/* Item label + chevron - main clickable area */}
          <button
            type="button"
            onClick={handleMainClick}
            className={cn(
              "flex flex-row items-center justify-between text-left h-7 flex-1 type-small text-primary",
              // Only show cursor-pointer for editable items
              isEditable ? "cursor-pointer" : "cursor-default"
            )}
          >
            <div
              className={cn(
                "flex items-center truncate",
                // Add right margin to make room for eye button when it exists
                item.canToggleVisibility ? "mr-7" : ""
              )}
            >
              <div className="flex items-center justify-center min-w-4 h-7">
                <Icons.GalleryVertical className="h-3 w-3 text-tertiary" />
              </div>
              <div className="flex items-center px-2 h-7">{item.displayName}</div>
            </div>
            {/* Navigation chevron - only show for editable items, at far right, shows on hover */}
            {isEditable && (
              <div className="flex items-center justify-center min-w-7 h-7 opacity-0 group-hover:opacity-100">
                <Icons.ChevronRight className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
          </button>

          {/* Visibility toggle - positioned absolutely to sit between label and chevron */}
          {item.canToggleVisibility && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleVisibility(item.id);
              }}
              className={cn(
                "absolute right-7 flex items-center justify-center w-7 h-7 hover:bg-accent-dark z-10",
                // Always visible if hidden, otherwise only on hover
                isHidden ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}
              aria-label={isHidden ? "Show" : "Hide"}
            >
              {isHidden ? (
                <Icons.EyeOff className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Icons.Eye className="h-3.5 w-3.5 text-primary" />
              )}
            </button>
          )}
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
              hiddenItems={hiddenItems}
              highlightedId={highlightedId}
              onToggleExpand={onToggleExpand}
              onToggleVisibility={onToggleVisibility}
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
  expandedItems: Set<string>
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
    const parentsExpanded = ancestry.slice(0, i).every((parent) =>
      expandedItems.has(parent.id)
    );

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

  // Local state for visibility toggle (UI only for now)
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());

  // Debounce timer for hover from layout tree
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHoverRef = useRef<string | null>(null);

  const handleToggleVisibility = (id: string) => {
    setHiddenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleItemClick = (id: string) => {
    navigateToComponent(id);
  };

  /**
   * Handle hover on layout tree items.
   * Uses debounce so highlight only shows after cursor stops.
   */
  const handleItemHover = useCallback(
    (id: string | null) => {
      // If leaving (id is null), clear immediately
      if (id === null) {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        pendingHoverRef.current = null;
        setHoveredComponentId(null);
        return;
      }

      // If same as pending, do nothing
      if (id === pendingHoverRef.current) return;

      pendingHoverRef.current = id;

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Start new debounce timer
      debounceTimerRef.current = setTimeout(() => {
        if (pendingHoverRef.current !== hoveredComponentId) {
          setHoveredComponentId(pendingHoverRef.current);
        }
        debounceTimerRef.current = null;
      }, PREVIEW_HIGHLIGHT_DEBOUNCE_MS);
    },
    [hoveredComponentId, setHoveredComponentId]
  );

  // Cleanup debounce timer on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Determine which item should be highlighted based on hover
  const highlightedId = findVisibleHighlightTarget(hoveredComponentId, expandedItems);

  return (
    <div
      className="flex-1 p-2 overflow-y-auto scrollbar-hide"
      onMouseLeave={() => handleItemHover(null)}
    >
      {COMPONENT_TREE.map((item) => (
        <LayoutTreeItem
          key={item.id}
          item={item}
          level={0}
          expandedItems={expandedItems}
          hiddenItems={hiddenItems}
          highlightedId={highlightedId}
          onToggleExpand={toggleExpanded}
          onToggleVisibility={handleToggleVisibility}
          onItemClick={handleItemClick}
          onItemHover={handleItemHover}
        />
      ))}
    </div>
  );
}

