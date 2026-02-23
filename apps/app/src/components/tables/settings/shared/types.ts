import type * as React from "react";

export interface RowAction {
  label: string;
  onSelect: () => void | Promise<void>;
  destructive?: boolean;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface FlatTableColumn<TRow> {
  id: string;
  header: React.ReactNode;
  cell: (row: TRow) => React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  getCellClassName?: (row: TRow) => string | undefined;
}
