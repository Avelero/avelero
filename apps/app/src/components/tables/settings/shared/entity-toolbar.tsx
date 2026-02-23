"use client";

import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import * as React from "react";
import { BulkActionsMenu } from "./bulk-actions-menu";

export function EntityToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search...",
  createLabel,
  onCreate,
  createAction,
  selectedCount,
  onDeleteSelected,
  actionsDisabled,
  className,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  createLabel?: string;
  onCreate?: () => void;
  createAction?: React.ReactNode;
  selectedCount: number;
  onDeleteSelected: () => void | Promise<void>;
  actionsDisabled?: boolean;
  className?: string;
}) {
  const [isFocused, setIsFocused] = React.useState(false);

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div
          className={cn(
            "relative flex items-center transition-all",
            isFocused ? "w-[340px]" : "w-[240px]",
          )}
        >
          <div
            className={cn(
              "absolute left-2 pointer-events-none text-tertiary",
              isFocused ? "text-secondary" : "text-tertiary",
            )}
          >
            <Icons.Search className="h-4 w-4" />
          </div>
          <Input
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              "pl-8 pr-3 py-[6px] h-9",
              "transition-transform",
              "disabled:cursor-default disabled:hover:cursor-default",
            )}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {createAction ?? (
          <Button
            type="button"
            variant="outline"
            size="default"
            onClick={onCreate}
            disabled={!onCreate}
          >
            <Icons.Plus className="h-[14px] w-[14px]" />
            <span className="px-1">{createLabel ?? "Create"}</span>
          </Button>
        )}

        <BulkActionsMenu
          selectedCount={selectedCount}
          disabled={actionsDisabled}
          onDeleteSelected={onDeleteSelected}
        />
      </div>
    </div>
  );
}
