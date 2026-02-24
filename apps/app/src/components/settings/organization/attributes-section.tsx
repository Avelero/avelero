"use client";

import { AttributesTable, type AttributeGroupListItem, type AttributeValueListItem } from "@/components/tables/settings/attributes";
import {
  DeleteConfirmationDialog,
  EntityTableShell,
  EntityToolbar,
} from "@/components/tables/settings/shared";
import {
  useBrandCatalog,
  type TaxonomyAttribute,
  type TaxonomyValue,
} from "@/hooks/use-brand-catalog";
import { invalidateSettingsEntityCaches } from "@/lib/settings-entity-cache";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

type DeleteDialogState =
  | { mode: "single-group"; group: AttributeGroupListItem }
  | { mode: "single-value"; group: AttributeGroupListItem; value: AttributeValueListItem }
  | { mode: "bulk"; groupIds: string[]; valueIds: string[] }
  | null;

function toTimestamp(value?: string | Date | null) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function matchesTerm(value: unknown, term: string) {
  if (value == null) return false;
  return String(value).toLowerCase().includes(term);
}

export function AttributesSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { taxonomyAttributes, taxonomyValuesByAttribute } = useBrandCatalog();

  const [searchValue, setSearchValue] = React.useState("");
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  const [selectedValueIds, setSelectedValueIds] = React.useState<string[]>([]);
  const [createGroupDraftRequestNonce, setCreateGroupDraftRequestNonce] = React.useState<number | null>(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = React.useState<Set<string>>(new Set());
  const hasInitializedCollapsedGroups = React.useRef(false);
  const seenGroupIds = React.useRef<Set<string>>(new Set());
  const lastDeleteDialogRef = React.useRef<DeleteDialogState>(null);
  const [deleteDialog, setDeleteDialog] = React.useState<DeleteDialogState>(null);

  const attributesQuery = useSuspenseQuery(trpc.catalog.attributes.listGrouped.queryOptions(undefined));

  const createAttributeMutation = useMutation(trpc.catalog.attributes.create.mutationOptions());
  const updateAttributeMutation = useMutation(trpc.catalog.attributes.update.mutationOptions());
  const deleteAttributeMutation = useMutation(trpc.catalog.attributes.delete.mutationOptions());

  const createValueMutation = useMutation(trpc.catalog.attributeValues.create.mutationOptions());
  const updateValueMutation = useMutation(trpc.catalog.attributeValues.update.mutationOptions());
  const deleteValueMutation = useMutation(trpc.catalog.attributeValues.delete.mutationOptions());

  const allGroups = React.useMemo(() => {
    const groups = attributesQuery.data?.data ?? [];
    return [...groups]
      .map((group) => ({
        ...group,
        values: [...group.values].sort((a, b) => {
          const createdDiff = toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
          if (createdDiff !== 0) return createdDiff;
          const nameDiff = a.name.localeCompare(b.name);
          if (nameDiff !== 0) return nameDiff;
          return a.id.localeCompare(b.id);
        }),
      }))
      .sort((a, b) => {
        const createdDiff = toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
        if (createdDiff !== 0) return createdDiff;
        const nameDiff = a.name.localeCompare(b.name);
        if (nameDiff !== 0) return nameDiff;
        return a.id.localeCompare(b.id);
      });
  }, [attributesQuery.data]);

  const groupById = React.useMemo(
    () => new Map<string, AttributeGroupListItem>(allGroups.map((group) => [group.id, group])),
    [allGroups],
  );

  const valueById = React.useMemo(
    () =>
      new Map<string, AttributeValueListItem>(
        allGroups.flatMap((group) =>
          group.values.map((value: AttributeValueListItem) => [value.id, value] as const),
        ),
      ),
    [allGroups],
  );

  const filteredGroups = React.useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) return allGroups;

    const filtered: AttributeGroupListItem[] = [];
    for (const group of allGroups) {
      const groupMatch =
        matchesTerm(group.name, term) ||
        matchesTerm(group.taxonomyAttribute?.name, term) ||
        matchesTerm(group.taxonomyAttribute?.friendlyId, term);

      const matchingValues = group.values.filter(
        (value: AttributeValueListItem) =>
          matchesTerm(value.name, term) ||
          matchesTerm(value.taxonomyValue?.name, term) ||
          matchesTerm(value.taxonomyValue?.friendlyId, term),
      );

      if (!groupMatch && matchingValues.length === 0) continue;

      filtered.push({
        ...group,
        values: groupMatch ? group.values : matchingValues,
      });
    }

    return filtered;
  }, [allGroups, searchValue]);

  const effectiveCollapsed = React.useMemo(
    () => (searchValue.trim() ? new Set<string>() : collapsedGroupIds),
    [collapsedGroupIds, searchValue],
  );

  React.useEffect(() => {
    const allowed = new Set(allGroups.map((group) => group.id));
    setSelectedGroupIds((prev) => {
      const next = prev.filter((id) => allowed.has(id));
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [allGroups]);

  React.useEffect(() => {
    if (deleteDialog) {
      lastDeleteDialogRef.current = deleteDialog;
    }
  }, [deleteDialog]);

  React.useEffect(() => {
    const allowed = new Set(
      allGroups.flatMap((group) =>
        group.values.map((value: AttributeValueListItem) => value.id),
      ),
    );
    setSelectedValueIds((prev) => {
      const next = prev.filter((id) => allowed.has(id));
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [allGroups]);

  React.useEffect(() => {
    const allowed = new Set(allGroups.map((group) => group.id));

    setCollapsedGroupIds((prev) => {
      if (allowed.size === 0) {
        seenGroupIds.current = new Set();
        return prev.size === 0 ? prev : new Set<string>();
      }

      if (!hasInitializedCollapsedGroups.current) {
        hasInitializedCollapsedGroups.current = true;
        seenGroupIds.current = new Set(allowed);
        return new Set(allowed);
      }

      let changed = false;
      const next = new Set<string>();

      for (const id of prev) {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      }

      // Only collapse truly new groups. Expanded groups are intentionally absent
      // from `prev`, so we must track previously seen IDs separately.
      for (const id of allowed) {
        if (!seenGroupIds.current.has(id)) {
          next.add(id);
          changed = true;
        }
      }

      seenGroupIds.current = new Set(allowed);
      return changed ? next : prev;
    });
  }, [allGroups]);

  const invalidateLists = React.useCallback(async () => {
    await invalidateSettingsEntityCaches({
      queryClient,
      entityListQueryKey: trpc.catalog.attributes.listGrouped.queryKey(undefined),
      compositeCatalogQueryKey: trpc.composite.catalogContent.queryKey(),
    });
    await queryClient.invalidateQueries({
      queryKey: trpc.catalog.attributes.list.queryKey(undefined),
    });
  }, [queryClient, trpc]);

  const patchAttributesGroupedCache = React.useCallback(
    (
      updater: (
        groups: AttributeGroupListItem[],
      ) => AttributeGroupListItem[],
    ) => {
      const queryKey = trpc.catalog.attributes.listGrouped.queryKey(undefined);
      const previous = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old?.data || !Array.isArray(old.data)) return old;
        return {
          ...old,
          data: updater(old.data as AttributeGroupListItem[]),
        };
      });

      return { queryKey, previous };
    },
    [queryClient, trpc],
  );

  const toggleGroup = React.useCallback((groupId: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const deleteGroupNow = React.useCallback(
    async (group: AttributeGroupListItem) => {
      try {
        await deleteAttributeMutation.mutateAsync({ id: group.id });
        await invalidateLists();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete attribute");
      }
    },
    [deleteAttributeMutation, invalidateLists],
  );

  const deleteValueNow = React.useCallback(
    async (_group: AttributeGroupListItem, value: AttributeValueListItem) => {
      try {
        await deleteValueMutation.mutateAsync({ id: value.id });
        setSelectedValueIds((prev) => prev.filter((id) => id !== value.id));
        await invalidateLists();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete value");
      }
    },
    [deleteValueMutation, invalidateLists],
  );

  const deleteSelectedNow = React.useCallback(async (groupIds: string[], valueIds: string[]) => {
    if (valueIds.length === 0 && groupIds.length === 0) return;

    const valueResults = await Promise.allSettled(
      valueIds.map((id) => deleteValueMutation.mutateAsync({ id })),
    );
    const groupResults = await Promise.allSettled(
      groupIds.map((id) => deleteAttributeMutation.mutateAsync({ id })),
    );

    const failedValueIds = valueResults.flatMap((result, index) =>
      result.status === "rejected" ? [valueIds[index]!] : [],
    );
    const failedGroupIds = groupResults.flatMap((result, index) =>
      result.status === "rejected" ? [groupIds[index]!] : [],
    );

    const valueSuccesses = valueResults.length - failedValueIds.length;
    const groupSuccesses = groupResults.length - failedGroupIds.length;
    const totalSuccesses = valueSuccesses + groupSuccesses;
    const totalFailures = failedValueIds.length + failedGroupIds.length;

    if (totalSuccesses > 0) {
      setSelectedValueIds(failedValueIds);
      setSelectedGroupIds(failedGroupIds);
      await invalidateLists();
    }

    if (totalFailures === 0) {
      setSelectedValueIds([]);
      setSelectedGroupIds([]);
      return;
    }

    if (totalSuccesses > 0) {
      toast.error(`${totalFailures} delete${totalFailures === 1 ? "" : "s"} failed`);
      return;
    }

    const firstFailure =
      valueResults.find((result) => result.status === "rejected") ??
      groupResults.find((result) => result.status === "rejected");

    toast.error(
      firstFailure &&
        firstFailure.status === "rejected" &&
        firstFailure.reason instanceof Error
        ? firstFailure.reason.message
        : "Failed to delete selected items",
    );
  }, [deleteAttributeMutation, deleteValueMutation, invalidateLists]);

  const handleDeleteGroup = React.useCallback((group: AttributeGroupListItem) => {
    setDeleteDialog({ mode: "single-group", group });
  }, []);

  const handleDeleteValue = React.useCallback(
    (group: AttributeGroupListItem, value: AttributeValueListItem) => {
      setDeleteDialog({ mode: "single-value", group, value });
    },
    [],
  );

  const handleDeleteSelected = React.useCallback(() => {
    if (selectedValueIds.length === 0 && selectedGroupIds.length === 0) return;
    setDeleteDialog({
      mode: "bulk",
      groupIds: [...selectedGroupIds],
      valueIds: [...selectedValueIds],
    });
  }, [selectedGroupIds, selectedValueIds]);

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteDialog) return;

    const currentDialog = deleteDialog;

    if (currentDialog.mode === "single-group" && (currentDialog.group.variants_count ?? 0) > 0) {
      setDeleteDialog(null);
      return;
    }

    if (
      currentDialog.mode === "single-value" &&
      (currentDialog.value.variants_count ?? 0) > 0
    ) {
      setDeleteDialog(null);
      return;
    }

    if (currentDialog.mode === "bulk") {
      const hasBlockedGroups = currentDialog.groupIds.some((id) => {
        const group = groupById.get(id);
        return (group?.variants_count ?? 0) > 0;
      });
      const hasBlockedValues = currentDialog.valueIds.some((id) => {
        const value = valueById.get(id);
        return (value?.variants_count ?? 0) > 0;
      });
      if (hasBlockedGroups || hasBlockedValues) {
        setDeleteDialog(null);
        return;
      }
    }

    if (currentDialog.mode === "single-group") {
      await deleteGroupNow(currentDialog.group);
    } else if (currentDialog.mode === "single-value") {
      await deleteValueNow(currentDialog.group, currentDialog.value);
    } else {
      await deleteSelectedNow(currentDialog.groupIds, currentDialog.valueIds);
    }

    setDeleteDialog(null);
  }, [deleteDialog, deleteGroupNow, deleteSelectedNow, deleteValueNow, groupById, valueById]);

  const selectedItemCount = selectedGroupIds.length + selectedValueIds.length;
  const isDeletePending = deleteValueMutation.isPending || deleteAttributeMutation.isPending;

  const handleCreateGroupInline = React.useCallback(
    async (input: { name: string; taxonomyAttributeId?: string | null }) => {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        toast.error("Attribute name is required");
        throw new Error("Attribute name is required");
      }

      const duplicate = allGroups.some(
        (group) => group.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );
      if (duplicate) {
        toast.error("An attribute with this name already exists");
        throw new Error("An attribute with this name already exists");
      }

      try {
        const result = await createAttributeMutation.mutateAsync({
          name: trimmedName,
          taxonomy_attribute_id: input.taxonomyAttributeId ?? null,
        });
        await invalidateLists();
        return result.data?.id ?? null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create attribute";
        toast.error(message);
        throw error;
      }
    },
    [allGroups, createAttributeMutation, invalidateLists],
  );

  const handleCreateValueInline = React.useCallback(
    async (
      group: AttributeGroupListItem,
      input: { name: string; taxonomyValueId?: string | null },
    ) => {
      const trimmedName = input.name.trim();
      if (!trimmedName) {
        toast.error("Attribute value name is required");
        throw new Error("Attribute value name is required");
      }

      const duplicate = group.values.some(
        (value: AttributeValueListItem) =>
          value.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );
      if (duplicate) {
        toast.error("A value with this name already exists in this attribute");
        throw new Error("A value with this name already exists in this attribute");
      }

      try {
        const result = await createValueMutation.mutateAsync({
          attribute_id: group.id,
          name: trimmedName,
          taxonomy_value_id: input.taxonomyValueId ?? null,
        });
        await invalidateLists();
        return result.data?.id ?? null;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create value";
        toast.error(message);
        throw error;
      }
    },
    [createValueMutation, invalidateLists],
  );

  const handleRenameGroup = React.useCallback(
    async (group: AttributeGroupListItem, nextName: string) => {
      const optimistic = patchAttributesGroupedCache((groups) =>
        groups.map((item) =>
          item.id === group.id
            ? {
                ...item,
                name: nextName,
              }
            : item,
        ),
      );
      try {
        await updateAttributeMutation.mutateAsync({
          id: group.id,
          name: nextName,
        });
      } catch (error) {
        queryClient.setQueryData(optimistic.queryKey, optimistic.previous);
        toast.error(error instanceof Error ? error.message : "Failed to rename attribute");
        throw error;
      }
      try {
        await invalidateLists();
      } catch {
        // Keep optimistic state if server mutation succeeded but refetch failed.
      }
    },
    [invalidateLists, patchAttributesGroupedCache, queryClient, updateAttributeMutation],
  );

  const handleRenameValue = React.useCallback(
    async (_group: AttributeGroupListItem, value: AttributeValueListItem, nextName: string) => {
      const optimistic = patchAttributesGroupedCache((groups) =>
        groups.map((item) => ({
          ...item,
          values: item.values.map((entry: AttributeValueListItem) =>
            entry.id === value.id
              ? {
                  ...entry,
                  name: nextName,
                }
              : entry,
          ),
        })),
      );
      try {
        await updateValueMutation.mutateAsync({
          id: value.id,
          name: nextName,
        });
      } catch (error) {
        queryClient.setQueryData(optimistic.queryKey, optimistic.previous);
        toast.error(error instanceof Error ? error.message : "Failed to rename value");
        throw error;
      }
      try {
        await invalidateLists();
      } catch {
        // Keep optimistic state if server mutation succeeded but refetch failed.
      }
    },
    [invalidateLists, patchAttributesGroupedCache, queryClient, updateValueMutation],
  );

  const handleUpdateGroupTaxonomyLink = React.useCallback(
    async (group: AttributeGroupListItem, taxonomyAttributeId: string | null) => {
      const selectedTaxonomyAttribute = taxonomyAttributes.find(
        (attribute) => attribute.id === taxonomyAttributeId,
      );
      const optimistic = patchAttributesGroupedCache((groups) =>
        groups.map((item) =>
          item.id === group.id
            ? {
                ...item,
                taxonomyAttributeId,
                taxonomyAttribute: taxonomyAttributeId
                  ? {
                      id: selectedTaxonomyAttribute?.id ?? taxonomyAttributeId,
                      name: selectedTaxonomyAttribute?.name ?? item.taxonomyAttribute?.name ?? "",
                      friendlyId:
                        selectedTaxonomyAttribute?.friendlyId ??
                        item.taxonomyAttribute?.friendlyId ??
                        "",
                    }
                  : null,
              }
            : item,
        ),
      );
      try {
        await updateAttributeMutation.mutateAsync({
          id: group.id,
          taxonomy_attribute_id: taxonomyAttributeId,
        });
      } catch (error) {
        queryClient.setQueryData(optimistic.queryKey, optimistic.previous);
        toast.error(error instanceof Error ? error.message : "Failed to update standard link");
        throw error;
      }
      try {
        await invalidateLists();
      } catch {
        // Keep optimistic state if server mutation succeeded but refetch failed.
      }
    },
    [
      invalidateLists,
      patchAttributesGroupedCache,
      queryClient,
      taxonomyAttributes,
      updateAttributeMutation,
    ],
  );

  const handleUpdateValueTaxonomyLink = React.useCallback(
    async (
      group: AttributeGroupListItem,
      value: AttributeValueListItem,
      taxonomyValueId: string | null,
    ) => {
      const selectedTaxonomyValue = group.taxonomyAttributeId
        ? (taxonomyValuesByAttribute.get(group.taxonomyAttributeId) ?? []).find(
            (entry: TaxonomyValue) => entry.id === taxonomyValueId,
          )
        : null;
      const optimistic = patchAttributesGroupedCache((groups) =>
        groups.map((item) => ({
          ...item,
          values: item.values.map((entry: AttributeValueListItem) =>
            entry.id === value.id
              ? {
                  ...entry,
                  taxonomyValueId,
                  taxonomyValue: taxonomyValueId
                    ? {
                        id: selectedTaxonomyValue?.id ?? taxonomyValueId,
                        name: selectedTaxonomyValue?.name ?? entry.taxonomyValue?.name ?? "",
                        friendlyId:
                          selectedTaxonomyValue?.friendlyId ??
                          entry.taxonomyValue?.friendlyId ??
                          "",
                        metadata:
                          selectedTaxonomyValue?.metadata ??
                          entry.taxonomyValue?.metadata ??
                          null,
                      }
                    : null,
                }
              : entry,
          ),
        })),
      );
      try {
        await updateValueMutation.mutateAsync({
          id: value.id,
          taxonomy_value_id: taxonomyValueId,
        });
      } catch (error) {
        queryClient.setQueryData(optimistic.queryKey, optimistic.previous);
        toast.error(error instanceof Error ? error.message : "Failed to update standard link");
        throw error;
      }
      try {
        await invalidateLists();
      } catch {
        // Keep optimistic state if server mutation succeeded but refetch failed.
      }
    },
    [
      invalidateLists,
      patchAttributesGroupedCache,
      queryClient,
      taxonomyValuesByAttribute,
      updateValueMutation,
    ],
  );

  const displayDeleteDialog = deleteDialog ?? lastDeleteDialogRef.current;

  const deleteDialogBlockState = React.useMemo(() => {
    if (!displayDeleteDialog) {
      return {
        blocked: false,
        blockedGroupCount: 0,
        blockedValueCount: 0,
      };
    }

    if (displayDeleteDialog.mode === "single-group") {
      return {
        blocked: (displayDeleteDialog.group.variants_count ?? 0) > 0,
        blockedGroupCount: (displayDeleteDialog.group.variants_count ?? 0) > 0 ? 1 : 0,
        blockedValueCount: 0,
      };
    }

    if (displayDeleteDialog.mode === "single-value") {
      return {
        blocked: (displayDeleteDialog.value.variants_count ?? 0) > 0,
        blockedGroupCount: 0,
        blockedValueCount: (displayDeleteDialog.value.variants_count ?? 0) > 0 ? 1 : 0,
      };
    }

    let blockedGroupCount = 0;
    let blockedValueCount = 0;
    for (const groupId of displayDeleteDialog.groupIds) {
      const group = groupById.get(groupId);
      if ((group?.variants_count ?? 0) > 0) blockedGroupCount += 1;
    }
    for (const valueId of displayDeleteDialog.valueIds) {
      const value = valueById.get(valueId);
      if ((value?.variants_count ?? 0) > 0) blockedValueCount += 1;
    }
    return {
      blocked: blockedGroupCount + blockedValueCount > 0,
      blockedGroupCount,
      blockedValueCount,
    };
  }, [displayDeleteDialog, groupById, valueById]);

  const deleteDialogCopy = React.useMemo(() => {
    if (!displayDeleteDialog) {
      return {
        title: "Delete item?",
        description:
          "You are about to permanently delete this item. This action cannot be undone.",
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        hideConfirm: false,
      };
    }

    if (displayDeleteDialog.mode === "single-group") {
      if (deleteDialogBlockState.blocked) {
        return {
          title: "Attribute can't be deleted",
          description:
            "This attribute can't be deleted because it is referenced on your variants.",
          confirmLabel: "Delete attribute",
          cancelLabel: "Close",
          hideConfirm: true,
        };
      }
      return {
        title: "Delete attribute?",
        description:
          "You are about to permanently delete this attribute. This action cannot be undone.",
        confirmLabel: "Delete attribute",
        cancelLabel: "Cancel",
        hideConfirm: false,
      };
    }

    if (displayDeleteDialog.mode === "single-value") {
      if (deleteDialogBlockState.blocked) {
        return {
          title: "Attribute value can't be deleted",
          description:
            "This attribute value can't be deleted because it is referenced on your variants.",
          confirmLabel: "Delete value",
          cancelLabel: "Close",
          hideConfirm: true,
        };
      }
      return {
        title: "Delete value?",
        description:
          "You are about to permanently delete this value. This action cannot be undone.",
        confirmLabel: "Delete value",
        cancelLabel: "Cancel",
        hideConfirm: false,
      };
    }

    const groupCount = displayDeleteDialog.groupIds.length;
    const valueCount = displayDeleteDialog.valueIds.length;
    const totalCount = groupCount + valueCount;

    if (deleteDialogBlockState.blocked) {
      const parts: string[] = [];
      if (deleteDialogBlockState.blockedGroupCount > 0) {
        parts.push(
          `${deleteDialogBlockState.blockedGroupCount} attribute${deleteDialogBlockState.blockedGroupCount === 1 ? "" : "s"}`,
        );
      }
      if (deleteDialogBlockState.blockedValueCount > 0) {
        parts.push(
          `${deleteDialogBlockState.blockedValueCount} value${deleteDialogBlockState.blockedValueCount === 1 ? "" : "s"}`,
        );
      }
      const totalBlocked =
        deleteDialogBlockState.blockedGroupCount +
        deleteDialogBlockState.blockedValueCount;
      return {
        title: "Selected items can't be deleted",
        description: `${parts.join(" and ")} ${totalBlocked === 1 ? "is" : "are"} referenced on your variants and can't be deleted.`,
        confirmLabel: `Delete ${totalCount} item${totalCount === 1 ? "" : "s"}`,
        cancelLabel: "Close",
        hideConfirm: true,
      };
    }

    let breakdown = "";
    if (groupCount > 0 && valueCount > 0) {
      breakdown = ` (${groupCount} attribute${groupCount === 1 ? "" : "s"} and ${valueCount} value${valueCount === 1 ? "" : "s"})`;
    } else if (groupCount > 0) {
      breakdown = ` (${groupCount} attribute${groupCount === 1 ? "" : "s"})`;
    } else if (valueCount > 0) {
      breakdown = ` (${valueCount} value${valueCount === 1 ? "" : "s"})`;
    }

    return {
      title: `Delete ${totalCount} item${totalCount === 1 ? "" : "s"}?`,
      description: `You are about to permanently delete ${totalCount} selected item${totalCount === 1 ? "" : "s"}${breakdown}. This action cannot be undone.`,
      confirmLabel: `Delete ${totalCount} item${totalCount === 1 ? "" : "s"}`,
      cancelLabel: "Cancel",
      hideConfirm: false,
    };
  }, [displayDeleteDialog, deleteDialogBlockState]);

  return (
    <div className="h-full min-h-0 w-full max-w-[1200px]">
      <EntityTableShell
        title="Attributes"
        toolbar={
          <EntityToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            createAction={
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() => setCreateGroupDraftRequestNonce(Date.now())}
                >
                  <Icons.Plus className="h-[14px] w-[14px]" />
                  <span className="px-1">New attribute</span>
                </Button>
              </div>
            }
            selectedCount={selectedItemCount}
            onDeleteSelected={handleDeleteSelected}
            actionsDisabled={deleteValueMutation.isPending || deleteAttributeMutation.isPending}
          />
        }
      >
        <AttributesTable
          groups={filteredGroups}
          collapsedGroupIds={effectiveCollapsed}
          onToggleGroup={toggleGroup}
          selectedGroupIds={selectedGroupIds}
          selectedValueIds={selectedValueIds}
          onSelectedGroupIdsChange={setSelectedGroupIds}
          onSelectedValueIdsChange={setSelectedValueIds}
          onCreateGroup={() => setCreateGroupDraftRequestNonce(Date.now())}
          createGroupDraftRequestNonce={createGroupDraftRequestNonce}
          onCreateGroupInline={handleCreateGroupInline}
          taxonomyAttributes={taxonomyAttributes as TaxonomyAttribute[]}
          taxonomyValuesByAttribute={taxonomyValuesByAttribute}
          onCreateValueInline={handleCreateValueInline}
          onDeleteGroup={handleDeleteGroup}
          onDeleteValue={handleDeleteValue}
          onRenameGroup={handleRenameGroup}
          onRenameValue={handleRenameValue}
          onUpdateGroupTaxonomyLink={handleUpdateGroupTaxonomyLink}
          onUpdateValueTaxonomyLink={handleUpdateValueTaxonomyLink}
          hasSearch={searchValue.trim().length > 0}
        />
      </EntityTableShell>

      <DeleteConfirmationDialog
        open={deleteDialog !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog(null);
        }}
        title={deleteDialogCopy.title}
        description={deleteDialogCopy.description}
        confirmLabel={deleteDialogCopy.confirmLabel}
        cancelLabel={deleteDialogCopy.cancelLabel}
        hideConfirm={deleteDialogCopy.hideConfirm}
        onConfirm={handleConfirmDelete}
        isPending={isDeletePending}
      />
    </div>
  );
}
