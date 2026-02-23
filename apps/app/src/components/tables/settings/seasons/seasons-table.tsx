"use client";

import { FlatDataTable, SettingsTableEmptyState } from "@/components/tables/settings/shared";
import { Icons } from "@v1/ui/icons";
import { seasonColumns } from "./columns";
import type { SeasonListItem } from "./types";

export function SeasonsTable({
  rows,
  selectedIds,
  onSelectedIdsChange,
  onEditSeason,
  onDeleteSeason,
  onCreateSeason,
  hasSearch,
}: {
  rows: SeasonListItem[];
  selectedIds: string[];
  onSelectedIdsChange: (next: string[]) => void;
  onEditSeason: (season: SeasonListItem) => void;
  onDeleteSeason: (season: SeasonListItem) => void | Promise<void>;
  onCreateSeason: () => void;
  hasSearch: boolean;
}) {
  return (
    <FlatDataTable
      rows={rows}
      rowKey={(row) => row.id}
      columns={seasonColumns}
      selectedIds={selectedIds}
      onSelectedIdsChange={onSelectedIdsChange}
      getRowActions={(row) => [
        {
          label: "Edit",
          icon: <Icons.Pencil className="h-[14px] w-[14px]" />,
          onSelect: () => onEditSeason(row),
        },
        {
          label: "Delete",
          icon: <Icons.Trash2 className="h-[14px] w-[14px]" />,
          destructive: true,
          onSelect: () => onDeleteSeason(row),
        },
      ]}
      emptyState={
        <SettingsTableEmptyState
          title={hasSearch ? "No seasons found" : "No seasons yet"}
          description={
            hasSearch
              ? "Try a different search term."
              : "Create your first season to start organizing products."
          }
          actionLabel={hasSearch ? undefined : "Create season"}
          onAction={hasSearch ? undefined : onCreateSeason}
        />
      }
    />
  );
}
