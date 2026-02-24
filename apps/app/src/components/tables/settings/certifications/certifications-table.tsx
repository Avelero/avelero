"use client";

import {
  FlatDataTable,
  SettingsTableEmptyState,
} from "@/components/tables/settings/shared";
import { Icons } from "@v1/ui/icons";
import { certificationColumns } from "./columns";
import type { CertificationListItem } from "./types";

export function CertificationsTable({
  rows,
  selectedIds,
  onSelectedIdsChange,
  onEditCertification,
  onDeleteCertification,
  onCreateCertification,
  hasSearch,
}: {
  rows: CertificationListItem[];
  selectedIds: string[];
  onSelectedIdsChange: (next: string[]) => void;
  onEditCertification: (certification: CertificationListItem) => void;
  onDeleteCertification: (certification: CertificationListItem) => void | Promise<void>;
  onCreateCertification: () => void;
  hasSearch: boolean;
}) {
  return (
    <FlatDataTable
      rows={rows}
      rowKey={(row) => row.id}
      columns={certificationColumns}
      selectedIds={selectedIds}
      onSelectedIdsChange={onSelectedIdsChange}
      getRowActions={(row) => [
        {
          label: "Edit",
          icon: <Icons.Pencil className="h-[14px] w-[14px]" />,
          onSelect: () => onEditCertification(row),
        },
        {
          label: "Delete",
          icon: <Icons.Trash2 className="h-[14px] w-[14px]" />,
          destructive: true,
          onSelect: () => onDeleteCertification(row),
        },
      ]}
      emptyState={
        <SettingsTableEmptyState
          title={hasSearch ? "No certifications found" : "No certifications yet"}
          description={
            hasSearch
              ? "Try a different search term."
              : "Create your first certification to standardize material compliance."
          }
          actionLabel={hasSearch ? undefined : "Create certification"}
          onAction={hasSearch ? undefined : onCreateCertification}
        />
      }
    />
  );
}
