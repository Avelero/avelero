"use client";

import {
  CertificationSheet,
  type CertificationSheetData,
} from "@/components/sheets/certification-sheet";
import {
  DeleteConfirmationDialog,
  EntityTableShell,
  EntityToolbar,
} from "@/components/tables/settings/shared";
import {
  CertificationsTable,
  type CertificationListItem,
} from "@/components/tables/settings/certifications";
import { invalidateSettingsEntityCaches } from "@/lib/settings-entity-cache";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

function toTimestamp(value?: string | Date | null) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function parseDate(value?: string | Date | null) {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function mapCertificationToSheetData(
  certification: CertificationListItem | null,
): CertificationSheetData | undefined {
  if (!certification) return undefined;

  return {
    id: certification.id,
    title: certification.title,
    certificationCode: certification.certification_code ?? undefined,
    instituteName: certification.institute_name ?? undefined,
    instituteEmail: certification.institute_email ?? undefined,
    instituteWebsite: certification.institute_website ?? undefined,
    instituteAddressLine1: certification.institute_address_line_1 ?? undefined,
    instituteAddressLine2: certification.institute_address_line_2 ?? undefined,
    instituteCity: certification.institute_city ?? undefined,
    instituteState: certification.institute_state ?? undefined,
    instituteZip: certification.institute_zip ?? undefined,
    instituteCountryCode: certification.institute_country_code ?? undefined,
    issueDate: parseDate(certification.issue_date),
    expiryDate: parseDate(certification.expiry_date),
    certificationPath: certification.certification_path ?? undefined,
  };
}

type DeleteDialogState =
  | { mode: "single"; certification: CertificationListItem }
  | { mode: "bulk"; ids: string[] }
  | null;

export function CertificationsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [editingCertification, setEditingCertification] =
    React.useState<CertificationListItem | null>(null);
  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>(null);

  const certificationsQuery = useSuspenseQuery(
    trpc.catalog.certifications.list.queryOptions(undefined),
  );
  const deleteCertificationMutation = useMutation(
    trpc.catalog.certifications.delete.mutationOptions(),
  );

  const allRows = React.useMemo(
    () =>
      [...(certificationsQuery.data?.data ?? [])].sort((a, b) => {
        const updatedDiff = toTimestamp(b.updated_at) - toTimestamp(a.updated_at);
        if (updatedDiff !== 0) return updatedDiff;

        const createdDiff = toTimestamp(b.created_at) - toTimestamp(a.created_at);
        if (createdDiff !== 0) return createdDiff;

        return a.title.localeCompare(b.title);
      }),
    [certificationsQuery.data],
  );

  const filteredRows = React.useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return allRows;

    return allRows.filter((row) =>
      [
        row.title,
        row.certification_code,
        row.institute_name,
        row.institute_email,
        row.institute_website,
        row.institute_city,
        row.institute_state,
        row.institute_country_code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [allRows, searchValue]);

  React.useEffect(() => {
    const allowed = new Set(allRows.map((row) => row.id));
    setSelectedIds((prev) => {
      const next = prev.filter((id) => allowed.has(id));
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [allRows]);

  React.useEffect(() => {
    if (!editingCertification) return;
    const exists = allRows.some((row) => row.id === editingCertification.id);
    if (!exists) setEditingCertification(null);
  }, [allRows, editingCertification]);

  const invalidateLists = React.useCallback(async () => {
    await invalidateSettingsEntityCaches({
      queryClient,
      entityListQueryKey: trpc.catalog.certifications.list.queryKey(undefined),
      compositeCatalogQueryKey: trpc.composite.catalogContent.queryKey(),
    });
  }, [queryClient, trpc]);

  const deleteCertificationNow = React.useCallback(
    async (certification: CertificationListItem) => {
      try {
        await deleteCertificationMutation.mutateAsync({ id: certification.id });
        setSelectedIds((prev) => prev.filter((id) => id !== certification.id));
        await invalidateLists();
        toast.success("Certification deleted");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete certification";
        toast.error(message);
      }
    },
    [deleteCertificationMutation, invalidateLists],
  );

  const deleteSelectedNow = React.useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const currentIds = [...ids];
    const results = await Promise.allSettled(
      currentIds.map((id) => deleteCertificationMutation.mutateAsync({ id })),
    );

    const failures = results.filter((result) => result.status === "rejected");
    const failedIds = results.flatMap((result, index) =>
      result.status === "rejected" ? [currentIds[index]!] : [],
    );
    const successes = results.length - failures.length;

    if (successes > 0) {
      setSelectedIds(failedIds);
      await invalidateLists();
    }

    if (failures.length === 0) {
      setSelectedIds([]);
      toast.success(`${successes} certification${successes === 1 ? "" : "s"} deleted`);
      return;
    }

    if (successes > 0) {
      toast.error(`${failures.length} delete${failures.length === 1 ? "" : "s"} failed`);
      return;
    }

    const reason = failures[0];
    toast.error(
      reason && reason.status === "rejected" && reason.reason instanceof Error
        ? reason.reason.message
        : "Failed to delete selected certifications",
    );
  }, [deleteCertificationMutation, invalidateLists]);

  const handleDeleteCertification = React.useCallback(
    (certification: CertificationListItem) => {
      setDeleteDialog({ mode: "single", certification });
    },
    [],
  );

  const handleDeleteSelected = React.useCallback(() => {
    if (selectedIds.length === 0) return;
    setDeleteDialog({ mode: "bulk", ids: [...selectedIds] });
  }, [selectedIds]);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteDialog) return;

    const currentDialog = deleteDialog;

    if (currentDialog.mode === "single") {
      await deleteCertificationNow(currentDialog.certification);
    } else {
      await deleteSelectedNow(currentDialog.ids);
    }

    setDeleteDialog(null);
  }, [deleteCertificationNow, deleteDialog, deleteSelectedNow]);

  return (
    <div className="h-full min-h-0 w-full max-w-[1200px]">
      <EntityTableShell
        title="Certifications"
        toolbar={
          <EntityToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            createLabel="Create certification"
            onCreate={() => {
              setEditingCertification(null);
              setIsSheetOpen(true);
            }}
            selectedCount={selectedIds.length}
            onDeleteSelected={handleDeleteSelected}
            actionsDisabled={deleteCertificationMutation.isPending}
          />
        }
      >
        <CertificationsTable
          rows={filteredRows}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onCreateCertification={() => {
            setEditingCertification(null);
            setIsSheetOpen(true);
          }}
          onEditCertification={(certification) => {
            setEditingCertification(certification);
            setIsSheetOpen(true);
          }}
          onDeleteCertification={handleDeleteCertification}
          hasSearch={searchValue.trim().length > 0}
        />
      </EntityTableShell>

      <CertificationSheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) setEditingCertification(null);
        }}
        initialCertification={mapCertificationToSheetData(editingCertification)}
        onSave={async () => {
          await invalidateLists();
        }}
      />

      <DeleteConfirmationDialog
        open={deleteDialog !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog(null);
        }}
        title={
          deleteDialog?.mode === "bulk"
            ? `Delete ${deleteDialog.ids.length} certification${deleteDialog.ids.length === 1 ? "" : "s"}?`
            : "Delete certification?"
        }
        description={
          deleteDialog?.mode === "bulk"
            ? `You are about to permanently delete ${deleteDialog.ids.length} certification${deleteDialog.ids.length === 1 ? "" : "s"}. This action cannot be undone.`
            : "You are about to permanently delete this certification. This action cannot be undone."
        }
        confirmLabel={
          deleteDialog?.mode === "bulk"
            ? `Delete ${deleteDialog.ids.length} certification${deleteDialog.ids.length === 1 ? "" : "s"}`
            : "Delete certification"
        }
        onConfirm={handleConfirmDelete}
        isPending={deleteCertificationMutation.isPending}
      />
    </div>
  );
}
