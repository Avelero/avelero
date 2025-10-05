"use client";

import { getQuickFilterFields } from "@/config/filters";
import { useFieldOptions } from "@/hooks/use-field-options";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import * as React from "react";
import type { FilterActions, FilterState } from "./filter-types";

interface QuickFiltersPopoverProps {
  filterState: FilterState;
  filterActions: FilterActions;
  onOpenAdvanced: () => void;
  disabled?: boolean;
}

const QUICK_FIELDS = getQuickFilterFields();

const renderStatusIcon = (fieldId: string, value: string) => {
  if (fieldId !== "status") return null;
  const iconClass = "status-icon h-[14px] w-[14px]";
  const icons = {
    published: <Icons.StatusPublished className={iconClass} />,
    scheduled: <Icons.StatusScheduled className={iconClass} />,
    unpublished: <Icons.StatusUnpublished className={iconClass} />,
    archived: <Icons.StatusArchived className={iconClass} />,
  };
  return icons[value as keyof typeof icons] || null;
};

export function QuickFiltersPopover({
  filterState,
  filterActions,
  onOpenAdvanced,
  disabled = false,
}: QuickFiltersPopoverProps) {
  const [open, setOpen] = React.useState(false);

  const activeFilters = React.useMemo(() => {
    const filters: Array<{
      fieldId: string;
      fieldLabel: string;
      value: any[];
      groupId: string;
      conditionId: string;
    }> = [];
    for (const group of filterState.groups) {
      for (const condition of group.conditions) {
        const field = QUICK_FIELDS.find((f) => f.id === condition.fieldId);
        if (field && condition.value != null) {
          const values = Array.isArray(condition.value)
            ? condition.value
            : [condition.value];
          if (values.length > 0) {
            filters.push({
              fieldId: field.id,
              fieldLabel: field.label,
              value: values,
              groupId: group.id,
              conditionId: condition.id,
            });
          }
        }
      }
    }
    return filters;
  }, [filterState.groups]);

  const getOptionLabel = React.useCallback((fieldId: string, value: string) => {
    const field = QUICK_FIELDS.find((f) => f.id === fieldId);
    const option = field?.options?.find((o: any) => o.value === value);
    return option?.label ?? value;
  }, []);

  const removeFilter = React.useCallback(
    (groupId: string, conditionId: string) => {
      filterActions.removeCondition(groupId, conditionId);
    },
    [filterActions],
  );

  const handleAdvancedClick = React.useCallback(() => {
    setOpen(false);
    onOpenAdvanced();
  }, [onOpenAdvanced]);

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="subtle"
            size="default"
            disabled={disabled}
            iconPosition="left"
            icon={<Icons.Filter className="h-[14px] w-[14px]" />}
          >
            Filter
            {activeFilters.length > 0 && (
              <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 ml-1 rounded-sm bg-brand text-[12px] leading-[12px] text-background">
                {activeFilters.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[320px] p-0">
          <div className="max-h-[400px] overflow-y-auto">
            <div>
              {QUICK_FIELDS.map((field) => (
                <QuickFilterItem
                  key={field.id}
                  field={field}
                  filterState={filterState}
                  filterActions={filterActions}
                />
              ))}
            </div>
          </div>
          <div className="border-t border-border">
            <button
              type="button"
              className="w-full px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors text-center"
              onClick={handleAdvancedClick}
            >
              Advanced filters
            </button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {activeFilters.map((filter) => {
        const displayText = filter.value
          .map((v) => getOptionLabel(filter.fieldId, v))
          .join(", ");
        const truncatedText =
          displayText.length > 30
            ? `${displayText.substring(0, 30)}...`
            : displayText;

        return (
          <div
            key={`${filter.groupId}-${filter.conditionId}`}
            className="group relative flex items-center h-9 px-2 rounded-none bg-accent text-p text-secondary"
            title={displayText}
          >
            <span className="truncate">{truncatedText}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeFilter(filter.groupId, filter.conditionId)}
              className="absolute right-0 top-0 h-full px-2 bg-accent opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed flex items-center"
              aria-label="Remove filter"
            >
              <Icons.X className="h-3 w-3 text-secondary flex-shrink-0" />
            </button>
          </div>
        );
      })}
    </>
  );
}

const QuickFilterItem = React.memo(function QuickFilterItem({
  field,
  filterState,
  filterActions,
}: {
  field: any;
  filterState: FilterState;
  filterActions: FilterActions;
}) {
  const { options: dynamicOptions, isLoading } = useFieldOptions(
    field.optionsSource?.endpoint,
    field.optionsSource?.transform,
  );

  const options = React.useMemo(
    () => field.options ?? dynamicOptions,
    [field.options, dynamicOptions],
  );

  const existingCondition = React.useMemo(() => {
    for (const group of filterState.groups) {
      const condition = group.conditions.find((c) => c.fieldId === field.id);
      if (condition) return { groupId: group.id, condition };
    }
    return null;
  }, [filterState.groups, field.id]);

  const selectedValues = (existingCondition?.condition.value as string[]) ?? [];
  const hideSearch = field.id === "status" || field.id === "moduleCompletion";

  const toggleValue = React.useCallback(
    (optionValue: string) => {
      const newValues = selectedValues.includes(optionValue)
        ? selectedValues.filter((v) => v !== optionValue)
        : [...selectedValues, optionValue];

      if (existingCondition) {
        filterActions.updateCondition(
          existingCondition.groupId,
          existingCondition.condition.id,
          { value: newValues },
        );
        return;
      }

      const targetGroupId = filterState.groups[0]?.id;
      if (!targetGroupId) {
        filterActions.addGroup();
        return;
      }

      filterActions.addCondition(targetGroupId, {
        fieldId: field.id,
        operator: field.operators[0],
        value: newValues,
      });
    },
    [
      selectedValues,
      existingCondition,
      filterState.groups,
      filterActions,
      field.id,
      field.operators,
    ],
  );

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 !text-p text-primary",
          "[&_svg]:!text-foreground",
        )}
      >
        <span>{field.label}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent sideOffset={0} className="w-[280px] p-0 ml-1">
          <Command>
            {!hideSearch && (
              <CommandInput
                placeholder={`Search ${field.label.toLowerCase()}...`}
                className="h-9 px-2"
              />
            )}
            <CommandList>
              <CommandEmpty>
                {isLoading ? "Loading..." : "No results found."}
              </CommandEmpty>
              <CommandGroup>
                {options.map((option: any) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => toggleValue(option.value)}
                      className="flex items-center justify-between !text-p text-foreground [&_.status-icon]:!h-[14px] [&_.status-icon]:!w-[14px]"
                    >
                      <div className="flex items-center gap-2">
                        {renderStatusIcon(field.id, option.value)}
                        <span className="text-p text-primary">
                          {option.label}
                        </span>
                      </div>
                      {isSelected && (
                        <Icons.Check className="h-4 w-4 text-foreground" />
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
});
