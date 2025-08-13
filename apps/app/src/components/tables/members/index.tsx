"use client";

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { type ColumnFiltersState, flexRender, getCoreRowModel, getFilteredRowModel, useReactTable } from "@tanstack/react-table";
import { cn } from "@v1/ui/cn";
import { useTRPC } from "@/trpc/client";
import { Input } from "@v1/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@v1/ui/table";
import { columns } from "./columns";

export function DataTable() {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const trpc = useTRPC();
  const { data } = useSuspenseQuery({
    ...trpc.brand.members.queryOptions(),
  });

  const table = useReactTable<any>({
    getRowId: (row) => row.id,
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnFiltersChange: setColumnFilters,
    state: {
      columnFilters,
    },
    meta: {
      currentUser: data?.find((member) => member?.user?.id),
      totalOwners: data?.filter((member) => member?.role === "owner").length,
    },
  });

  return (
    <div className="w-full">
      <div className="flex items-center pb-4 space-x-4">
        <Input
          className="flex-1"
          placeholder="Search..."
          value={(table.getColumn("user")?.getFilterValue() as string) ?? ""}
          onChange={(event) => table.getColumn("user")?.setFilterValue(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
        />
        {/* Invite button/modal is provided at the page header */}
      </div>
      <Table>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && "selected"} className="hover:bg-transparent">
                {row.getAllCells().map((cell) => (
                  <TableCell key={cell.id} className={cn("border-r-[0px] py-4") }>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}


