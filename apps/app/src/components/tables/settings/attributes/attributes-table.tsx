"use client";

import { useTableScroll } from "@/hooks/use-table-scroll";
import {
  RowActionsMenu,
  RowSelectionCheckbox,
  SettingsTableEmptyState,
  type RowAction,
} from "@/components/tables/settings/shared";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import { format } from "date-fns";
import * as React from "react";
import type { AttributeGroupListItem, AttributeValueListItem } from "./types";

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "d MMM yyyy");
}

function extractHex(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  if (typeof m.swatch === "string") return m.swatch;
  if (typeof m.hex === "string") {
    return m.hex.startsWith("#") ? m.hex : `#${m.hex}`;
  }
  return null;
}

// Opaque equivalent for our soft border tone. Using a fixed opaque color here
// avoids visible darkening where the elbow overlays the vertical connector line.
const ATTRIBUTE_VALUE_CONNECTOR_COLOR = "#d8d8d8";

type FlatRow =
  | { kind: "group"; group: AttributeGroupListItem }
  | {
      kind: "value";
      group: AttributeGroupListItem;
      value: AttributeValueListItem;
      indexInGroup: number;
      visibleGroupValueCount: number;
    };

type EditingTarget =
  | { kind: "group"; id: string }
  | { kind: "value"; id: string }
  | null;

type FocusRequest = { id: string; nonce: number } | null;

function InlineNameField({
  id,
  value,
  isEditing,
  focusRequest,
  onFocusRequestConsumed,
  onEditingChange,
  onCommit,
  textClassName,
  placeholder,
}: {
  id: string;
  value: string;
  isEditing: boolean;
  focusRequest: FocusRequest;
  onFocusRequestConsumed: (id: string) => void;
  onEditingChange: (editing: boolean) => void;
  onCommit: (nextName: string) => Promise<void>;
  textClassName?: string;
  placeholder?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [draftName, setDraftName] = React.useState(value);
  const [hovered, setHovered] = React.useState(false);
  const isCommittingRef = React.useRef(false);

  React.useEffect(() => {
    setDraftName(value);
  }, [value]);

  React.useEffect(() => {
    if (!focusRequest || focusRequest.id !== id) return;
    const input = inputRef.current;
    if (!input) return;

    requestAnimationFrame(() => {
      input.focus();
      const length = input.value.length;
      input.setSelectionRange(length, length);
      onFocusRequestConsumed(id);
    });
  }, [focusRequest, id, onFocusRequestConsumed]);

  const commit = React.useCallback(async () => {
    if (isCommittingRef.current) return;
    const trimmed = draftName.trim();
    const current = value.trim();

    if (!trimmed || trimmed === current) {
      setDraftName(value);
      onEditingChange(false);
      return;
    }

    isCommittingRef.current = true;
    try {
      await onCommit(trimmed);
      setDraftName(trimmed);
      onEditingChange(false);
    } catch {
      setDraftName(value);
      onEditingChange(false);
    } finally {
      isCommittingRef.current = false;
    }
  }, [draftName, onCommit, onEditingChange, value]);

  const showInputShell = isEditing || hovered;

  return (
    <div
      className="relative inline-grid min-w-[200px] w-fit max-w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        aria-hidden
        className={cn(
          "invisible inline-flex h-8 min-w-[200px] max-w-full items-center whitespace-pre border border-transparent px-2",
          textClassName ?? "type-p text-primary",
        )}
      >
        {draftName || value || placeholder || " "}
      </span>

      <input
        ref={inputRef}
        type="text"
        value={draftName}
        onChange={(event) => setDraftName(event.target.value)}
        onFocus={() => onEditingChange(true)}
        onBlur={() => void commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            setDraftName(value);
            onEditingChange(false);
            event.currentTarget.blur();
          }
        }}
        className={cn(
          "absolute inset-0 h-8 w-full min-w-[200px] max-w-full px-2 outline-none focus:outline-none box-border border bg-transparent",
          textClassName ?? "type-p text-primary",
          showInputShell ? "border-border bg-background" : "border-transparent",
        )}
        aria-label={placeholder ?? "Name"}
        placeholder={placeholder}
      />
    </div>
  );
}

