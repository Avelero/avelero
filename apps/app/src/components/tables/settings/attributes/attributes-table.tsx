"use client";

import type { TaxonomyAttribute, TaxonomyValue } from "@/hooks/use-brand-catalog";
import { useTableScroll } from "@/hooks/use-table-scroll";
import {
  RowActionsMenu,
  RowSelectionCheckbox,
  SettingsTableEmptyState,
  type RowAction,
} from "@/components/tables/settings/shared";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { toast } from "@v1/ui/sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@v1/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@v1/ui/tooltip";
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
const DRAFT_GROUP_ID = "__draft_attribute_group__";
const DRAFT_GROUP_FOCUS_ID = `group:${DRAFT_GROUP_ID}`;
const DRAFT_VALUE_ROW_PREFIX = "__draft_attribute_value__";

type FlatRow =
  | { kind: "group"; group: AttributeGroupListItem }
  | { kind: "draft-group"; id: string; nonce: number }
  | { kind: "draft-value"; group: AttributeGroupListItem; nonce: number }
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
  | { kind: "draft-group" }
  | { kind: "draft-value"; groupId: string }
  | null;

type FocusRequest = { id: string; nonce: number } | null;
type CommitTrigger = "enter" | "blur";

function draftValueFocusId(groupId: string) {
  return `draft-value:${groupId}`;
}

