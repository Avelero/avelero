"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
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

  if (isLoading) return <PassportTableSkeleton />;
  if (!data.length) return <EmptyState.NoPassports />;

  return (
    <div className="w-full">
      <div className="overflow-x-auto border-l border-r border-border">
        <Table>
          <PassportTableHeader table={table} />
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer hover:bg-accent"
                data-state={row.getIsSelected() && "selected"}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest("button, a, [role='menuitem'], input"))
                    return;
                  // Placeholder: navigate to details page when available
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end gap-2 py-3">
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
