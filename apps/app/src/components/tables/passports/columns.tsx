"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import type { Passport } from "./types";

export const columns: ColumnDef<Passport>[] = [
  // 1) Select checkbox (header-level select handled in header component)
  {
    id: "select",
    header: () => null,
    cell: ({ row }) => (
      <input
        type="checkbox"
        aria-label="Select row"
        className="h-4 w-4 appearance-none border border-border bg-background checked:bg-brand checked:border-brand"
        checked={row.getIsSelected()}
        onChange={(e) => row.toggleSelected(e.target.checked)}
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    meta: {
      className: "sticky left-0 z-10 bg-background",
    },
  },
  // 2) Product title + SKU
  {
    accessorKey: "title",
    header: "Product title",
    cell: ({ row }) => (
      <div className="min-w-[240px]">
        <div className="font-medium truncate" title={row.original.title}>
          {row.original.title}
        </div>
        {row.original.sku ? (
          <div className="text-xs text-muted-foreground truncate">
            {row.original.sku}
          </div>
        ) : null}
      </div>
    ),
    meta: { className: "min-w-[240px]" },
  },
  // 3) Status with icon
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const { status } = row.original;
      const Dot = Icons.EllipsisVertical; // placeholder icon mapping
      return (
        <div className="flex items-center gap-2">
          <Dot className="h-3 w-3" />
          <span className="capitalize">{status}</span>
        </div>
      );
    },
    meta: { className: "min-w-[140px]" },
  },
  // 4) Completion: X / 6 + progress bar popover
  {
    id: "completion",
    header: "Completion",
    cell: ({ row }) => {
      const { completedSections, totalSections } = row.original;
      const pct = Math.max(
        0,
        Math.min(100, Math.round((completedSections / totalSections) * 100)),
      );
      return (
        <div className="min-w-[220px]">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="text-sm text-foreground"
                type="button"
                aria-label="Show completion details"
                onClick={(e) => e.stopPropagation()}
              >
                {completedSections} / {totalSections}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[280px] p-3">
              <div className="space-y-2">
                {Array.from({ length: totalSections }).map((_, i) => (
                  <div
                    key={`section-${row.id}-${i}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    {i < completedSections ? (
                      <Icons.Check className="h-4 w-4 text-brand" />
                    ) : (
                      <span className="h-4 w-4 border border-border" />
                    )}
                    <span>Section {i + 1}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <div className="mt-2 h-1.5 w-full bg-border">
            <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
          </div>
        </div>
      );
    },
    meta: { className: "min-w-[220px]" },
  },
  // 5) Category with hover path
  {
    id: "category",
    header: "Category",
    cell: ({ row }) => (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="truncate inline-block max-w-[180px] align-middle">
              {row.original.category}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {row.original.categoryPath.join(" › ")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ),
    meta: { className: "min-w-[180px]" },
  },
  // 6) Season chip
  {
    accessorKey: "season",
    header: "Season",
    cell: ({ row }) => (
      <span className="inline-flex items-center border px-2 py-1 text-xs">
        {row.original.season ?? "-"}
      </span>
    ),
    meta: { className: "min-w-[140px]" },
  },
  // 7) Template chip with color dot
  {
    id: "template",
    header: "Template",
    cell: ({ row }) => {
      const tpl = row.original.template;
      if (!tpl) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="inline-flex max-w-[200px] items-center gap-2 truncate border px-2 py-1 text-xs">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: tpl.color }}
          />
          <span className="truncate">{tpl.name}</span>
        </span>
      );
    },
    meta: { className: "min-w-[220px]" },
  },
  // 8) Actions
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <div className="flex items-center justify-between">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                aria-label="Open passport"
                onClick={(e) => {
                  e.stopPropagation();
                  if (row.original.passportUrl)
                    window.open(row.original.passportUrl, "_blank");
                }}
              >
                Passport →
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open passport in a new tab</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open actions menu"
              onClick={(e) => e.stopPropagation()}
            >
              <Icons.EllipsisVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Change status
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    meta: {
      className: "sticky right-0 bg-background z-20 min-w-[220px]",
    },
    enableSorting: false,
  },
];
