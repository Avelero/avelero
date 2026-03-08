/**
 * Utility functions for the component registry.
 *
 * In the Passport system, section components are resolved via SECTION_REGISTRY
 * (from dpp-components), while fixed components (Header/Footer) use COMPONENT_TREE.
 */

import type { Passport, SectionType, ZoneId } from "@v1/dpp-components";
import { SECTION_REGISTRY } from "@v1/dpp-components";
import { COMPONENT_TREE } from "./component-tree";
import type { ComponentDefinition } from "./types";

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
 * Searches COMPONENT_TREE first, then SECTION_REGISTRY editorTrees.
 */
export function findComponentById(
  id: string,
  tree?: ComponentDefinition[],
): ComponentDefinition | null {
  const searchTree = tree ?? COMPONENT_TREE;
  for (const component of searchTree) {
    if (component.id === id) return component;
    if (component.children) {
      const found = findComponentById(id, component.children);
      if (found) return found;
    }
  }

  // Only search SECTION_REGISTRY when using default tree
  if (!tree) {
    for (const entry of Object.values(SECTION_REGISTRY)) {
      const found = findInTree(
        id,
        entry.schema.editorTree as ComponentDefinition,
      );
      if (found) return found;
    }
  }

  return null;
}

/**
 * Check if a component has editable style fields.
 */
export function hasEditableContent(component: ComponentDefinition): boolean {
  if (component.isGrouping) return false;
  return (component.styleFields?.length ?? 0) > 0;
}

/**
 * Check if a component has editable config fields (for the Content tab).
 */
export function hasConfigContent(component: ComponentDefinition): boolean {
  return (component.configFields?.length ?? 0) > 0;
}

/**
 * Check if a CSS class name is a selectable component in the preview.
 */
export function isSelectableComponent(className: string): boolean {
  const component = findComponentById(className);
  if (!component) return false;
  return !component.isGrouping;
}

/**
 * Resolve a component definition for the editor by ID.
 *
 * Checks COMPONENT_TREE first (header, footer), then SECTION_REGISTRY
 * editorTrees, then passport sections by instance ID.
 */
export function resolveComponentForEditor(
  componentId: string,
  passport: Passport,
): ComponentDefinition | null {
  // Try COMPONENT_TREE and SECTION_REGISTRY editorTrees
  const component = findComponentById(componentId);
  if (component) return component;

  // Try passport sections — match by instance ID and return section schema editorTree
  for (const zoneKey of ["sidebar", "canvas"] as const) {
    const zone = passport[zoneKey];
    if (!zone) continue;
    for (const section of zone) {
      if (section.id === componentId) {
        const entry = SECTION_REGISTRY[section.type as SectionType];
        if (entry) return entry.schema.editorTree as ComponentDefinition;
      }
    }
  }

  return null;
}
