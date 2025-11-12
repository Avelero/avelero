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
import { toast } from "sonner";

/**
 * Import error data type from getImportErrors endpoint
 */
interface ImportError {
  rowNumber: number;
  rawData: Record<string, unknown>;
  error: string;
  field: string | null;
}

interface ErrorListSectionProps {
  jobId: string;
}

/**
 * Truncate long text with ellipsis
 */
function TruncatedText({
  text,
  maxLength = 50,
}: { text: string; maxLength?: number }) {
  const truncated =
    text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;

  return (
    <div className="group relative">
      <div className="truncate max-w-xs">{truncated}</div>
      {text.length > maxLength && (
        <div className="pointer-events-none absolute bottom-full left-0 mb-2 hidden w-max max-w-md rounded-md bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg group-hover:block z-50">
          {text}
        </div>
      )}
    </div>
  );
}

/**
 * Extract meaningful column name from raw data keys
 */
function formatColumnName(
  rawData: Record<string, unknown>,
  field: string | null,
): string {
  if (field) return field;

  // Try to extract column from error context
  const keys = Object.keys(rawData);
  if (keys.length > 0 && keys[0]) {
    return keys[0]; // Fallback to first column
  }

  return "—";
}

/**
 * Extract value from raw data for display
 */
function extractValue(rawData: Record<string, unknown>): string {
  const values = Object.values(rawData);
  const firstValue = values[0];

  if (firstValue === null || firstValue === undefined) return "—";
  if (typeof firstValue === "string") return firstValue;
  if (typeof firstValue === "number") return String(firstValue);
  if (typeof firstValue === "boolean") return String(firstValue);

  return JSON.stringify(firstValue);
}

/**
 * Table columns definition
 */
const columns: ColumnDef<ImportError>[] = [
  {
    id: "row",
    header: "Row #",
    accessorKey: "rowNumber",
    size: 80,
    cell: ({ row }) => (
      <div className="text-secondary font-medium">{row.original.rowNumber}</div>
    ),
  },
  {
    id: "column",
    header: "Column",
    size: 150,
    cell: ({ row }) => (
      <div className="font-mono text-xs text-secondary">
        {formatColumnName(row.original.rawData, row.original.field)}
      </div>
    ),
  },
  {
    id: "value",
    header: "Value",
    size: 200,
    cell: ({ row }) => (
      <TruncatedText text={extractValue(row.original.rawData)} maxLength={40} />
    ),
  },
  {
    id: "error",
    header: "Error",
    size: 350,
    cell: ({ row }) => (
      <div className="flex items-start gap-2">
        <Icons.AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
        <TruncatedText text={row.original.error} maxLength={80} />
      </div>
    ),
  },
];

/**
 * ErrorListSection Component
 *
 * Displays validation errors in tabular format with export functionality.
 * Integrates with bulk.staging.errors and bulk.staging.export tRPC endpoints.
 *
 * @param jobId - Import job ID to fetch errors for
 */
export function ErrorListSection({ jobId }: ErrorListSectionProps) {
  const [page, setPage] = React.useState(0);
  const [isExporting, setIsExporting] = React.useState(false);
  const pageSize = 50; // Display 50 errors per page
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Fetch import errors
  const {
    data: response,
    isLoading,
    error,
  } = useQuery(
    trpc.bulk.staging.errors.queryOptions({
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
    if (!response?.totalErrors) return;

    const totalPages = Math.ceil(response.totalErrors / pageSize);
    const lastPage = totalPages - 1;

    // Prefetch next page
    if (page < lastPage) {
      void queryClient.prefetchQuery(
        trpc.bulk.staging.errors.queryOptions({
          jobId,
          limit: pageSize,
          offset: (page + 1) * pageSize,
        }),
      );
    }

    // Prefetch previous page
    if (page > 0) {
      void queryClient.prefetchQuery(
        trpc.bulk.staging.errors.queryOptions({
          jobId,
          limit: pageSize,
          offset: (page - 1) * pageSize,
        }),
      );
    }

    // Prefetch last page when near the beginning (within first 3 pages)
    if (page <= 2 && lastPage > page + 1) {
      void queryClient.prefetchQuery(
        trpc.bulk.staging.errors.queryOptions({
          jobId,
          limit: pageSize,
          offset: lastPage * pageSize,
        }),
      );
    }

    // Prefetch first page when near the end (within last 3 pages)
    if (page >= lastPage - 2 && page > 2) {
      void queryClient.prefetchQuery(
        trpc.bulk.staging.errors.queryOptions({
          jobId,
          limit: pageSize,
          offset: 0,
        }),
      );
    }
  }, [page, response?.totalErrors, jobId, pageSize, queryClient, trpc]);

  const data = React.useMemo<ImportError[]>(
    () => response?.errors ?? [],
    [response],
  );

  const totalErrors = response?.totalErrors ?? 0;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(totalErrors / pageSize),
  });

  // Handle CSV export
  const handleExport = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);
      const toastId = toast.loading("Exporting failed rows...");

      // Use queryClient to fetch data directly
      const result = await queryClient.fetchQuery(
        trpc.bulk.staging.export.queryOptions({ jobId }),
      );

      if (result.totalRows === 0) {
        toast.info("No failed rows to export", { id: toastId });
        return;
      }

      // Create blob and download
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${result.totalRows} failed rows`, {
        id: toastId,
      });
    } catch (err) {
      toast.error("Failed to export failed rows. Please try again.");
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
        <Icons.Spinner className="h-5 w-5 animate-spin text-brand" />
        <div>
          <div className="text-sm font-medium">Loading errors...</div>
          <div className="text-xs text-secondary">Please wait</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
        <div className="rounded-md bg-destructive/20 p-2">
          <Icons.AlertCircle className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <div className="text-sm font-medium text-destructive">
            Failed to load errors
          </div>
          <div className="text-xs text-secondary">
            Please try again or contact support
          </div>
        </div>
      </div>
    );
  }

  // Empty state - no errors (success case)
  if (totalErrors === 0 && !isLoading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-4">
        <div className="rounded-md bg-green-100 p-2">
          <Icons.CheckCircle2 className="h-5 w-5 text-green-700" />
        </div>
        <div>
          <div className="text-sm font-medium">No errors found</div>
          <div className="text-xs text-secondary">
            All rows passed validation successfully
          </div>
        </div>
      </div>
    );
  }

  // Calculate pagination info
  const start = totalErrors === 0 ? 0 : page * pageSize + 1;
  const end = Math.min(page * pageSize + data.length, totalErrors);
  const lastPage = Math.max(0, Math.ceil(totalErrors / pageSize) - 1);
  const canGoPrev = page > 0;
  const canGoNext = page < lastPage;

  return (
    <div className="space-y-4">
      {/* Header with error count and export button */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-destructive/20 p-2">
            <Icons.AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <div className="text-sm font-medium">
              {totalErrors} {totalErrors === 1 ? "error" : "errors"} found
            </div>
            <div className="text-xs text-secondary">
              These rows need to be fixed before they can be imported
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
          icon={
            isExporting ? (
              <Icons.Spinner className="h-4 w-4 animate-spin" />
            ) : (
              <Icons.Download className="h-4 w-4" />
            )
          }
        >
          {isExporting ? "Exporting..." : "Export Failed Rows"}
        </Button>
      </div>

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
      {totalErrors > pageSize && (
        <div className="flex items-center justify-end gap-4 py-3">
          <div className="type-p text-secondary">
            {start} - {end} of {totalErrors}
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
      )}
    </div>
  );
}
