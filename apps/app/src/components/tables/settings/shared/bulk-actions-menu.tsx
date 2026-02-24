"use client";

import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";

export function BulkActionsMenu({
  selectedCount,
  disabled,
  onDeleteSelected,
}: {
  selectedCount: number;
  disabled?: boolean;
  onDeleteSelected: () => void | Promise<void>;
}) {
  const hasSelection = selectedCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="brand" size="default" disabled={disabled || !hasSelection}>
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
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(event) => {
            event.preventDefault();
            void onDeleteSelected();
          }}
        >
          <span className="inline-flex items-center gap-2">
            <Icons.Trash2 className="h-[14px] w-[14px]" />
            <span>Delete</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
