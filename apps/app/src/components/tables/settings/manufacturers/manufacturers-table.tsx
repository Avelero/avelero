"use client";

import {
  FlatDataTable,
  SettingsTableEmptyState,
} from "@/components/tables/settings/shared";
import { Icons } from "@v1/ui/icons";
import { manufacturerColumns } from "./columns";
import type { ManufacturerListItem } from "./types";

export function ManufacturersTable({
  rows,
  selectedIds,
  onSelectedIdsChange,
  onEditManufacturer,
  onDeleteManufacturer,
  onCreateManufacturer,
  hasSearch,
}: {
  rows: ManufacturerListItem[];
  selectedIds: string[];
  onSelectedIdsChange: (next: string[]) => void;
  onEditManufacturer: (manufacturer: ManufacturerListItem) => void;
  onDeleteManufacturer: (manufacturer: ManufacturerListItem) => void | Promise<void>;
  onCreateManufacturer: () => void;
  hasSearch: boolean;
}) {
  return (
    <FlatDataTable
      rows={rows}
      rowKey={(row) => row.id}
      columns={manufacturerColumns}
      selectedIds={selectedIds}
      onSelectedIdsChange={onSelectedIdsChange}
      getRowActions={(row) => [
        {
          label: "Edit",
          icon: <Icons.Pencil className="h-[14px] w-[14px]" />,
          onSelect: () => onEditManufacturer(row),
        },
        {
          label: "Delete",
          icon: <Icons.Trash2 className="h-[14px] w-[14px]" />,
          destructive: true,
          onSelect: () => onDeleteManufacturer(row),
        },
      ]}
      emptyState={
        <SettingsTableEmptyState
          title={hasSearch ? "No manufacturers found" : "No manufacturers yet"}
          description={
            hasSearch
              ? "Try a different search term."
              : "Create your first manufacturer to organize product sourcing."
          }
          actionLabel={hasSearch ? undefined : "Create manufacturer"}
          onAction={hasSearch ? undefined : onCreateManufacturer}
        />
      }
    />
  );
}
