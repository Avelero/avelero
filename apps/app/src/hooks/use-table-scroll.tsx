"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

interface UseTableScrollOptions {
  scrollAmount?: number;
  useColumnWidths?: boolean;
  startFromColumn?: number;
  scrollBehavior?: ScrollBehavior;
  enableKeyboardNavigation?: boolean;
}

interface ColumnPositionsResult {
  positions: number[];
  widths: number[];
}

interface UseTableScrollResult {
  containerRef: React.RefObject<HTMLDivElement | null>;
  canScrollLeft: boolean;
  canScrollRight: boolean;
  isScrollable: boolean;
  scrollLeft: (smooth?: boolean) => void;
  scrollRight: (smooth?: boolean) => void;
  scrollToStart: () => void;
  scrollToEnd: () => void;
}

export function useTableScroll(
  options: UseTableScrollOptions = {},
): UseTableScrollResult {
  const {
    scrollAmount = 120,
    useColumnWidths = false,
    startFromColumn = 0,
    scrollBehavior = "smooth",
    enableKeyboardNavigation = true,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const currentColumnIndex = useRef(startFromColumn);
  const isScrollingProgrammatically = useRef(false);
  const scrollTimeoutRef = useRef<number | null>(null);

  const getColumnPositions = useCallback((): ColumnPositionsResult => {
    const container = containerRef.current;
    if (!container) return { positions: [], widths: [] };

    const table = container.querySelector("table");
    if (!table) return { positions: [], widths: [] };

    const headerRow = table.querySelector("thead tr");
    if (!headerRow) return { positions: [], widths: [] };

    const columns = Array.from(headerRow.querySelectorAll("th"));
    const positions: number[] = [];
    const widths: number[] = [];
    let currentPosition = 0;

    for (const column of columns) {
      const width = (column as HTMLElement).offsetWidth;
      positions.push(currentPosition);
      widths.push(width);
      currentPosition += width;
    }

    return { positions, widths };
  }, []);

  const syncColumnIndex = useCallback(() => {
    if (!useColumnWidths || isScrollingProgrammatically.current) return;

    const container = containerRef.current;
    if (!container) return;

    const { positions, widths } = getColumnPositions();
    if (positions.length === 0) return;

    const currentScrollLeft = container.scrollLeft;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;

    if (currentScrollLeft <= 10) {
      currentColumnIndex.current = startFromColumn;
      return;
    }

    if (currentScrollLeft >= maxScrollLeft - 10) {
      // When at the end, find the rightmost visible column instead of just setting to last
      let visibleColumn = startFromColumn;
      let accumulatedWidth = 0;
      for (let i = startFromColumn; i < widths.length; i += 1) {
        if (accumulatedWidth + (widths[i] ?? 0) > currentScrollLeft) {
          visibleColumn = i;
          break;
        }
        accumulatedWidth += widths[i] ?? 0;
        visibleColumn = i + 1;
      }
      currentColumnIndex.current = Math.min(
        visibleColumn,
        positions.length - 1,
      );
      return;
    }

    let accumulatedWidth = 0;
    let detectedColumn = startFromColumn;

    for (let i = startFromColumn; i < widths.length; i += 1) {
      const columnWidth = widths[i] ?? 0;
      if (Math.abs(currentScrollLeft - accumulatedWidth) <= columnWidth / 2) {
        detectedColumn = i;
        break;
      }

      accumulatedWidth += columnWidth;
      detectedColumn = i + 1;
    }

    currentColumnIndex.current = Math.max(
      startFromColumn,
      Math.min(detectedColumn, positions.length - 1),
    );
  }, [getColumnPositions, startFromColumn, useColumnWidths]);

  const updateScrollState = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollWidth, clientWidth, scrollLeft } = container;
    const scrollable = scrollWidth > clientWidth + 1;

    if (useColumnWidths) {
      syncColumnIndex();
      const { positions } = getColumnPositions();
      const maxColumnIndex = positions.length - 1;

      setCanScrollLeft(
        currentColumnIndex.current > startFromColumn || scrollLeft > 10,
      );
      setCanScrollRight(currentColumnIndex.current < maxColumnIndex);
      setIsScrollable(scrollable);
    } else {
      setCanScrollLeft(scrollLeft > 1);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
      setIsScrollable(scrollable);
    }
  }, [getColumnPositions, startFromColumn, syncColumnIndex, useColumnWidths]);

  const scrollToPosition = useCallback(
    (target: number) => {
      const container = containerRef.current;
      if (!container) return;

      isScrollingProgrammatically.current = true;
      container.scrollTo({
        left: target,
        behavior: scrollBehavior,
      });

      window.setTimeout(() => {
        isScrollingProgrammatically.current = false;
        updateScrollState();
      }, 320);
    },
    [scrollBehavior, updateScrollState],
  );

  const scrollLeft = useCallback(
    (smooth = true) => {
      const container = containerRef.current;
      if (!container) return;

      if (!useColumnWidths) {
        container.scrollBy({
          left: -scrollAmount,
          behavior: smooth ? scrollBehavior : "auto",
        });
        return;
      }

      const { positions, widths } = getColumnPositions();
      if (positions.length === 0) return;

      const nextIndex = Math.max(
        startFromColumn,
        currentColumnIndex.current - 1,
      );
      currentColumnIndex.current = nextIndex;

      let target = 0;
      for (let i = startFromColumn; i < nextIndex; i += 1) {
        target += widths[i] ?? 0;
      }

      scrollToPosition(target);
    },
    [
      getColumnPositions,
      scrollAmount,
      scrollBehavior,
      scrollToPosition,
      startFromColumn,
      useColumnWidths,
    ],
  );

  const scrollRight = useCallback(
    (smooth = true) => {
      const container = containerRef.current;
      if (!container) return;

      if (!useColumnWidths) {
        container.scrollBy({
          left: scrollAmount,
          behavior: smooth ? scrollBehavior : "auto",
        });
        return;
      }

      const { positions, widths } = getColumnPositions();
      if (positions.length === 0) return;

      const maxIndex = positions.length - 1;
      const nextIndex = Math.min(maxIndex, currentColumnIndex.current + 1);
      currentColumnIndex.current = nextIndex;

      let target = 0;
      for (let i = startFromColumn; i < nextIndex; i += 1) {
        target += widths[i] ?? 0;
      }

      if (nextIndex === maxIndex) {
        scrollToPosition(container.scrollWidth - container.clientWidth);
        return;
      }

      scrollToPosition(target);
    },
    [
      getColumnPositions,
      scrollAmount,
      scrollBehavior,
      scrollToPosition,
      startFromColumn,
      useColumnWidths,
    ],
  );

  const scrollToStart = useCallback(() => {
    currentColumnIndex.current = startFromColumn;
    scrollToPosition(0);
  }, [scrollToPosition, startFromColumn]);

  const scrollToEnd = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    currentColumnIndex.current = Number.POSITIVE_INFINITY;
    scrollToPosition(container.scrollWidth - container.clientWidth);
  }, [scrollToPosition]);

  useLayoutEffect(() => {
    let rafId: number | null = null;
    let cleanup: (() => void) | null = null;

    const setup = (container: HTMLDivElement) => {
      currentColumnIndex.current = startFromColumn;

      // Initial measurement and a follow-up on next frame for accurate widths
      updateScrollState();
      requestAnimationFrame(() => updateScrollState());

      const handleScroll = () => {
        if (isScrollingProgrammatically.current) return;

        if (scrollTimeoutRef.current !== null)
          clearTimeout(scrollTimeoutRef.current);

        scrollTimeoutRef.current = window.setTimeout(() => {
          updateScrollState();
        }, 80);
      };

      const handleResize = () => {
        currentColumnIndex.current = startFromColumn;
        updateScrollState();
      };

      container.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("resize", handleResize, { passive: true });

      // Observe container and table; attach to table when it appears
      const resizeObserver = new ResizeObserver(() => {
        currentColumnIndex.current = startFromColumn;
        updateScrollState();
      });

      resizeObserver.observe(container);

      let observedTable: HTMLTableElement | null = null;
      const observeTableIfPresent = () => {
        const table = container.querySelector("table");
        if (table && table !== observedTable) {
          observedTable = table as HTMLTableElement;
          resizeObserver.observe(observedTable);
          updateScrollState();
        }
      };

      observeTableIfPresent();

      const mutationObserver = new MutationObserver(() => {
        observeTableIfPresent();
      });
      mutationObserver.observe(container, { childList: true, subtree: true });

      cleanup = () => {
        container.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleResize);
        mutationObserver.disconnect();
        resizeObserver.disconnect();
        if (scrollTimeoutRef.current !== null)
          clearTimeout(scrollTimeoutRef.current);
      };
    };

    const ensureContainerThenSetup = () => {
      const container = containerRef.current;
      if (!container) {
        rafId = requestAnimationFrame(ensureContainerThenSetup);
        return;
      }
      setup(container);
    };

    ensureContainerThenSetup();

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (cleanup) cleanup();
    };
  }, [startFromColumn, updateScrollState]);

  useHotkeys(
    "ArrowLeft, ArrowRight, Home, End, PageUp, PageDown",
    (event) => {
      if (!enableKeyboardNavigation) return;

      if (event.key === "ArrowLeft" && canScrollLeft) {
        event.preventDefault();
        scrollLeft();
        return;
      }

      if (event.key === "ArrowRight" && canScrollRight) {
        event.preventDefault();
        scrollRight();
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        scrollToStart();
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        scrollToEnd();
        return;
      }

      if (event.key === "PageUp") {
        event.preventDefault();
        scrollLeft(false);
        return;
      }

      if (event.key === "PageDown") {
        event.preventDefault();
        scrollRight(false);
      }
    },
    {
      enabled: isScrollable && enableKeyboardNavigation,
    },
    [
      canScrollLeft,
      canScrollRight,
      enableKeyboardNavigation,
      isScrollable,
      scrollLeft,
      scrollRight,
      scrollToEnd,
      scrollToStart,
    ],
  );

  return {
    containerRef,
    canScrollLeft,
    canScrollRight,
    isScrollable,
    scrollLeft,
    scrollRight,
    scrollToStart,
    scrollToEnd,
  };
}
