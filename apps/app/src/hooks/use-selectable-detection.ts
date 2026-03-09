"use client";

/**
 * Preview selection detection for the theme editor.
 *
 * The shared DPP renderer now emits explicit selection metadata, so the editor
 * can resolve hover and click targets without inferring anything from CSS
 * classes or legacy DOM structure.
 */

import { useDesignEditor } from "@/contexts/design-editor-provider";
import type { ZoneId } from "@v1/dpp-components";
import { useCallback, useEffect, useRef } from "react";

/** Debounce delay in ms - hover shows after cursor has been on an item for this duration */
const HOVER_DEBOUNCE_MS = 20;

type SelectableNodeTarget =
  | {
      nodeId: string;
      kind: "fixed";
      editorId: string;
    }
  | {
      nodeId: string;
      kind: "section-root" | "section-child";
      editorId: string;
      sectionId: string;
      zoneId: ZoneId;
    };

/**
 * Escape a node id so it can be used inside an attribute selector safely.
 */
function escapeAttributeValue(value: string): string {
  // Use the browser escape helper when available so dots and colons stay valid.
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replace(/["\\]/g, "\\$&");
}

/**
 * Apply a selection data attribute to every preview node with the given id.
 */
function applySelectionAttribute(
  container: HTMLElement | null,
  nodeId: string | null,
  attributeKey: string,
) {
  if (!container || !nodeId) return;

  const selector = `[data-dpp-node-id="${escapeAttributeValue(nodeId)}"]`;
  const elements = container.querySelectorAll(selector);
  for (const element of elements) {
    (element as HTMLElement).dataset[attributeKey] = "true";
  }
}

/**
 * Remove a selection data attribute from every preview node that currently has it.
 */
function removeSelectionAttribute(
  container: HTMLElement | null,
  attributeKey: string,
) {
  if (!container) return;

  const selector = `[data-${toKebabCase(attributeKey)}="true"]`;
  const elements = container.querySelectorAll(selector);
  for (const element of elements) {
    delete (element as HTMLElement).dataset[attributeKey];
  }
}

/**
 * Convert camelCase to kebab-case for dataset selector lookups.
 */
function toKebabCase(value: string): string {
  return value.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Parse a selectable preview node target from the renderer metadata.
 */
function parseSelectableTarget(
  element: HTMLElement | null,
): SelectableNodeTarget | null {
  if (!element) return null;

  const nodeId = element.dataset.dppNodeId;
  const kind = element.dataset.dppNodeKind;
  const editorId = element.dataset.dppEditorId;

  if (!nodeId || !kind || !editorId) {
    return null;
  }

  if (kind === "fixed") {
    return { nodeId, kind, editorId };
  }

  const sectionId = element.dataset.dppSectionId;
  const zoneId = element.dataset.dppZoneId as ZoneId | undefined;

  if (!sectionId || !zoneId) {
    return null;
  }

  if (kind === "section-root" || kind === "section-child") {
    return { nodeId, kind, editorId, sectionId, zoneId };
  }

  return null;
}

/**
 * Find the deepest selectable preview node under the current event target.
 */
function findSelectableTarget(
  target: EventTarget | null,
): SelectableNodeTarget | null {
  if (!(target instanceof Element)) return null;

  const selectableElement = target.closest<HTMLElement>("[data-dpp-node-id]");
  return parseSelectableTarget(selectableElement);
}

/**
 * Hook for detecting selectable components in the DPP preview.
 */
export function useSelectableDetection(
  containerRef: React.RefObject<HTMLElement | null>,
) {
  const {
    hoveredNodeId,
    setHoveredNodeId,
    selectedNodeId,
    setSelectedNodeId,
    navigateToComponent,
    navigateToSectionInstance,
    navigateBack,
  } = useDesignEditor();

  // Debounce timer for hover detection.
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the node under cursor before the debounce completes.
  const pendingNodeRef = useRef<string | null>(null);

  // Track previous node ids so selection attributes update cleanly.
  const prevHoveredRef = useRef<string | null>(null);
  const prevSelectedRef = useRef<string | null>(null);

  // Apply or clear hover attributes when the hovered node changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (prevHoveredRef.current) {
      removeSelectionAttribute(container, "hoverSelection");
    }

    if (hoveredNodeId && hoveredNodeId !== selectedNodeId) {
      applySelectionAttribute(container, hoveredNodeId, "hoverSelection");
    }

    prevHoveredRef.current = hoveredNodeId;
  }, [hoveredNodeId, selectedNodeId, containerRef]);

  // Apply or clear selected attributes when the selected node changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (prevSelectedRef.current) {
      removeSelectionAttribute(container, "selectedSelection");
    }

    if (selectedNodeId) {
      applySelectionAttribute(container, selectedNodeId, "selectedSelection");
    }

    prevSelectedRef.current = selectedNodeId;
  }, [selectedNodeId, containerRef]);

  // Clean up hover state and any pending timers on unmount.
  useEffect(() => {
    return () => {
      const container = containerRef.current;
      if (container) {
        removeSelectionAttribute(container, "hoverSelection");
        removeSelectionAttribute(container, "selectedSelection");
      }

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [containerRef]);

  /**
   * Handle mouse move and debounce hover updates against explicit preview nodes.
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const target = findSelectableTarget(event.target);
      const nodeId = target?.nodeId ?? null;

      if (nodeId === pendingNodeRef.current) {
        return;
      }

      pendingNodeRef.current = nodeId;

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }

      if (nodeId === null) {
        debounceTimerRef.current = null;
        if (hoveredNodeId !== null) {
          setHoveredNodeId(null);
        }
        return;
      }

      debounceTimerRef.current = setTimeout(() => {
        if (pendingNodeRef.current === nodeId) {
          setHoveredNodeId(nodeId);
        }
        debounceTimerRef.current = null;
      }, HOVER_DEBOUNCE_MS);
    },
    [hoveredNodeId, setHoveredNodeId],
  );

  /**
   * Handle mouse leave and clear the current hover state immediately.
   */
  const handleMouseLeave = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    pendingNodeRef.current = null;
    setHoveredNodeId(null);
  }, [setHoveredNodeId]);

  /**
   * Handle preview clicks by selecting the node and navigating to its editor target.
   */
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const target = findSelectableTarget(event.target);

      if (!target) {
        if (selectedNodeId) {
          setSelectedNodeId(null);
          navigateBack();
        }
        return;
      }

      setSelectedNodeId(target.nodeId);

      if (target.kind === "fixed") {
        navigateToComponent(target.editorId);
        return;
      }

      navigateToSectionInstance(target.zoneId, target.sectionId);

      if (target.kind === "section-child") {
        navigateToComponent(target.editorId);
      }
    },
    [
      navigateBack,
      navigateToComponent,
      navigateToSectionInstance,
      selectedNodeId,
      setSelectedNodeId,
    ],
  );

  return {
    handleMouseMove,
    handleMouseLeave,
    handleClick,
  };
}
