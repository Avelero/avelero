"use client";

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { type ColumnFiltersState, flexRender, getCoreRowModel, getFilteredRowModel, useReactTable } from "@tanstack/react-table";
import { cn } from "@v1/ui/cn";
import { useTRPC } from "@/trpc/client";
import { DataTableHeader } from "./table-header";
import { columns, type TeamInviteRow } from "./columns";

interface Props {
  brandId: string;
}

export function MemberInvitesTable({ brandId }: Props) {
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const trpc = useTRPC();
  const { data } = useSuspenseQuery({
    ...trpc.brand.listInvites.queryOptions({ brand_id: brandId }),
  });

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: (data as any)?.data ?? [],
    columns: columns as typeof columns,
    state: { columnFilters },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="w-full">
      <DataTableHeader brandId={brandId} table={table} />
      <div className="divide-y">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => (
            <div key={row.id} className="py-3 flex items-center justify-between">
              {row.getAllCells().map((cell) => (
                <div key={cell.id} className={cn("py-2")}> 
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              ))}
            </div>
          ))
        ) : (
          <div className="py-16 text-center">
            <h2 className="font-medium mb-1">No Pending Invitations Found</h2>
            <span className="text-[#606060]">
              Use the button above to invite a Team Member.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// columns are imported statically from "./columns"


