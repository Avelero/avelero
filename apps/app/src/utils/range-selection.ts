import type { SelectionState } from "../components/tables/passports/types";

/**
 * Range Selection Utility
 *
 * Handles shift-click range selection for table rows.
 * Calculates which rows should be selected based on the range between
 * the last clicked row and the current row.
 *
 * Range selection is just an efficient manual selection method - it stays
 * in "explicit" mode and populates includeIds (same as individual clicks).
 *
 * Performance: Updates are INSTANT via optimistic local state, with parent
 * state synced in background using queueMicrotask + startTransition.
 */

interface RangeSelectionParams {
  currentGlobalIndex: number;
  lastClickedGlobalIndex: number | null;
  currentPageData: Array<{ id: string }>;
  currentPage: number;
  pageSize: number;
  selection: SelectionState;
}

interface RangeSelectionResult {
  type: "same-page" | "cross-page" | "none";
  rowIdsToSelect?: string[];
  rangeInfo?: {
    startIndex: number;
    endIndex: number;
    startPage: number;
    endPage: number;
  };
}

export function calculateRangeSelection(
  params: RangeSelectionParams,
): RangeSelectionResult {
  const {
    currentGlobalIndex,
    lastClickedGlobalIndex,
    currentPageData,
    currentPage,
    pageSize,
  } = params;

  // No shift-click or no previous click
  if (lastClickedGlobalIndex === null) {
    return { type: "none" };
  }

  const start = Math.min(lastClickedGlobalIndex, currentGlobalIndex);
  const end = Math.max(lastClickedGlobalIndex, currentGlobalIndex);
  const startPage = Math.floor(start / pageSize);
  const endPage = Math.floor(end / pageSize);

  const rangeInfo = { startIndex: start, endIndex: end, startPage, endPage };

  // Range is on current page only
  if (startPage === endPage && startPage === currentPage) {
    const startLocal = start % pageSize;
    const endLocal = end % pageSize;
    const rowIdsToSelect = currentPageData
      .slice(startLocal, endLocal + 1)
      .map((r) => r.id);

    return {
      type: "same-page",
      rowIdsToSelect,
      rangeInfo,
    };
  }

  // Range spans multiple pages
  return {
    type: "cross-page",
    rangeInfo,
  };
}

/**
 * Applies range selection to the current selection state.
 *
 * In "all" mode: removes IDs from excludeIds (re-selects them)
 * In "explicit" mode: adds IDs to includeIds
 */
export function applyRangeSelection(
  selection: SelectionState,
  rowIds: string[],
): SelectionState {
  if (selection.mode === "all") {
    // Remove from excludes (re-select them)
    const newExcludes = selection.excludeIds.filter(
      (id) => !rowIds.includes(id),
    );
    return {
      mode: "all",
      includeIds: [],
      excludeIds: newExcludes,
    };
  }

  // Add to includes
  const newIncludes = Array.from(new Set([...selection.includeIds, ...rowIds]));
  return {
    mode: "explicit",
    includeIds: newIncludes,
    excludeIds: [],
  };
}

/**
 * Placeholder for fetching row IDs across pages.
 *
 * TODO: Replace this with your actual backend query once the API is ready.
 *
 * Expected behavior:
 * - Fetch all passport IDs in the range [startIndex, endIndex] (inclusive)
 * - Respect the same ordering as your main list query
 * - Return an array of ID strings
 *
 * Example implementation:
 * ```typescript
 * const ids = await trpc.passports.getIdsByRange.query({
 *   startIndex,
 *   endIndex,
 *   // Include any filters/sorting that match your main query
 * });
 * return ids;
 * ```
 */
export async function fetchRowIdsByRange(
  startIndex: number,
  endIndex: number,
  // Add any additional params needed (filters, sorting, etc.)
): Promise<string[]> {
  console.warn(
    "Cross-page selection requires backend support.",
    `Range: ${startIndex} to ${endIndex}`,
  );

  // TODO: Implement backend query here
  // For now, return empty array (no cross-page selection)
  return [];
}
