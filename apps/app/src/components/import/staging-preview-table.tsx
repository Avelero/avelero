"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
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
    seasonId: string | null;
    primaryImageUrl: string | null;
  };
  variant: {
    upid: string;
    colorId: string | null;
    sizeId: string | null;
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
          : "bg-blue-50 text-blue-700 ring-blue-600/20",
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
  const queryClient = useQueryClient();

  // Fetch staging preview data
  const {
    data: response,
    isLoading,
    error,
    isError,
    failureReason,
  } = useQuery(
    trpc.bulk.staging.preview.queryOptions({
      jobId,
      limit: pageSize,
      offset: page * pageSize,
    }),
  );

  /**
   * Smart prefetching for smooth pagination
   * - Always prefetch adjacent pages (prev/next)
   * - Prefetch last page when user is near the beginning
   * - Prefetch first page when user is near the end
   */
  React.useEffect(() => {
    if (!response?.totalValid) return;

    const totalPages = Math.ceil(response.totalValid / pageSize);
    const lastPage = totalPages - 1;

    // Prefetch next page
    if (page < lastPage) {
      void queryClient.prefetchQuery(
        trpc.bulk.staging.preview.queryOptions({
          jobId,
          limit: pageSize,
          offset: (page + 1) * pageSize,
        }),
      );
    }

    // Prefetch previous page
    if (page > 0) {
      void queryClient.prefetchQuery(
        trpc.bulk.staging.preview.queryOptions({
          jobId,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
      );
    }

    // Prefetch last page when near the beginning (within first 3 pages)
    if (page <= 2 && lastPage > page + 1) {
      void queryClient.prefetchQuery(
        trpc.bulk.staging.preview.queryOptions({
          jobId,
          limit: pageSize,
          offset: lastPage * pageSize,
        }),
      );
    }

    // Prefetch first page when near the end (within last 3 pages)
    if (page >= lastPage - 2 && page > 2) {
      void queryClient.prefetchQuery(
        trpc.bulk.staging.preview.queryOptions({
          jobId,
          limit: pageSize,
          offset: 0,
        }),
      );
    }
  }, [page, response?.totalValid, jobId, pageSize, queryClient, trpc]);

  // Debug logging for preview loading
  React.useEffect(() => {
    console.log("[StagingPreview] Query state:", {
      jobId,
      page,
      offset: page * pageSize,
      limit: pageSize,
      isLoading,
      isError,
      hasError: !!error,
      errorMessage: error?.message,
      errorData: error,
      failureReason,
      hasData: !!response,
      dataRowCount: response?.stagingData?.length,
      totalValid: response?.totalValid,
    });

    if (isError && error) {
      console.error("[StagingPreview] Query error details:", {
        error,
        message: error.message,
        data: error.data,
      });
    }
  }, [
    jobId,
    page,
    pageSize,
    isLoading,
    isError,
    error,
    response,
    failureReason,
  ]);

  const data = React.useMemo<StagingDataRow[]>(
    () =>
      (response?.stagingData ?? []).map((row) => ({
        ...row,
        action: row.action as "CREATE" | "UPDATE",
      })),
    [response],
  );

  const totalValid = response?.totalValid ?? 0;

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
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
        <Icons.Spinner className="h-5 w-5 animate-spin text-brand" />
        <div>
          <div className="text-sm font-medium">Loading preview...</div>
          <div className="text-xs text-secondary">Please wait</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <div className="rounded-md bg-destructive/20 p-2">
            <Icons.AlertCircle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-destructive">
              Failed to load preview
            </div>
            <div className="text-xs text-destructive/80 mt-1">
              {error.message || "Unknown error occurred"}
            </div>
          </div>
        </div>
        <div className="text-xs text-secondary bg-accent/50 p-3 rounded-lg font-mono">
          <div className="font-semibold mb-1">Debug Info:</div>
          <div>Job ID: {jobId}</div>
          <div>Page: {page}</div>
          <div>Offset: {page * pageSize}</div>
        </div>
      </div>
    );
  }

  // Empty state
  if (!data.length && !isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
        <div className="rounded-md bg-accent p-2">
          <Icons.Package className="h-5 w-5 text-secondary" />
        </div>
        <div>
          <div className="text-sm font-medium">No staging data found</div>
          <div className="text-xs text-secondary">
            There are no products to preview for this import job
          </div>
        </div>
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
      {/* Table */}
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-background">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-accent/30">
                {table.getHeaderGroups().map((headerGroup) =>
                  headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.column.getSize() }}
                      className="h-12 border-r px-4 last:border-r-0"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                    </TableHead>
                  )),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="h-14 border-b border-border hover:bg-accent/20 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="border-r px-4 align-middle last:border-r-0"
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
          >
            <Icons.ChevronsLeft className="h-[14px] w-[14px]" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Previous page"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={!canGoPrev}
          >
            <Icons.ChevronLeft className="h-[14px] w-[14px]" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Next page"
            onClick={() => setPage((p) => p + 1)}
            disabled={!canGoNext}
          >
            <Icons.ChevronRight className="h-[14px] w-[14px]" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="Last page"
            onClick={() => setPage(lastPage)}
            disabled={!canGoNext}
          >
            <Icons.ChevronsRight className="h-[14px] w-[14px]" />
          </Button>
        </div>
      </div>
    </div>
  );
}
