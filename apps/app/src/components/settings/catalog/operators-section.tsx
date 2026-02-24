"use client";

import { type OperatorData, OperatorSheet } from "@/components/sheets/operator-sheet";
import {
  DeleteConfirmationDialog,
  EntityTableShell,
  EntityToolbar,
} from "@/components/tables/settings/shared";
import { OperatorsTable, type OperatorListItem } from "@/components/tables/settings/operators";
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

function mapOperatorToSheetData(operator: OperatorListItem | null): OperatorData | undefined {
  if (!operator) return undefined;

  return {
    id: operator.id,
    name: operator.display_name,
    legalName: operator.legal_name ?? undefined,
    email: operator.email ?? undefined,
    phone: operator.phone ?? undefined,
    website: operator.website ?? undefined,
    addressLine1: operator.address_line_1 ?? undefined,
    addressLine2: operator.address_line_2 ?? undefined,
    city: operator.city ?? undefined,
    state: operator.state ?? undefined,
    zip: operator.zip ?? undefined,
    countryCode: operator.country_code ?? undefined,
  };
}

type DeleteDialogState =
  | { mode: "single"; operator: OperatorListItem }
  | { mode: "bulk"; ids: string[] }
  | null;

export function OperatorsSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [editingOperator, setEditingOperator] = React.useState<OperatorListItem | null>(null);
  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>(null);

  const operatorsQuery = useSuspenseQuery(trpc.catalog.operators.list.queryOptions(undefined));
  const deleteOperatorMutation = useMutation(trpc.catalog.operators.delete.mutationOptions());

  const allRows = React.useMemo(
    () =>
      [...(operatorsQuery.data?.data ?? [])].sort((a, b) => {
        const updatedDiff = toTimestamp(b.updated_at) - toTimestamp(a.updated_at);
        if (updatedDiff !== 0) return updatedDiff;

        const createdDiff = toTimestamp(b.created_at) - toTimestamp(a.created_at);
        if (createdDiff !== 0) return createdDiff;

        return a.display_name.localeCompare(b.display_name);
      }),
    [operatorsQuery.data],
  );

  const filteredRows = React.useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return allRows;

    return allRows.filter((row) =>
      [
        row.display_name,
        row.legal_name,
        row.email,
        row.city,
        row.state,
        row.country_code,
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
    if (!editingOperator) return;
    const exists = allRows.some((row) => row.id === editingOperator.id);
    if (!exists) setEditingOperator(null);
  }, [allRows, editingOperator]);

  const invalidateLists = React.useCallback(async () => {
    await invalidateSettingsEntityCaches({
      queryClient,
      entityListQueryKey: trpc.catalog.operators.list.queryKey(undefined),
      compositeCatalogQueryKey: trpc.composite.catalogContent.queryKey(),
    });
  }, [queryClient, trpc]);

  const deleteOperatorNow = React.useCallback(
    async (operator: OperatorListItem) => {
      try {
        await deleteOperatorMutation.mutateAsync({ id: operator.id });
        setSelectedIds((prev) => prev.filter((id) => id !== operator.id));
        await invalidateLists();
        toast.success("Operator deleted");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete operator";
        toast.error(message);
      }
    },
    [deleteOperatorMutation, invalidateLists],
  );

  const deleteSelectedNow = React.useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;

    const currentIds = [...ids];
    const results = await Promise.allSettled(
      currentIds.map((id) => deleteOperatorMutation.mutateAsync({ id })),
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
      toast.success(`${successes} operator${successes === 1 ? "" : "s"} deleted`);
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
        : "Failed to delete selected operators",
    );
  }, [deleteOperatorMutation, invalidateLists]);

  const handleDeleteOperator = React.useCallback((operator: OperatorListItem) => {
    setDeleteDialog({ mode: "single", operator });
  }, []);

  const handleDeleteSelected = React.useCallback(() => {
    if (selectedIds.length === 0) return;
    setDeleteDialog({ mode: "bulk", ids: [...selectedIds] });
  }, [selectedIds]);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteDialog) return;

    const currentDialog = deleteDialog;

    if (currentDialog.mode === "single") {
      await deleteOperatorNow(currentDialog.operator);
    } else {
      await deleteSelectedNow(currentDialog.ids);
    }

    setDeleteDialog(null);
  }, [deleteDialog, deleteOperatorNow, deleteSelectedNow]);

  return (
    <div className="h-full min-h-0 w-full max-w-[1200px]">
      <EntityTableShell
        title="Operators"
        toolbar={
          <EntityToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            createLabel="Create operator"
            onCreate={() => {
              setEditingOperator(null);
              setIsSheetOpen(true);
            }}
            selectedCount={selectedIds.length}
            onDeleteSelected={handleDeleteSelected}
            actionsDisabled={deleteOperatorMutation.isPending}
          />
        }
      >
        <OperatorsTable
          rows={filteredRows}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          onCreateOperator={() => {
            setEditingOperator(null);
            setIsSheetOpen(true);
          }}
          onEditOperator={(operator) => {
            setEditingOperator(operator);
            setIsSheetOpen(true);
          }}
          onDeleteOperator={handleDeleteOperator}
          hasSearch={searchValue.trim().length > 0}
        />
      </EntityTableShell>

      <OperatorSheet
        open={isSheetOpen}
        onOpenChange={(open) => {
          setIsSheetOpen(open);
          if (!open) setEditingOperator(null);
        }}
        initialOperator={mapOperatorToSheetData(editingOperator)}
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
            ? `Delete ${deleteDialog.ids.length} operator${deleteDialog.ids.length === 1 ? "" : "s"}?`
            : "Delete operator?"
        }
        description={
          deleteDialog?.mode === "bulk"
            ? `You are about to permanently delete ${deleteDialog.ids.length} operator${deleteDialog.ids.length === 1 ? "" : "s"}. This action cannot be undone.`
            : "You are about to permanently delete this operator. This action cannot be undone."
        }
        confirmLabel={
          deleteDialog?.mode === "bulk"
            ? `Delete ${deleteDialog.ids.length} operator${deleteDialog.ids.length === 1 ? "" : "s"}`
            : "Delete operator"
        }
        onConfirm={handleConfirmDelete}
        isPending={deleteOperatorMutation.isPending}
      />
    </div>
  );
}
