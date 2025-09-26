"use client";

import type { HeaderContext, Table as ReactTable } from "@tanstack/react-table";
import { cn } from "@v1/ui/cn";
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
    "h-14 px-4 text-left align-middle text-secondary text-p",
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
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  const ref = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <div className="relative inline-flex h-4 w-4 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        aria-label={ariaLabel}
        aria-checked={indeterminate ? "mixed" : checked ? "true" : "false"}
        className="block h-4 w-4 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand aria-[checked=mixed]:border-brand cursor-pointer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {(checked || indeterminate) && (
        <div className="absolute top-0 left-0 w-4 h-4 flex items-center justify-center pointer-events-none">
          <div className="w-[10px] h-[10px] bg-brand" />
        </div>
      )}
    </div>
  );
}

export function PassportTableHeader({
  table,
}: {
  table: ReactTable<Passport>;
}) {
  const isAllSelected = table.getIsAllPageRowsSelected();
  const isSomeSelected = table.getIsSomePageRowsSelected();

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
                  <div className="flex items-center gap-4">
                    <IndeterminateCheckbox
                      checked={isAllSelected}
                      indeterminate={isSomeSelected}
                      onChange={(_next) => {
                        const hasAnySelected =
                          table.getIsAllPageRowsSelected() ||
                          table.getIsSomePageRowsSelected();
                        table.toggleAllPageRowsSelected(!hasAnySelected);
                      }}
                      ariaLabel="Select all"
                    />
                    <span className="whitespace-nowrap">Product title</span>
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
