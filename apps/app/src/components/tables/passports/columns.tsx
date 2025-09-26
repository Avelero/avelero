"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
import { useRouter } from "next/navigation";
import type { Passport } from "./types";

const MAX_COLUMN_WIDTH = 320;
const CELL_PADDING_X = "px-4";
const CELL_HEIGHT = "h-14";

export const columns: ColumnDef<Passport>[] = [
  {
    id: "product",
    header: "Product",
    enableSorting: false,
    enableHiding: false,
    size: MAX_COLUMN_WIDTH,
    minSize: 200,
    meta: {
      sticky: "left",
      headerClassName: cn(CELL_PADDING_X, CELL_HEIGHT, "min-w-[260px]"),
      cellClassName: cn(
        CELL_PADDING_X,
        CELL_HEIGHT,
        // Sticky first column with its own always-on divider (no native border to avoid double lines)
        "relative min-w-[260px] sticky left-0 z-[12] bg-background border-r-0",
        "before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-border",
        // Sync background with row hover/selected
        "[tr:hover_&]:bg-accent-blue [tr[data-state=selected]_&]:bg-accent-blue",
      ),
    },
    cell: ({ row }) => {
      const router = useRouter();
      const product = row.original;

      return (
        <div className="flex h-full items-center gap-4">
          <div className="relative inline-flex h-4 w-4 items-center justify-center">
            <input
              type="checkbox"
              aria-label={`Select ${product.title}`}
              className="block h-4 w-4 shrink-0 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand"
              checked={row.getIsSelected()}
              onChange={(event) => row.toggleSelected(event.target.checked)}
              onClick={(event) => event.stopPropagation()}
            />
            {row.getIsSelected() && (
              <div className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center pointer-events-none">
                <div className="w-[10px] h-[10px] bg-brand" />
              </div>
            )}
          </div>
          <div className="min-w-0 space-y-1">
            <button
              type="button"
              className="block max-w-full truncate text-p text-primary"
              onClick={(event) => {
                event.stopPropagation();
                router.push(`/passports/${product.id}`);
              }}
            >
              {product.title}
            </button>
            {product.sku ? (
              <span className="block max-w-full truncate text-small text-secondary">
                {product.sku}
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
          <Icon className="h-4 w-4" />
          <span className="truncate text-p text-primary capitalize">
            {status}
          </span>
        </div>
      );
    },
    meta: { className: "min-w-[140px] max-w-[320px]" },
  },
  // 4) Completion: X / 6 + progress bar popover
  {
    id: "completion",
    header: "Completion",
    cell: ({ row }) => {
      const { completedSections, totalSections } = row.original;
      const clamped = Math.max(0, Math.min(totalSections, completedSections));
      const stepped = Math.round((clamped / totalSections) * 6);
      const pct = (stepped / 6) * 100;
      return (
        <div className="min-w-[220px] max-w-[320px] flex items-center gap-3">
          <TooltipProvider delayDuration={120}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="text-p flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-primary w-3 text-center">
                    {completedSections}
                  </div>
                  <div className="text-tertiary w-2 text-center">/</div>
                  <div className="text-tertiary w-3 text-center">
                    {totalSections}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent
                align="start"
                className="w-[240px] p-2 cursor-default"
              >
                <div className="space-y-1.5">
                  {Array.from({ length: totalSections }).map((_, i) => (
                    <div
                      key={`section-${row.id}-${i}`}
                      className="flex items-center gap-2 text-small "
                    >
                      {i < completedSections ? (
                        <Icons.Check className="h-[14px] w-[14px] text-brand" />
                      ) : (
                        <span className="h-[14px] w-[14px] shrink-0" />
                      )}
                      <span>Section {i + 1}</span>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="h-[6px] w-full rounded-[6px] bg-border">
            <div
              className="h-full rounded-[6px] bg-brand"
              style={{ width: `${pct}%` }}
            />
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
    cell: ({ row }) => {
      const path = row.original.categoryPath ?? [];
      const leafCategory =
        path.length > 0 ? path[path.length - 1] : row.original.category;
      return (
        <TooltipProvider delayDuration={120}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block max-w-[180px] truncate align-middle">
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
                    <span className="text-small">{segment}</span>
                  </span>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
    meta: { className: "min-w-[180px] hidden xl:table-cell" },
  },
  // 6) Season chip
  {
    accessorKey: "season",
    header: "Season",
    cell: ({ row }) => (
      <span className="inline-flex h-6 items-center rounded-full border bg-background px-2 text-small text-primary">
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
        <span className="inline-flex h-6 max-w-[220px] items-center gap-[6px] truncate rounded-full border bg-background px-2 text-small text-primary">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: tpl.color }}
          />
          <span className="truncate">{tpl.name}</span>
        </span>
      );
    },
    meta: { className: "min-w-[220px] hidden lg:table-cell" },
  },
  // 8) Actions
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <div className="flex items-center justify-end gap-4">
        <Button
          variant="default-secondary"
          size="sm"
          className="hidden md:inline-flex"
          aria-label="Open passport"
          onClick={(e) => {
            e.stopPropagation();
            if (row.original.passportUrl)
              window.open(row.original.passportUrl, "_blank");
          }}
          icon={<Icons.ChevronRight className="h-[14px] w-[14px]" />}
          iconPosition="right"
        >
          Passport
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default-secondary"
              size="iconSm"
              aria-label="Open actions menu"
              onClick={(e) => e.stopPropagation()}
              icon={<Icons.EllipsisVertical className="h-[14px] w-[14px]" />}
              iconOnly
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
            <DropdownMenuItem
              className="h-9 py-3"
              onSelect={(e) => e.preventDefault()}
            >
              Open Edit Passport
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-9 py-3">
                Change status
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-[220px]">
                <DropdownMenuItem className="h-9 py-3">
                  Published
                </DropdownMenuItem>
                <DropdownMenuItem className="h-9 py-3">
                  Scheduled
                </DropdownMenuItem>
                <DropdownMenuItem className="h-9 py-3">
                  Unpublished
                </DropdownMenuItem>
                <DropdownMenuItem className="h-9 py-3">
                  Archived
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="h-9 py-3 text-destructive"
              onSelect={(e) => e.preventDefault()}
            >
              Delete Product
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
    meta: {
      className: "w-fit",
    },
    enableSorting: false,
  },
];
