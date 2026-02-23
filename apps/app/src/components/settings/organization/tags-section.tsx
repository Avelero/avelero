"use client";

import { TagsTable, type TagListItem } from "@/components/tables/settings/tags";
import {
  DeleteConfirmationDialog,
  EntityTableShell,
  EntityToolbar,
} from "@/components/tables/settings/shared";
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

type DeleteDialogState =
  | { mode: "single"; tag: TagListItem }
  | { mode: "bulk"; ids: string[] }
  | null;

export function TagsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [createDraftRequestNonce, setCreateDraftRequestNonce] = React.useState<number | null>(null);
  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>(null);

  const tagsQuery = useSuspenseQuery(trpc.catalog.tags.list.queryOptions(undefined));
  const createTagMutation = useMutation(trpc.catalog.tags.create.mutationOptions());
  const deleteTagMutation = useMutation(trpc.catalog.tags.delete.mutationOptions());
  const updateTagMutation = useMutation(trpc.catalog.tags.update.mutationOptions());

  const allRows = React.useMemo(
    () =>
      [...(tagsQuery.data?.data ?? [])].sort((a, b) => {
        const updatedDiff = toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt);
        if (updatedDiff !== 0) return updatedDiff;

        const createdDiff = toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
        if (createdDiff !== 0) return createdDiff;

        return a.name.localeCompare(b.name);
      }),
    [tagsQuery.data],
  );

  const filteredRows = React.useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return allRows;
    return allRows.filter((row) => {
      const nameMatch = row.name.toLowerCase().includes(term);
      const hexMatch = (row.hex ?? "").toLowerCase().includes(term);
      return nameMatch || hexMatch;
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
      entityListQueryKey: trpc.catalog.tags.list.queryKey(undefined),
      compositeCatalogQueryKey: trpc.composite.catalogContent.queryKey(),
    });
  }, [queryClient, trpc]);

  const deleteTagNow = React.useCallback(
    async (tag: TagListItem) => {
      try {
        await deleteTagMutation.mutateAsync({ id: tag.id });
        toast.success("Tag deleted");
        setSelectedIds((prev) => prev.filter((id) => id !== tag.id));
        await invalidateLists();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete tag";
        toast.error(message);
      }
    },
    [deleteTagMutation, invalidateLists],
  );

  const deleteSelectedNow = React.useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const currentIds = [...ids];
    const results = await Promise.allSettled(
      currentIds.map((id) => deleteTagMutation.mutateAsync({ id })),
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
      toast.success(`${successes} tag${successes === 1 ? "" : "s"} deleted`);
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
        : "Failed to delete selected tags",
    );
  }, [deleteTagMutation, invalidateLists]);

  const handleDeleteTag = React.useCallback((tag: TagListItem) => {
    setDeleteDialog({ mode: "single", tag });
  }, []);

  const handleDeleteSelected = React.useCallback(() => {
    if (selectedIds.length === 0) return;
    setDeleteDialog({ mode: "bulk", ids: [...selectedIds] });
  }, [selectedIds]);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteDialog) return;

    const currentDialog = deleteDialog;

    if (currentDialog.mode === "single") {
      await deleteTagNow(currentDialog.tag);
    } else {
      await deleteSelectedNow(currentDialog.ids);
    }

    setDeleteDialog(null);
  }, [deleteDialog, deleteSelectedNow, deleteTagNow]);

  const handleCreateTagInline = React.useCallback(
    async ({ name, hex }: { name: string; hex: string }) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        throw new Error("Tag name is required");
      }

      const duplicate = allRows.some((row) => {
        return row.name.trim().toLowerCase() === trimmedName.toLowerCase();
      });
      if (duplicate) {
        toast.error("A tag with this name already exists");
        throw new Error("A tag with this name already exists");
      }

      await createTagMutation.mutateAsync({
        name: trimmedName,
        hex: hex.replace("#", "").toUpperCase(),
      });

      await invalidateLists();
    },
    [allRows, createTagMutation, invalidateLists],
  );

  const handleUpdateTagName = React.useCallback(
    async (tag: TagListItem, nextName: string) => {
      const trimmedName = nextName.trim();
      if (!trimmedName) {
        toast.error("Tag name is required");
        throw new Error("Tag name is required");
      }

      const duplicate = allRows.some((row) => {
        if (row.id === tag.id) return false;
        return row.name.trim().toLowerCase() === trimmedName.toLowerCase();
      });
      if (duplicate) {
        toast.error("A tag with this name already exists");
        throw new Error("A tag with this name already exists");
      }

      const currentHex = (tag.hex ?? "000000").replace("#", "").toUpperCase();

      await updateTagMutation.mutateAsync({
        id: tag.id,
        name: trimmedName,
        hex: currentHex,
      });

      await invalidateLists();
    },
    [allRows, invalidateLists, updateTagMutation],
  );

  const handleUpdateTagColor = React.useCallback(
    async (tag: TagListItem, nextHex: string) => {
      const normalizedHex = nextHex.replace("#", "").toUpperCase();
      const currentHex = (tag.hex ?? "000000").replace("#", "").toUpperCase();
      if (normalizedHex === currentHex) return;

      const listQueryKey = trpc.catalog.tags.list.queryKey(undefined);
      const compositeQueryKey = trpc.composite.catalogContent.queryKey();
      const previousList = queryClient.getQueryData(listQueryKey);
      const previousComposite = queryClient.getQueryData(compositeQueryKey);

      queryClient.setQueryData(listQueryKey, (old: any) => {
        if (!old?.data) return old;
        return {
          ...old,
          data: old.data.map((row: any) =>
            row.id === tag.id
              ? {
                  ...row,
                  hex: normalizedHex,
                  updatedAt: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                }
              : row,
          ),
        };
      });

      queryClient.setQueryData(compositeQueryKey, (old: any) => {
        if (!old?.brandCatalog?.tags) return old;
        return {
          ...old,
          brandCatalog: {
            ...old.brandCatalog,
            tags: old.brandCatalog.tags.map((row: any) =>
              row.id === tag.id
                ? {
                    ...row,
                    hex: normalizedHex,
                    updated_at: new Date().toISOString(),
                  }
                : row,
            ),
          },
        };
      });

      try {
        await updateTagMutation.mutateAsync({
          id: tag.id,
          name: tag.name,
          hex: normalizedHex,
        });

        await invalidateLists();
      } catch (error) {
        queryClient.setQueryData(listQueryKey, previousList);
        queryClient.setQueryData(compositeQueryKey, previousComposite);

        const message =
          error instanceof Error ? error.message : "Failed to update tag color";
        toast.error(message);
        throw error;
      }
    },
    [invalidateLists, queryClient, trpc, updateTagMutation],
  );

  return (
    <div className="w-full max-w-[1200px] h-full min-h-0">
      <EntityTableShell
        title="Tags"
        toolbar={
          <EntityToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            createLabel="Create tag"
            onCreate={() => setCreateDraftRequestNonce(Date.now())}
            selectedCount={selectedIds.length}
            onDeleteSelected={handleDeleteSelected}
            actionsDisabled={
              createTagMutation.isPending ||
              deleteTagMutation.isPending ||
              updateTagMutation.isPending
            }
          />
        }
      >
        <TagsTable
          rows={filteredRows}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onDeleteTag={handleDeleteTag}
          createDraftRequestNonce={createDraftRequestNonce}
          onCreateTagInline={handleCreateTagInline}
          onUpdateTagName={handleUpdateTagName}
          onUpdateTagColor={handleUpdateTagColor}
          onCreateTag={() => setCreateDraftRequestNonce(Date.now())}
          hasSearch={searchValue.trim().length > 0}
        />
      </EntityTableShell>

      <DeleteConfirmationDialog
        open={deleteDialog !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog(null);
        }}
        title={
          deleteDialog?.mode === "bulk"
            ? `Delete ${deleteDialog.ids.length} tag${deleteDialog.ids.length === 1 ? "" : "s"}?`
            : "Delete tag?"
        }
        description={
          deleteDialog?.mode === "bulk"
            ? `You are about to permanently delete ${deleteDialog.ids.length} tag${deleteDialog.ids.length === 1 ? "" : "s"}. This action cannot be undone.`
            : "You are about to permanently delete this tag. This action cannot be undone."
        }
        confirmLabel={
          deleteDialog?.mode === "bulk"
            ? `Delete ${deleteDialog.ids.length} tag${deleteDialog.ids.length === 1 ? "" : "s"}`
            : "Delete tag"
        }
        onConfirm={handleConfirmDelete}
        isPending={deleteTagMutation.isPending}
      />
    </div>
  );
}
