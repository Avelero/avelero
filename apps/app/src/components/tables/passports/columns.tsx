"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import Link from "next/link";
import type { PassportTableRow } from "./types";

const MAX_COLUMN_WIDTH = 320;
const CELL_PADDING_X = "px-4";
const CELL_HEIGHT = "h-14";

export const columns: ColumnDef<PassportTableRow>[] = [
  {
    id: "product",
    header: "Product",
    enableSorting: false,
    enableHiding: false,
    size: MAX_COLUMN_WIDTH,
    minSize: 200,
    meta: {
      sticky: "left",
      headerClassName: cn(
        CELL_PADDING_X,
        CELL_HEIGHT,
        "min-w-[320px] max-w-[680px]",
      ),
      cellClassName: cn(
        CELL_PADDING_X,
        CELL_HEIGHT,
        // Sticky first column with its own always-on divider (no native border to avoid double lines)
        "relative min-w-[260px] max-w-[680px] sticky left-0 z-[12] bg-background border-r-0",
        "before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-border",
        // Sync background with row hover/selected
        "[tr:hover_&]:bg-accent-light [tr[data-state=selected]_&]:bg-accent-blue",
      ),
    },
    cell: ({ row, table }) => {
      const product = row.original;
      const meta = table.options.meta as
        | {
            handleRangeSelection?: (
              index: number,
              shift: boolean,
              id: string,
            ) => void;
          }
        | undefined;

      return (
        <div className="flex h-full items-center gap-4">
          <label
            className="relative inline-flex h-4 w-4 items-center justify-center cursor-pointer before:absolute before:right-[-12px] before:left-[-16px] before:top-[-21px] before:bottom-[-21px] before:content-['']"
            onClick={(event) => event.stopPropagation()}
            onMouseDown={(event) => {
              // Prevent text selection on shift-click
              if (event.shiftKey) {
                event.preventDefault();
              }
            }}
          >
            <input
              type="checkbox"
              aria-label={`Select ${product.name}`}
              className="block h-4 w-4 shrink-0 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand cursor-pointer outline-none focus:outline-none"
              checked={row.getIsSelected()}
              onChange={(event) => {
                const checked = event.target.checked;
                const shiftKey = (event.nativeEvent as MouseEvent).shiftKey;

                // Prevent focus ring on checkbox
                (event.target as HTMLInputElement).blur();

                // For range selection (shift-click), let handleRangeSelection handle everything
                // For regular clicks, toggle immediately for instant feedback
                if (!shiftKey) {
                  row.toggleSelected(checked);
                }

                // Handle range selection or update last clicked index
                meta?.handleRangeSelection?.(row.index, shiftKey, product.id);
              }}
            />
            {row.getIsSelected() && (
              <div className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center pointer-events-none">
                <div className="w-[10px] h-[10px] bg-brand" />
              </div>
            )}
          </label>
          <div className="min-w-0 max-w-[680px] space-y-1">
            <Link
              href={`/passports/edit/${product.productUpid}`}
              prefetch
              className="block max-w-full truncate type-p text-primary hover:text-brand cursor-pointer"
              onClick={(event) => event.stopPropagation()}
            >
              {product.name}
            </Link>
            {product.productIdentifier ? (
              <span className="block max-w-full truncate type-small text-secondary">
                {product.productIdentifier}
              </span>
            ) : null}
          </div>
        </div>
      );
    },
  },
  // 3) Status with icon
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const { status } = row.original;

      const Icon =
        status === "published"
          ? Icons.StatusPublished
          : status === "scheduled"
            ? Icons.StatusScheduled
            : status === "unpublished"
              ? Icons.StatusUnpublished
              : Icons.StatusArchived;

      return (
        <div className="flex items-center gap-3">
          <Icon className="h-[14px] w-[14px]" />
          <span className="truncate type-p text-primary capitalize">
            {status}
          </span>
        </div>
      );
    },
    meta: {
      headerClassName: cn("w-[240px] min-w-[240px] max-w-[240px]"),
      cellClassName: cn("w-[240px] min-w-[240px] max-w-[240px]"),
    },
  },
  // Category with hover path
  {
    id: "category",
    header: "Category",
    cell: ({ row }) => {
      const path = row.original.categoryPath ?? [];
      const leafCategory =
        path.length > 0 ? path[path.length - 1] : row.original.category;
      return (
        <TooltipProvider delayDuration={120}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block max-w-[200px] truncate align-middle">
                {leafCategory}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex items-center gap-1">
                {path.map((segment, i) => (
                  <span
                    key={`cat-${row.id}-${i}`}
                    className="flex items-center gap-1"
                  >
                    {i > 0 ? (
                      <Icons.ChevronRight className="h-[14px] w-[14px]" />
                    ) : null}
                    <span className="type-small">{segment}</span>
                  </span>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
    meta: {
      headerClassName: cn("w-[240px] min-w-[240px] max-w-[240px]"),
      cellClassName: cn("w-[240px] min-w-[240px] max-w-[240px]"),
    },
  },
  // Season chip
  {
    accessorKey: "season",
    header: "Season",
    cell: ({ row }) => (
      <span className="inline-flex h-6 items-center rounded-full border bg-background px-2 type-small text-primary">
        {row.original.season ?? "-"}
      </span>
    ),
    meta: {
      headerClassName: cn("w-[240px] min-w-[240px] max-w-[240px]"),
      cellClassName: cn("w-[240px] min-w-[240px] max-w-[240px]"),
    },
  },
  // Variants count
  {
    id: "variantCount",
    header: "Variants",
    cell: ({ row }) => (
      <span className="inline-block text-primary">
        {row.original.variantCount ?? 0}
      </span>
    ),
    meta: {
      headerClassName: cn("w-[120px] min-w-[120px] max-w-[140px]"),
      cellClassName: cn("w-[120px] min-w-[120px] max-w-[140px]"),
    },
  },
  {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    meta: {
      headerClassName: cn("w-[1%]"),
      cellClassName: cn("w-[1%] whitespace-nowrap"),
    },
    cell: ({ row }) => {
      const product = row.original;
      const upid = product.productUpid || product.id;
      const editHref = upid ? `/passports/edit/${upid}` : undefined;

      return (
        <div className="flex items-center justify-end gap-3">
          <Button
            variant="outline"
            size="sm"
            aria-label="Open passport"
            disabled={!editHref}
            onClick={(e) => {
              e.stopPropagation();
              if (!editHref) return;
              window.open(editHref, "_blank");
            }}
            icon={<Icons.ChevronRight className="h-[14px] w-[14px]" />}
            iconPosition="right"
          >
            Passport
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Open actions menu"
                disabled={!editHref}
                onClick={(e) => e.stopPropagation()}
                icon={<Icons.EllipsisVertical className="h-[14px] w-[14px]" />}
                iconPosition="right"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[220px]"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem asChild onSelect={(e) => e.preventDefault()}>
                <Link href={editHref ?? ""}>Open Edit Passport</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onSelect={(e) => e.preventDefault()}
              >
                Delete Product
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
