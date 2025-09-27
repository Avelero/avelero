"use client";

import { useTableScroll } from "@/hooks/use-table-scroll";
import type { ColumnDef } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { cn } from "@v1/ui/cn";
import { Table, TableBody, TableCell, TableRow } from "@v1/ui/table";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import * as React from "react";
import { columns } from "./columns";
import { EmptyState } from "./empty-state";
import { getMockPassports } from "./mock-data";
import { PassportTableHeader } from "./table-header";
import { PassportTableSkeleton } from "./table-skeleton";
import type { Passport } from "./types";

export function PassportDataTable() {
  const [page, setPage] = React.useState(0);
  const pageSize = 50;
  const [data, setData] = React.useState<Passport[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [rowSelection, setRowSelection] = React.useState<
    Record<string, boolean>
  >({});

  React.useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getMockPassports(page, pageSize).then((res) => {
      if (!mounted) return;
      setData(res.data);
      setTotal(res.meta.total);
      setIsLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [page]);

  const table = useReactTable({
    data,
    columns: columns as ColumnDef<Passport, unknown>[],
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  });
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

  if (isLoading) return <PassportTableSkeleton />;
  if (!data.length) return <EmptyState.NoPassports />;

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
            />
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="h-14 cursor-default border-b border-border hover:bg-accent-blue data-[state=selected]:bg-accent-blue"
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
            <div className="text-p text-secondary">
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