export function AttributesTable({
  groups,
  collapsedGroupIds,
  onToggleGroup,
  selectedGroupIds,
  selectedValueIds,
  onSelectedGroupIdsChange,
  onSelectedValueIdsChange,
  onCreateGroup,
  onDeleteGroup,
  onAddValue,
  onDeleteValue,
  onRenameGroup,
  onRenameValue,
  hasSearch,
}: {
  groups: AttributeGroupListItem[];
  collapsedGroupIds: Set<string>;
  onToggleGroup: (groupId: string) => void;
  selectedGroupIds: string[];
  selectedValueIds: string[];
  onSelectedGroupIdsChange: (next: string[]) => void;
  onSelectedValueIdsChange: (next: string[]) => void;
  onCreateGroup: () => void;
  onDeleteGroup: (group: AttributeGroupListItem) => void | Promise<void>;
  onAddValue: (group: AttributeGroupListItem) => void;
  onDeleteValue: (group: AttributeGroupListItem, value: AttributeValueListItem) => void | Promise<void>;
  onRenameGroup: (group: AttributeGroupListItem, nextName: string) => Promise<void>;
  onRenameValue: (group: AttributeGroupListItem, value: AttributeValueListItem, nextName: string) => Promise<void>;
  hasSearch: boolean;
}) {
  const selectedGroupSet = React.useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
  const selectedSet = React.useMemo(() => new Set(selectedValueIds), [selectedValueIds]);
  const [lastClickedChildIndex, setLastClickedChildIndex] = React.useState<number | null>(null);
  const [editingTarget, setEditingTarget] = React.useState<EditingTarget>(null);
  const [focusRequest, setFocusRequest] = React.useState<FocusRequest>(null);

  const flatRows = React.useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    for (const group of groups) {
      rows.push({ kind: "group", group });
      if (!collapsedGroupIds.has(group.id)) {
        const values = group.values;
        values.forEach((value: AttributeValueListItem, index: number) => {
          rows.push({
            kind: "value",
            group,
            value,
            indexInGroup: index,
            visibleGroupValueCount: values.length,
          });
        });
      }
    }
    return rows;
  }, [groups, collapsedGroupIds]);

  const visibleChildRows = React.useMemo(
    () => flatRows.filter((row): row is Extract<FlatRow, { kind: "value" }> => row.kind === "value"),
    [flatRows],
  );
  const visibleGroupRows = React.useMemo(
    () => flatRows.filter((row): row is Extract<FlatRow, { kind: "group" }> => row.kind === "group"),
    [flatRows],
  );
  const visibleGroupIds = React.useMemo(() => visibleGroupRows.map((row) => row.group.id), [visibleGroupRows]);
  const visibleChildIds = React.useMemo(() => visibleChildRows.map((row) => row.value.id), [visibleChildRows]);
  const childIndexById = React.useMemo(() => {
    const map = new Map<string, number>();
    visibleChildRows.forEach((row, index) => map.set(row.value.id, index));
    return map;
  }, [visibleChildRows]);

  const selectableVisibleCount = visibleGroupIds.length + visibleChildIds.length;
  const allSelected =
    selectableVisibleCount > 0 &&
    visibleGroupIds.every((id) => selectedGroupSet.has(id)) &&
    visibleChildIds.every((id) => selectedSet.has(id));
  const someSelected =
    visibleGroupIds.some((id) => selectedGroupSet.has(id)) ||
    visibleChildIds.some((id) => selectedSet.has(id));
  const hasAnySelection = allSelected || someSelected;

  const {
    containerRef,
    canScrollLeft,
    canScrollRight,
    isScrollable,
    scrollLeft,
    scrollRight,
  } = useTableScroll({
    useColumnWidths: true,
    startFromColumn: 1,
    scrollAmount: 120,
    scrollBehavior: "smooth",
    enableKeyboardNavigation: true,
  });

  const toggleValue = React.useCallback(
    (id: string, checked: boolean) => {
      const next = new Set(selectedSet);
      if (checked) next.add(id);
      else next.delete(id);
      onSelectedValueIdsChange(Array.from(next));
    },
    [onSelectedValueIdsChange, selectedSet],
  );

  const toggleGroup = React.useCallback(
    (id: string, checked: boolean) => {
      const next = new Set(selectedGroupSet);
      if (checked) next.add(id);
      else next.delete(id);
      onSelectedGroupIdsChange(Array.from(next));
    },
    [onSelectedGroupIdsChange, selectedGroupSet],
  );

  const handleValueSelectionChange = React.useCallback(
    (valueId: string, checked: boolean, shiftKey: boolean) => {
      const rowIndex = childIndexById.get(valueId);
      if (rowIndex == null) return;

      if (!shiftKey) {
        toggleValue(valueId, checked);
        setLastClickedChildIndex(rowIndex);
        return;
      }

      if (lastClickedChildIndex == null) {
        toggleValue(valueId, checked);
        setLastClickedChildIndex(rowIndex);
        return;
      }

      const start = Math.min(lastClickedChildIndex, rowIndex);
      const end = Math.max(lastClickedChildIndex, rowIndex);
      const idsInRange = visibleChildIds.slice(start, end + 1);
      setLastClickedChildIndex(rowIndex);
      if (!idsInRange.length) return;

      const next = new Set(selectedSet);
      for (const id of idsInRange) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      onSelectedValueIdsChange(Array.from(next));
    },
    [childIndexById, lastClickedChildIndex, onSelectedValueIdsChange, selectedSet, toggleValue, visibleChildIds],
  );

  const toggleAllVisible = React.useCallback(
    (checked: boolean) => {
      const nextGroups = new Set(selectedGroupSet);
      const next = new Set(selectedSet);
      for (const id of visibleGroupIds) {
        if (checked) nextGroups.add(id);
        else nextGroups.delete(id);
      }
      for (const id of visibleChildIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      onSelectedGroupIdsChange(Array.from(nextGroups));
      onSelectedValueIdsChange(Array.from(next));
    },
    [onSelectedGroupIdsChange, onSelectedValueIdsChange, selectedGroupSet, selectedSet, visibleChildIds, visibleGroupIds],
  );

  if (groups.length === 0) {
    return (
      <SettingsTableEmptyState
        title={hasSearch ? "No attributes found" : "No attributes yet"}
        description={
          hasSearch
            ? "Try a different search term."
            : "Create your first attribute group to manage variant dimensions."
        }
        actionLabel={hasSearch ? undefined : "New group"}
        onAction={hasSearch ? undefined : onCreateGroup}
      />
    );
  }

  return (
    <div className="relative w-full h-full min-h-0">
      <div
        ref={containerRef}
        className="relative w-full h-fit min-h-0 max-h-full max-w-full overflow-x-auto overflow-y-auto border border-border bg-background scrollbar-hide"
      >
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="h-14 border-b border-border">
              {["Name", "Values", "Variants", "Standard link", "Created"].map((header, columnIndex) => {
                const isFirstColumn = columnIndex === 0;
                const stickyFirstColumnClass = isFirstColumn
                  ? "sticky left-0 z-[12] bg-background border-r-0 before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-accent-dark"
                  : undefined;
                const widthClass =
                  columnIndex === 0
                    ? "min-w-[360px]"
                    : columnIndex === 1
                      ? "w-[120px] min-w-[120px] max-w-[120px]"
                    : columnIndex === 2
                      ? "w-[120px] min-w-[120px] max-w-[120px]"
                    : columnIndex === 3
                      ? "w-[260px] min-w-[260px] max-w-[260px]"
                      : "w-[240px] min-w-[240px] max-w-[240px]";

                return (
                  <TableHead
                    key={header}
                    className={cn(
                      "relative h-14 px-4 align-middle text-secondary type-p bg-background",
                      stickyFirstColumnClass,
                      widthClass,
                    )}
                  >
                    {isFirstColumn ? (
                      <div className="flex items-center justify-between gap-4 min-w-0">
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <div className="flex-shrink-0">
                            <RowSelectionCheckbox
                              checked={allSelected}
                              indeterminate={someSelected && !allSelected}
                              onChange={() => toggleAllVisible(!hasAnySelection)}
                              ariaLabel="Select all attributes and values"
                              hitArea="header"
                            />
                          </div>
                          <div className="min-w-0 flex-1">{header}</div>
                        </div>
                        {isScrollable ? (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-label="Scroll left"
                              onClick={(event) => {
                                event.preventDefault();
                                scrollLeft();
                              }}
                              disabled={!canScrollLeft}
                            >
                              <Icons.ChevronLeft className="h-[14px] w-[14px]" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              aria-label="Scroll right"
                              onClick={(event) => {
                                event.preventDefault();
                                scrollRight();
                              }}
                              disabled={!canScrollRight}
                            >
                              <Icons.ChevronRight className="h-[14px] w-[14px]" />
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {flatRows.map((row, flatRowIndex) => {
              if (row.kind === "group") {
                const group = row.group;
                const groupActions: RowAction[] = [
                  {
                    label: "Add value",
                    icon: <Icons.Plus className="h-[14px] w-[14px]" />,
                    onSelect: () => onAddValue(group),
                  },
                  {
                    label: "Edit",
                    icon: <Icons.Pencil className="h-[14px] w-[14px]" />,
                    onSelect: () => {
                      setEditingTarget({ kind: "group", id: group.id });
                      setFocusRequest({ id: `group:${group.id}`, nonce: Date.now() });
                    },
                  },
                  {
                    label: "Delete",
                    icon: <Icons.Trash2 className="h-[14px] w-[14px]" />,
                    destructive: true,
                    onSelect: () => onDeleteGroup(group),
                  },
                ];

                const isGroupSelected = selectedGroupSet.has(group.id);
                const isGroupEditing =
                  editingTarget?.kind === "group" && editingTarget.id === group.id;
                const isExpandedWithVisibleValues =
                  !collapsedGroupIds.has(group.id) && group.values.length > 0;

                return (
                  <TableRow
                    key={group.id}
                    data-state={isGroupSelected ? "selected" : undefined}
                    className="group h-14 bg-background hover:bg-accent-light data-[state=selected]:bg-accent-blue"
                  >
                    <TableCell
                      className={cn(
                        "relative h-14 px-4 py-0 align-middle sticky left-0 z-[8] border-r-0 before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-accent-dark after:absolute after:left-0 after:bottom-0 after:h-px after:w-[120px] after:bg-background group-hover:after:bg-accent-light group-data-[state=selected]:after:bg-accent-blue bg-background group-hover:bg-accent-light group-data-[state=selected]:bg-accent-blue min-w-[360px]",
                        isExpandedWithVisibleValues && "border-b-transparent",
                      )}
                    >
                      <div className="flex h-full items-center gap-4 min-w-0">
                        <div className="flex-shrink-0">
                          <RowSelectionCheckbox
                            checked={isGroupSelected}
                            onChange={(checked) => toggleGroup(group.id, checked)}
                            ariaLabel={`Select attribute ${group.name}`}
                            hitArea="row"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => onToggleGroup(group.id)}
                          className="flex h-6 w-6 items-center justify-center text-secondary hover:text-primary hover:bg-accent"
                          aria-label={collapsedGroupIds.has(group.id) ? `Expand ${group.name}` : `Collapse ${group.name}`}
                        >
                          {collapsedGroupIds.has(group.id) ? (
                            <Icons.ChevronRight className="h-4 w-4" />
                          ) : (
                            <Icons.ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        <div className="min-w-0 flex-1">
                          <InlineNameField
                            id={`group:${group.id}`}
                            value={group.name}
                            isEditing={isGroupEditing}
                            focusRequest={focusRequest}
                            onFocusRequestConsumed={(id) => {
                              if (id === `group:${group.id}`) {
                                setFocusRequest((prev) => (prev?.id === `group:${group.id}` ? null : prev));
                              }
                            }}
                            onEditingChange={(editing) =>
                              setEditingTarget(editing ? { kind: "group", id: group.id } : null)
                            }
                            onCommit={(nextName) => onRenameGroup(group, nextName)}
                            textClassName="type-p text-primary"
                            placeholder="Attribute name"
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="h-14 px-4 py-0 align-middle w-[120px] min-w-[120px] max-w-[120px]">
                      <span className="whitespace-nowrap type-p text-primary">{group.values_count ?? group.values.length}</span>
                    </TableCell>
                    <TableCell className="h-14 px-4 py-0 align-middle w-[120px] min-w-[120px] max-w-[120px]">
                      <span className="whitespace-nowrap type-p text-primary">{group.variants_count ?? 0}</span>
                    </TableCell>
                    <TableCell className="h-14 px-4 py-0 align-middle w-[260px] min-w-[260px] max-w-[260px]">
                      <span className="block truncate whitespace-nowrap type-p text-primary">
                        {group.taxonomyAttribute?.name ?? ""}
                      </span>
                    </TableCell>
                    <TableCell className="h-14 px-4 py-0 align-middle w-[240px] min-w-[240px] max-w-[240px]">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="whitespace-nowrap type-p text-primary">{formatDate(group.createdAt)}</span>
                        <div className="w-[30px] flex-shrink-0 flex justify-end">
                          <RowActionsMenu actions={groupActions} triggerClassName="opacity-0 group-hover:opacity-100" />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }

              const { group, value } = row;
              const isSelected = selectedSet.has(value.id);
              const isValueEditing =
                editingTarget?.kind === "value" && editingTarget.id === value.id;
              const valueActions: RowAction[] = [
                {
                  label: "Edit",
                  icon: <Icons.Pencil className="h-[14px] w-[14px]" />,
                  onSelect: () => {
                    setEditingTarget({ kind: "value", id: value.id });
                    setFocusRequest({ id: `value:${value.id}`, nonce: Date.now() });
                  },
                },
                {
                  label: "Delete",
                  icon: <Icons.Trash2 className="h-[14px] w-[14px]" />,
                  destructive: true,
                  onSelect: () => onDeleteValue(group, value),
                },
              ];
              const swatch = extractHex(value.taxonomyValue?.metadata);
              const isFirstValue = row.indexInGroup === 0;
              const isLastValue = row.indexInGroup === row.visibleGroupValueCount - 1;
              const isLastFlatRow = flatRowIndex === flatRows.length - 1;

              return (
                <TableRow
                  key={value.id}
                  data-state={isSelected ? "selected" : undefined}
                  className="group h-14 hover:bg-accent-light data-[state=selected]:bg-accent-blue"
                >
                  <TableCell
                    className="relative h-14 px-4 py-0 align-middle sticky left-0 z-[8] border-b-transparent border-r-0 before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-accent-dark bg-background group-hover:bg-accent-light group-data-[state=selected]:bg-accent-blue min-w-[360px]"
                  >
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute left-0 top-0 h-px w-[120px] bg-background group-hover:bg-accent-light group-data-[state=selected]:bg-accent-blue"
                    />
                    <div className="flex h-full items-center gap-4 min-w-0">
                      <div className="flex-shrink-0">
                        <RowSelectionCheckbox
                          checked={isSelected}
                          onChange={(checked, meta) =>
                            handleValueSelectionChange(value.id, checked, meta?.shiftKey ?? false)
                          }
                          ariaLabel={`Select value ${value.name}`}
                          hitArea="row"
                        />
                      </div>
                      <div className="flex h-full items-stretch gap-4 min-w-0 flex-1">
                        <div
                          className="relative h-14 w-6 shrink-0"
                          aria-hidden="true"
                          style={{ color: ATTRIBUTE_VALUE_CONNECTOR_COLOR }}
                        >
                          <div
                            className={cn(
                              "absolute left-1/2 w-px -translate-x-1/2",
                              isLastValue ? "top-0 bottom-[39px]" : "top-0 -bottom-px",
                            )}
                            style={{ backgroundColor: ATTRIBUTE_VALUE_CONNECTOR_COLOR }}
                          />
                          <svg
                            className="absolute left-1/2 top-1/2 -translate-x-[0.5px] -translate-y-[11px]"
                            width="10"
                            height="9"
                            viewBox="0 0 10 9"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M0.5 0.5v1c0 2.5 2.212 3.546 2.212 3.546l6.525 3.514"
                              stroke="currentColor"
                              strokeWidth="1"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <div className="flex h-full items-stretch gap-3 min-w-0 flex-1">
                          {swatch ? (
                            <div
                              className="h-3.5 w-3.5 shrink-0 self-center rounded-full border border-border"
                              style={{ backgroundColor: swatch }}
                              aria-hidden="true"
                            />
                          ) : null}
                          <div className="relative flex h-full min-w-0 flex-1 items-center self-stretch">
                            {isFirstValue ? (
                              <div
                                aria-hidden="true"
                                className="pointer-events-none absolute left-0 right-[-15px] -top-px h-px bg-border"
                              />
                            ) : null}
                            {!isLastValue && !isLastFlatRow ? (
                              <div
                                aria-hidden="true"
                                className="pointer-events-none absolute -bottom-px left-0 right-[-15px] h-px bg-border"
                              />
                            ) : null}
                            <InlineNameField
                              id={`value:${value.id}`}
                              value={value.name}
                              isEditing={isValueEditing}
                              focusRequest={focusRequest}
                              onFocusRequestConsumed={(id) => {
                                if (id === `value:${value.id}`) {
                                  setFocusRequest((prev) => (prev?.id === `value:${value.id}` ? null : prev));
                                }
                              }}
                              onEditingChange={(editing) =>
                                setEditingTarget(editing ? { kind: "value", id: value.id } : null)
                              }
                              onCommit={(nextName) => onRenameValue(group, value, nextName)}
                              placeholder="Value name"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    {isLastValue && !isLastFlatRow ? (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -bottom-px left-0 right-px h-px bg-border"
                      />
                    ) : null}
                  </TableCell>
                  <TableCell className="h-14 px-4 py-0 align-middle w-[120px] min-w-[120px] max-w-[120px]" />
                  <TableCell className="h-14 px-4 py-0 align-middle w-[120px] min-w-[120px] max-w-[120px]">
                    <span className="whitespace-nowrap type-p text-primary">{value.variants_count ?? 0}</span>
                  </TableCell>
                  <TableCell className="h-14 px-4 py-0 align-middle w-[260px] min-w-[260px] max-w-[260px]">
                    <span className="block truncate whitespace-nowrap type-p text-primary">
                      {value.taxonomyValue?.name ?? ""}
                    </span>
                  </TableCell>
                  <TableCell className="h-14 px-4 py-0 align-middle w-[240px] min-w-[240px] max-w-[240px]">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                      <span className="whitespace-nowrap type-p text-primary">{formatDate(value.createdAt)}</span>
                      <div className="w-[30px] flex-shrink-0 flex justify-end">
                        <RowActionsMenu actions={valueActions} triggerClassName="opacity-0 group-hover:opacity-100" />
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
