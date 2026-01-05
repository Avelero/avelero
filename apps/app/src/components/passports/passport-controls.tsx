"use client";

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

interface PassportControlsProps {
  selectedCount?: number;
  disabled?: boolean;
  selection?: SelectionState;
  onClearSelectionAction?: () => void;
  onRequestBulkUpdate?: (changes: BulkChanges) => void; // optional external handler
  onDeleteSelectedAction?: () => void; // trigger delete modal for selected items
  onStatusChangeAction?: (status: string) => void; // trigger bulk status change
  filterState?: FilterState;
  filterActions?: FilterActions;
  sortState?: { field: string; direction: "asc" | "desc" } | null;
  onSortChange?: (
    sort: { field: string; direction: "asc" | "desc" } | null,
  ) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

export function PassportControls({
  selectedCount = 0,
  disabled = false,
  selection,
  onClearSelectionAction,
  onDeleteSelectedAction,
  onStatusChangeAction,
  filterState,
  filterActions,
  sortState,
  onSortChange,
  searchValue = "",
  onSearchChange,
}: PassportControlsProps) {
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);
  const [advancedFilterOpen, setAdvancedFilterOpen] = React.useState(false);

  const hasSelection = selectedCount > 0;

  function handleBulkStatusChange(
    status: "published" | "scheduled" | "unpublished" | "archived",
  ) {
    onStatusChangeAction?.(status);
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
              "transition-transform",
              // Ensure normal arrow cursor when disabled (not not-allowed)
              "disabled:cursor-default disabled:hover:cursor-default"
            )}
            disabled={disabled}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
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
          >
            <Icons.ArrowDownUp className="h-[14px] w-[14px]" />
            <span className="px-1">Sort</span>
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
          >
            <Icons.Filter className="h-[14px] w-[14px]" />
            <span className="px-1">Filter</span>
          </Button>
        )}

        <div className="flex-1" />

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="brand"
              size="default"
              disabled={disabled || !hasSelection}
            >
              <Icons.Globe className="h-[14px] w-[14px]" />
              <span className="px-1">Actions</span>
              {hasSelection && (
                <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 ml-1 rounded-sm bg-background text-[12px] leading-[12px] text-brand">
                  {selectedCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[220px]">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span>Change status</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-[220px]">
                <DropdownMenuItem
                  onSelect={() => {
                    handleBulkStatusChange("published");
                  }}
                >
                  <span className="inline-flex items-center">
                    <Icons.StatusPublished className="!h-[14px] !w-[14px]" />
                    <span className="px-1">Published</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    handleBulkStatusChange("scheduled");
                  }}
                >
                  <span className="inline-flex items-center">
                    <Icons.StatusScheduled className="!h-[14px] !w-[14px]" />
                    <span className="px-1">Scheduled</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    handleBulkStatusChange("unpublished");
                  }}
                >
                  <span className="inline-flex items-center">
                    <Icons.StatusUnpublished className="!h-[14px] !w-[14px]" />
                    <span className="px-1">Unpublished</span>
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    handleBulkStatusChange("archived");
                  }}
                >
                  <span className="inline-flex items-center">
                    <Icons.StatusArchived className="!h-[14px] !w-[14px]" />
                    <span className="px-1">Archived</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={() => {
                onDeleteSelectedAction?.();
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
    </div>
  );
}
