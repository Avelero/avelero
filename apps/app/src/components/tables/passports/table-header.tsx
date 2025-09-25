"use client";

import type { Table as ReactTable } from "@tanstack/react-table";
import { TableHead, TableHeader, TableRow } from "@v1/ui/table";
import * as React from "react";
import type { Passport } from "./types";

interface ColumnMeta {
  className?: string;
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
    <input
      ref={ref}
      type="checkbox"
      aria-label={ariaLabel}
      className="h-4 w-4 appearance-none border border-border bg-background checked:bg-brand checked:border-brand"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
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
    <TableHeader>
      {table.getHeaderGroups().map((headerGroup) => (
        <TableRow
          key={headerGroup.id}
          className="sticky top-0 z-20 bg-background"
        >
          {headerGroup.headers.map((header) => {
            const meta = (header.column.columnDef.meta ?? {}) as ColumnMeta;
            const isSelect = header.column.id === "select";

            return (
              <TableHead key={header.id} className={meta.className}>
                {isSelect ? (
                  <IndeterminateCheckbox
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    onChange={(next) => table.toggleAllPageRowsSelected(next)}
                    ariaLabel="Select all"
                  />
                ) : header.isPlaceholder ? null : (
                  <span>
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
