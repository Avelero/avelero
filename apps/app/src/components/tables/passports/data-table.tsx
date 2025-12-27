"use client";

import { useTableScroll } from "@/hooks/use-table-scroll";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Table, TableBody, TableCell, TableRow } from "@v1/ui/table";
import * as React from "react";
import {
  applyRangeSelection,
  calculateRangeSelection,
} from "../../../utils/range-selection";
import { columns } from "./columns";
import { EmptyState } from "./empty-state";
import { PassportTableHeader } from "./table-header";
import type { PassportTableRow, SelectionState } from "./types";

export function PassportDataTable({
  onSelectionChangeAction,
  columnOrder,
  columnVisibility,
  onTotalCountChangeAction,
  selection,
  onSelectionStateChangeAction,
  rows,
  total,
  pageInfo,
  onNextPage,
  onPrevPage,
  onFirstPage,
  onLastPage,
  onPrefetchNext,
  onPrefetchPrev,
  onPrefetchFirst,
  onPrefetchLast,
  hasActiveFilters,
  onClearFilters,
  brandSlug,
  onDeleteProduct,
  onChangeStatus,
}: {
  onSelectionChangeAction?: (count: number) => void;
  columnOrder?: string[];
  columnVisibility?: Record<string, boolean>;
  onTotalCountChangeAction?: (hasAny: boolean) => void;
  selection: SelectionState;
  onSelectionStateChangeAction: (next: SelectionState) => void;
  rows: PassportTableRow[];
  total: number;
  pageInfo: {
    hasNext: boolean;
    hasPrev: boolean;
    hasFirst: boolean;
    hasLast: boolean;
    start: number;
    end: number;
  };
  onNextPage: () => void;
  onPrevPage: () => void;
  onFirstPage: () => void;
  onLastPage: () => void;
  onPrefetchNext?: () => void;
  onPrefetchPrev?: () => void;
  onPrefetchFirst?: () => void;
  onPrefetchLast?: () => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  brandSlug?: string | null;
  onDeleteProduct?: (productId: string) => void;
  onChangeStatus?: (productId: string, status: string) => void;
}) {
  const pageSize = 50;
  const page =
    pageInfo.start > 0
      ? Math.max(0, Math.floor((pageInfo.start - 1) / pageSize))
      : 0;
  const tableData = rows;
  const totalProducts = total;

  const mapRowIdsToPassportIds = React.useCallback(
    (rowIds: string[]) => {
      if (!rowIds.length) return [];
      const expanded: string[] = [];
      const seen = new Set<string>();

      for (const rowId of rowIds) {
        const row = tableData.find((item) => item.id === rowId);
        if (!row) continue;
        for (const passportId of row.passportIds) {
          if (seen.has(passportId)) continue;
          seen.add(passportId);
          expanded.push(passportId);
        }
      }

      return expanded;
    },
    [tableData],
  );

  React.useEffect(() => {
    onTotalCountChangeAction?.(total > 0);
  }, [total, onTotalCountChangeAction]);

  // Optimistic local state for instant UI updates
  const [optimisticRowSelection, setOptimisticRowSelection] = React.useState<
    Record<string, boolean>
  >({});
  const [lastClickedIndex, setLastClickedIndex] = React.useState<number | null>(
    null,
  );
  const [isPending, startTransition] = React.useTransition();

  const handleRangeSelection = React.useCallback(
    (rowIndex: number, shiftKey: boolean, rowId: string) => {
      const globalIndex = page * pageSize + rowIndex;

      if (!shiftKey) {
        setLastClickedIndex(globalIndex);
        return;
      }

      // Prevent text selection on shift-click
      window.getSelection()?.removeAllRanges();

      if (lastClickedIndex === null) {
        setLastClickedIndex(globalIndex);
        return;
      }

      const result = calculateRangeSelection({
        currentGlobalIndex: globalIndex,
        lastClickedGlobalIndex: lastClickedIndex,
        currentPageData: tableData,
        currentPage: page,
        pageSize,
        selection,
      });

      setLastClickedIndex(globalIndex);

      if (result.type === "same-page" && result.rowIdsToSelect) {
        const idsToSelect = result.rowIdsToSelect;
        const passportIdsToSelect = mapRowIdsToPassportIds(idsToSelect);
        if (!passportIdsToSelect.length) {
          setLastClickedIndex(globalIndex);
          return;
        }

        // INSTANT UPDATE - synchronous, no delays
        const next: Record<string, boolean> = { ...optimisticRowSelection };
        for (const id of idsToSelect) {
          next[id] = true;
        }
        setOptimisticRowSelection(next);

        // Defer parent update (non-blocking)
        startTransition(() => {
          const newSelection = applyRangeSelection(
            selection,
            passportIdsToSelect,
          );
          onSelectionStateChangeAction(newSelection);
        });
      } else if (result.type === "cross-page" && result.rangeInfo) {
        // TODO: Implement cross-page selection with backend support
        console.warn(
          "Cross-page selection requires backend support.",
          `Range: ${result.rangeInfo.startIndex} to ${result.rangeInfo.endIndex}`,
        );
      }
    },
    [
      page,
      pageSize,
      lastClickedIndex,
      tableData,
      selection,
      onSelectionStateChangeAction,
      optimisticRowSelection,
      mapRowIdsToPassportIds,
    ],
  );

  const table = useReactTable({
    data: tableData,
    columns: columns as ColumnDef<PassportTableRow, unknown>[],
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    onRowSelectionChange: (updater) => {
      // INSTANT UPDATE - synchronous, no delays
      const prev = optimisticRowSelection;
      const next = typeof updater === "function" ? updater(prev) : updater;
      setOptimisticRowSelection(next);

      // Defer parent sync (non-blocking)
      startTransition(() => {
        if (selection.mode === "all") {
          // In "all" mode: unchecking adds to excludeIds
          const exclude = new Set(selection.excludeIds);
          for (const row of tableData) {
            const isChecked = !!next[row.id];
            const targetIds = row.passportIds;
            if (!targetIds.length) continue;
            if (isChecked) {
              for (const id of targetIds) {
                exclude.delete(id); // Re-selecting removes from exclusions
              }
            } else {
              for (const id of targetIds) {
                exclude.add(id); // Deselecting adds to exclusions
              }
            }
          }
          const nextExcludeIds = Array.from(exclude);
          // Only update if changed (avoid unnecessary re-renders)
          if (
            nextExcludeIds.length !== selection.excludeIds.length ||
            !nextExcludeIds.every((id) => selection.excludeIds.includes(id))
          ) {
            onSelectionStateChangeAction({
              mode: "all",
              includeIds: [],
              excludeIds: nextExcludeIds,
            });
          }
        } else {
          // In "explicit" mode: checking adds to includeIds
          const include = new Set(selection.includeIds);
          for (const row of tableData) {
            const isChecked = !!next[row.id];
            const targetIds = row.passportIds;
            if (!targetIds.length) continue;
            if (isChecked) {
              for (const id of targetIds) {
                include.add(id);
              }
            } else {
              for (const id of targetIds) {
                include.delete(id);
              }
            }
          }
          const nextIncludeIds = Array.from(include);
          // Only update if changed (avoid unnecessary re-renders)
          if (
            nextIncludeIds.length !== selection.includeIds.length ||
            !nextIncludeIds.every((id) => selection.includeIds.includes(id))
          ) {
            onSelectionStateChangeAction({
              mode: "explicit",
              includeIds: nextIncludeIds,
              excludeIds: [],
            });
          }
        }
      });
    },
    state: {
      rowSelection: optimisticRowSelection,
      columnOrder,
      columnVisibility,
    },
    meta: {
      handleRangeSelection,
      brandSlug,
      onDeleteProduct,
      onChangeStatus,
    },
  });

  const selectedCount = React.useMemo(() => {
    if (selection.mode === "all") return total - selection.excludeIds.length;
    return selection.includeIds.length;
  }, [selection, total]);

  React.useEffect(() => {
    onSelectionChangeAction?.(selectedCount);
  }, [selectedCount, onSelectionChangeAction]);
  const {
    containerRef,
    canScrollLeft,
    canScrollRight,
    isScrollable,
    scrollLeft,
    scrollRight,
  } = useTableScroll({
    useColumnWidths: true,
    startFromColumn: 1,
    scrollAmount: 120,
    scrollBehavior: "smooth",
    enableKeyboardNavigation: true,
  });

  // Sync from parent selection → optimistic state (only when not in transition)
  React.useEffect(() => {
    // Don't overwrite optimistic updates during transitions
    if (isPending) return;

    if (!tableData.length) {
      setOptimisticRowSelection({});
      return;
    }

    const nextMap: Record<string, boolean> = {};

    if (selection.mode === "all") {
      const excludeSet = new Set(selection.excludeIds);
      for (const row of tableData) {
        nextMap[row.id] = row.passportIds.every(
          (passportId) => !excludeSet.has(passportId),
        );
      }
    } else {
      const includeSet = new Set(selection.includeIds);
      for (const row of tableData) {
        nextMap[row.id] = row.passportIds.every((passportId) =>
          includeSet.has(passportId),
        );
      }
    }

    setOptimisticRowSelection(nextMap);
  }, [tableData, selection, isPending]);
  if (!tableData.length) {
    // Show "No passports yet" only if there are truly no products AND no active filters/search
    // If there are active filters/search and no results, show "No results"
    const hasNoProductsAtAll = total === 0 && !hasActiveFilters;
    return hasNoProductsAtAll ? (
      <EmptyState.NoPassports />
    ) : (
      <EmptyState.NoResults onClearAction={onClearFilters} />
    );
  }

  return (
    <div className="relative w-full h-full">
      <div className="relative w-full overflow-hidden border border-border">
        <div
          ref={containerRef}
          className="scrollbar-hide overflow-x-auto overflow-y-auto max-w-full w-full max-h-[calc(100vh_-_202px)]"
        >
          <Table className="min-w-full">
            <PassportTableHeader
              table={table}
              isScrollable={isScrollable}
              onScrollLeftAction={scrollLeft}
              onScrollRightAction={scrollRight}
              onSelectAllAction={() => {
                // Switch to "all" mode - selects ALL products in filter (not just visible)
                // INSTANT UPDATE - synchronous, no delays
                const next: Record<string, boolean> = {};
                for (const row of tableData) next[row.id] = true;
                setOptimisticRowSelection(next);

                // Defer parent update (non-blocking)
                startTransition(() => {
                  onSelectionStateChangeAction({
                    mode: "all",
                    includeIds: [],
                    excludeIds: [],
                  });
                });
              }}
              onClearSelectionAction={() => {
                // Clear selection completely
                // INSTANT UPDATE - synchronous, no delays
                setOptimisticRowSelection({});

                // Defer parent update (non-blocking)
                startTransition(() => {
                  onSelectionStateChangeAction({
                    mode: "explicit",
                    includeIds: [],
                    excludeIds: [],
                  });
                });
              }}
              isAllMode={selection.mode === "all"}
              hasAnySelection={selectedCount > 0}
            />
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="h-14 cursor-default border-b border-border hover:bg-accent-light data-[state=selected]:bg-accent-blue"
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "border-r px-4 align-middle",
                        (
                          cell.column.columnDef.meta as
                          | { cellClassName?: string }
                          | undefined
                        )?.cellClassName,
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {(() => {
        const start = pageInfo.start;
        const end = pageInfo.end;
        const canGoPrev = pageInfo.hasPrev;
        const canGoNext = pageInfo.hasNext;
        const canGoFirst = pageInfo.hasFirst;
        const canGoLast = pageInfo.hasLast;
        return (
          <div className="flex items-center justify-end gap-4 py-3">
            <div className="type-p text-secondary">
              {start} - {end} of {totalProducts}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                aria-label="First page"
                onClick={onFirstPage}
                onMouseEnter={onPrefetchFirst}
                disabled={!canGoFirst}
              >
                <Icons.ChevronsLeft className="h-[14px] w-[14px]" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Previous page"
                onClick={onPrevPage}
                onMouseEnter={onPrefetchPrev}
                disabled={!canGoPrev}
              >
                <Icons.ChevronLeft className="h-[14px] w-[14px]" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Next page"
                onClick={onNextPage}
                onMouseEnter={onPrefetchNext}
                disabled={!canGoNext}
              >
                <Icons.ChevronRight className="h-[14px] w-[14px]" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="Last page"
                onClick={onLastPage}
                onMouseEnter={onPrefetchLast}
                disabled={!canGoLast}
              >
                <Icons.ChevronsRight className="h-[14px] w-[14px]" />
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
