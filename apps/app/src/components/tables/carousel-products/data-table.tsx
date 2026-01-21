"use client";

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
import { columns } from "./columns";
import { EmptyState } from "./empty-state";
import { CarouselTableHeader } from "./table-header";
import type { CarouselProductRow, CarouselSelectionState } from "./types";

interface CarouselProductsDataTableProps {
  /**
   * Product rows to display
   */
  rows: CarouselProductRow[];
  /**
   * Total number of products (for display in footer)
   */
  total: number;
  /**
   * Current selection state
   */
  selection: CarouselSelectionState;
  /**
   * Callback when selection changes
   */
  onSelectionChange: (selection: CarouselSelectionState) => void;
  /**
   * Whether there are more products to load
   */
  hasMore: boolean;
  /**
   * Callback to load more products
   */
  onLoadMore: () => void;
  /**
   * Whether loading more products
   */
  isLoadingMore: boolean;
  /**
   * Whether any filters/search are active
   */
  hasFilters: boolean;
  /**
   * Callback to clear all filters/search
   */
  onClearFilters?: () => void;
}

/**
 * Data table for carousel product selection.
 * Follows the passports table pattern for selection behavior.
 */
export function CarouselProductsDataTable({
  rows,
  total,
  selection,
  onSelectionChange,
  hasMore,
  onLoadMore,
  isLoadingMore,
  hasFilters,
  onClearFilters,
}: CarouselProductsDataTableProps) {
  // Optimistic local state for instant UI updates
  const [optimisticRowSelection, setOptimisticRowSelection] = React.useState<
    Record<string, boolean>
  >({});

  // Compute row selection state from selection prop
  React.useEffect(() => {
    if (!rows.length) {
      setOptimisticRowSelection({});
      return;
    }

    const result: Record<string, boolean> = {};

    if (selection.mode === "all") {
      // All mode: all rows selected except excludeIds
      for (const row of rows) {
        result[row.id] = !selection.excludeIds.includes(row.id);
      }
    } else {
      // Explicit mode: only includeIds are selected
      for (const row of rows) {
        result[row.id] = selection.includeIds.includes(row.id);
      }
    }

    setOptimisticRowSelection(result);
  }, [rows, selection]);

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableRowSelection: true,
    state: {
      rowSelection: optimisticRowSelection,
    },
    onRowSelectionChange: (updater) => {
      const prev = optimisticRowSelection;
      const next = typeof updater === "function" ? updater(prev) : updater;
      setOptimisticRowSelection(next);

      // Sync parent state immediately (no startTransition to avoid stale closures)
      if (selection.mode === "all") {
        // In "all" mode: unchecking adds to excludeIds
        const exclude = new Set(selection.excludeIds);
        for (const row of rows) {
          const isChecked = !!next[row.id];
          if (isChecked) {
            exclude.delete(row.id); // Re-selecting removes from exclusions
          } else {
            exclude.add(row.id); // Deselecting adds to exclusions
          }
        }
        const nextExcludeIds = Array.from(exclude);
        if (
          nextExcludeIds.length !== selection.excludeIds.length ||
          !nextExcludeIds.every((id) => selection.excludeIds.includes(id))
        ) {
          onSelectionChange({
            mode: "all",
            includeIds: [],
            excludeIds: nextExcludeIds,
          });
        }
      } else {
        // In "explicit" mode: checking adds to includeIds
        const include = new Set(selection.includeIds);
        for (const row of rows) {
          const isChecked = !!next[row.id];
          if (isChecked) {
            include.add(row.id);
          } else {
            include.delete(row.id);
          }
        }
        const nextIncludeIds = Array.from(include);
        if (
          nextIncludeIds.length !== selection.includeIds.length ||
          !nextIncludeIds.every((id) => selection.includeIds.includes(id))
        ) {
          onSelectionChange({
            mode: "explicit",
            includeIds: nextIncludeIds,
            excludeIds: [],
          });
        }
      }
    },
  });

  // Calculate selected count
  const selectedCount = React.useMemo(() => {
    if (selection.mode === "all") {
      return total - selection.excludeIds.length;
    }
    return selection.includeIds.length;
  }, [selection, total]);

  const hasAnySelection = selectedCount > 0;

  // Handle select all
  const handleSelectAll = React.useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const row of rows) next[row.id] = true;
    setOptimisticRowSelection(next);

    onSelectionChange({
      mode: "all",
      includeIds: [],
      excludeIds: [],
    });
  }, [rows, onSelectionChange]);

  // Handle clear selection
  const handleClearSelection = React.useCallback(() => {
    setOptimisticRowSelection({});

    onSelectionChange({
      mode: "explicit",
      includeIds: [],
      excludeIds: [],
    });
  }, [onSelectionChange]);

  // Empty state - show different message based on whether filters are active
  if (rows.length === 0) {
    // If total is 0 and no active filters, there are truly no products
    const hasNoProductsAtAll = total === 0 && !hasFilters;
    return hasNoProductsAtAll ? (
      <EmptyState.NoPassports />
    ) : (
      <EmptyState.NoResults onClearAction={onClearFilters} />
    );
  }

  return (
    <div className="flex flex-col">
      {/* Table */}
      <div className="overflow-auto scrollbar-hide max-h-[400px] border border-border">
        <Table>
          <CarouselTableHeader
            table={table}
            onSelectAllAction={handleSelectAll}
            onClearSelectionAction={handleClearSelection}
            isAllMode={selection.mode === "all"}
            hasAnySelection={hasAnySelection}
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
                      "border-r last:border-r-0 align-middle",
                      (
                        cell.column.columnDef.meta as
                          | { cellClassName?: string }
                          | undefined
                      )?.cellClassName,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Load More / Footer */}
      <div className="flex items-center justify-end py-3">
        <div className="flex items-center gap-3">
          <span className="type-small text-secondary">
            Showing {rows.length} of {total}
          </span>
          {hasMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadMore}
              disabled={isLoadingMore}
            >
              <span className="px-1">
                {isLoadingMore ? "Loading..." : "Load more"}
              </span>
              {isLoadingMore ? (
                <Icons.Spinner className="h-3.5 w-3.5 animate-spin" />
              ) : undefined}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
