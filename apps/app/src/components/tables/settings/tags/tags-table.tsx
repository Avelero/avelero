"use client";

import {
  FlatDataTable,
  SettingsTableEmptyState,
} from "@/components/tables/settings/shared";
import { Icons } from "@v1/ui/icons";
import { toast } from "@v1/ui/sonner";
import * as React from "react";
import { getTagColumns } from "./columns";
import {
  type DraftTagListItem,
  isDraftTagListItem,
  type TagListItem,
  type TagsTableRow,
} from "./types";

const DRAFT_TAG_ROW_ID = "__draft_tag_row__";

export function TagsTable({
  rows,
  selectedIds,
  onSelectedIdsChange,
  onDeleteTag,
  createDraftRequestNonce,
  onCreateTagInline,
  onUpdateTagName,
  onUpdateTagColor,
  onCreateTag,
  hasSearch,
}: {
  rows: TagListItem[];
  selectedIds: string[];
  onSelectedIdsChange: (next: string[]) => void;
  onDeleteTag: (tag: TagListItem) => void | Promise<void>;
  createDraftRequestNonce: number | null;
  onCreateTagInline: (input: { name: string; hex: string }) => Promise<void>;
  onUpdateTagName: (tag: TagListItem, nextName: string) => Promise<void>;
  onUpdateTagColor: (tag: TagListItem, nextHex: string) => Promise<void>;
  onCreateTag: () => void;
  hasSearch: boolean;
}) {
  const [editingTagId, setEditingTagId] = React.useState<string | null>(null);
  const [focusRequest, setFocusRequest] = React.useState<{
    tagId: string;
    nonce: number;
  } | null>(null);
  const [draftRow, setDraftRow] = React.useState<DraftTagListItem | null>(null);

  const spawnDraftRow = React.useCallback((focusNonce?: number) => {
    const nonce = focusNonce ?? Date.now();
    setDraftRow({
      id: DRAFT_TAG_ROW_ID,
      __draft: true,
      name: "",
      hex: "000000",
      createdAt: null,
      updatedAt: null,
      products_count: 0,
    });
    setEditingTagId(DRAFT_TAG_ROW_ID);
    setFocusRequest({ tagId: DRAFT_TAG_ROW_ID, nonce });
  }, []);

  React.useEffect(() => {
    if (!editingTagId) return;
    const exists =
      (draftRow?.id === editingTagId) || rows.some((row) => row.id === editingTagId);
    if (!exists) {
      setEditingTagId(null);
    }
  }, [draftRow, editingTagId, rows]);

  React.useEffect(() => {
    if (!createDraftRequestNonce) return;
    setDraftRow((prev) =>
      prev ?? {
        id: DRAFT_TAG_ROW_ID,
        __draft: true,
        name: "",
        hex: "000000",
        createdAt: null,
        updatedAt: null,
        products_count: 0,
      },
    );
    setEditingTagId(DRAFT_TAG_ROW_ID);
    setFocusRequest({ tagId: DRAFT_TAG_ROW_ID, nonce: createDraftRequestNonce });
  }, [createDraftRequestNonce]);

  const tableRows = React.useMemo<TagsTableRow[]>(
    () => (draftRow ? [draftRow, ...rows] : rows),
    [draftRow, rows],
  );

  const handleCommitTagName = React.useCallback(
    async (row: TagsTableRow, nextName: string) => {
      if (isDraftTagListItem(row)) {
        const trimmedName = nextName.trim();
        if (!trimmedName) {
          setDraftRow(null);
          setEditingTagId(null);
          return;
        }

        try {
          await onCreateTagInline({
            name: trimmedName,
            hex: row.hex ?? "000000",
          });
          setDraftRow(null);
          setEditingTagId(null);
        } catch {
          setEditingTagId(row.id);
          setFocusRequest({ tagId: row.id, nonce: Date.now() });
          throw new Error("Failed to create tag");
        }
        return;
      }

      await onUpdateTagName(row, nextName);
    },
    [onCreateTagInline, onUpdateTagName],
  );

  const handleChangeTagColor = React.useCallback(
    async (row: TagsTableRow, nextHex: string) => {
      if (isDraftTagListItem(row)) {
        setDraftRow((prev) =>
          prev && prev.id === row.id
            ? {
                ...prev,
                hex: nextHex.replace("#", "").toUpperCase(),
              }
            : prev,
        );
        return;
      }

      await onUpdateTagColor(row, nextHex);
    },
    [onUpdateTagColor],
  );

  const columns = React.useMemo(
    () =>
      getTagColumns({
        editingTagId,
        onEditingTagIdChange: setEditingTagId,
        focusRequest,
        onFocusRequestConsumed: (tagId) => {
          setFocusRequest((prev) => (prev?.tagId === tagId ? null : prev));
        },
        onCommitTagName: async (tag, nextName) => {
          await handleCommitTagName(tag, nextName);
          if (!isDraftTagListItem(tag)) {
            setEditingTagId(null);
          }
        },
        onUpdateTagColor: handleChangeTagColor,
        onDraftCreateCommittedByEnter: () => {
          spawnDraftRow();
        },
        onDraftEmptyEnter: () => {
          toast.error("Tag name is required");
        },
      }),
    [editingTagId, focusRequest, handleChangeTagColor, handleCommitTagName, spawnDraftRow],
  );

  return (
    <FlatDataTable
      rows={tableRows}
      rowKey={(row) => row.id}
      columns={columns}
      selectedIds={selectedIds}
      onSelectedIdsChange={onSelectedIdsChange}
      getRowActions={(row) => [
        ...(isDraftTagListItem(row)
          ? []
          : [
              {
                label: "Edit",
                icon: <Icons.Pencil className="h-[14px] w-[14px]" />,
                onSelect: () => {
                  setEditingTagId(row.id);
                  setFocusRequest({ tagId: row.id, nonce: Date.now() });
                },
              },
              {
                label: "Delete",
                icon: <Icons.Trash2 className="h-[14px] w-[14px]" />,
                destructive: true,
                onSelect: () => onDeleteTag(row),
              },
            ]),
      ]}
      emptyState={
        <SettingsTableEmptyState
          title={hasSearch ? "No tags found" : "No tags yet"}
          description={
            hasSearch
              ? "Try a different search term."
              : "Create your first tag to classify products."
          }
          actionLabel={hasSearch ? undefined : "Create tag"}
          onAction={hasSearch ? undefined : onCreateTag}
        />
      }
    />
  );
}
