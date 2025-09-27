"use client";

import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { cn } from "@v1/ui/cn";
import * as React from "react";
import { DisplayPopover } from "./display-popover";

interface PassportControlsProps {
  selectedCount?: number;
  displayProps?: {
    productLabel?: string;
    allColumns: { id: string; label: string }[];
    initialVisible: string[];
    onSave: (visibleOrdered: string[]) => void;
  };
}

export function PassportControls({ selectedCount = 0, displayProps }: PassportControlsProps) {
  const [isSearchFocused, setIsSearchFocused] = React.useState(false);

  const hasSelection = selectedCount > 0;

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
          <div className={cn(
            "absolute left-2 pointer-events-none text-tertiary",
            isSearchFocused ? "text-secondary" : "text-tertiary",
          )}>
            <Icons.Search className="h-4 w-4" />
          </div>
          <Input
            aria-label="Search"
            placeholder={"Search..."}
            className={cn(
              "pl-8 pr-3 py-[6px] h-9",
              "transition-all",
              isSearchFocused ? "ring-1 ring-brand" : "ring-0",
            )}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
          />
        </div>

        {/* Sort */}
        <Button variant="subtle" size="default" iconPosition="left" icon={<Icons.ArrowDownUp className="h-[14px] w-[14px]" />}>Sort</Button>

        {/* Filter */}
        <Button variant="subtle" size="default" iconPosition="left" icon={<Icons.Filter className="h-[14px] w-[14px]" />}>Filter</Button>

        <div className="flex-1" />

        {/* Display */}
        {displayProps ? (
          <DisplayPopover
            trigger={
              <Button
                variant="subtle"
                size="default"
                iconPosition="left"
                icon={<Icons.SlidersHorizontal className="h-[14px] w-[14px]" />}
              >
                Display
              </Button>
            }
            productLabel={displayProps.productLabel}
            allColumns={displayProps.allColumns}
            initialVisible={displayProps.initialVisible}
            onSave={displayProps.onSave}
          />
        ) : (
          <Button variant="subtle" size="default" iconPosition="left" icon={<Icons.SlidersHorizontal className="h-[14px] w-[14px]" />}>Display</Button>
        )}

        {/* Actions */}
        <Button
          variant="brand"
          size="default"
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
      </div>
    </div>
  );
}