function InlineNameField({
  id,
  value,
  isEditing,
  focusRequest,
  onFocusRequestConsumed,
  onEditingChange,
  onCommit,
  onEmptyCommit,
  onCommitError,
  keepEditingOnError = false,
  textClassName,
  placeholder,
}: {
  id: string;
  value: string;
  isEditing: boolean;
  focusRequest: FocusRequest;
  onFocusRequestConsumed: (id: string) => void;
  onEditingChange: (editing: boolean) => void;
  onCommit: (nextName: string, meta: { trigger: CommitTrigger }) => Promise<void>;
  onEmptyCommit?: (meta: { trigger: CommitTrigger }) => "keep-open" | undefined;
  onCommitError?: () => void;
  keepEditingOnError?: boolean;
  textClassName?: string;
  placeholder?: string;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [draftName, setDraftName] = React.useState(value);
  const [hovered, setHovered] = React.useState(false);
  const [suppressHoverUntilPointerMove, setSuppressHoverUntilPointerMove] = React.useState(false);
  const isCommittingRef = React.useRef(false);
  const submitTriggerRef = React.useRef<CommitTrigger | null>(null);

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

  const hideHoverShellUntilPointerMoves = React.useCallback(() => {
    setHovered(false);
    setSuppressHoverUntilPointerMove(true);
  }, []);

  const commit = React.useCallback(async () => {
    if (isCommittingRef.current) return;
    const trigger = submitTriggerRef.current ?? "blur";
    submitTriggerRef.current = null;
    const trimmed = draftName.trim();
    const current = value.trim();

    if (!trimmed) {
      setDraftName(value);
      const emptyResult = onEmptyCommit?.({ trigger });
      if (emptyResult === "keep-open") {
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
        return;
      }
      if (trigger === "enter") {
        hideHoverShellUntilPointerMoves();
      }
      onEditingChange(false);
      return;
    }

    if (trimmed === current) {
      setDraftName(value);
      if (trigger === "enter") {
        hideHoverShellUntilPointerMoves();
      }
      onEditingChange(false);
      return;
    }

    isCommittingRef.current = true;
    const closeImmediatelyOnEnter = trigger === "enter";
    if (closeImmediatelyOnEnter) {
      hideHoverShellUntilPointerMoves();
      onEditingChange(false);
    }
    try {
      await onCommit(trimmed, { trigger });
      setDraftName(trimmed);
      if (!closeImmediatelyOnEnter) {
        onEditingChange(false);
      }
    } catch {
      setDraftName(value);
      onCommitError?.();
      if (!keepEditingOnError) {
        onEditingChange(false);
      }
    } finally {
      isCommittingRef.current = false;
    }
  }, [
    draftName,
    hideHoverShellUntilPointerMoves,
    keepEditingOnError,
    onCommit,
    onCommitError,
    onEditingChange,
    onEmptyCommit,
    value,
  ]);

  const showInputShell = isEditing || hovered;

  return (
    <div
      className="relative inline-grid min-w-[200px] w-fit max-w-full"
      onMouseEnter={() => {
        setSuppressHoverUntilPointerMove(false);
        setHovered(true);
      }}
      onMouseMove={() => {
        if (!suppressHoverUntilPointerMove) return;
        setSuppressHoverUntilPointerMove(false);
        setHovered(true);
      }}
      onMouseLeave={() => {
        setSuppressHoverUntilPointerMove(false);
        setHovered(false);
      }}
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
            submitTriggerRef.current = "enter";
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

interface LinkOption {
  id: string;
  label: string;
  hex?: string | null;
}

function InlineLinkPicker({
  value,
  placeholder,
  options,
  disabled = false,
  disabledLabel,
  disabledReason,
  onChange,
}: {
  value: string | null;
  placeholder: string;
  options: LinkOption[];
  disabled?: boolean;
  disabledLabel?: string;
  disabledReason?: string;
  onChange: (nextId: string | null) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);
  const [isTriggerHovered, setIsTriggerHovered] = React.useState(false);
  const [activeCommandItemValue, setActiveCommandItemValue] = React.useState("");
  const [isPointerSelectionArmed, setIsPointerSelectionArmed] = React.useState(false);
  const popoverContentRef = React.useRef<HTMLDivElement | null>(null);

  const selected = React.useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const filteredOptions = React.useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => option.label.toLowerCase().includes(term));
  }, [options, searchQuery]);

  const selectedCommandItemValue = React.useMemo(() => {
    if (!value) return "";
    return options.some((option) => option.id === value) ? value : "";
  }, [options, value]);

  const handleSelect = React.useCallback(
    async (nextId: string | null) => {
      if (isPending) return;
      const isDeselectingCurrent = Boolean(nextId && value && nextId === value);
      const resolvedNextId = isDeselectingCurrent ? null : nextId;

      if (!isDeselectingCurrent) {
        setOpen(false);
        setSearchQuery("");
      }
      if (isDeselectingCurrent) {
        setActiveCommandItemValue("");
      }

      setIsPending(true);
      try {
        await onChange(resolvedNextId);
      } finally {
        setIsPending(false);
      }
    },
    [isPending, onChange, value],
  );

  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setIsPointerSelectionArmed(false);
      return;
    }
    setSearchQuery("");
    setActiveCommandItemValue(selectedCommandItemValue);
    setIsPointerSelectionArmed(false);
  }, [open, selectedCommandItemValue]);

  React.useEffect(() => {
    if (!open) return;
    let rafA = 0;
    let rafB = 0;
    let rafC = 0;
    let timeoutA: number | null = null;
    let timeoutB: number | null = null;

    const centerSelectedItem = () => {
      const container = popoverContentRef.current;
      if (!container) return;

      const list = container.querySelector<HTMLElement>("[cmdk-list]");
      const selectedNode = container.querySelector<HTMLElement>(
        '[data-selected-link-item="true"]',
      );

      if (!list || !selectedNode) return;

      // Compute item position relative to the scroll container and center it.
      let offsetTop = selectedNode.offsetTop;
      let currentParent = selectedNode.offsetParent as HTMLElement | null;
      while (currentParent && currentParent !== list) {
        offsetTop += currentParent.offsetTop;
        currentParent = currentParent.offsetParent as HTMLElement | null;
      }

      const targetScrollTop =
        offsetTop - (list.clientHeight / 2 - selectedNode.offsetHeight / 2);
      const maxScrollTop = Math.max(0, list.scrollHeight - list.clientHeight);
      const nextScrollTop = Math.min(maxScrollTop, Math.max(0, targetScrollTop));

      list.scrollTop = nextScrollTop;
    };

    rafA = requestAnimationFrame(() => {
      rafB = requestAnimationFrame(centerSelectedItem);
    });

    // cmdk may apply its own "nearest" scroll after open/selection; re-center after that.
    timeoutA = window.setTimeout(() => {
      rafC = requestAnimationFrame(centerSelectedItem);
    }, 0);
    timeoutB = window.setTimeout(centerSelectedItem, 80);

    return () => {
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
      cancelAnimationFrame(rafC);
      if (timeoutA != null) {
        window.clearTimeout(timeoutA);
      }
      if (timeoutB != null) {
        window.clearTimeout(timeoutB);
      }
    };
  }, [open, selectedCommandItemValue, filteredOptions.length]);

  const showTriggerHighlight = !disabled && (isTriggerHovered || open);

  const handleCommandListPointerMoveCapture = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isPointerSelectionArmed) {
        setIsPointerSelectionArmed(true);
      }

      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const item = target.closest<HTMLElement>('[cmdk-item=""]');
      const hoveredValue = item?.getAttribute("data-value");
      if (hoveredValue && hoveredValue !== activeCommandItemValue) {
        setActiveCommandItemValue(hoveredValue);
      }
    },
    [activeCommandItemValue, isPointerSelectionArmed],
  );

  const triggerContent = (
    <button
      type="button"
      onMouseDown={(event) => {
        // Avoid stealing focus from inline name editors while opening the popover.
        event.preventDefault();
      }}
      onMouseEnter={() => setIsTriggerHovered(true)}
      onMouseLeave={() => setIsTriggerHovered(false)}
      disabled={!disabled && isPending}
      aria-disabled={disabled ? "true" : undefined}
      tabIndex={disabled ? -1 : undefined}
      className={cn(
        "inline-flex max-w-full items-center py-1 text-left rounded",
        disabled ? "cursor-default" : "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "truncate border-b type-p transition-colors",
          disabled
            ? "border-border/40 text-tertiary opacity-55"
            : selected
              ? cn(
                  "border-border text-primary",
                  showTriggerHighlight && "border-secondary text-secondary",
                )
              : cn(
                  "border-border text-tertiary",
                  showTriggerHighlight && "border-secondary text-secondary",
                ),
        )}
      >
        {disabled ? (disabledLabel ?? placeholder) : (selected?.label ?? placeholder)}
      </span>
    </button>
  );

  if (disabled) {
    return (
      <TooltipProvider delayDuration={120}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="flex h-full items-center"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              aria-disabled="true"
            >
              {triggerContent}
            </span>
          </TooltipTrigger>
          {disabledReason ? (
            <TooltipContent side="top" sideOffset={4}>
              {disabledReason}
            </TooltipContent>
          ) : null}
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{triggerContent}</PopoverTrigger>
      <PopoverContent
        ref={popoverContentRef}
        className="p-0 w-[260px] max-w-[260px]"
        align="start"
        sideOffset={4}
      >
        <Command
          shouldFilter={false}
          disablePointerSelection={!isPointerSelectionArmed}
          value={activeCommandItemValue}
          onValueChange={setActiveCommandItemValue}
        >
          <CommandInput
            placeholder="Search..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList
            className="max-h-56"
            onPointerMoveCapture={handleCommandListPointerMoveCapture}
          >
            <CommandGroup>
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  disabled={isPending}
                  onSelect={() => void handleSelect(option.id)}
                  className="justify-between"
                  data-selected-link-item={value === option.id ? "true" : undefined}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {option.hex ? (
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: option.hex }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <span className="truncate type-p">{option.label}</span>
                  </div>
                  {value === option.id ? <Icons.Check className="h-4 w-4 text-brand" /> : null}
                </CommandItem>
              ))}
            </CommandGroup>
            {filteredOptions.length === 0 ? <CommandEmpty>No options found.</CommandEmpty> : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
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
  createGroupDraftRequestNonce,
  onCreateGroupInline,
  taxonomyAttributes,
  taxonomyValuesByAttribute,
  onCreateValueInline,
  onDeleteGroup,
  onDeleteValue,
  onRenameGroup,
  onRenameValue,
  onUpdateGroupTaxonomyLink,
  onUpdateValueTaxonomyLink,
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
  createGroupDraftRequestNonce: number | null;
  onCreateGroupInline: (input: { name: string }) => Promise<string | null>;
  taxonomyAttributes: TaxonomyAttribute[];
  taxonomyValuesByAttribute: Map<string, TaxonomyValue[]>;
  onCreateValueInline: (
    group: AttributeGroupListItem,
    input: { name: string; taxonomyValueId?: string | null },
  ) => Promise<string | null>;
  onDeleteGroup: (group: AttributeGroupListItem) => void | Promise<void>;
  onDeleteValue: (group: AttributeGroupListItem, value: AttributeValueListItem) => void | Promise<void>;
  onRenameGroup: (group: AttributeGroupListItem, nextName: string) => Promise<void>;
  onRenameValue: (group: AttributeGroupListItem, value: AttributeValueListItem, nextName: string) => Promise<void>;
  onUpdateGroupTaxonomyLink: (group: AttributeGroupListItem, taxonomyAttributeId: string | null) => Promise<void>;
  onUpdateValueTaxonomyLink: (
    group: AttributeGroupListItem,
    value: AttributeValueListItem,
    taxonomyValueId: string | null,
  ) => Promise<void>;
  hasSearch: boolean;
}) {
  const selectedGroupSet = React.useMemo(() => new Set(selectedGroupIds), [selectedGroupIds]);
  const selectedSet = React.useMemo(() => new Set(selectedValueIds), [selectedValueIds]);
  const [lastClickedChildIndex, setLastClickedChildIndex] = React.useState<number | null>(null);
  const [editingTarget, setEditingTarget] = React.useState<EditingTarget>(null);
  const [focusRequest, setFocusRequest] = React.useState<FocusRequest>(null);
  const [hasDraftGroup, setHasDraftGroup] = React.useState(false);
  const [draftGroupNonce, setDraftGroupNonce] = React.useState(0);
  const [draftValue, setDraftValue] = React.useState<{
    groupId: string;
    nonce: number;
    taxonomyValueId: string | null;
  } | null>(null);

  React.useEffect(() => {
    if (!createGroupDraftRequestNonce) return;
    setHasDraftGroup(true);
    setDraftGroupNonce(createGroupDraftRequestNonce);
    setEditingTarget({ kind: "draft-group" });
    setFocusRequest({ id: DRAFT_GROUP_FOCUS_ID, nonce: createGroupDraftRequestNonce });
  }, [createGroupDraftRequestNonce]);

  React.useEffect(() => {
    if (!draftValue) return;
    const exists = groups.some((group) => group.id === draftValue.groupId);
    if (!exists) {
      setDraftValue(null);
      setEditingTarget((prev) =>
        prev?.kind === "draft-value" && prev.groupId === draftValue.groupId ? null : prev,
      );
    }
  }, [draftValue, groups]);

  const startDraftValue = React.useCallback(
    (group: AttributeGroupListItem, options?: { focus?: boolean }) => {
      if (collapsedGroupIds.has(group.id)) {
        onToggleGroup(group.id);
      }

      const next = { groupId: group.id, nonce: Date.now() };
      const nextState = { ...next, taxonomyValueId: null };
      setDraftValue(nextState);

      if (options?.focus ?? true) {
        setEditingTarget({ kind: "draft-value", groupId: group.id });
        setFocusRequest({ id: draftValueFocusId(group.id), nonce: nextState.nonce });
      }
    },
    [collapsedGroupIds, onToggleGroup],
  );

  const flatRows = React.useMemo<FlatRow[]>(() => {
    const rows: FlatRow[] = [];
    if (hasDraftGroup) {
      rows.push({ kind: "draft-group", id: DRAFT_GROUP_ID, nonce: draftGroupNonce });
    }
    for (const group of groups) {
      rows.push({ kind: "group", group });
      if (draftValue && draftValue.groupId === group.id) {
        rows.push({ kind: "draft-value", group, nonce: draftValue.nonce });
      }
      const isExpanded = !collapsedGroupIds.has(group.id) || draftValue?.groupId === group.id;
      if (isExpanded) {
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
  }, [collapsedGroupIds, draftGroupNonce, draftValue, groups, hasDraftGroup]);

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
  const childIdsByGroupId = React.useMemo(() => {
    const map = new Map<string, string[]>();
    for (const group of groups) {
      map.set(
        group.id,
        group.values.map((value: AttributeValueListItem) => value.id),
      );
    }
    return map;
  }, [groups]);

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

  const applyValueSelection = React.useCallback(
    (nextValues: Set<string>) => {
      const nextGroups = new Set(selectedGroupSet);

      // Parent selection implies all children are selected; if any child is
      // deselected later, clear the parent while preserving sibling children.
      for (const [groupId, childIds] of childIdsByGroupId) {
        if (childIds.length === 0) continue;
        const allChildrenSelected = childIds.every((id) => nextValues.has(id));
        if (allChildrenSelected) nextGroups.add(groupId);
        else nextGroups.delete(groupId);
      }

      onSelectedGroupIdsChange(Array.from(nextGroups));
      onSelectedValueIdsChange(Array.from(nextValues));
    },
    [childIdsByGroupId, onSelectedGroupIdsChange, onSelectedValueIdsChange, selectedGroupSet],
  );

  const toggleValue = React.useCallback(
    (id: string, checked: boolean) => {
      const next = new Set(selectedSet);
      if (checked) next.add(id);
      else next.delete(id);
      applyValueSelection(next);
    },
    [applyValueSelection, selectedSet],
  );

  const toggleGroup = React.useCallback(
    (id: string, checked: boolean) => {
      const next = new Set(selectedGroupSet);
      const nextValues = new Set(selectedSet);
      if (checked) next.add(id);
      else next.delete(id);

      const childIds = childIdsByGroupId.get(id) ?? [];
      for (const childId of childIds) {
        if (checked) nextValues.add(childId);
        else nextValues.delete(childId);
      }

      onSelectedGroupIdsChange(Array.from(next));
      onSelectedValueIdsChange(Array.from(nextValues));
    },
    [childIdsByGroupId, onSelectedGroupIdsChange, onSelectedValueIdsChange, selectedGroupSet, selectedSet],
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
      applyValueSelection(next);
    },
    [applyValueSelection, childIndexById, lastClickedChildIndex, selectedSet, toggleValue, visibleChildIds],
  );

  const toggleAllVisible = React.useCallback(
    (checked: boolean) => {
      const nextGroups = new Set(selectedGroupSet);
      const next = new Set(selectedSet);
      for (const id of visibleGroupIds) {
        if (checked) nextGroups.add(id);
        else nextGroups.delete(id);
        const childIds = childIdsByGroupId.get(id) ?? [];
        for (const childId of childIds) {
          if (checked) next.add(childId);
          else next.delete(childId);
        }
      }
      onSelectedGroupIdsChange(Array.from(nextGroups));
      onSelectedValueIdsChange(Array.from(next));
    },
    [childIdsByGroupId, onSelectedGroupIdsChange, onSelectedValueIdsChange, selectedGroupSet, selectedSet, visibleGroupIds],
  );

  if (groups.length === 0 && !hasDraftGroup) {
    return (
      <SettingsTableEmptyState
        title={hasSearch ? "No attributes found" : "No attributes yet"}
        description={
          hasSearch
            ? "Try a different search term."
            : "Create your first attribute to manage variant dimensions."
        }
        actionLabel={hasSearch ? undefined : "New attribute"}
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
              if (row.kind === "draft-group") {
                const isDraftEditing = editingTarget?.kind === "draft-group";

                return (
                  <TableRow key={`${row.id}:${row.nonce}`} className="group h-14 bg-background hover:bg-accent-light">
                    <TableCell
                      className="relative h-14 px-4 py-0 align-middle sticky left-0 z-[8] border-r-0 before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-accent-dark bg-background group-hover:bg-accent-light min-w-[360px]"
                    >
                      <div className="flex h-full items-center gap-3 min-w-0">
                        <div className="w-4 flex-shrink-0" aria-hidden="true" />
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <div className="h-[30px] w-[30px] flex-shrink-0" aria-hidden="true" />
                          <div className="min-w-0 flex-1">
                            <InlineNameField
                              id={DRAFT_GROUP_FOCUS_ID}
                              value=""
                              isEditing={isDraftEditing}
                              focusRequest={focusRequest}
                              onFocusRequestConsumed={(id) => {
                                if (id === DRAFT_GROUP_FOCUS_ID) {
                                  setFocusRequest((prev) => (prev?.id === DRAFT_GROUP_FOCUS_ID ? null : prev));
                                }
                              }}
                              onEditingChange={(editing) =>
                                setEditingTarget(editing ? { kind: "draft-group" } : null)
                              }
                              onEmptyCommit={({ trigger }) => {
                                if (trigger === "enter") {
                                  toast.error("Attribute name is required");
                                  return "keep-open";
                                }
                                setHasDraftGroup(false);
                                setEditingTarget(null);
                              }}
                              onCommitError={() => {
                                setEditingTarget({ kind: "draft-group" });
                                setFocusRequest({ id: DRAFT_GROUP_FOCUS_ID, nonce: Date.now() });
                              }}
                              keepEditingOnError
                              onCommit={async (nextName, meta) => {
                                const createdGroupId = await onCreateGroupInline({ name: nextName });
                                requestAnimationFrame(() => {
                                  // Creating an attribute should chain into a value row only.
                                  // Do not auto-spawn another attribute draft row.
                                  setHasDraftGroup(false);
                                  setEditingTarget(null);
                                  if (createdGroupId) {
                                    const nextDraftValue = {
                                      groupId: createdGroupId,
                                      nonce: Date.now(),
                                      taxonomyValueId: null,
                                    };
                                    setDraftValue(nextDraftValue);
                                    setEditingTarget({ kind: "draft-value", groupId: createdGroupId });
                                    setFocusRequest({
                                      id: draftValueFocusId(createdGroupId),
                                      nonce: nextDraftValue.nonce,
                                    });
                                  }
                                });
                              }}
                              textClassName="type-p text-primary"
                              placeholder="Attribute name"
                            />
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="h-14 px-4 py-0 align-middle w-[120px] min-w-[120px] max-w-[120px]" />
                    <TableCell className="h-14 px-4 py-0 align-middle w-[120px] min-w-[120px] max-w-[120px]" />
                    <TableCell className="h-14 px-4 py-0 align-middle w-[260px] min-w-[260px] max-w-[260px]" />
                    <TableCell className="h-14 px-4 py-0 align-middle w-[240px] min-w-[240px] max-w-[240px]" />
                  </TableRow>
                );
              }

              if (row.kind === "draft-value") {
                const group = row.group;
                const isDraftValueEditing =
                  editingTarget?.kind === "draft-value" && editingTarget.groupId === group.id;
                const draftValueIsLastInGroup = group.values.length === 0;
                const isLastFlatRow = flatRowIndex === flatRows.length - 1;

                return (
                  <TableRow
                    key={`${DRAFT_VALUE_ROW_PREFIX}:${group.id}:${row.nonce}`}
                    className="group h-14 hover:bg-accent-light"
                  >
                    <TableCell
                      className="relative h-14 px-4 py-0 align-middle sticky left-0 z-[8] border-b-transparent border-r-0 before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-accent-dark bg-background group-hover:bg-accent-light min-w-[360px]"
                    >
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute left-0 top-0 h-px w-[120px] bg-background group-hover:bg-accent-light"
                      />
                      <div className="flex h-full items-center gap-4 min-w-0">
                        <div className="w-4 flex-shrink-0" aria-hidden="true" />
                        <div className="flex h-full items-stretch gap-4 min-w-0 flex-1">
                          <div
                            className="relative h-14 w-6 shrink-0"
                            aria-hidden="true"
                            style={{ color: ATTRIBUTE_VALUE_CONNECTOR_COLOR }}
                          >
                            <div
                              className={cn(
                                "absolute left-1/2 w-px -translate-x-1/2",
                                draftValueIsLastInGroup ? "top-0 bottom-[39px]" : "top-0 -bottom-px",
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
                          <div className="relative flex h-full min-w-0 flex-1 items-center self-stretch">
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute left-0 right-[-15px] -top-px h-px bg-border"
                            />
                            {!draftValueIsLastInGroup && !isLastFlatRow ? (
                              <div
                                aria-hidden="true"
                                className="pointer-events-none absolute -bottom-px left-0 right-[-15px] h-px bg-border"
                              />
                            ) : null}
                            <InlineNameField
                              id={draftValueFocusId(group.id)}
                              value=""
                              isEditing={isDraftValueEditing}
                              focusRequest={focusRequest}
                              onFocusRequestConsumed={(id) => {
                                if (id === draftValueFocusId(group.id)) {
                                  setFocusRequest((prev) =>
                                    prev?.id === draftValueFocusId(group.id) ? null : prev,
                                  );
                                }
                              }}
                              onEditingChange={(editing) =>
                                setEditingTarget(editing ? { kind: "draft-value", groupId: group.id } : null)
                              }
                              onEmptyCommit={({ trigger }) => {
                                if (trigger === "enter") {
                                  toast.error("Attribute value name is required");
                                  return "keep-open";
                                }
                                setDraftValue((prev) => (prev?.groupId === group.id ? null : prev));
                                setEditingTarget(null);
                              }}
                              onCommitError={() => {
                                setEditingTarget({ kind: "draft-value", groupId: group.id });
                                setFocusRequest({ id: draftValueFocusId(group.id), nonce: Date.now() });
                              }}
                              keepEditingOnError
                              onCommit={async (nextName, meta) => {
                                const draftTaxonomyValueId =
                                  draftValue && draftValue.groupId === group.id
                                    ? draftValue.taxonomyValueId
                                    : null;
                                await onCreateValueInline(group, {
                                  name: nextName,
                                  taxonomyValueId: draftTaxonomyValueId ?? null,
                                });
                                requestAnimationFrame(() => {
                                  if (meta.trigger === "enter") {
                                    const nextDraft = {
                                      groupId: group.id,
                                      nonce: Date.now(),
                                      taxonomyValueId: null,
                                    };
                                    setDraftValue(nextDraft);
                                    setEditingTarget({ kind: "draft-value", groupId: group.id });
                                    setFocusRequest({
                                      id: draftValueFocusId(group.id),
                                      nonce: nextDraft.nonce,
                                    });
                                  } else {
                                    setDraftValue((prev) =>
                                      prev?.groupId === group.id ? null : prev,
                                    );
                                    setEditingTarget(null);
                                  }
                                });
                              }}
                              placeholder="Value name"
                            />
                          </div>
                        </div>
                      </div>
                      {draftValueIsLastInGroup && !isLastFlatRow ? (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute -bottom-px left-0 right-px h-px bg-border"
                        />
                      ) : null}
                    </TableCell>
                    <TableCell className="h-14 px-4 py-0 align-middle w-[120px] min-w-[120px] max-w-[120px]" />
                    <TableCell className="h-14 px-4 py-0 align-middle w-[120px] min-w-[120px] max-w-[120px]" />
                    <TableCell className="h-14 px-4 py-0 align-middle w-[260px] min-w-[260px] max-w-[260px]">
                      <div className="flex h-full items-center">
                        <InlineLinkPicker
                          value={
                            draftValue && draftValue.groupId === group.id
                              ? draftValue.taxonomyValueId
                              : null
                          }
                          placeholder="Add link"
                          disabled={!group.taxonomyAttributeId}
                          disabledLabel="Add link"
                          disabledReason="Link parent attribute first"
                          options={(group.taxonomyAttributeId
                            ? (taxonomyValuesByAttribute.get(group.taxonomyAttributeId) ?? []).map((option) => ({
                                id: option.id,
                                label: option.name,
                                hex: extractHex(option.metadata),
                              }))
                            : [])}
                          onChange={async (nextId) => {
                            setDraftValue((prev) => {
                              if (!prev || prev.groupId !== group.id) return prev;
                              return {
                                ...prev,
                                taxonomyValueId: nextId,
                              };
                            });
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="h-14 px-4 py-0 align-middle w-[240px] min-w-[240px] max-w-[240px]" />
                  </TableRow>
                );
              }

              if (row.kind === "group") {
                const group = row.group;
                const groupActions: RowAction[] = [
                  {
                    label: "Add value",
                    icon: <Icons.Plus className="h-[14px] w-[14px]" />,
                    onSelect: () => startDraftValue(group),
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

                const selectedChildCount = group.values.reduce(
                  (count: number, value: AttributeValueListItem) =>
                    count + (selectedSet.has(value.id) ? 1 : 0),
                  0,
                );
                const allChildValuesSelected =
                  group.values.length > 0 && selectedChildCount === group.values.length;
                const isGroupSelected =
                  group.values.length > 0 ? allChildValuesSelected : selectedGroupSet.has(group.id);
                const isGroupEditing =
                  editingTarget?.kind === "group" && editingTarget.id === group.id;
                const hasDraftValueForGroup = draftValue?.groupId === group.id;
                const isGroupExpanded =
                  hasDraftValueForGroup || (group.values.length > 0 && !collapsedGroupIds.has(group.id));
                const hasVisibleChildren =
                  (isGroupExpanded && group.values.length > 0) || hasDraftValueForGroup;
                const canToggleGroup = group.values.length > 0 || hasDraftValueForGroup;
                const chevronButton = (
                  <button
                    type="button"
                    onClick={() => {
                      if (!canToggleGroup) return;
                      onToggleGroup(group.id);
                    }}
                    aria-disabled={!canToggleGroup}
                    className={cn(
                      "flex h-[30px] w-[30px] items-center justify-center rounded transition-colors",
                      canToggleGroup
                        ? "text-primary hover:text-primary hover:bg-accent"
                        : "text-tertiary opacity-40 cursor-default",
                    )}
                    aria-label={isGroupExpanded ? `Collapse ${group.name}` : `Expand ${group.name}`}
                  >
                    <Icons.ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform duration-150",
                        isGroupExpanded && "rotate-90",
                      )}
                    />
                  </button>
                );

                return (
                  <TableRow
                    key={group.id}
                    data-state={isGroupSelected ? "selected" : undefined}
                    className="group h-14 bg-background hover:bg-accent-light data-[state=selected]:bg-accent-blue"
                  >
                    <TableCell
                      className={cn(
                        "relative h-14 px-4 py-0 align-middle sticky left-0 z-[8] border-r-0 before:absolute before:inset-y-0 before:right-0 before:w-px before:bg-accent-dark after:absolute after:left-0 after:bottom-0 after:h-px after:w-[120px] after:bg-background group-hover:after:bg-accent-light group-data-[state=selected]:after:bg-accent-blue bg-background group-hover:bg-accent-light group-data-[state=selected]:bg-accent-blue min-w-[360px]",
                        hasVisibleChildren && "border-b-transparent",
                      )}
                    >
                      <div className="flex h-full items-center gap-3 min-w-0">
                        <div className="flex-shrink-0">
                          <RowSelectionCheckbox
                            checked={isGroupSelected}
                            onChange={(checked) => toggleGroup(group.id, checked)}
                            ariaLabel={`Select attribute ${group.name}`}
                            hitArea="row"
                          />
                        </div>
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          {canToggleGroup ? (
                            chevronButton
                          ) : (
                            <TooltipProvider delayDuration={120}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex-shrink-0">{chevronButton}</span>
                                </TooltipTrigger>
                                <TooltipContent side="top">Add attribute value first</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
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
                      </div>
                    </TableCell>
                    <TableCell className="h-14 px-4 py-0 align-middle w-[120px] min-w-[120px] max-w-[120px]">
                      <span className="whitespace-nowrap type-p text-primary">{group.values_count ?? group.values.length}</span>
                    </TableCell>
                    <TableCell className="h-14 px-4 py-0 align-middle w-[120px] min-w-[120px] max-w-[120px]">
                      <span className="whitespace-nowrap type-p text-primary">{group.variants_count ?? 0}</span>
                    </TableCell>
                    <TableCell className="h-14 px-4 py-0 align-middle w-[260px] min-w-[260px] max-w-[260px]">
                      <div className="flex h-full items-center">
                        <InlineLinkPicker
                          value={group.taxonomyAttributeId ?? null}
                          placeholder="Add link"
                          options={taxonomyAttributes.map((attribute) => ({
                            id: attribute.id,
                            label: attribute.name,
                          }))}
                          onChange={(nextId) => onUpdateGroupTaxonomyLink(group, nextId)}
                        />
                      </div>
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
              const hasDraftValueAbove = draftValue?.groupId === group.id;

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
                        <div className="relative flex h-full items-stretch gap-3 min-w-0 flex-1">
                          {isFirstValue && !hasDraftValueAbove ? (
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
                          {swatch ? (
                            <div
                              className="h-3.5 w-3.5 shrink-0 self-center rounded-full border border-border"
                              style={{ backgroundColor: swatch }}
                              aria-hidden="true"
                            />
                          ) : null}
                          <div className="relative flex h-full min-w-0 flex-1 items-center self-stretch">
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
                    <div className="flex h-full items-center">
                      <InlineLinkPicker
                        value={value.taxonomyValueId ?? null}
                        placeholder="Add link"
                        disabled={!group.taxonomyAttributeId}
                        disabledLabel="Add link"
                        disabledReason="Link parent attribute first"
                        options={(group.taxonomyAttributeId
                          ? (taxonomyValuesByAttribute.get(group.taxonomyAttributeId) ?? []).map((option) => ({
                              id: option.id,
                              label: option.name,
                              hex: extractHex(option.metadata),
                            }))
                          : [])}
                        onChange={(nextId) => onUpdateValueTaxonomyLink(group, value, nextId)}
                      />
                    </div>
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
