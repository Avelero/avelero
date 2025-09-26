"use client";

import { useTableScroll } from "@/hooks/use-table-scroll";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { cn } from "@v1/ui/cn";
import { Table, TableBody, TableCell, TableRow } from "@v1/ui/table";
import * as React from "react";
import { columns } from "./columns";
import { EmptyState } from "./empty-state";
import { getMockPassports } from "./mock-data";
import { PassportTableHeader } from "./table-header";
import { PassportTableSkeleton } from "./table-skeleton";
import type { Passport } from "./types";

export function PassportDataTable() {
  const [page, setPage] = React.useState(0);
  const pageSize = 20;
  const [data, setData] = React.useState<Passport[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [rowSelection, setRowSelection] = React.useState<
    Record<string, boolean>
  >({});

  React.useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    getMockPassports(page, pageSize).then((res) => {
      if (!mounted) return;
      setData(res.data);
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
    getPaginationRowModel: getPaginationRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
  });
  const {
    containerRef,
    canScrollLeft,
    canScrollRight,
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
    <div className="relative w-full">
      <div className="relative w-full overflow-hidden border border-border">
        <div
          ref={containerRef}
          className="scrollbar-hide overflow-x-auto max-w-full w-full"
        >
          <Table className="min-w-full">
            <PassportTableHeader table={table} />
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
        {null}
      </div>
      <div className="flex items-center justify-end gap-2 py-3 px-4">
        <button
          type="button"
          className="border px-3 py-1 text-sm"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          Previous
        </button>
        <button
          type="button"
          className="border px-3 py-1 text-sm"
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
