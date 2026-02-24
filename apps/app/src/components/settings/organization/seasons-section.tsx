"use client";

import { SeasonModal } from "@/components/modals/season-modal";
import {
  DeleteConfirmationDialog,
  EntityTableShell,
  EntityToolbar,
} from "@/components/tables/settings/shared";
import { SeasonsTable, type SeasonListItem } from "@/components/tables/settings/seasons";
import { invalidateSettingsEntityCaches } from "@/lib/settings-entity-cache";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

function toDateOrNull(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

type DeleteDialogState =
  | { mode: "single"; season: SeasonListItem }
  | { mode: "bulk"; ids: string[] }
  | null;

export function SeasonsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [editingSeason, setEditingSeason] = React.useState<SeasonListItem | null>(null);
  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>(null);

  const seasonsQuery = useSuspenseQuery(
    trpc.catalog.seasons.list.queryOptions(undefined),
  );
  const deleteSeasonMutation = useMutation(
    trpc.catalog.seasons.delete.mutationOptions(),
  );

  const allRows = React.useMemo(
    () => seasonsQuery.data?.data ?? [],
    [seasonsQuery.data],
  );

  const filteredRows = React.useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return allRows;

    return allRows.filter((row) => {
      const nameMatch = row.name.toLowerCase().includes(term);
      const startMatch = row.startDate
        ? new Date(row.startDate).toLocaleDateString().toLowerCase().includes(term)
        : false;
      const endMatch = row.endDate
        ? new Date(row.endDate).toLocaleDateString().toLowerCase().includes(term)
        : false;
      return nameMatch || startMatch || endMatch || (row.ongoing && "ongoing".includes(term));
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

  const invalidateLists = React.useCallback(async () => {
    await invalidateSettingsEntityCaches({
      queryClient,
      entityListQueryKey: trpc.catalog.seasons.list.queryKey(undefined),
      compositeCatalogQueryKey: trpc.composite.catalogContent.queryKey(),
    });
  }, [queryClient, trpc]);

  const deleteSeasonNow = React.useCallback(
    async (season: SeasonListItem) => {
      try {
        await deleteSeasonMutation.mutateAsync({ id: season.id });
        toast.success("Season deleted");
        setSelectedIds((prev) => prev.filter((id) => id !== season.id));
        await invalidateLists();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete season";
        toast.error(message);
      }
    },
    [deleteSeasonMutation, invalidateLists],
  );

  const deleteSelectedNow = React.useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const currentIds = [...ids];
    const results = await Promise.allSettled(
      currentIds.map((id) => deleteSeasonMutation.mutateAsync({ id })),
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
      toast.success(`${successes} season${successes === 1 ? "" : "s"} deleted`);
      return;
    }

    if (successes > 0) {
      toast.error(`${failures.length} delete${failures.length === 1 ? "" : "s"} failed`);
    } else {
      const reason = failures[0];
      toast.error(
        reason && reason.status === "rejected" && reason.reason instanceof Error
          ? reason.reason.message
          : "Failed to delete selected seasons",
      );
    }
  }, [deleteSeasonMutation, invalidateLists]);

  const handleDeleteSeason = React.useCallback((season: SeasonListItem) => {
    setDeleteDialog({ mode: "single", season });
  }, []);

  const handleDeleteSelected = React.useCallback(() => {
    if (selectedIds.length === 0) return;
    setDeleteDialog({ mode: "bulk", ids: [...selectedIds] });
  }, [selectedIds]);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteDialog) return;

    const currentDialog = deleteDialog;

    if (currentDialog.mode === "single") {
      await deleteSeasonNow(currentDialog.season);
    } else {
      await deleteSelectedNow(currentDialog.ids);
    }

    setDeleteDialog(null);
  }, [deleteDialog, deleteSeasonNow, deleteSelectedNow]);

  return (
    <div className="w-full max-w-[1200px] h-full min-h-0">
      <EntityTableShell
        title="Seasons"
        toolbar={
          <EntityToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            createLabel="Create season"
            onCreate={() => {
              setEditingSeason(null);
              setIsModalOpen(true);
            }}
            selectedCount={selectedIds.length}
            onDeleteSelected={handleDeleteSelected}
            actionsDisabled={deleteSeasonMutation.isPending}
          />
        }
      >
        <SeasonsTable
          rows={filteredRows}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onCreateSeason={() => {
            setEditingSeason(null);
            setIsModalOpen(true);
          }}
          onEditSeason={(season) => {
            setEditingSeason(season);
            setIsModalOpen(true);
          }}
          onDeleteSeason={handleDeleteSeason}
          hasSearch={searchValue.trim().length > 0}
        />
      </EntityTableShell>

      <SeasonModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            setEditingSeason(null);
          }
        }}
        initialSeason={
          editingSeason
            ? {
                id: editingSeason.id,
                name: editingSeason.name,
                startDate: toDateOrNull(editingSeason.startDate),
                endDate: toDateOrNull(editingSeason.endDate),
                isOngoing: editingSeason.ongoing,
              }
            : undefined
        }
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
            ? `Delete ${deleteDialog.ids.length} season${deleteDialog.ids.length === 1 ? "" : "s"}?`
            : "Delete season?"
        }
        description={
          deleteDialog?.mode === "bulk"
            ? `You are about to permanently delete ${deleteDialog.ids.length} season${deleteDialog.ids.length === 1 ? "" : "s"}. This action cannot be undone.`
            : "You are about to permanently delete this season. This action cannot be undone."
        }
        confirmLabel={
          deleteDialog?.mode === "bulk"
            ? `Delete ${deleteDialog.ids.length} season${deleteDialog.ids.length === 1 ? "" : "s"}`
            : "Delete season"
        }
        onConfirm={handleConfirmDelete}
        isPending={deleteSeasonMutation.isPending}
      />
    </div>
  );
}
