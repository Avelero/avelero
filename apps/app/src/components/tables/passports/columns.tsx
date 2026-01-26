"use client";

import { buildPublicUrl } from "@/utils/storage-urls";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { PassportTableRow } from "./types";

const MAX_COLUMN_WIDTH = 320;
const CELL_PADDING_X = "px-4";
const CELL_HEIGHT = "h-14";

/**
 * Link component with hover-triggered prefetching.
 * Prefetches the route only when the user hovers over the link.
 * Disables prefetch for edit links to avoid auth errors during hover prefetch.
 */
function EditPassportLink({
  href,
  children,
  className,
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const [active, setActive] = useState(false);

  return (
    <Link
      href={href}
      prefetch={active}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      className={className}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

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
        "before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-accent-dark",
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

          {/* Image */}
          <div className="w-10 h-10 bg-accent-light overflow-hidden flex items-center justify-center flex-shrink-0">
            {product.imagePath ? (
              <Image
                src={buildPublicUrl("products", product.imagePath) ?? ""}
                alt={product.name}
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full bg-accent">
                <Icons.Image className="h-[14px] w-[14px] text-muted" />
              </div>
            )}
          </div>

          <div className="min-w-0 max-w-[680px] space-y-1">
            <EditPassportLink
              href={`/passports/edit/${product.productHandle}`}
              className="block max-w-full truncate type-p text-primary hover:text-brand cursor-pointer"
              onClick={(event) => event.stopPropagation()}
            >
              {product.name}
            </EditPassportLink>
            <span className="block max-w-full truncate type-small text-secondary">
              {product.productHandle}
            </span>
          </div>
        </div>
      );
    },
  },
  // Status with icon - Published/Unpublished/Scheduled
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
            : Icons.StatusUnpublished;

      return (
        <div className="flex items-center gap-3">
          <Icon className="h-[16px] w-[16px]" />
          <span className="truncate type-p text-primary capitalize">
            {status}
          </span>
        </div>
      );
    },
    meta: {
      headerClassName: cn("w-[180px] min-w-[180px] max-w-[180px]"),
      cellClassName: cn("w-[180px] min-w-[180px] max-w-[180px]"),
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
      headerClassName: cn("w-[220px] min-w-[220px] max-w-[220px]"),
      cellClassName: cn("w-[220px] min-w-[220px] max-w-[220px]"),
    },
  },
  // Season chip
  {
    accessorKey: "season",
    header: "Season",
    cell: ({ row }) => {
      const season = row.original.season;
      if (!season) {
        return null;
      }
      return (
        <span className="inline-flex h-6 items-center rounded-full border bg-background px-2 type-small text-primary">
          {season}
        </span>
      );
    },
    meta: {
      headerClassName: cn("w-[220px] min-w-[220px] max-w-[220px]"),
      cellClassName: cn("w-[220px] min-w-[220px] max-w-[220px]"),
    },
  },
  // Variant count
  {
    id: "variantCount",
    header: "Variants",
    cell: ({ row }) => {
      const count = row.original.variantCount;
      return <span className="type-p text-primary">{count}</span>;
    },
    meta: {
      headerClassName: cn("w-[120px] min-w-[120px] max-w-[120px]"),
      cellClassName: cn("w-[120px] min-w-[120px] max-w-[120px]"),
    },
  },
  // Tags
  {
    id: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const tags = row.original.tags;
      if (!tags || tags.length === 0) {
        return null;
      }
      return (
        <TooltipProvider delayDuration={120}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative max-w-[200px]">
                {/* Tags container with hidden overflow */}
                <div className="flex items-center gap-1 overflow-hidden">
                  {tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex h-6 items-center gap-1.5 rounded-full border bg-background px-2 type-small text-primary flex-shrink-0"
                    >
                      {tag.hex && (
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0 border-[0.5px] border-border"
                          style={{ backgroundColor: `#${tag.hex}` }}
                        />
                      )}
                      {tag.name}
                    </span>
                  ))}
                </div>
                {/* Right-edge fade-out gradient overlay */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-background pointer-events-none [tr:hover_&]:to-accent-light [tr[data-state=selected]_&]:to-accent-blue" />
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              align="start"
              className="p-2 min-w-[120px]"
            >
              <div className="flex flex-col gap-1.5">
                {tags.map((tag) => (
                  <div key={tag.id} className="flex items-center gap-2">
                    {tag.hex && (
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 border-[0.5px] border-border"
                        style={{ backgroundColor: `#${tag.hex}` }}
                      />
                    )}
                    <span className="type-small text-primary">{tag.name}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
    meta: {
      headerClassName: cn("w-[220px] min-w-[220px] max-w-[220px]"),
      cellClassName: cn("w-[220px] min-w-[220px] max-w-[220px]"),
    },
  },
  // Barcode coverage
  {
    id: "barcodeCoverage",
    header: "Barcodes",
    cell: ({ row }) => {
      const variantsWithBarcode = row.original.variantsWithBarcode ?? 0;
      const totalVariants = row.original.variantCount ?? 0;
      const percentage =
        totalVariants > 0 ? (variantsWithBarcode / totalVariants) * 100 : 0;

      return (
        <div className="flex items-center gap-1.5">
          <span className="type-p text-secondary whitespace-nowrap">
            {variantsWithBarcode} / {totalVariants}
          </span>
          <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden min-w-[60px]">
            <div
              className="h-full bg-brand rounded-full transition-all"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      );
    },
    meta: {
      headerClassName: cn("w-[220px] min-w-[220px] max-w-[220px]"),
      cellClassName: cn("w-[220px] min-w-[220px] max-w-[220px]"),
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
    cell: ({ row, table }) => {
      const product = row.original;
      const handle = product.productHandle || product.id;
      const editHref = handle ? `/passports/edit/${handle}` : undefined;

      // Get callbacks from table meta
      const meta = table.options.meta as
        | {
            onDeleteProduct?: (productId: string) => void;
            onChangeStatus?: (
              productId: string,
              status: "published" | "unpublished" | "scheduled",
            ) => void;
          }
        | undefined;
      const onDeleteProduct = meta?.onDeleteProduct;
      const onChangeStatus = meta?.onChangeStatus;

      // Build public DPP URL using UPID (new immutable passports URL structure)
      const dppBaseUrl =
        process.env.NEXT_PUBLIC_DPP_URL || "https://passport.avelero.com";
      // Use firstVariantUpid if available, otherwise the product isn't published yet
      const upid = product.firstVariantUpid;
      const dppUrl = upid ? `${dppBaseUrl}/${upid}` : undefined;

      // Only show passport button if product is published and has a UPID
      const canViewPassport =
        product.status === "published" && dppUrl !== undefined;

      return (
        <div className="flex items-center justify-end gap-3">
          <TooltipProvider delayDuration={120}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="View public passport"
                    disabled={!canViewPassport}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!dppUrl) return;
                      window.open(dppUrl, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <span className="px-1">Passport</span>
                    <Icons.ChevronRight className="h-[14px] w-[14px]" />
                  </Button>
                </span>
              </TooltipTrigger>
              {!canViewPassport && (
                <TooltipContent>
                  {product.status !== "published"
                    ? "Passport must be published to view"
                    : "Passport URL not available"}
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Open actions menu"
                disabled={!editHref}
                onClick={(e) => e.stopPropagation()}
                className="data-[state=open]:bg-accent"
              >
                <Icons.EllipsisVertical className="h-[14px] w-[14px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[220px]"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Change status</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onSelect={() => {
                      onChangeStatus?.(product.id, "published");
                    }}
                  >
                    <span className="inline-flex items-center">
                      <Icons.StatusPublished width={12} height={12} />
                      <span className="px-1">Published</span>
                    </span>
                    {product.status === "published" && (
                      <Icons.Check className="h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      onChangeStatus?.(product.id, "unpublished");
                    }}
                  >
                    <span className="inline-flex items-center">
                      <Icons.StatusUnpublished width={12} height={12} />
                      <span className="px-1">Unpublished</span>
                    </span>
                    {product.status === "unpublished" && (
                      <Icons.Check className="h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      onChangeStatus?.(product.id, "scheduled");
                    }}
                  >
                    <span className="inline-flex items-center">
                      <Icons.StatusScheduled width={12} height={12} />
                      <span className="px-1">Scheduled</span>
                    </span>
                    {product.status === "scheduled" && (
                      <Icons.Check className="h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => {
                  onDeleteProduct?.(product.id);
                }}
              >
                <span className="inline-flex items-center">
                  <Icons.Trash2 size={14} />
                  <span className="px-1">Delete</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    },
  },
];
