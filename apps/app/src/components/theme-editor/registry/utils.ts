/**
 * Utility functions for the component registry
 */

import { COMPONENT_TREE } from "./component-tree";
import type { ComponentDefinition } from "./types";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Find a component definition by its ID
 */
export function findComponentById(
  id: string,
  tree: ComponentDefinition[] = COMPONENT_TREE,
): ComponentDefinition | null {
  for (const component of tree) {
    if (component.id === id) {
      return component;
    }
    if (component.children) {
      const found = findComponentById(id, component.children);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Get the ancestry chain for a component (for breadcrumb)
 */
export function getComponentAncestry(
  id: string,
  tree: ComponentDefinition[] = COMPONENT_TREE,
  path: ComponentDefinition[] = [],
): ComponentDefinition[] | null {
  for (const component of tree) {
    if (component.id === id) {
      return [...path, component];
    }
    if (component.children) {
      const result = getComponentAncestry(id, component.children, [
        ...path,
        component,
      ]);
      if (result) return result;
    }
  }
  return null;
}

/**
 * Get all component IDs as a flat list
 */
export function getAllComponentIds(
  tree: ComponentDefinition[] = COMPONENT_TREE,
): string[] {
  const ids: string[] = [];
  for (const component of tree) {
    ids.push(component.id);
    if (component.children) {
      ids.push(...getAllComponentIds(component.children));
    }
  }
  return ids;
}

/**
 * Check if a component has editable style fields.
 * Used to determine if clicking should navigate to editor or just expand.
 */
export function hasEditableContent(component: ComponentDefinition): boolean {
  // Grouping-only components are never directly editable
  if (component.isGrouping) {
    return false;
  }
  return (component.styleFields?.length ?? 0) > 0;
}

/**
 * Check if a CSS class name is a selectable component in the preview.
 * Returns false for groupings (logical groupings that don't have a corresponding CSS class).
 */
export function isSelectableComponent(className: string): boolean {
  const component = findComponentById(className);
  if (!component) return false;
  // Groupings are not selectable in the preview
  if (component.isGrouping) return false;
  return true;
}

/**
 * Check if a component has editable config fields (for the Content tab).
 * Used to determine if the Content tab should be shown.
 */
export function hasConfigContent(component: ComponentDefinition): boolean {
  return (component.configFields?.length ?? 0) > 0;
}

/**
 * Check if a component has a visibility toggle (for eye icon in layout tree).
 * Used to determine if an eye icon should be shown next to the component.
 */
export function hasVisibilityToggle(component: ComponentDefinition): boolean {
  return component.visibilityKey !== undefined;
}
