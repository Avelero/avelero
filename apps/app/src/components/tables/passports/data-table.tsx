"use client";

import { useTableScroll } from "@/hooks/use-table-scroll";
import { useUserQuerySuspense } from "@/hooks/use-user";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
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
import { columns } from "./columns";
import { EmptyState } from "./empty-state";
import { PassportTableHeader } from "./table-header";
import { PassportTableSkeleton } from "./table-skeleton";
import type { Passport, SelectionState } from "./types";
import type { SearchState } from "@/hooks/use-search-state";
import type { SortState } from "@/hooks/use-sort-state";
import type { FilterState } from "@/components/passports/filter-types";

export function PassportDataTable({
  onSelectionChangeAction,
  columnOrder,
  columnVisibility,
  onTotalCountChangeAction,
  selection,
  onSelectionStateChangeAction,
  searchState,
  sortState,
  filterState,
}: {
  onSelectionChangeAction?: (count: number) => void;
  columnOrder?: string[];
  columnVisibility?: Record<string, boolean>;
  onTotalCountChangeAction?: (hasAny: boolean) => void;
  selection: SelectionState;
  onSelectionStateChangeAction: (next: SelectionState) => void;
  searchState?: SearchState;
  sortState?: SortState;
  filterState?: FilterState;
}) {
  const [page, setPage] = React.useState(0);
  const pageSize = 50;
  const trpc = useTRPC();
  const { data: user } = useUserQuerySuspense();
  const brandId = (user as any)?.brand_id as string | null | undefined;

  // Reset page when search, sort, or filter changes
  React.useEffect(() => {
    setPage(0);
  }, [
    searchState?.debouncedQuery,
    sortState?.field,
    sortState?.direction,
    filterState,
    brandId, // Reset page when brand changes
  ]);

  // Convert frontend filter state to backend filter format
  // Memoize based on filterState to prevent unnecessary recalculations
  const convertedFilters = React.useMemo(() => {
    if (!filterState || filterState.groups.length === 0) return {};

    const backendFilter: any = {};

    // Process all filter groups (AND logic between groups)
    for (const group of filterState.groups) {
      for (const condition of group.conditions) {
        if (!condition.fieldId || condition.value == null) continue;

        const value = condition.value;
        const values = Array.isArray(value) ? value : [value];

        switch (condition.fieldId) {
          case "status":
            // passportStatus expects array of status values
            if (!backendFilter.passportStatus)
              backendFilter.passportStatus = [];
            backendFilter.passportStatus.push(...values);
            break;

          case "categoryId":
            // Category filtering through product join
            if (!backendFilter.categoryIds) backendFilter.categoryIds = [];
            backendFilter.categoryIds.push(...values);
            break;

          case "colorId":
            // Color filtering through variant join
            if (!backendFilter.colorIds) backendFilter.colorIds = [];
            backendFilter.colorIds.push(...values);
            break;

          case "sizeId":
            // Size filtering through variant join
            if (!backendFilter.sizeIds) backendFilter.sizeIds = [];
            backendFilter.sizeIds.push(...values);
            break;

          case "season":
            // Season is a direct field on passport
            if (!backendFilter.season) backendFilter.season = [];
            backendFilter.season.push(...values);
            break;

          case "moduleCompletion":
            // Module completion - complex logic, placeholder for now
            // TODO: Implement module completion filtering
            break;
        }
      }
    }

    // Deduplicate arrays
    for (const key of Object.keys(backendFilter)) {
      if (Array.isArray(backendFilter[key])) {
        backendFilter[key] = [...new Set(backendFilter[key])];
      }
    }

    return backendFilter;
  }, [filterState]);

  // Build query parameters with search, sort, and filters
  const queryParams = React.useMemo(() => {
    const params: any = {
      pagination: {
        limit: pageSize,
        page: page + 1, // Convert 0-based to 1-based page number
        includeTotalCount: true, // Request total count for pagination
      },
      include: {
        product: true,
        variant: true,
        template: true,
      },
    };

    // Initialize filter object
    params.filter = {};

    // Add search if active
    if (searchState?.debouncedQuery?.trim()) {
      params.filter.search = searchState.debouncedQuery.trim();
    }

    // Add converted filters
    params.filter = { ...params.filter, ...convertedFilters };

    // Add sort if active
    if (sortState?.field && sortState?.direction) {
      params.sort = {
        field: sortState.field,
        direction: sortState.direction,
      };
    }

    return params;
  }, [
    searchState?.debouncedQuery,
    sortState?.field,
    sortState?.direction,
    convertedFilters,
    pageSize,
    page,
    brandId, // Include brandId in dependencies so query cache invalidates when brand changes
  ]);

  const { data: listRes, isLoading } = useQuery(
    React.useMemo(
      () => trpc.passports.list.queryOptions(queryParams),
      [trpc, queryParams],
    ),
  );
  const data = React.useMemo<Passport[]>(() => {
    const rawData = (listRes as { data?: unknown } | undefined)?.data;
    if (!Array.isArray(rawData)) return [];

    // Map the API response to the Passport type expected by the frontend
    return rawData.map((item: any) => ({
      id: item.id,
      title: item.product?.name || item.productId || "Untitled",
      sku: item.variant?.sku || undefined,
      color: item.variant?.color || undefined,
      size: item.variant?.size || undefined,
      status: (item.status === "draft" || item.status === "blocked"
        ? "unpublished"
        : item.status) as
        | "published"
        | "scheduled"
        | "unpublished"
        | "archived",
      completedSections: 0, // TODO: Calculate from actual data
      totalSections: 6, // TODO: Get from template
      category: item.product?.category || "Uncategorized",
      categoryPath: [], // TODO: Build from category hierarchy
      season: item.season || undefined,
      template: item.template
        ? {
            id: item.template.id,
            name: item.template.name,
            color: item.template.brandColor || "#3B82F6",
          }
        : undefined,
      passportUrl: item.publicUrl || undefined,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }, [listRes]);
  const total = React.useMemo<number>(() => {
    const m = (listRes as { meta?: { total?: unknown } } | undefined)?.meta;
    const t = (m?.total as number | undefined) ?? 0;
    return typeof t === "number" ? t : 0;
  }, [listRes]);

  React.useEffect(() => {
    onTotalCountChangeAction?.(total > 0);
  }, [total, onTotalCountChangeAction]);
  const [rowSelection, setRowSelection] = React.useState<
    Record<string, boolean>
  >({});

  const table = useReactTable({
    data,
    columns: columns as ColumnDef<Passport, unknown>[],
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    onRowSelectionChange: (updater) => {
      setRowSelection((prev) => {
        const next =
          typeof updater === "function" ? (updater as any)(prev) : updater;
        return next;
      });
    },
    state: { rowSelection: optimisticRowSelection, columnOrder, columnVisibility },
    meta: {
      handleRangeSelection,
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

  // Used to avoid propagating selection updates caused by our own sync
  const skipPropagateRef = React.useRef<Record<string, boolean> | null>(null);

  React.useEffect(() => {
    if (!data.length) {
      setRowSelection({});
      return;
    }
    // sync visible page selection with SelectionState
    const nextMap: Record<string, boolean> = {};
    if (selection.mode === "all") {
      for (const row of data) {
        nextMap[row.id] = !selection.excludeIds.includes(row.id);
      }
    } else {
      for (const row of data) {
        nextMap[row.id] = selection.includeIds.includes(row.id);
      }
    }
    skipPropagateRef.current = nextMap;
    setRowSelection(nextMap);
  }, [data, selection]);

  // After user toggles row checkboxes, update SelectionState based on current page selections.
  React.useEffect(() => {
    if (!data.length) return;
    // If this update was triggered by our own selection→rowSelection sync, skip propagation
    if (skipPropagateRef.current) {
      const expect = skipPropagateRef.current;
      let same = true;
      const keys = new Set([
        ...Object.keys(expect),
        ...Object.keys(rowSelection),
      ]);
      for (const k of keys) {
        if (!!expect[k] !== !!rowSelection[k]) {
          same = false;
          break;
        }
      }
      if (same) {
        skipPropagateRef.current = null;
        return;
      }
      // if not same, clear marker and continue to propagate
      skipPropagateRef.current = null;
    }
    function setsEqual(a: Set<string>, b: Set<string>) {
      if (a.size !== b.size) return false;
      for (const v of a) if (!b.has(v)) return false;
      return true;
    }
    if (selection.mode === "all") {
      const exclude = new Set(selection.excludeIds);
      for (const row of data) {
        const checked = !!rowSelection[row.id];
        if (checked) exclude.delete(row.id);
        else exclude.add(row.id);
      }
      const nextExcludeSet = exclude;
      const currExcludeSet = new Set(selection.excludeIds);
      if (!setsEqual(nextExcludeSet, currExcludeSet)) {
        onSelectionStateChangeAction({
          ...selection,
          excludeIds: Array.from(nextExcludeSet),
        });
      }
    } else {
      const include = new Set(selection.includeIds);
      for (const row of data) {
        const checked = !!rowSelection[row.id];
        if (checked) include.add(row.id);
        else include.delete(row.id);
      }
      const nextIncludeSet = include;
      const currIncludeSet = new Set(selection.includeIds);
      if (!setsEqual(nextIncludeSet, currIncludeSet)) {
        onSelectionStateChangeAction({
          ...selection,
          includeIds: Array.from(nextIncludeSet),
        });
      }
    }
  }, [rowSelection, data, selection, onSelectionStateChangeAction]);

  // Debug logging
  React.useEffect(() => {
  console.log('DEBUG - PassportDataTable:', {
      isLoading,
      dataLength: data.length,
      total,
      rawListRes: listRes,
      data: data.slice(0, 2), // Show first 2 items
    });
  }, [isLoading, data.length, total, listRes, data]);

  if (isLoading) return <PassportTableSkeleton />;
  if (!data.length)
    return total === 0 ? (
      <EmptyState.NoPassports onCreateAction={() => {}} />
    ) : (
      <EmptyState.NoResults />
    );

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
                // switch to all mode and clear excludes
                if (selection.mode !== "all" || selection.excludeIds.length) {
                  onSelectionStateChangeAction({
                    mode: "all",
                    includeIds: [],
                    excludeIds: [],
                  });
                }
                // visually select all on page
                const next: Record<string, boolean> = {};
                for (const row of data) next[row.id] = true;
                setRowSelection(next);
              }}
              onClearSelectionAction={() => {
                onSelectionStateChangeAction({
                  mode: "explicit",
                  includeIds: [],
                  excludeIds: [],
                });
                setRowSelection({});
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
        const start = total === 0 ? 0 : page * pageSize + 1;
        const end = page * pageSize + data.length;
        const lastPage = Math.max(0, Math.ceil(total / pageSize) - 1);
        const canGoPrev = page > 0;
        const canGoNext = page < lastPage;
        return (
          <div className="flex items-center justify-end gap-4 py-3">
            <div className="type-p text-secondary">
              {start} - {end} of {total}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                aria-label="First page"
                onClick={() => setPage(0)}
                disabled={!canGoPrev}
                icon={<Icons.ChevronsLeft className="h-[14px] w-[14px]" />}
              />
              <Button
                variant="outline"
                size="sm"
                aria-label="Previous page"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={!canGoPrev}
                icon={<Icons.ChevronLeft className="h-[14px] w-[14px]" />}
              />
              <Button
                variant="outline"
                size="sm"
                aria-label="Next page"
                onClick={() => setPage((p) => p + 1)}
                disabled={!canGoNext}
                icon={<Icons.ChevronRight className="h-[14px] w-[14px]" />}
              />
              <Button
                variant="outline"
                size="sm"
                aria-label="Last page"
                onClick={() => setPage(lastPage)}
                disabled={!canGoNext}
                icon={<Icons.ChevronsRight className="h-[14px] w-[14px]" />}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
