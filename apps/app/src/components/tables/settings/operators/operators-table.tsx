"use client";

import {
  FlatDataTable,
  SettingsTableEmptyState,
} from "@/components/tables/settings/shared";
import { Icons } from "@v1/ui/icons";
import { operatorColumns } from "./columns";
import type { OperatorListItem } from "./types";

export function OperatorsTable({
  rows,
  selectedIds,
  onSelectedIdsChange,
  onEditOperator,
  onDeleteOperator,
  onCreateOperator,
  hasSearch,
}: {
  rows: OperatorListItem[];
  selectedIds: string[];
  onSelectedIdsChange: (next: string[]) => void;
  onEditOperator: (operator: OperatorListItem) => void;
  onDeleteOperator: (operator: OperatorListItem) => void | Promise<void>;
  onCreateOperator: () => void;
  hasSearch: boolean;
}) {
  return (
    <FlatDataTable
      rows={rows}
      rowKey={(row) => row.id}
      columns={operatorColumns}
      selectedIds={selectedIds}
      onSelectedIdsChange={onSelectedIdsChange}
      getRowActions={(row) => [
        {
          label: "Edit",
          icon: <Icons.Pencil className="h-[14px] w-[14px]" />,
          onSelect: () => onEditOperator(row),
        },
        {
          label: "Delete",
          icon: <Icons.Trash2 className="h-[14px] w-[14px]" />,
          destructive: true,
          onSelect: () => onDeleteOperator(row),
        },
      ]}
      emptyState={
        <SettingsTableEmptyState
          title={hasSearch ? "No operators found" : "No operators yet"}
          description={
            hasSearch
              ? "Try a different search term."
              : "Create your first operator to manage journey participants."
          }
          actionLabel={hasSearch ? undefined : "Create operator"}
          onAction={hasSearch ? undefined : onCreateOperator}
        />
      }
    />
  );
}
