/**
 * Editor selection helpers for the shared DPP renderer.
 *
 * The theme editor preview uses these attributes to map rendered DOM nodes
 * back to the currently editable fixed components and section instances.
 */

import type { ZoneId } from "../types/passport";

export type DppSelectionHighlightMode = "outline" | "overlay";

export type DppSelectableNode =
  | {
      kind: "fixed";
      editorId: string;
      highlightMode?: DppSelectionHighlightMode;
    }
  | {
      kind: "section-root";
      editorId: string;
      sectionId: string;
      zoneId: ZoneId;
      highlightMode?: DppSelectionHighlightMode;
    };

/**
 * Build the stable node id used to highlight all matching DOM nodes together.
 */
export function buildDppSelectableNodeId(node: DppSelectableNode): string {
  if (node.kind === "fixed") {
    return node.editorId;
  }

  return `${node.zoneId}:${node.sectionId}:${node.editorId}`;
}

/**
 * Build the data attributes the theme editor uses for hover and selection.
 */
export function getDppSelectableAttributes(
  node: DppSelectableNode,
): Record<`data-${string}`, string> {
  const attributes: Record<`data-${string}`, string> = {
    "data-dpp-node-id": buildDppSelectableNodeId(node),
    "data-dpp-node-kind": node.kind,
    "data-dpp-editor-id": node.editorId,
    "data-dpp-highlight-mode": node.highlightMode ?? "outline",
  };

  if (node.kind !== "fixed") {
    attributes["data-dpp-section-id"] = node.sectionId;
    attributes["data-dpp-zone-id"] = node.zoneId;
  }

  return attributes;
}

/**
 * Create a reusable attribute builder for fixed header and footer nodes.
 */
export function createFixedSelectionAttributes() {
  return (
    editorId: string,
    highlightMode: DppSelectionHighlightMode = "outline",
  ) => getDppSelectableAttributes({ kind: "fixed", editorId, highlightMode });
}

/**
 * Create a reusable attribute builder for a single section instance.
 */
export function createSectionSelectionAttributes(
  sectionId: string,
  zoneId: ZoneId,
) {
  return (
    editorId: string,
    highlightMode: DppSelectionHighlightMode = "outline",
  ) =>
    getDppSelectableAttributes({
      kind: "section-root",
      editorId,
      sectionId,
      zoneId,
      highlightMode,
    });
}
