"use client";

import type { ColumnDef } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Skeleton } from "@v1/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@v1/ui/table";
import { columns } from "./columns";
import { PassportTableHeader } from "./table-header";
import type { PassportTableRow } from "./types";
import { PassportControls } from "@/components/passports/passport-controls";

// Default values matching table-section.tsx
const DEFAULT_VISIBLE = ["status", "category", "season", "variantCount"];
const DEFAULT_COLUMN_ORDER = ["product", ...DEFAULT_VISIBLE, "actions"];
const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
  product: true,
  status: true,
  category: true,
  season: true,
  variantCount: true,
  actions: true,
};

export function TableSectionSkeleton({
  rows = 16,
}: {
  rows?: number;
}) {
  // Force Actions column to a fixed width in the skeleton
  const skeletonColumns: ColumnDef<PassportTableRow, unknown>[] = (
    columns as ColumnDef<PassportTableRow, unknown>[]
  ).map((col) => {
    if ((col as { id?: string }).id === "actions") {
      const fixedWidth = "w-[181.12px] min-w-[181.12px] max-w-[181.12px]";
      return {
        ...col,
        meta: {
          ...((col.meta ?? {}) as Record<string, unknown>),
          headerClassName: cn(fixedWidth),
          cellClassName: cn(fixedWidth),
        },
      } as ColumnDef<PassportTableRow, unknown>;
    }
    return col;
  });
  // Create a mock table instance for the header
  const mockTable = useReactTable({
    data: [] as PassportTableRow[],
    columns: skeletonColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      rowSelection: {},
      columnVisibility: DEFAULT_COLUMN_VISIBILITY,
      columnOrder: DEFAULT_COLUMN_ORDER,
    },
  });

  return (
    <div className="relative w-full h-full">
      <PassportControls disabled={true} />
      <div className="relative w-full overflow-hidden border border-border">
        <div className="scrollbar-hide overflow-x-auto overflow-y-auto max-w-full w-full h-[calc(100vh_-_202px)]">
          <Table className="min-w-full">
            <PassportTableHeader table={mockTable} />
            <TableBody>{/* Empty table body - no rows */}</TableBody>
          </Table>
          {/* Supabase-style skeleton bars below the header */}
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
      {/* Pagination footer placeholder (outside bordered container) */}
      <div className="flex items-center justify-end gap-4 py-3">
        <div className="type-p text-secondary">0 - 0 of 0</div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            aria-label="First page"
            disabled
            icon={<Icons.ChevronsLeft className="h-[14px] w-[14px]" />}
          />
          <Button
            variant="outline"
            size="sm"
            aria-label="Previous page"
            disabled
            icon={<Icons.ChevronLeft className="h-[14px] w-[14px]" />}
          />
          <Button
            variant="outline"
            size="sm"
            aria-label="Next page"
            disabled
            icon={<Icons.ChevronRight className="h-[14px] w-[14px]" />}
          />
          <Button
            variant="outline"
            size="sm"
            aria-label="Last page"
            disabled
            icon={<Icons.ChevronsRight className="h-[14px] w-[14px]" />}
          />
        </div>
      </div>
    </div>
  );
}

interface PassportTableSkeletonProps {
  rows?: number;
  columnOrder?: string[];
  columnVisibility?: Record<string, boolean>;
}

export function PassportTableSkeleton({
  rows = 16,
  columnOrder = DEFAULT_COLUMN_ORDER,
  columnVisibility = DEFAULT_COLUMN_VISIBILITY,
}: PassportTableSkeletonProps) {
  // Force Actions column to a fixed width in the skeleton
  const skeletonColumns: ColumnDef<PassportTableRow, unknown>[] = (
    columns as ColumnDef<PassportTableRow, unknown>[]
  ).map((col) => {
    if ((col as { id?: string }).id === "actions") {
      const fixedWidth = "w-[181.12px] min-w-[181.12px] max-w-[181.12px]";
      return {
        ...col,
        meta: {
          ...((col.meta ?? {}) as Record<string, unknown>),
          headerClassName: cn(fixedWidth),
          cellClassName: cn(fixedWidth),
        },
      } as ColumnDef<PassportTableRow, unknown>;
    }
    return col;
  });
  // Create a mock table instance for the header
  const mockTable = useReactTable({
    data: [] as PassportTableRow[],
    columns: skeletonColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      rowSelection: {},
      columnVisibility,
      columnOrder,
    },
  });

  return (
    <div className="relative w-full h-full">
      <div className="relative w-full overflow-hidden border border-border">
        <div className="scrollbar-hide overflow-x-auto overflow-y-auto max-w-full w-full h-[calc(100vh_-_202px)]">
          <Table className="min-w-full">
            <PassportTableHeader table={mockTable} />
            <TableBody>{/* Empty table body - no rows */}</TableBody>
          </Table>
          {/* Supabase-style skeleton bars below the header */}
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
      {/* Pagination footer placeholder (outside bordered container) */}
      <div className="flex items-center justify-end gap-4 py-3">
        <div className="type-p text-secondary">0 - 0 of 0</div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            aria-label="First page"
            disabled
            icon={<Icons.ChevronsLeft className="h-[14px] w-[14px]" />}
          />
          <Button
            variant="outline"
            size="sm"
            aria-label="Previous page"
            disabled
            icon={<Icons.ChevronLeft className="h-[14px] w-[14px]" />}
          />
          <Button
            variant="outline"
            size="sm"
            aria-label="Next page"
            disabled
            icon={<Icons.ChevronRight className="h-[14px] w-[14px]" />}
          />
          <Button
            variant="outline"
            size="sm"
            aria-label="Last page"
            disabled
            icon={<Icons.ChevronsRight className="h-[14px] w-[14px]" />}
          />
        </div>
      </div>
    </div>
  );
}
