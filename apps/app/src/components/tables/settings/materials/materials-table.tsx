"use client";

import {
  FlatDataTable,
  SettingsTableEmptyState,
} from "@/components/tables/settings/shared";
import { Icons } from "@v1/ui/icons";
import { materialColumns } from "./columns";
import type { MaterialTableRow } from "./types";

export function MaterialsTable({
  rows,
  selectedIds,
  onSelectedIdsChange,
  onEditMaterial,
  onDeleteMaterial,
  onCreateMaterial,
  hasSearch,
}: {
  rows: MaterialTableRow[];
  selectedIds: string[];
  onSelectedIdsChange: (next: string[]) => void;
  onEditMaterial: (material: MaterialTableRow) => void;
  onDeleteMaterial: (material: MaterialTableRow) => void | Promise<void>;
  onCreateMaterial: () => void;
  hasSearch: boolean;
}) {
  return (
    <FlatDataTable
      rows={rows}
      rowKey={(row) => row.id}
      columns={materialColumns}
      selectedIds={selectedIds}
      onSelectedIdsChange={onSelectedIdsChange}
      getRowActions={(row) => [
        {
          label: "Edit",
          icon: <Icons.Pencil className="h-[14px] w-[14px]" />,
          onSelect: () => onEditMaterial(row),
        },
        {
          label: "Delete",
          icon: <Icons.Trash2 className="h-[14px] w-[14px]" />,
          destructive: true,
          onSelect: () => onDeleteMaterial(row),
        },
      ]}
      emptyState={
        <SettingsTableEmptyState
          title={hasSearch ? "No materials found" : "No materials yet"}
          description={
            hasSearch
              ? "Try a different search term."
              : "Create your first material to manage composition data."
          }
          actionLabel={hasSearch ? undefined : "Create material"}
          onAction={hasSearch ? undefined : onCreateMaterial}
        />
      }
    />
  );
}
