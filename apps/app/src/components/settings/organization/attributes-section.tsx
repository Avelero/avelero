"use client";

import { AttributesTable, type AttributeGroupListItem, type AttributeValueListItem } from "@/components/tables/settings/attributes";
import {
  DeleteConfirmationDialog,
  EntityTableShell,
  EntityToolbar,
} from "@/components/tables/settings/shared";
import { useBrandCatalog, type TaxonomyAttribute, type TaxonomyValue } from "@/hooks/use-brand-catalog";
import { invalidateSettingsEntityCaches } from "@/lib/settings-entity-cache";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@v1/ui/dialog";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import {
  Select,
  SelectContent,
  SelectEmpty,
  SelectGroup,
  SelectItem,
  SelectList,
  SelectSearch,
  SelectTrigger,
} from "@v1/ui/select";
import { toast } from "@v1/ui/sonner";
import * as React from "react";

type GroupDialogState =
  | { mode: "create" }
  | { mode: "edit"; group: AttributeGroupListItem }
  | null;

type ValueDialogState =
  | { mode: "create"; groupId?: string }
  | { mode: "edit"; groupId: string; value: AttributeValueListItem }
  | null;

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

function extractHex(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  if (typeof m.swatch === "string") return m.swatch;
  if (typeof m.hex === "string") {
    return m.hex.startsWith("#") ? m.hex : `#${m.hex}`;
  }
  return null;
}

function matchesTerm(value: unknown, term: string) {
  if (value == null) return false;
  return String(value).toLowerCase().includes(term);
}

interface SelectOption {
  value: string;
  label: string;
  hex?: string | null;
}

function CommandSelectField({
  id,
  label,
  placeholder,
  value,
  onValueChange,
  options,
  required = false,
  allowClear = false,
  emptyLabel = "No items found.",
}: {
  id: string;
  label: React.ReactNode;
  placeholder: string;
  value: string | null;
  onValueChange: (value: string | null) => void;
  options: SelectOption[];
  required?: boolean;
  allowClear?: boolean;
  emptyLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredOptions = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => option.label.toLowerCase().includes(term));
  }, [options, searchTerm]);

  const selected = options.find((option) => option.value === value);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <Select open={open} onOpenChange={setOpen}>
        <SelectTrigger asChild>
          <Button id={id} variant="outline" size="default" className="w-full justify-between data-[state=open]:bg-accent">
            <span className={cn("truncate px-1", !selected && "text-tertiary")}>
              {selected?.label ?? placeholder}
            </span>
            <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
          </Button>
        </SelectTrigger>
        <SelectContent shouldFilter={false} inline defaultValue={value ?? undefined}>
          <SelectSearch placeholder="Search..." value={searchTerm} onValueChange={setSearchTerm} />
          <SelectList>
            <SelectGroup>
              {allowClear ? (
                <SelectItem
                  value="__none__"
                  onSelect={() => {
                    onValueChange(null);
                    setOpen(false);
                    setSearchTerm("");
                  }}
                >
                  <span className="type-p text-tertiary">No link</span>
                  {!value ? <Icons.Check className="h-4 w-4" /> : null}
                </SelectItem>
              ) : null}
              {filteredOptions.map((option, index) => (
                <SelectItem
                  key={`${option.value}:${index}`}
                  value={option.value}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                    setSearchTerm("");
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {option.hex ? (
                      <div
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: option.hex }}
                      />
                    ) : null}
                    <span className="truncate type-p">{option.label}</span>
                  </div>
                  {value === option.value ? <Icons.Check className="h-4 w-4" /> : null}
                </SelectItem>
              ))}
            </SelectGroup>
            {filteredOptions.length === 0 ? <SelectEmpty>{emptyLabel}</SelectEmpty> : null}
          </SelectList>
        </SelectContent>
      </Select>
    </div>
  );
}

