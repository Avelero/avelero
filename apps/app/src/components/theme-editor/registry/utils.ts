/**
 * Utility functions for the component registry
 */

import type {
  LayoutComponentInstance,
  ThemeConfig,
  ZoneId,
} from "@v1/dpp-components";
import { COMPONENT_LIBRARY } from "@v1/dpp-components/lib/component-library";
import { COMPONENT_TREE } from "./component-tree";
import type { ComponentDefinition } from "./types";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Recursively search a ComponentDefinition tree for a matching ID.
 */
function findInTree(
  id: string,
  node: ComponentDefinition,
): ComponentDefinition | null {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findInTree(id, child);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Find a component definition by its ID.
 * Searches COMPONENT_TREE first, then COMPONENT_LIBRARY editorTrees.
 */
export function findComponentById(
  id: string,
  tree?: ComponentDefinition[],
): ComponentDefinition | null {
  // Search provided tree (or COMPONENT_TREE by default)
  const searchTree = tree ?? COMPONENT_TREE;
  for (const component of searchTree) {
    if (component.id === id) {
      return component;
    }
    if (component.children) {
      const found = findComponentById(id, component.children);
      if (found) return found;
    }
  }

  // Only search COMPONENT_LIBRARY when using default tree (avoids recursion on subtrees)
  if (!tree) {
    for (const entry of Object.values(COMPONENT_LIBRARY)) {
      const found = findInTree(id, entry.editorTree as ComponentDefinition);
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
  return !component.isGrouping;
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

/**
 * Resolve a component definition for the editor by ID.
 * Checks COMPONENT_TREE first (header, footer), then searches all
 * COMPONENT_LIBRARY editorTree nodes (instances and their children).
 */
export function resolveComponentForEditor(
  componentId: string,
  themeConfig: ThemeConfig,
): ComponentDefinition | null {
  // Try COMPONENT_TREE and COMPONENT_LIBRARY editorTrees
  const component = findComponentById(componentId);
  if (component) return component;

  // Try layout instances — match by instance ID and return root editorTree
  const { zones } = themeConfig.layout;
  for (const zoneId of Object.keys(zones) as ZoneId[]) {
    const instance = zones[zoneId].find(
      (inst: LayoutComponentInstance) => inst.id === componentId,
    );
    if (instance) {
      const entry = COMPONENT_LIBRARY[instance.componentType];
      if (entry) return entry.editorTree as ComponentDefinition;
    }
  }

  return null;
}
