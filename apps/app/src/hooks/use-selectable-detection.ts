"use client";

import { useCallback, useRef, useEffect } from "react";
import { useDesignEditor } from "@/contexts/design-editor-provider";
import { isSelectableComponent } from "@/components/design/layout/component-registry";

/**
 * Apply selection data attribute to all elements with a given class within a container.
 * CSS handles the visual styling via [data-*] selectors.
 */
function applySelectionAttribute(
  container: HTMLElement | null,
  componentId: string | null,
  attributeKey: string
) {
  if (!container || !componentId) return;

  const elements = container.querySelectorAll(`.${componentId}`);
  for (const el of elements) {
    (el as HTMLElement).dataset[attributeKey] = "true";
  }
}

/**
 * Remove selection data attribute from all elements that have it.
 */
function removeSelectionAttribute(
  container: HTMLElement | null,
  attributeKey: string
) {
  if (!container) return;

  const selector = `[data-${toKebabCase(attributeKey)}="true"]`;
  const elements = container.querySelectorAll(selector);
  for (const el of elements) {
    delete (el as HTMLElement).dataset[attributeKey];
  }
}

/**
 * Convert camelCase to kebab-case for data attribute selectors
 */
function toKebabCase(str: string): string {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Hook for detecting selectable components in the DPP preview.
 * Uses CSS-driven styling via data attributes for GPU-accelerated rendering.
 */
export function useSelectableDetection(
  containerRef: React.RefObject<HTMLElement | null>
) {
  const {
    hoveredComponentId,
    setHoveredComponentId,
    selectedComponentId,
    setSelectedComponentId,
  } = useDesignEditor();

  // requestAnimationFrame-based throttling for smooth 60fps updates
  const pendingFrameRef = useRef<number | null>(null);
  const pendingTargetRef = useRef<EventTarget | null>(null);

  // Track previous IDs to know when to update attributes
  const prevHoveredRef = useRef<string | null>(null);
  const prevSelectedRef = useRef<string | null>(null);

  /**
   * Find the deepest selectable element under the cursor.
   */
  const findSelectableComponentId = useCallback(
    (target: EventTarget | null): string | null => {
      if (!(target instanceof Element)) return null;

      let current: Element | null = target;

      while (current) {
        for (const className of current.classList) {
          if (isSelectableComponent(className)) {
            return className;
          }
        }
        current = current.parentElement;
      }

      return null;
    },
    []
  );

  // Apply/remove hover attributes when hoveredComponentId changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remove old hover attribute
    if (prevHoveredRef.current) {
      removeSelectionAttribute(container, "hoverSelection");
    }

    // Apply new hover attribute (only if different from selected)
    if (hoveredComponentId && hoveredComponentId !== selectedComponentId) {
      applySelectionAttribute(container, hoveredComponentId, "hoverSelection");
    }

    prevHoveredRef.current = hoveredComponentId;
  }, [hoveredComponentId, selectedComponentId, containerRef]);

  // Apply/remove selected attributes when selectedComponentId changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Remove old selected attribute
    if (prevSelectedRef.current) {
      removeSelectionAttribute(container, "selectedSelection");
    }

    // Apply new selected attribute
    if (selectedComponentId) {
      applySelectionAttribute(container, selectedComponentId, "selectedSelection");
    }

    prevSelectedRef.current = selectedComponentId;
  }, [selectedComponentId, containerRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const container = containerRef.current;
      if (container) {
        removeSelectionAttribute(container, "hoverSelection");
        removeSelectionAttribute(container, "selectedSelection");
      }
      // Cancel any pending animation frame
      if (pendingFrameRef.current !== null) {
        cancelAnimationFrame(pendingFrameRef.current);
      }
    };
  }, [containerRef]);

  /**
   * Handle mouse move - detect which component is under cursor.
   * Uses requestAnimationFrame for smooth, render-cycle-synced updates.
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      // Store the latest target
      pendingTargetRef.current = event.target;

      // Only schedule a new frame if one isn't already pending
      if (pendingFrameRef.current === null) {
        pendingFrameRef.current = requestAnimationFrame(() => {
          const componentId = findSelectableComponentId(pendingTargetRef.current);

          if (componentId !== hoveredComponentId) {
            setHoveredComponentId(componentId);
          }

          pendingFrameRef.current = null;
        });
      }
    },
    [findSelectableComponentId, hoveredComponentId, setHoveredComponentId]
  );

  /**
   * Handle mouse leave - clear hover state
   */
  const handleMouseLeave = useCallback(() => {
    // Cancel any pending frame
    if (pendingFrameRef.current !== null) {
      cancelAnimationFrame(pendingFrameRef.current);
      pendingFrameRef.current = null;
    }
    setHoveredComponentId(null);
  }, [setHoveredComponentId]);

  /**
   * Handle click - select the component
   */
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      const componentId = findSelectableComponentId(event.target);
      setSelectedComponentId(componentId);
    },
    [findSelectableComponentId, setSelectedComponentId]
  );

  return {
    handleMouseMove,
    handleMouseLeave,
    handleClick,
  };
}
