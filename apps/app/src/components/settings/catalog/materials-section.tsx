"use client";

import {
  type MaterialData,
  MaterialSheet,
} from "@/components/sheets/material-sheet";
import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import {
  DeleteConfirmationDialog,
  EntityTableShell,
  EntityToolbar,
} from "@/components/tables/settings/shared";
import {
  MaterialsTable,
  type MaterialListItem,
  type MaterialTableRow,
} from "@/components/tables/settings/materials";
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

function mapMaterialToSheetData(material: MaterialListItem | null): MaterialData | undefined {
  if (!material) return undefined;

  return {
    id: material.id,
    name: material.name,
    countryOfOrigin: material.country_of_origin ?? undefined,
    recyclable: material.recyclable ?? undefined,
    certificationId: material.certification_id ?? undefined,
  };
}

type DeleteDialogState =
  | { mode: "single"; material: MaterialListItem }
  | { mode: "bulk"; ids: string[] }
  | null;

export function MaterialsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { certifications } = useBrandCatalog();

  const [searchValue, setSearchValue] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [editingMaterial, setEditingMaterial] = React.useState<MaterialListItem | null>(null);
  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>(null);

  const materialsQuery = useSuspenseQuery(trpc.catalog.materials.list.queryOptions(undefined));
  const deleteMaterialMutation = useMutation(trpc.catalog.materials.delete.mutationOptions());

  const certificationsById = React.useMemo(() => {
    const map = new Map<string, { title?: string | null; certification_code?: string | null }>();
    for (const cert of certifications) {
      map.set(cert.id, {
        title: cert.title ?? null,
        certification_code: cert.certification_code ?? null,
      });
    }
    return map;
  }, [certifications]);

  const allRows = React.useMemo<MaterialTableRow[]>(() => {
    return [...(materialsQuery.data?.data ?? [])]
      .map((row) => {
        const cert = row.certification_id ? certificationsById.get(row.certification_id) : undefined;
        return {
          ...row,
          certification_title: cert?.title ?? null,
          certification_code: cert?.certification_code ?? null,
        };
      })
      .sort((a, b) => {
        const updatedDiff = toTimestamp(b.updated_at) - toTimestamp(a.updated_at);
        if (updatedDiff !== 0) return updatedDiff;

        const createdDiff = toTimestamp(b.created_at) - toTimestamp(a.created_at);
        if (createdDiff !== 0) return createdDiff;

        return a.name.localeCompare(b.name);
      });
  }, [certificationsById, materialsQuery.data]);

  const filteredRows = React.useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return allRows;

    return allRows.filter((row) =>
      [
        row.name,
        row.country_of_origin,
        row.recyclable == null ? null : row.recyclable ? "yes" : "no",
        row.certification_title,
        row.certification_code,
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
    if (!editingMaterial) return;
    const exists = allRows.some((row) => row.id === editingMaterial.id);
    if (!exists) setEditingMaterial(null);
  }, [allRows, editingMaterial]);

  const invalidateLists = React.useCallback(async () => {
    await invalidateSettingsEntityCaches({
      queryClient,
      entityListQueryKey: trpc.catalog.materials.list.queryKey(undefined),
      compositeCatalogQueryKey: trpc.composite.catalogContent.queryKey(),
    });
  }, [queryClient, trpc]);

  const deleteMaterialNow = React.useCallback(
    async (material: MaterialListItem) => {
      try {
        await deleteMaterialMutation.mutateAsync({ id: material.id });
        setSelectedIds((prev) => prev.filter((id) => id !== material.id));
        await invalidateLists();
        toast.success("Material deleted");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete material";
        toast.error(message);
      }
    },
    [deleteMaterialMutation, invalidateLists],
  );

  const deleteSelectedNow = React.useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const currentIds = [...ids];
    const results = await Promise.allSettled(
      currentIds.map((id) => deleteMaterialMutation.mutateAsync({ id })),
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
      toast.success(`${successes} material${successes === 1 ? "" : "s"} deleted`);
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
        : "Failed to delete selected materials",
    );
  }, [deleteMaterialMutation, invalidateLists]);

  const handleDeleteMaterial = React.useCallback((material: MaterialListItem) => {
    setDeleteDialog({ mode: "single", material });
  }, []);

  const handleDeleteSelected = React.useCallback(() => {
    if (selectedIds.length === 0) return;
    setDeleteDialog({ mode: "bulk", ids: [...selectedIds] });
  }, [selectedIds]);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteDialog) return;

    const currentDialog = deleteDialog;

    if (currentDialog.mode === "single") {
      await deleteMaterialNow(currentDialog.material);
    } else {
      await deleteSelectedNow(currentDialog.ids);
    }

    setDeleteDialog(null);
  }, [deleteDialog, deleteMaterialNow, deleteSelectedNow]);

  return (
    <div className="h-full min-h-0 w-full max-w-[1200px]">
      <EntityTableShell
        title="Materials"
        toolbar={
          <EntityToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            createLabel="Create material"
            onCreate={() => {
              setEditingMaterial(null);
              setIsSheetOpen(true);
            }}
            selectedCount={selectedIds.length}
            onDeleteSelected={handleDeleteSelected}
            actionsDisabled={deleteMaterialMutation.isPending}
          />
        }
      >
        <MaterialsTable
          rows={filteredRows}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onCreateMaterial={() => {
            setEditingMaterial(null);
            setIsSheetOpen(true);
          }}
          onEditMaterial={(material) => {
            setEditingMaterial(material);
            setIsSheetOpen(true);
          }}
          onDeleteMaterial={handleDeleteMaterial}
          hasSearch={searchValue.trim().length > 0}
        />
      </EntityTableShell>

      <MaterialSheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) setEditingMaterial(null);
        }}
        initialMaterial={mapMaterialToSheetData(editingMaterial)}
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
            ? `Delete ${deleteDialog.ids.length} material${deleteDialog.ids.length === 1 ? "" : "s"}?`
            : "Delete material?"
        }
        description={
          deleteDialog?.mode === "bulk"
            ? `You are about to permanently delete ${deleteDialog.ids.length} material${deleteDialog.ids.length === 1 ? "" : "s"}. This action cannot be undone.`
            : "You are about to permanently delete this material. This action cannot be undone."
        }
        confirmLabel={
          deleteDialog?.mode === "bulk"
            ? `Delete ${deleteDialog.ids.length} material${deleteDialog.ids.length === 1 ? "" : "s"}`
            : "Delete material"
        }
        onConfirm={handleConfirmDelete}
        isPending={deleteMaterialMutation.isPending}
      />
    </div>
  );
}
