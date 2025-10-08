"use client";

import type { HeaderContext, Table as ReactTable } from "@tanstack/react-table";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { TableHead, TableHeader, TableRow } from "@v1/ui/table";
import * as React from "react";
import type { Passport } from "./types";

interface ColumnMeta {
  headerClassName?: string;
  cellClassName?: string;
  sticky?: "left" | "right";
}

function getHeaderClassName(
  header: HeaderContext<Passport, unknown>["header"],
  meta: ColumnMeta | null,
) {
  const stickyClass =
    meta?.sticky === "left"
      ? "sticky left-0 z-[15] bg-background border-r-0 before:absolute before:right-0 before:top-0 before:bottom-0 before:w-px before:bg-border"
      : meta?.sticky === "right"
        ? "sticky right-0 z-[15] border-l border-border bg-background"
        : "";

  return cn(
    "h-14 px-4 text-left align-middle text-secondary type-p",
    "bg-background",
    stickyClass,
    meta?.headerClassName,
  );
}

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
  ariaLabel: string;
}) {
  const ref = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <label 
      className="relative inline-flex h-4 w-4 items-center justify-center cursor-pointer before:absolute before:right-[-12px] before:left-[-16px] before:top-[-20px] before:bottom-[-19px] before:content-['']"
      onClick={(event) => event.stopPropagation()}
    >
      <input
        ref={ref}
        type="checkbox"
        aria-label={ariaLabel}
        aria-checked={indeterminate ? "mixed" : checked ? "true" : "false"}
        className="block h-4 w-4 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand aria-[checked=mixed]:border-brand cursor-pointer outline-none focus:outline-none"
        checked={checked}
        onChange={(e) => {
          // Prevent focus ring
          (e.target as HTMLInputElement).blur();
          onChange();
        }}
      />
      {(checked || indeterminate) && (
        <div className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center pointer-events-none">
          <div className="w-[10px] h-[10px] bg-brand" />
        </div>
      )}
    </label>
  );
}

export function PassportTableHeader({
  table,
  isScrollable,
  onScrollLeftAction,
  onScrollRightAction,
  onSelectAllAction,
  onClearSelectionAction,
  isAllMode,
  hasAnySelection,
}: {
  table: ReactTable<Passport>;
  isScrollable?: boolean;
  onScrollLeftAction?: () => void;
  onScrollRightAction?: () => void;
  onSelectAllAction?: () => void;
  onClearSelectionAction?: () => void;
  isAllMode?: boolean;
  hasAnySelection?: boolean;
}) {
  // In "all" mode, checkbox is always checked
  // In "explicit" mode, check if all/some visible rows are selected
  const isAllPageSelected = table.getIsAllPageRowsSelected();
  const isSomePageSelected = table.getIsSomePageRowsSelected();
  
  const checked = isAllMode || isAllPageSelected;
  const indeterminate = !isAllMode && isSomePageSelected && !isAllPageSelected;

  return (
    <TableHeader className="sticky top-0 z-20 border-b border-border bg-background">
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow key={headerGroup.id} className="h-14 border-b border-border">
          {headerGroup.headers.map((header) => {
            const meta = (header.column.columnDef.meta ??
              null) as ColumnMeta | null;

            const isProductHeader = header.column.id === "product";

            return (
              <TableHead
                key={header.id}
                className={getHeaderClassName(header, meta)}
              >
                {isProductHeader ? (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <IndeterminateCheckbox
                        checked={isAllSelected}
                        indeterminate={isSomeSelected}
                        onChange={(_next) => {
                          if (isAllMode) {
                            // In all-mode, clicking header toggles clear
                            if (hasAnySelection) onClearSelectionAction?.();
                            else onSelectAllAction?.();
                          } else {
                            const hasAnySelected =
                              table.getIsAllPageRowsSelected() ||
                              table.getIsSomePageRowsSelected();
                            table.toggleAllPageRowsSelected(!hasAnySelected);
                            if (!hasAnySelection) onSelectAllAction?.();
                          }
                        }}
                        ariaLabel="Select all products"
                      />
                      <span className="whitespace-nowrap">Product title</span>
                    </div>
                    {isScrollable && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label="Scroll left"
                          onClick={(e) => {
                            e.preventDefault();
                            onScrollLeftAction?.();
                          }}
                          icon={
                            <Icons.ChevronLeft className="h-[14px] w-[14px]" />
                          }
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label="Scroll right"
                          onClick={(e) => {
                            e.preventDefault();
                            onScrollRightAction?.();
                          }}
                          icon={
                            <Icons.ChevronRight className="h-[14px] w-[14px]" />
                          }
                        />
                      </div>
                    )}
                  </div>
                ) : header.isPlaceholder ? null : (
                  <span className="whitespace-nowrap">
                    {String(header.column.columnDef.header ?? header.column.id)}
                  </span>
                )}
              </TableHead>
            );
          })}
        </TableRow>
      ))}
    </TableHeader>
  );
}
