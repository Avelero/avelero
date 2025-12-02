"use client";

import { useCallback, useRef, useEffect } from "react";
import { useDesignEditor } from "@/contexts/design-editor-provider";
import { findComponentById, hasEditableContent } from "@/components/theme-editor/registry/component-registry";

/** Debounce delay in ms - hover is only shown after cursor stops for this duration */
const HOVER_DEBOUNCE_MS = 25;

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
 * Includes debounce so hover only shows after cursor stops moving.
 */
export function useSelectableDetection(
  containerRef: React.RefObject<HTMLElement | null>
) {
  const {
    hoveredComponentId,
    setHoveredComponentId,
    selectedComponentId,
    setSelectedComponentId,
    navigateToComponent,
    navigateBack,
  } = useDesignEditor();

  // Debounce timer for hover detection
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the component under cursor (before debounce completes)
  const pendingComponentRef = useRef<string | null>(null);

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
          const component = findComponentById(className);
          if (component && hasEditableContent(component)) {
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
      // Cancel any pending debounce timer
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [containerRef]);

  /**
   * Handle mouse move - detect which component is under cursor.
   * Uses debounce so hover only shows after cursor STOPS moving.
   * 
   * Behavior:
   * - When cursor is moving, keep the current hover (don't clear it)
   * - When cursor stops, update hover to whatever component is under cursor
   * - This means hover persists while moving, only changes when cursor stops
   */
  const handleMouseMove = useCallback(
    (event: React.MouseEvent) => {
      const componentId = findSelectableComponentId(event.target);

      // Always update the pending component (what's currently under cursor)
      pendingComponentRef.current = componentId;

      // Clear any existing debounce timer (cursor moved, so reset)
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
      }

      // Start a new debounce timer - will fire when cursor stops moving
      debounceTimerRef.current = setTimeout(() => {
        // Cursor has stopped - update hover to whatever component is under cursor
        // This could be a different component, the same component, or null (no component)
        if (pendingComponentRef.current !== hoveredComponentId) {
          setHoveredComponentId(pendingComponentRef.current);
        }
        debounceTimerRef.current = null;
      }, HOVER_DEBOUNCE_MS);
    },
    [findSelectableComponentId, hoveredComponentId, setHoveredComponentId]
  );

  /**
   * Handle mouse leave - clear hover state
   */
  const handleMouseLeave = useCallback(() => {
    // Cancel any pending debounce timer
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    pendingComponentRef.current = null;
    setHoveredComponentId(null);
  }, [setHoveredComponentId]);

  /**
   * Handle click - select the component and navigate to its editor,
   * or deselect if clicking on background.
   * Prevents default behavior (links, buttons) so preview is non-interactive.
   */
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      // Prevent default behavior (links opening, buttons submitting, etc.)
      event.preventDefault();
      event.stopPropagation();

      const componentId = findSelectableComponentId(event.target);
      if (componentId) {
        // Clicked on a component - select it and navigate to editor
        setSelectedComponentId(componentId);
        navigateToComponent(componentId);
      } else {
        // Clicked on background - clear selection and go back to layout menu
        setSelectedComponentId(null);
        navigateBack();
      }
    },
    [findSelectableComponentId, setSelectedComponentId, navigateToComponent, navigateBack]
  );

  return {
    handleMouseMove,
    handleMouseLeave,
    handleClick,
  };
}
