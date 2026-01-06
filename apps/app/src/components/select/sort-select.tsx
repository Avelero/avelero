"use client";

import { Button } from "@v1/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import * as React from "react";

type SortDirection = "asc" | "desc";
type DataType = "text" | "number" | "date";

interface SortField {
  id: string;
  label: string;
  dataType: DataType;
}

interface SortState {
  field: string;
  direction: SortDirection;
}

interface SortPopoverProps {
  sortState: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  disabled?: boolean;
}

const SORT_FIELDS: SortField[] = [
  { id: "title", label: "Product title", dataType: "text" },
  { id: "productHandle", label: "Product handle", dataType: "text" },
  { id: "status", label: "Status", dataType: "text" },
  { id: "category", label: "Category", dataType: "text" },
  { id: "season", label: "Season", dataType: "text" },
  { id: "updatedAt", label: "Updated at", dataType: "date" },
  { id: "createdAt", label: "Created at", dataType: "date" },
];

function getSortIcon(dataType: DataType, direction: SortDirection) {
  if (dataType === "text") {
    return direction === "asc" ? Icons.ArrowUpZA : Icons.ArrowDownZA;
  }
  if (dataType === "number") {
    return direction === "asc" ? Icons.ArrowUp10 : Icons.ArrowDown10;
  }
  return direction === "asc" ? Icons.CalendarArrowUp : Icons.CalendarArrowDown;
}

export function SortPopover({
  sortState,
  onSortChange,
  disabled = false,
}: SortPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  // Optimistic local state for instant UI updates
  const [optimisticSort, setOptimisticSort] = React.useState<SortState | null>(
    sortState,
  );

  // Sync with parent when it changes (but only if not in a pending transition)
  React.useEffect(() => {
    if (!isPending) {
      setOptimisticSort(sortState);
    }
  }, [sortState, isPending]);

  const activeField = optimisticSort
    ? SORT_FIELDS.find((f) => f.id === optimisticSort.field)
    : null;

  const ActiveIcon = activeField
    ? getSortIcon(activeField.dataType, optimisticSort!.direction)
    : Icons.ArrowDownUp;

  const handleSortSelect = React.useCallback(
    (fieldId: string, direction: SortDirection) => {
      const newSort = { field: fieldId, direction };
      // Instant UI update (synchronous, highest priority)
      setOptimisticSort(newSort);
      // Defer parent update to not block UI
      startTransition(() => {
        onSortChange(newSort);
      });
      setOpen(false);
    },
    [onSortChange],
  );

  const handleClearSort = React.useCallback(() => {
    // Instant UI update (synchronous, highest priority)
    setOptimisticSort(null);
    // Defer parent update to not block UI
    startTransition(() => {
      onSortChange(null);
    });
  }, [onSortChange]);

  return (
    <div className="relative group inline-flex">
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="subtle"
            size="default"
            disabled={disabled}
            className="group-hover:bg-accent transition-none data-[state=open]:bg-accent"
          >
            <ActiveIcon className="h-[14px] w-[14px]" />
            <span className="px-1">{optimisticSort && activeField ? (
              <>
                Sorted by{" "}
                <span className="font-medium pl-2 text-foreground">{activeField.label}</span>
              </>
            ) : (
              "Sort"
            )}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[220px]">
          {SORT_FIELDS.map((field) => {
            const AscIcon = getSortIcon(field.dataType, "asc");
            const DescIcon = getSortIcon(field.dataType, "desc");

            return (
              <DropdownMenuSub key={field.id}>
                <DropdownMenuSubTrigger>
                  <span>{field.label}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="w-[220px]">
                    <DropdownMenuItem
                      onSelect={() => handleSortSelect(field.id, "asc")}
                    >
                      <span className="flex items-center">
                        <AscIcon className="h-[14px] w-[14px]" />
                        <span className="px-1">Ascending</span>
                      </span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => handleSortSelect(field.id, "desc")}
                    >
                      <span className="flex items-center">
                        <DescIcon className="h-[14px] w-[14px]" />
                        <span className="px-1">Descending</span>
                      </span>
                    </DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {optimisticSort && !disabled && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleClearSort();
          }}
          className="absolute right-0 top-1/2 -translate-y-1/2 h-[35px] w-[35px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-accent before:absolute before:right-full before:top-0 before:bottom-0 before:w-8 before:bg-gradient-to-r before:from-transparent before:to-accent before:pointer-events-none z-10"
          aria-label="Clear sort"
        >
          <Icons.X className="h-3 w-3 text-secondary" />
        </button>
      )}
    </div>
  );
}