function AttributeGroupDialog({
  open,
  onOpenChange,
  mode,
  initialGroup,
  taxonomyAttributes,
  existingGroups,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialGroup?: AttributeGroupListItem | null;
  taxonomyAttributes: TaxonomyAttribute[];
  existingGroups: AttributeGroupListItem[];
  onSubmit: (input: { name: string; taxonomyAttributeId: string | null }) => Promise<void>;
  isSaving?: boolean;
}) {
  const [name, setName] = React.useState("");
  const [taxonomyAttributeId, setTaxonomyAttributeId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setName(initialGroup?.name ?? "");
    setTaxonomyAttributeId(initialGroup?.taxonomyAttributeId ?? null);
  }, [open, initialGroup]);

  const taxonomyOptions = React.useMemo<SelectOption[]>(
    () =>
      taxonomyAttributes.map((attribute) => ({
        value: attribute.id,
        label: attribute.name,
      })),
    [taxonomyAttributes],
  );

  const nameError = React.useMemo(() => {
    const trimmed = name.trim();
    if (!trimmed) return "Name is required";
    const currentId = initialGroup?.id;
    const duplicate = existingGroups.some(
      (group) => group.id !== currentId && group.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) return "An attribute with this name already exists";
    return "";
  }, [existingGroups, initialGroup?.id, name]);

  const handleSave = async () => {
    if (nameError) return;
    await onSubmit({ name: name.trim(), taxonomyAttributeId });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit group" : "New group"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="attribute-group-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="attribute-group-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Color"
              className="h-9"
              autoFocus
            />
            {nameError ? <p className="type-small text-destructive">{nameError}</p> : null}
          </div>

          <CommandSelectField
            id="attribute-group-taxonomy"
            label="Link to standard attribute"
            placeholder="No link"
            value={taxonomyAttributeId}
            onValueChange={setTaxonomyAttributeId}
            options={taxonomyOptions}
            allowClear
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button variant="brand" onClick={() => void handleSave()} disabled={!!nameError || isSaving}>
            {mode === "edit" ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttributeValueDialog({
  open,
  onOpenChange,
  mode,
  groups,
  taxonomyValuesByAttribute,
  initialGroupId,
  initialValue,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  groups: AttributeGroupListItem[];
  taxonomyValuesByAttribute: Map<string, TaxonomyValue[]>;
  initialGroupId?: string;
  initialValue?: AttributeValueListItem | null;
  onSubmit: (input: {
    attributeId: string;
    name: string;
    taxonomyValueId: string | null;
  }) => Promise<void>;
  isSaving?: boolean;
}) {
  const [attributeId, setAttributeId] = React.useState("");
  const [name, setName] = React.useState("");
  const [taxonomyValueId, setTaxonomyValueId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setAttributeId(initialGroupId ?? "");
    setName(initialValue?.name ?? "");
    setTaxonomyValueId(initialValue?.taxonomyValueId ?? null);
  }, [open, initialGroupId, initialValue]);

  const selectedGroup = React.useMemo(
    () => groups.find((group) => group.id === attributeId) ?? null,
    [attributeId, groups],
  );
  const taxonomyAttributeId = selectedGroup?.taxonomyAttributeId ?? null;

  const attributeOptions = React.useMemo<SelectOption[]>(
    () => groups.map((group) => ({ value: group.id, label: group.name })),
    [groups],
  );

  const taxonomyValueOptions = React.useMemo<SelectOption[]>(() => {
    if (!taxonomyAttributeId) return [];
    const values = taxonomyValuesByAttribute.get(taxonomyAttributeId) ?? [];
    return values.map((value) => ({
      value: value.id,
      label: value.name,
      hex: extractHex(value.metadata),
    }));
  }, [taxonomyAttributeId, taxonomyValuesByAttribute]);

  React.useEffect(() => {
    if (!taxonomyAttributeId) {
      setTaxonomyValueId(null);
      return;
    }
    if (!taxonomyValueId) return;
    const exists = taxonomyValueOptions.some((option) => option.value === taxonomyValueId);
    if (!exists) setTaxonomyValueId(null);
  }, [taxonomyAttributeId, taxonomyValueId, taxonomyValueOptions]);

  const handleTaxonomyValueChange = (nextId: string | null) => {
    setTaxonomyValueId(nextId);
    if (!nextId) return;
    if (!name.trim()) {
      const match = taxonomyValueOptions.find((option) => option.value === nextId);
      if (match) setName(match.label);
    }
  };

  const nameError = React.useMemo(() => {
    if (!attributeId) return "Attribute group is required";
    const trimmed = name.trim();
    if (!trimmed) return "Value name is required";
    if (taxonomyAttributeId && !taxonomyValueId) return "Standard value is required";
    const group = groups.find((item) => item.id === attributeId);
    if (!group) return "Attribute group is required";
    const currentId = initialValue?.id;
    const duplicate = group.values.some(
      (value: AttributeValueListItem) =>
        value.id !== currentId && value.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) return "A value with this name already exists in this group";
    return "";
  }, [attributeId, groups, initialValue?.id, name, taxonomyAttributeId, taxonomyValueId]);

  const handleSave = async () => {
    if (nameError) return;
    await onSubmit({
      attributeId,
      name: name.trim(),
      taxonomyValueId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit value" : "New value"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <CommandSelectField
            id="attribute-value-group"
            label={<>Attribute group <span className="text-destructive">*</span></>}
            placeholder="Select group"
            value={attributeId || null}
            onValueChange={(next) => setAttributeId(next ?? "")}
            options={attributeOptions}
            required={false}
          />

          <div className="space-y-1.5">
            <Label htmlFor="attribute-value-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="attribute-value-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={selectedGroup ? `Add ${selectedGroup.name.toLowerCase()} value` : "Value name"}
              className="h-9"
              autoFocus={mode === "create"}
            />
          </div>

          {taxonomyAttributeId ? (
            <CommandSelectField
              id="attribute-value-taxonomy"
              label="Link to standard value"
              placeholder="Select standard value"
              value={taxonomyValueId}
              onValueChange={handleTaxonomyValueChange}
              options={taxonomyValueOptions}
              required
              emptyLabel="No values found"
            />
          ) : null}

          {nameError ? <p className="type-small text-destructive">{nameError}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button variant="brand" onClick={() => void handleSave()} disabled={!!nameError || isSaving}>
            {mode === "edit" ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AttributesSection() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { taxonomyAttributes, taxonomyValuesByAttribute } = useBrandCatalog();

  const [searchValue, setSearchValue] = React.useState("");
  const [selectedGroupIds, setSelectedGroupIds] = React.useState<string[]>([]);
  const [selectedValueIds, setSelectedValueIds] = React.useState<string[]>([]);
  const [collapsedGroupIds, setCollapsedGroupIds] = React.useState<Set<string>>(new Set());
  const hasInitializedCollapsedGroups = React.useRef(false);
  const [groupDialog, setGroupDialog] = React.useState<GroupDialogState>(null);
  const [valueDialog, setValueDialog] = React.useState<ValueDialogState>(null);
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
    return [...groups].sort((a, b) => {
      const updatedDiff = toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt);
      if (updatedDiff !== 0) return updatedDiff;
      const createdDiff = toTimestamp(b.createdAt) - toTimestamp(a.createdAt);
      if (createdDiff !== 0) return createdDiff;
      return a.name.localeCompare(b.name);
    });
  }, [attributesQuery.data]);

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
        return prev.size === 0 ? prev : new Set<string>();
      }

      if (!hasInitializedCollapsedGroups.current) {
        hasInitializedCollapsedGroups.current = true;
        return new Set(allowed);
      }

      let changed = false;
      const next = new Set<string>();

      for (const id of prev) {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      }

      // Collapse newly created/loaded groups by default as well.
      for (const id of allowed) {
        if (!prev.has(id)) {
          next.add(id);
          changed = true;
        }
      }

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
        toast.success("Group deleted");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete group");
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
        toast.success("Value deleted");
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
      toast.success(`${totalSuccesses} item${totalSuccesses === 1 ? "" : "s"} deleted`);
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

    if (currentDialog.mode === "single-group") {
      await deleteGroupNow(currentDialog.group);
    } else if (currentDialog.mode === "single-value") {
      await deleteValueNow(currentDialog.group, currentDialog.value);
    } else {
      await deleteSelectedNow(currentDialog.groupIds, currentDialog.valueIds);
    }

    setDeleteDialog(null);
  }, [deleteDialog, deleteGroupNow, deleteSelectedNow, deleteValueNow]);

  const selectedItemCount = selectedGroupIds.length + selectedValueIds.length;
  const isDeletePending = deleteValueMutation.isPending || deleteAttributeMutation.isPending;

  const selectedGroupForToolbarValue = React.useMemo(() => {
    if (allGroups.length === 1) return allGroups[0]?.id;
    return undefined;
  }, [allGroups]);

  const handleSubmitGroup = React.useCallback(
    async (input: { name: string; taxonomyAttributeId: string | null }) => {
      try {
        if (groupDialog?.mode === "edit") {
          await updateAttributeMutation.mutateAsync({
            id: groupDialog.group.id,
            name: input.name,
            taxonomy_attribute_id: input.taxonomyAttributeId,
          });
          toast.success("Group saved");
        } else {
          await createAttributeMutation.mutateAsync({
            name: input.name,
            taxonomy_attribute_id: input.taxonomyAttributeId,
          });
          toast.success("Group created");
        }
        await invalidateLists();
        setGroupDialog(null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save group");
      }
    },
    [createAttributeMutation, groupDialog, invalidateLists, updateAttributeMutation],
  );

  const handleSubmitValue = React.useCallback(
    async (input: { attributeId: string; name: string; taxonomyValueId: string | null }) => {
      try {
        if (valueDialog?.mode === "edit") {
          await updateValueMutation.mutateAsync({
            id: valueDialog.value.id,
            name: input.name,
            taxonomy_value_id: input.taxonomyValueId,
          });
          toast.success("Value saved");
        } else {
          await createValueMutation.mutateAsync({
            attribute_id: input.attributeId,
            name: input.name,
            taxonomy_value_id: input.taxonomyValueId,
          });
          toast.success("Value created");
        }
        await invalidateLists();
        setValueDialog(null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save value");
      }
    },
    [createValueMutation, invalidateLists, updateValueMutation, valueDialog],
  );

  const groupDialogInitial = groupDialog?.mode === "edit" ? groupDialog.group : null;
  const valueDialogInitialValue = valueDialog?.mode === "edit" ? valueDialog.value : null;
  const valueDialogInitialGroupId = valueDialog?.groupId;

  const handleRenameGroup = React.useCallback(
    async (group: AttributeGroupListItem, nextName: string) => {
      try {
        await updateAttributeMutation.mutateAsync({
          id: group.id,
          name: nextName,
        });
        await invalidateLists();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to rename group");
        throw error;
      }
    },
    [invalidateLists, updateAttributeMutation],
  );

  const handleRenameValue = React.useCallback(
    async (_group: AttributeGroupListItem, value: AttributeValueListItem, nextName: string) => {
      try {
        await updateValueMutation.mutateAsync({
          id: value.id,
          name: nextName,
        });
        await invalidateLists();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to rename value");
        throw error;
      }
    },
    [invalidateLists, updateValueMutation],
  );

  const deleteDialogCopy = React.useMemo(() => {
    if (!deleteDialog) {
      return {
        title: "Delete item?",
        description:
          "You are about to permanently delete this item. This action cannot be undone.",
        confirmLabel: "Delete",
      };
    }

    if (deleteDialog.mode === "single-group") {
      return {
        title: "Delete group?",
        description:
          "You are about to permanently delete this group. This action cannot be undone.",
        confirmLabel: "Delete group",
      };
    }

    if (deleteDialog.mode === "single-value") {
      return {
        title: "Delete value?",
        description:
          "You are about to permanently delete this value. This action cannot be undone.",
        confirmLabel: "Delete value",
      };
    }

    const groupCount = deleteDialog.groupIds.length;
    const valueCount = deleteDialog.valueIds.length;
    const totalCount = groupCount + valueCount;

    let breakdown = "";
    if (groupCount > 0 && valueCount > 0) {
      breakdown = ` (${groupCount} group${groupCount === 1 ? "" : "s"} and ${valueCount} value${valueCount === 1 ? "" : "s"})`;
    } else if (groupCount > 0) {
      breakdown = ` (${groupCount} group${groupCount === 1 ? "" : "s"})`;
    } else if (valueCount > 0) {
      breakdown = ` (${valueCount} value${valueCount === 1 ? "" : "s"})`;
    }

    return {
      title: `Delete ${totalCount} item${totalCount === 1 ? "" : "s"}?`,
      description: `You are about to permanently delete ${totalCount} selected item${totalCount === 1 ? "" : "s"}${breakdown}. This action cannot be undone.`,
      confirmLabel: `Delete ${totalCount} item${totalCount === 1 ? "" : "s"}`,
    };
  }, [deleteDialog]);

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
                  onClick={() => setGroupDialog({ mode: "create" })}
                >
                  <Icons.Plus className="h-[14px] w-[14px]" />
                  <span className="px-1">New group</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="default"
                  onClick={() =>
                    setValueDialog({ mode: "create", groupId: selectedGroupForToolbarValue })
                  }
                  disabled={allGroups.length === 0}
                >
                  <Icons.Plus className="h-[14px] w-[14px]" />
                  <span className="px-1">New value</span>
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
          onCreateGroup={() => setGroupDialog({ mode: "create" })}
          onDeleteGroup={handleDeleteGroup}
          onAddValue={(group) => {
            if (searchValue.trim()) {
              setCollapsedGroupIds((prev) => {
                const next = new Set(prev);
                next.delete(group.id);
                return next;
              });
            }
            setValueDialog({ mode: "create", groupId: group.id });
          }}
          onDeleteValue={handleDeleteValue}
          onRenameGroup={handleRenameGroup}
          onRenameValue={handleRenameValue}
          hasSearch={searchValue.trim().length > 0}
        />
      </EntityTableShell>

      <AttributeGroupDialog
        open={groupDialog !== null}
        onOpenChange={(open) => {
          if (!open) setGroupDialog(null);
        }}
        mode={groupDialog?.mode ?? "create"}
        initialGroup={groupDialogInitial}
        taxonomyAttributes={taxonomyAttributes}
        existingGroups={allGroups}
        onSubmit={handleSubmitGroup}
        isSaving={createAttributeMutation.isPending || updateAttributeMutation.isPending}
      />

      <AttributeValueDialog
        open={valueDialog !== null}
        onOpenChange={(open) => {
          if (!open) setValueDialog(null);
        }}
        mode={valueDialog?.mode ?? "create"}
        groups={allGroups}
        taxonomyValuesByAttribute={taxonomyValuesByAttribute}
        initialGroupId={valueDialogInitialGroupId}
        initialValue={valueDialogInitialValue}
        onSubmit={handleSubmitValue}
        isSaving={createValueMutation.isPending || updateValueMutation.isPending}
      />

      <DeleteConfirmationDialog
        open={deleteDialog !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog(null);
        }}
        title={deleteDialogCopy.title}
        description={deleteDialogCopy.description}
        confirmLabel={deleteDialogCopy.confirmLabel}
        onConfirm={handleConfirmDelete}
        isPending={isDeletePending}
      />
    </div>
  );
}
