"use client";

import { useTableScroll } from "@/hooks/use-table-scroll";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@v1/ui/table";
import * as React from "react";
import { RowActionsMenu } from "./row-actions-menu";
import { RowSelectionCheckbox } from "./row-selection-checkbox";
import type { FlatTableColumn, RowAction } from "./types";

export function FlatDataTable<TRow>({
  rows,
  rowKey,
  columns,
  selectedIds,
  onSelectedIdsChange,
  getRowActions,
  emptyState,
}: {
  rows: TRow[];
  rowKey: (row: TRow) => string;
  columns: Array<FlatTableColumn<TRow>>;
  selectedIds: string[];
  onSelectedIdsChange: (next: string[]) => void;
  getRowActions?: (row: TRow) => RowAction[];
  emptyState?: React.ReactNode;
}) {
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const rowIds = React.useMemo(() => rows.map(rowKey), [rows, rowKey]);
  const [lastClickedRowIndex, setLastClickedRowIndex] = React.useState<number | null>(null);
  const {
    containerRef: scrollContainerRef,
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

  const allSelected = rowIds.length > 0 && rowIds.every((id) => selectedSet.has(id));
  const someSelected = rowIds.some((id) => selectedSet.has(id));
  const hasAnySelection = allSelected || someSelected;

  const toggleRow = React.useCallback(
    (id: string, checked: boolean) => {
      const next = new Set(selectedSet);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      onSelectedIdsChange(Array.from(next));
    },
    [onSelectedIdsChange, selectedSet],
  );

  const handleRowSelectionChange = React.useCallback(
    (rowIndex: number, id: string, checked: boolean, shiftKey: boolean) => {
      if (!shiftKey) {
        toggleRow(id, checked);
        setLastClickedRowIndex(rowIndex);
        return;
      }

      if (lastClickedRowIndex === null) {
        setLastClickedRowIndex(rowIndex);
        return;
      }

      const start = Math.min(lastClickedRowIndex, rowIndex);
      const end = Math.max(lastClickedRowIndex, rowIndex);
      const idsInRange = rowIds.slice(start, end + 1);

      setLastClickedRowIndex(rowIndex);

      if (!idsInRange.length) return;

      const next = new Set(selectedSet);
      for (const rangeId of idsInRange) {
        next.add(rangeId);
      }
      onSelectedIdsChange(Array.from(next));
    },
    [lastClickedRowIndex, onSelectedIdsChange, rowIds, selectedSet, toggleRow],
  );

  const toggleAllVisible = React.useCallback(
    (checked: boolean) => {
      if (checked) {
        const next = new Set(selectedSet);
        for (const id of rowIds) next.add(id);
        onSelectedIdsChange(Array.from(next));
        return;
      }

      const next = new Set(selectedSet);
      for (const id of rowIds) next.delete(id);
      onSelectedIdsChange(Array.from(next));
    },
    [onSelectedIdsChange, rowIds, selectedSet],
  );

  if (rows.length === 0) {
    return <>{emptyState ?? null}</>;
  }

  return (
    <div className="relative w-full h-full min-h-0">
      <div
        ref={scrollContainerRef}
        className="relative w-full h-fit min-h-0 max-h-full max-w-full overflow-x-auto overflow-y-auto border border-border bg-background scrollbar-hide"
      >
        <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow className="h-14 border-b border-border">
                {columns.map((column, columnIndex) => {
                  const isFirstColumn = columnIndex === 0;
                  const stickyFirstColumnClass = isFirstColumn
                    ? "sticky left-0 z-[12] bg-background border-r-0 before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-accent-dark"
                    : undefined;

                  return (
                    <TableHead
                      key={column.id}
                      className={cn(
                        "relative h-14 px-4 align-middle text-secondary type-p bg-background",
                        stickyFirstColumnClass,
                        column.headerClassName,
                      )}
                    >
                      {isFirstColumn ? (
                        <div className="flex items-center justify-between gap-4 min-w-0">
                          <div className="flex items-center gap-4 min-w-0 flex-1">
                            <div className="flex-shrink-0">
                              <RowSelectionCheckbox
                              checked={allSelected}
                              indeterminate={someSelected && !allSelected}
                              onChange={() => {
                                toggleAllVisible(!hasAnySelection);
                              }}
                              ariaLabel="Select all rows"
                              hitArea="header"
                            />
                            </div>
                            <div className="min-w-0 flex-1">{column.header}</div>
                          </div>
                          {isScrollable ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-label="Scroll left"
                                onClick={(event) => {
                                  event.preventDefault();
                                  scrollLeft();
                                }}
                                disabled={!canScrollLeft}
                              >
                                <Icons.ChevronLeft className="h-[14px] w-[14px]" />
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                aria-label="Scroll right"
                                onClick={(event) => {
                                  event.preventDefault();
                                  scrollRight();
                                }}
                                disabled={!canScrollRight}
                              >
                                <Icons.ChevronRight className="h-[14px] w-[14px]" />
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        column.header
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => {
                const id = rowKey(row);
                const isSelected = selectedSet.has(id);
                const actions = getRowActions?.(row) ?? [];

                return (
                  <TableRow
                    key={id}
                    data-state={isSelected ? "selected" : undefined}
                    className="group h-14 border-b border-border hover:bg-accent-light data-[state=selected]:bg-accent-blue"
                  >
                    {columns.map((column, columnIndex) => {
                      const isFirstColumn = columnIndex === 0;
                      const isLastColumn = columnIndex === columns.length - 1;
                      const stickyFirstColumnClass = isFirstColumn
                        ? "sticky left-0 z-[8] border-r-0 before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-accent-dark bg-background group-hover:bg-accent-light group-data-[state=selected]:bg-accent-blue"
                        : undefined;

                      let content: React.ReactNode = column.cell(row);

                    if (isFirstColumn) {
                      content = (
                        <div className="flex h-full items-center gap-4 min-w-0">
                          <div className="flex-shrink-0">
                            <RowSelectionCheckbox
                              checked={isSelected}
                              onChange={(checked, meta) => {
                                handleRowSelectionChange(
                                  rowIndex,
                                  id,
                                  checked,
                                  meta?.shiftKey ?? false,
                                );
                              }}
                              ariaLabel={`Select row ${id}`}
                              hitArea="row"
                            />
                            </div>
                            <div className="min-w-0 flex-1">{content}</div>
                          </div>
                        );
                      }

                      if (isLastColumn && actions.length > 0) {
                        content = (
                          <div className="flex items-center justify-between gap-2 min-w-0">
                            <div className="min-w-0 flex-1">{content}</div>
                            <div className="w-[30px] flex-shrink-0 flex justify-end">
                              <RowActionsMenu
                                actions={actions}
                                triggerClassName="opacity-0 group-hover:opacity-100"
                              />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <TableCell
                          key={`${id}-${column.id}`}
                          className={cn(
                            "relative h-14 px-4 py-0 align-middle",
                            stickyFirstColumnClass,
                            column.cellClassName,
                            column.getCellClassName?.(row),
                          )}
                        >
                          {content}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
      </div>
    </div>
  );
}
