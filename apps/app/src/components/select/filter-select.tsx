"use client";

import { getQuickFilterFields } from "@/config/filters";
import { useFieldOptions } from "@/hooks/use-filter-options";
import {
  convertQuickFiltersToFilterState,
  extractQuickFiltersFromFilterState,
  hasAdvancedFilters,
  hasQuickFilters,
} from "@/utils/filter-converter";
import { useTRPC } from "@/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
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
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import * as React from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { FilterActions, FilterState } from "../passports/filter-types";

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

  // Extract current quick filter selections from FilterState
  // If advanced filters exist, show empty (quick filters will overwrite on apply)
  const currentQuickFilters = React.useMemo(() => {
    if (hasQuickFilters(filterState)) {
      return extractQuickFiltersFromFilterState(filterState);
    }
    return {};
  }, [filterState]);

  const activeFilters = React.useMemo(() => {
    const filters: Array<{
      fieldId: string;
      fieldLabel: string;
      value: string[];
    }> = [];
    for (const field of QUICK_FIELDS) {
      const values = currentQuickFilters[field.id] ?? [];
      if (values.length > 0) {
        filters.push({
          fieldId: field.id,
          fieldLabel: field.label,
          value: values,
        });
      }
    }
    return filters;
  }, [currentQuickFilters]);

  const getOptionLabel = React.useCallback((fieldId: string, value: string) => {
    const field = QUICK_FIELDS.find((f) => f.id === fieldId);
    const option = field?.options?.find((o: any) => o.value === value);
    return option?.label ?? value;
  }, []);

  // Handle toggling a quick filter value
  const handleToggleValue = React.useCallback(
    (fieldId: string, optionValue: string) => {
      const newQuickFilters = { ...currentQuickFilters };
      const current = newQuickFilters[fieldId] ?? [];
      const nextValues = current.includes(optionValue)
        ? current.filter((v) => v !== optionValue)
        : [...current, optionValue];

      if (nextValues.length > 0) {
        newQuickFilters[fieldId] = nextValues;
      } else {
        delete newQuickFilters[fieldId];
      }

      // Convert to FilterState and replace entire FilterState
      // This ensures quick filters overwrite advanced filters if they exist
      const newFilterState = convertQuickFiltersToFilterState(newQuickFilters);
      filterActions.setGroups(newFilterState.groups);
    },
    [currentQuickFilters, filterActions],
  );

  const removeFilter = React.useCallback(
    (fieldId: string) => {
      const newQuickFilters = { ...currentQuickFilters };
      delete newQuickFilters[fieldId];

      // If no quick filters remain, clear FilterState
      if (Object.keys(newQuickFilters).length === 0) {
        filterActions.setGroups([]);
      } else {
        const newFilterState = convertQuickFiltersToFilterState(newQuickFilters);
        filterActions.setGroups(newFilterState.groups);
      }
    },
    [currentQuickFilters, filterActions],
  );

  const handleAdvancedClick = React.useCallback(() => {
    setOpen(false);
    onOpenAdvanced();
  }, [onOpenAdvanced]);

  // Keyboard shortcut: Shift + Cmd/Ctrl + F
  useHotkeys("shift+mod+f", (event) => {
    event.preventDefault();
    handleAdvancedClick();
  });

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
        <DropdownMenuContent align="start" className="p-0">
          <div className="max-h-[400px] overflow-y-auto">
            <div>
              {QUICK_FIELDS.map((field) => {
                const selectedValues = currentQuickFilters[field.id] ?? [];
                return (
                  <QuickFilterItem
                    key={field.id}
                    field={field}
                    selectedValues={selectedValues}
                    onToggleValue={(optionValue: string) =>
                      handleToggleValue(field.id, optionValue)
                    }
                  />
                );
              })}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleAdvancedClick}>
            Advanced filters
            <DropdownMenuShortcut>⇧⌘F</DropdownMenuShortcut>
          </DropdownMenuItem>
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
            key={filter.fieldId}
            className="group relative flex items-center h-9 px-2 rounded-none bg-accent type-p text-secondary"
            title={displayText}
          >
            <span className="truncate">{truncatedText}</span>
            <button
              type="button"
              disabled={disabled}
              onClick={() => removeFilter(filter.fieldId)}
              className="absolute right-0 h-full px-2 bg-accent opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed flex items-center"
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
  selectedValues,
  onToggleValue,
}: {
  field: any;
  selectedValues: string[];
  onToggleValue: (optionValue: string) => void;
}) {
  const { options: dynamicOptions, isLoading } = useFieldOptions(field.id);

  const options = React.useMemo(
    () => field.options ?? dynamicOptions,
    [field.options, dynamicOptions],
  );
  const hideSearch = field.id === "status" || field.id === "moduleCompletion";

  const toggleValue = React.useCallback(
    (optionValue: string) => {
      onToggleValue(optionValue);
    },
    [onToggleValue],
  );

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <span>{field.label}</span>
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
          <Command>
            {!hideSearch && (
              <CommandInput
                placeholder={`Search ${field.label.toLowerCase()}...`}
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
                      className="[&_.status-icon]:h-[14px] [&_.status-icon]:w-[14px]"
                    >
                      <div className="flex items-center gap-2">
                        {renderStatusIcon(field.id, option.value)}
                        <span>{option.label}</span>
                      </div>
                      {isSelected && <Icons.Check className="h-4 w-4" />}
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
