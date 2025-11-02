"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Input } from "@v1/ui/input";
import { toast } from "@v1/ui/sonner";
import * as React from "react";
import { QuickFiltersPopover } from "../select/filter-select";
import { SortPopover } from "../select/sort-select";
import { AdvancedFilterPanel } from "../sheets/filter-sheet";
import type {
  BulkChanges,
  FilterActions,
  FilterState,
  SelectionState,
} from "../tables/passports/types";
import { DisplayPopover } from "./display-popover";

interface PassportControlsProps {
  selectedCount?: number;
  disabled?: boolean;
  selection?: SelectionState;
  onClearSelectionAction?: () => void;
  onRequestBulkUpdate?: (changes: BulkChanges) => void; // optional external handler
  displayProps?: {
    productLabel?: string;
    allColumns: { id: string; label: string }[];
    initialVisible: string[];
    onSave: (visibleOrdered: string[]) => void;
  };
  filterState?: FilterState;
  filterActions?: FilterActions;
  sortState?: { field: string; direction: "asc" | "desc" } | null;
  onSortChange?: (
    sort: { field: string; direction: "asc" | "desc" } | null,
  ) => void;
}

export function PassportControls({
  selectedCount = 0,
  disabled = false,
  selection,
  onClearSelectionAction,
  displayProps,
  filterState,
  filterActions,
  sortState,
  onSortChange,
}: PassportControlsProps) {
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const [advancedFilterOpen, setAdvancedFilterOpen] = React.useState(false);

  const hasSelection = selectedCount > 0;
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const bulkUpdateMutation = useMutation(trpc.bulk.update.mutationOptions());

  async function handleBulkStatusChange(
    status: "published" | "scheduled" | "unpublished" | "archived",
  ) {
    if (!selection) return;
    try {
      const res = await bulkUpdateMutation.mutateAsync({
        domain: "passports",
        selection:
          selection.mode === "all"
            ? { mode: "all", excludeIds: selection.excludeIds }
            : { mode: "explicit", includeIds: selection.includeIds },
        changes: { status },
      });
      const affected =
        (res as { affectedCount?: number } | undefined)?.affectedCount ??
        selectedCount;
      toast.success(`Edited ${affected} passports successfully`);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: trpc.passports.list.queryKey(),
        }),
        queryClient.invalidateQueries({
          queryKey: trpc.passports.list.queryKey({
            includeStatusCounts: true,
          }),
        }),
      ]);
      // Clear selection and close popover after success
      onClearSelectionAction?.();
    } catch (err) {
      toast.error("Bulk update failed, please try again");
    }
  }

  return (
    <div className="flex items-center justify-between pb-3">
      <div className="flex items-center gap-2 w-full">
        {/* Search */}
        <div
          className={cn(
            "relative flex items-center transition-all",
            isSearchFocused ? "w-[340px]" : "w-[240px]",
          )}
        >
          <div
            className={cn(
              "absolute left-2 pointer-events-none text-tertiary",
              isSearchFocused ? "text-secondary" : "text-tertiary",
            )}
          >
            <Icons.Search className="h-4 w-4" />
          </div>
          <Input
            aria-label="Search"
            placeholder={"Search..."}
            className={cn(
              "pl-8 pr-3 py-[6px] h-9",
              "transition-all",
              // Ensure normal arrow cursor when disabled (not not-allowed)
              "disabled:cursor-default disabled:hover:cursor-default",
              isSearchFocused ? "ring-1 ring-brand" : "ring-0",
            )}
            disabled={disabled}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
        </div>

        {/* Sort */}
        {sortState !== undefined && onSortChange ? (
          <SortPopover
            sortState={sortState}
            onSortChange={onSortChange}
            disabled={disabled}
          />
        ) : (
          <Button
            variant="subtle"
            size="default"
            disabled={disabled}
            iconPosition="left"
            icon={<Icons.ArrowDownUp className="h-[14px] w-[14px]" />}
          >
            Sort
          </Button>
        )}

        {/* Filter */}
        {filterState && filterActions ? (
          <>
            <QuickFiltersPopover
              filterState={filterState}
              filterActions={filterActions}
              onOpenAdvanced={() => setAdvancedFilterOpen(true)}
              disabled={disabled}
            />
            <AdvancedFilterPanel
              open={advancedFilterOpen}
              onOpenChange={setAdvancedFilterOpen}
              filterState={filterState}
              filterActions={filterActions}
            />
          </>
        ) : (
          <Button
            variant="subtle"
            size="default"
            disabled={disabled}
            iconPosition="left"
            icon={<Icons.Filter className="h-[14px] w-[14px]" />}
          >
            Filter
          </Button>
        )}

        <div className="flex-1" />

        {/* Display */}
        {displayProps ? (
          disabled ? (
            <Button
              variant="subtle"
              size="default"
              disabled
              iconPosition="left"
              icon={<Icons.SlidersHorizontal className="h-[14px] w-[14px]" />}
            >
              Display
            </Button>
          ) : (
            <DisplayPopover
              trigger={
                <Button
                  variant="subtle"
                  size="default"
                  iconPosition="left"
                  icon={
                    <Icons.SlidersHorizontal className="h-[14px] w-[14px]" />
                  }
                >
                  Display
                </Button>
              }
              productLabel={displayProps.productLabel}
              allColumns={displayProps.allColumns}
              initialVisible={displayProps.initialVisible}
              onSave={displayProps.onSave}
            />
          )
        ) : (
          <Button
            variant="subtle"
            size="default"
            disabled={disabled}
            iconPosition="left"
            icon={<Icons.SlidersHorizontal className="h-[14px] w-[14px]" />}
          >
            Display
          </Button>
        )}

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="brand"
              size="default"
              disabled={disabled || !hasSelection}
              iconPosition="left"
              icon={<Icons.Globe className="h-[14px] w-[14px]" />}
            >
              <span>Actions</span>
              {hasSelection && (
                <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 ml-1 rounded-sm bg-background text-[12px] leading-[12px] text-brand">
                  {selectedCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="h-9 py-3">
                Change status
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-[220px]">
                <DropdownMenuItem
                  className="h-9 py-3"
                  onSelect={() => {
                    handleBulkStatusChange("published");
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icons.StatusPublished width={12} height={12} />
                    <span>Published</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="h-9 py-3"
                  onSelect={() => {
                    handleBulkStatusChange("scheduled");
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icons.StatusScheduled width={12} height={12} />
                    <span>Scheduled</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="h-9 py-3"
                  onSelect={() => {
                    handleBulkStatusChange("unpublished");
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icons.StatusUnpublished width={12} height={12} />
                    <span>Unpublished</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="h-9 py-3"
                  onSelect={() => {
                    handleBulkStatusChange("archived");
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <Icons.StatusArchived width={12} height={12} />
                    <span>Archived</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
