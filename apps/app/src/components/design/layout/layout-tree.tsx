"use client";

import * as React from "react";
import { useState } from "react";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";
import { COMPONENT_TREE, type ComponentDefinition } from "./component-registry";

// =============================================================================
// LAYOUT TREE ITEM
// =============================================================================

interface LayoutTreeItemProps {
  item: ComponentDefinition;
  level: number;
  expandedItems: Set<string>;
  hiddenItems: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleVisibility: (id: string) => void;
}

function LayoutTreeItem({
  item,
  level,
  expandedItems,
  hiddenItems,
  onToggleExpand,
  onToggleVisibility,
}: LayoutTreeItemProps) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItems.has(item.id);
  const isHidden = hiddenItems.has(item.id);

  // Calculate indentation - 24px per level
  const indentPx = level * 24;

  return (
    <div className="flex flex-col">
      {/* Item row */}
      <div className="flex items-center h-8 group">
        {/* Inner container with h-7 hover background */}
        <div
          className="relative flex items-center w-full h-7 group-hover:bg-accent"
          style={{ paddingLeft: `${indentPx}px` }}
        >
          {/* Expand/collapse chevron or spacer */}
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggleExpand(item.id)}
              className="flex items-center justify-center min-w-4 h-7 hover:bg-border transition-colors duration-100"
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

          {/* Item label + chevron - main clickable area for navigation */}
          <button
            type="button"
            className="flex flex-row items-center justify-between text-left h-7 flex-1 type-small text-primary"
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
            {/* Navigation chevron - at far right, shows on hover */}
            <div className="flex items-center justify-center min-w-7 h-7 opacity-0 group-hover:opacity-100">
              <Icons.ChevronRight className="h-3.5 w-3.5 text-primary" />
            </div>
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
                "absolute right-7 flex items-center justify-center w-7 h-7 hover:bg-border z-10",
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
              onToggleExpand={onToggleExpand}
              onToggleVisibility={onToggleVisibility}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// LAYOUT TREE (Main Export)
// =============================================================================

export function LayoutTree() {
  // Local state for expand/collapse
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  
  // Local state for visibility toggle (UI only for now)
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());

  const handleToggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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

  return (
    <div className="flex-1 p-2 overflow-y-auto scrollbar-hide">
      {COMPONENT_TREE.map((item) => (
        <LayoutTreeItem
          key={item.id}
          item={item}
          level={0}
          expandedItems={expandedItems}
          hiddenItems={hiddenItems}
          onToggleExpand={handleToggleExpand}
          onToggleVisibility={handleToggleVisibility}
        />
      ))}
    </div>
  );
}

