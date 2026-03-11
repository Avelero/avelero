/**
 * Utility functions for the component registry.
 *
 * Searches COMPONENT_REGISTRY (fixed components) and SECTION_REGISTRY (sections)
 * to resolve editor component definitions by ID.
 */

import type {
  ComponentDefinition,
  Passport,
  SectionType,
} from "@v1/dpp-components";
import {
  COMPONENT_REGISTRY,
  MODAL_SCHEMA_REGISTRY,
  SECTION_REGISTRY,
} from "@v1/dpp-components";

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
 * Searches fixed components, modal schemas, then section editor trees.
 */
function findComponentById(
  id: string,
  tree?: ComponentDefinition[],
): ComponentDefinition | null {
  // When an explicit tree is passed, search only that subtree (recursive calls).
  if (tree) {
    for (const component of tree) {
      if (component.id === id) return component;
      if (component.children) {
        const found = findComponentById(id, component.children);
        if (found) return found;
      }
    }
    return null;
  }

  // Search COMPONENT_REGISTRY editor trees (header, productImage, modal, footer)
  for (const entry of Object.values(COMPONENT_REGISTRY)) {
    if (!entry) continue;
    const found = findInTree(id, entry.schema.editorTree);
    if (found) return found;
  }

  // Search modal editor trees.
  for (const entry of Object.values(MODAL_SCHEMA_REGISTRY)) {
    if (!entry) continue;
    const found = findInTree(id, entry.schema.editorTree);
    if (found) return found;
  }

  // Search SECTION_REGISTRY editor trees
  for (const entry of Object.values(SECTION_REGISTRY)) {
    const found = findInTree(
      id,
      entry.schema.editorTree as ComponentDefinition,
    );
    if (found) return found;
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
 * Resolve a component definition for the editor by ID.
 *
 * Checks fixed components and modal schemas first, then section editor trees,
 * then passport sections by instance ID.
 */
export function resolveComponentForEditor(
  componentId: string,
  passport: Passport,
): ComponentDefinition | null {
  // Try fixed components, modal schemas, and section editor trees.
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
