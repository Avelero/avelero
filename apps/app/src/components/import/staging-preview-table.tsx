"use client";

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@v1/ui/table";
import * as React from "react";

/**
 * Staging data row type from getStagingPreview endpoint
 */
interface StagingDataRow {
  rowNumber: number;
  action: "CREATE" | "UPDATE";
  existingProductId: string | null;
  product: {
    name: string;
    description: string | null;
    categoryId: string | null;
    season: string | null;
    primaryImageUrl: string | null;
  };
  variant: {
    upid: string;
    sku: string | null;
    colorId: string | null;
    sizeId: string | null;
    productImageUrl: string | null;
  } | null;
}

interface StagingPreviewTableProps {
  jobId: string;
}

/**
 * Action badge component for CREATE/UPDATE display
 */
function ActionBadge({ action }: { action: "CREATE" | "UPDATE" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        action === "CREATE"
          ? "bg-green-50 text-green-700 ring-green-600/20"
          : "bg-blue-50 text-blue-700 ring-blue-600/20"
      )}
    >
      {action}
    </span>
  );
}

/**
 * Table columns definition
 */
const columns: ColumnDef<StagingDataRow>[] = [
  {
    id: "row",
    header: "Row #",
    accessorKey: "rowNumber",
    size: 80,
    cell: ({ row }) => (
      <div className="text-secondary">{row.original.rowNumber}</div>
    ),
  },
  {
    id: "action",
    header: "Action",
    accessorKey: "action",
    size: 100,
    cell: ({ row }) => <ActionBadge action={row.original.action} />,
  },
  {
    id: "productName",
    header: "Product Name",
    size: 250,
    cell: ({ row }) => (
      <div className="font-medium">{row.original.product.name}</div>
    ),
  },
  {
    id: "upid",
    header: "UPID",
    size: 150,
    cell: ({ row }) => (
      <div className="text-secondary font-mono text-xs">
        {row.original.variant?.upid ?? "—"}
      </div>
    ),
  },
  {
    id: "sku",
    header: "SKU",
    size: 150,
    cell: ({ row }) => (
      <div className="text-secondary font-mono text-xs">
        {row.original.variant?.sku ?? "—"}
      </div>
    ),
  },
  {
    id: "description",
    header: "Description",
    size: 300,
    cell: ({ row }) => (
      <div className="text-secondary truncate max-w-xs">
        {row.original.product.description ?? "—"}
      </div>
    ),
  },
];

/**
 * StagingPreviewTable Component
 *
 * Displays paginated preview of staging data with CREATE/UPDATE badges.
 * Integrates with bulk.staging.preview tRPC endpoint.
 *
 * @param jobId - Import job ID to fetch staging data for
 */
export function StagingPreviewTable({ jobId }: StagingPreviewTableProps) {
  const [page, setPage] = React.useState(0);
  const pageSize = 100; // As per requirements: 100 rows per page
  const trpc = useTRPC();

  // Fetch staging preview data
  const { data: response, isLoading, error } = useQuery(
    trpc.bulk.staging.preview.queryOptions({
      jobId,
      limit: pageSize,
      offset: page * pageSize,
    })
  );

  const data = React.useMemo<StagingDataRow[]>(
    () => (response?.stagingData ?? []).map(row => ({
      ...row,
      action: row.action as "CREATE" | "UPDATE"
    })),
    [response]
  );

  const totalValid = response?.totalValid ?? 0;
  const willCreate = response?.willCreate ?? 0;
  const willUpdate = response?.willUpdate ?? 0;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalValid / pageSize),
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icons.Spinner className="h-6 w-6 animate-spin text-brand" />
        <span className="ml-2 text-secondary">Loading preview...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-center gap-2">
          <Icons.AlertCircle className="h-5 w-5 text-destructive" />
          <p className="text-sm text-destructive">
            Failed to load staging preview. Please try again.
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data.length && !isLoading) {
    return (
      <div className="rounded-lg border border-border bg-background p-12 text-center">
        <Icons.Package className="mx-auto h-12 w-12 text-secondary opacity-50" />
        <h3 className="mt-4 text-lg font-medium">No staging data found</h3>
        <p className="mt-2 text-sm text-secondary">
          There are no products to preview for this import job.
        </p>
      </div>
    );
  }

  // Calculate pagination info
  const start = totalValid === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(page * pageSize + data.length, totalValid);
  const lastPage = Math.max(0, Math.ceil(totalValid / pageSize) - 1);
  const canGoPrev = page > 0;
  const canGoNext = page < lastPage;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-accent/50 p-4">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-green-100 p-2">
            <Icons.Plus className="h-4 w-4 text-green-700" />
          </div>
          <div>
            <div className="text-sm font-medium">{willCreate} to create</div>
            <div className="text-xs text-secondary">New products</div>
          </div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-blue-100 p-2">
            <Icons.RefreshCw className="h-4 w-4 text-blue-700" />
          </div>
          <div>
            <div className="text-sm font-medium">{willUpdate} to update</div>
            <div className="text-xs text-secondary">Existing products</div>
          </div>
        </div>
        <div className="h-8 w-px bg-border" />
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-accent p-2">
            <Icons.CheckCircle2 className="h-4 w-4 text-brand" />
          </div>
          <div>
            <div className="text-sm font-medium">{totalValid} total</div>
            <div className="text-xs text-secondary">Valid products</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="relative w-full overflow-hidden rounded-lg border border-border">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {table.getHeaderGroups().map((headerGroup) =>
                  headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.column.getSize() }}
                      className="h-12 border-r px-4"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="h-14 border-b border-border hover:bg-accent-light"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="border-r px-4 align-middle"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-end gap-4 py-3">
        <div className="type-p text-secondary">
          {start} - {end} of {totalValid}
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
    </div>
  );
}
