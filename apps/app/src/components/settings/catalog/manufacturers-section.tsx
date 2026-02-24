"use client";

import {
  type ManufacturerData,
  ManufacturerSheet,
} from "@/components/sheets/manufacturer-sheet";
import {
  DeleteConfirmationDialog,
  EntityTableShell,
  EntityToolbar,
} from "@/components/tables/settings/shared";
import {
  ManufacturersTable,
  type ManufacturerListItem,
} from "@/components/tables/settings/manufacturers";
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

function mapManufacturerToSheetData(
  manufacturer: ManufacturerListItem | null,
): ManufacturerData | undefined {
  if (!manufacturer) return undefined;

  return {
    id: manufacturer.id,
    name: manufacturer.name,
    legalName: manufacturer.legal_name ?? undefined,
    email: manufacturer.email ?? undefined,
    phone: manufacturer.phone ?? undefined,
    website: manufacturer.website ?? undefined,
    addressLine1: manufacturer.address_line_1 ?? undefined,
    addressLine2: manufacturer.address_line_2 ?? undefined,
    city: manufacturer.city ?? undefined,
    state: manufacturer.state ?? undefined,
    zip: manufacturer.zip ?? undefined,
    countryCode: manufacturer.country_code ?? undefined,
  };
}

type DeleteDialogState =
  | { mode: "single"; manufacturer: ManufacturerListItem }
  | { mode: "bulk"; ids: string[] }
  | null;

export function ManufacturersSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [editingManufacturer, setEditingManufacturer] =
    React.useState<ManufacturerListItem | null>(null);
  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>(null);

  const manufacturersQuery = useSuspenseQuery(
    trpc.catalog.manufacturers.list.queryOptions(undefined),
  );
  const deleteManufacturerMutation = useMutation(
    trpc.catalog.manufacturers.delete.mutationOptions(),
  );

  const allRows = React.useMemo(
    () =>
      [...(manufacturersQuery.data?.data ?? [])].sort((a, b) => {
        const updatedDiff = toTimestamp(b.updated_at) - toTimestamp(a.updated_at);
        if (updatedDiff !== 0) return updatedDiff;

        const createdDiff = toTimestamp(b.created_at) - toTimestamp(a.created_at);
        if (createdDiff !== 0) return createdDiff;

        return a.name.localeCompare(b.name);
      }),
    [manufacturersQuery.data],
  );

  const filteredRows = React.useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return allRows;

    return allRows.filter((row) => {
      return [
        row.name,
        row.legal_name,
        row.email,
        row.website,
        row.city,
        row.state,
        row.country_code,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
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
    if (!editingManufacturer) return;
    const exists = allRows.some((row) => row.id === editingManufacturer.id);
    if (!exists) setEditingManufacturer(null);
  }, [allRows, editingManufacturer]);

  const invalidateLists = React.useCallback(async () => {
    await invalidateSettingsEntityCaches({
      queryClient,
      entityListQueryKey: trpc.catalog.manufacturers.list.queryKey(undefined),
      compositeCatalogQueryKey: trpc.composite.catalogContent.queryKey(),
    });
  }, [queryClient, trpc]);

  const deleteManufacturerNow = React.useCallback(
    async (manufacturer: ManufacturerListItem) => {
      try {
        await deleteManufacturerMutation.mutateAsync({ id: manufacturer.id });
        setSelectedIds((prev) => prev.filter((id) => id !== manufacturer.id));
        await invalidateLists();
        toast.success("Manufacturer deleted");
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to delete manufacturer";
        toast.error(message);
      }
    },
    [deleteManufacturerMutation, invalidateLists],
  );

  const deleteSelectedNow = React.useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const currentIds = [...ids];
    const results = await Promise.allSettled(
      currentIds.map((id) => deleteManufacturerMutation.mutateAsync({ id })),
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
      toast.success(`${successes} manufacturer${successes === 1 ? "" : "s"} deleted`);
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
        : "Failed to delete selected manufacturers",
    );
  }, [deleteManufacturerMutation, invalidateLists]);

  const handleDeleteManufacturer = React.useCallback((manufacturer: ManufacturerListItem) => {
    setDeleteDialog({ mode: "single", manufacturer });
  }, []);

  const handleDeleteSelected = React.useCallback(() => {
    if (selectedIds.length === 0) return;
    setDeleteDialog({ mode: "bulk", ids: [...selectedIds] });
  }, [selectedIds]);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteDialog) return;

    const currentDialog = deleteDialog;

    if (currentDialog.mode === "single") {
      await deleteManufacturerNow(currentDialog.manufacturer);
    } else {
      await deleteSelectedNow(currentDialog.ids);
    }

    setDeleteDialog(null);
  }, [deleteDialog, deleteManufacturerNow, deleteSelectedNow]);

  return (
    <div className="h-full min-h-0 w-full max-w-[1200px]">
      <EntityTableShell
        title="Manufacturers"
        toolbar={
          <EntityToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            createLabel="Create manufacturer"
            onCreate={() => {
              setEditingManufacturer(null);
              setIsSheetOpen(true);
            }}
            selectedCount={selectedIds.length}
            onDeleteSelected={handleDeleteSelected}
            actionsDisabled={deleteManufacturerMutation.isPending}
          />
        }
      >
        <ManufacturersTable
          rows={filteredRows}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onCreateManufacturer={() => {
            setEditingManufacturer(null);
            setIsSheetOpen(true);
          }}
          onEditManufacturer={(manufacturer) => {
            setEditingManufacturer(manufacturer);
            setIsSheetOpen(true);
          }}
          onDeleteManufacturer={handleDeleteManufacturer}
          hasSearch={searchValue.trim().length > 0}
        />
      </EntityTableShell>

      <ManufacturerSheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) setEditingManufacturer(null);
        }}
        initialManufacturer={mapManufacturerToSheetData(editingManufacturer)}
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
            ? `Delete ${deleteDialog.ids.length} manufacturer${deleteDialog.ids.length === 1 ? "" : "s"}?`
            : "Delete manufacturer?"
        }
        description={
          deleteDialog?.mode === "bulk"
            ? `You are about to permanently delete ${deleteDialog.ids.length} manufacturer${deleteDialog.ids.length === 1 ? "" : "s"}. This action cannot be undone.`
            : "You are about to permanently delete this manufacturer. This action cannot be undone."
        }
        confirmLabel={
          deleteDialog?.mode === "bulk"
            ? `Delete ${deleteDialog.ids.length} manufacturer${deleteDialog.ids.length === 1 ? "" : "s"}`
            : "Delete manufacturer"
        }
        onConfirm={handleConfirmDelete}
        isPending={deleteManufacturerMutation.isPending}
      />
    </div>
  );
}
