"use client";

import { getQuickFilterFields } from "@/config/filters";
import { useFieldOptions } from "@/hooks/use-filter-options";
import { useBrandCatalog } from "@/hooks/use-brand-catalog";
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
import { cn } from "@v1/ui/cn";
import { format } from "date-fns";
import * as React from "react";
import { useHotkeys } from "react-hotkeys-hook";
import type { FilterActions, FilterState } from "../passports/filter-types";

interface QuickFiltersPopoverProps {
  filterState: FilterState;
  filterActions: FilterActions;
  onOpenAdvanced?: () => void;
  disabled?: boolean;
  /**
   * Whether to show the "Advanced filters" option.
   * Defaults to true. Set to false to hide the option and disable the keyboard shortcut.
   */
  showAdvancedFilters?: boolean;
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
  showAdvancedFilters = true,
}: QuickFiltersPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [openSubmenu, setOpenSubmenu] = React.useState<string | null>(null);

  // Store pending selections locally - only apply when popover closes
  const [pendingQuickFilters, setPendingQuickFilters] = React.useState<Record<string, string[]>>({});
  const [hasLocalChanges, setHasLocalChanges] = React.useState(false);

  // Extract current quick filter selections from FilterState
  // If advanced filters exist, show empty (quick filters will overwrite on apply)
  const currentQuickFilters = React.useMemo(() => {
    if (hasQuickFilters(filterState)) {
      return extractQuickFiltersFromFilterState(filterState);
    }
    return {};
  }, [filterState]);

  // Sync pending filters with actual filters when popover opens
  React.useEffect(() => {
    if (open) {
      setPendingQuickFilters(currentQuickFilters);
      setHasLocalChanges(false);
    }
  }, [open, currentQuickFilters]);

  // The display filters - show pending when open, otherwise show current
  const displayFilters = open ? pendingQuickFilters : currentQuickFilters;

  const activeFilters = React.useMemo(() => {
    const filters: Array<{
      fieldId: string;
      fieldLabel: string;
      value: string[];
    }> = [];
    for (const field of QUICK_FIELDS) {
      const values = displayFilters[field.id] ?? [];
      if (values.length > 0) {
        filters.push({
          fieldId: field.id,
          fieldLabel: field.label,
          value: values,
        });
      }
    }
    return filters;
  }, [displayFilters]);

  // Handle toggling a quick filter value - only updates local state
  const handleToggleValue = React.useCallback(
    (fieldId: string, optionValue: string) => {
      setPendingQuickFilters((prev) => {
        const newQuickFilters = { ...prev };

        // Standard multi-select toggle behavior
        const current = newQuickFilters[fieldId] ?? [];
        const nextValues = current.includes(optionValue)
          ? current.filter((v) => v !== optionValue)
          : [...current, optionValue];

        if (nextValues.length > 0) {
          newQuickFilters[fieldId] = nextValues;
        } else {
          delete newQuickFilters[fieldId];
        }

        return newQuickFilters;
      });
      setHasLocalChanges(true);
    },
    [],
  );

  // Apply pending filters to actual filter state
  const applyPendingFilters = React.useCallback(() => {
    if (!hasLocalChanges) return;

    const newFilterState = convertQuickFiltersToFilterState(pendingQuickFilters);
    filterActions.setGroups(newFilterState.groups);
    setHasLocalChanges(false);
  }, [pendingQuickFilters, hasLocalChanges, filterActions]);

  // Handle popover open/close - apply filters on close
  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!newOpen && hasLocalChanges) {
        // Popover is closing - apply pending filters
        applyPendingFilters();
      }
      setOpen(newOpen);
    },
    [hasLocalChanges, applyPendingFilters],
  );

  const removeFilter = React.useCallback(
    (fieldId: string) => {
      const newQuickFilters = { ...currentQuickFilters };
      delete newQuickFilters[fieldId];

      // If no quick filters remain, clear FilterState
      if (Object.keys(newQuickFilters).length === 0) {
        filterActions.setGroups([]);
      } else {
        const newFilterState =
          convertQuickFiltersToFilterState(newQuickFilters);
        filterActions.setGroups(newFilterState.groups);
      }
    },
    [currentQuickFilters, filterActions],
  );

  const handleAdvancedClick = React.useCallback(() => {
    if (!showAdvancedFilters || !onOpenAdvanced) return;
    // Apply pending filters before opening advanced
    if (hasLocalChanges) {
      applyPendingFilters();
    }
    setOpen(false);
    onOpenAdvanced();
  }, [onOpenAdvanced, showAdvancedFilters, hasLocalChanges, applyPendingFilters]);

  // Keyboard shortcut: Shift + Cmd/Ctrl + F (only when advanced filters are enabled)
  useHotkeys(
    "shift+mod+f",
    (event) => {
      if (!showAdvancedFilters) return;
      event.preventDefault();
      handleAdvancedClick();
    },
    { enabled: showAdvancedFilters },
    [handleAdvancedClick, showAdvancedFilters],
  );

  return (
    <>
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="subtle"
            size="default"
            disabled={disabled}
          >
            <Icons.Filter className="h-[14px] w-[14px]" />
            <span className="px-1">Filter</span>
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
                const selectedValues = pendingQuickFilters[field.id] ?? [];
                return (
                  <QuickFilterItem
                    key={field.id}
                    field={field}
                    selectedValues={selectedValues}
                    onToggleValue={(optionValue: string) =>
                      handleToggleValue(field.id, optionValue)
                    }
                    openSubmenu={openSubmenu}
                    onOpenSubmenuChange={setOpenSubmenu}
                  />
                );
              })}
            </div>
          </div>
          {showAdvancedFilters && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleAdvancedClick}>
                Advanced filters
                <DropdownMenuShortcut>⇧⌘F</DropdownMenuShortcut>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ActiveFiltersDisplay
        activeFilters={activeFilters}
        disabled={disabled}
        onRemoveFilter={removeFilter}
      />

      {/* Advanced filter tag */}
      {hasAdvancedFilters(filterState) && (
        <div className="group relative flex items-center h-9 px-2 rounded-none bg-accent type-p text-secondary">
          <span className="truncate">Advanced filter</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => filterActions.setGroups([])}
            className="absolute right-0 h-full px-2 bg-accent opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed flex items-center"
            aria-label="Remove advanced filter"
          >
            <Icons.X className="h-3 w-3 text-secondary flex-shrink-0" />
          </button>
        </div>
      )}
    </>
  );
}

// Helper function to format season date range
function formatSeasonDateRange(season: {
  startDate?: Date | null;
  endDate?: Date | null;
  isOngoing?: boolean;
}): string {
  if (season.isOngoing) {
    return "Ongoing";
  }

  if (!season.startDate || !season.endDate) {
    return "";
  }

  const startMonth = format(season.startDate, "MMMM yyyy");
  const endMonth = format(season.endDate, "MMMM yyyy");

  return `${startMonth} to ${endMonth}`;
}

// Paged category hierarchy component (similar to category-select.tsx)
const CategoryHierarchySubmenu = React.memo(function CategoryHierarchySubmenu({
  categoryHierarchy,
  categoryMap,
  selectedValues,
  onToggleValue,
}: {
  categoryHierarchy: Record<
    string,
    { label: string; id: string; children?: Record<string, any> }
  >;
  categoryMap: Map<string, { name: string; parentId: string | null }>;
  selectedValues: string[];
  onToggleValue: (categoryId: string) => void;
}) {
  const [categoryPath, setCategoryPath] = React.useState<string[]>([]);
  const [hoveredRow, setHoveredRow] = React.useState<string | null>(null);
  const [hoveredArea, setHoveredArea] = React.useState<
    "selection" | "navigation" | null
  >(null);

  // Helper function to get current level options
  const getCurrentLevelOptions = React.useCallback(() => {
    let current: any = categoryHierarchy;
    for (const key of categoryPath) {
      current = current[key]?.children || {};
    }
    return current;
  }, [categoryHierarchy, categoryPath]);

  // Helper function to get breadcrumb string for navigation
  const getBreadcrumbString = React.useCallback(() => {
    if (categoryPath.length === 0) return "";

    const labels: string[] = [];
    let current: any = categoryHierarchy;

    for (const key of categoryPath) {
      if (current[key]) {
        labels.push(current[key].label);
        current = current[key].children || {};
      }
    }

    return labels.join(" / ");
  }, [categoryHierarchy, categoryPath]);

  const handleCategoryNavigate = React.useCallback((categoryId: string) => {
    setCategoryPath((prev) => [...prev, categoryId]);
  }, []);

  const handleCategoryBack = React.useCallback(() => {
    setCategoryPath((prev) => prev.slice(0, -1));
  }, []);

  const handleCategorySelect = React.useCallback(
    (categoryId: string) => {
      onToggleValue(categoryId);
    },
    [onToggleValue],
  );

  const currentLevel = getCurrentLevelOptions();

  return (
    <div className="flex flex-col">
      {/* Navigation Bar */}
      {categoryPath.length > 0 && (
        <div className="border-b border-border bg-background">
          <button
            type="button"
            onClick={handleCategoryBack}
            className="w-full py-2 px-3 type-p text-primary focus:outline-none flex items-center hover:bg-accent transition-colors"
          >
            <Icons.ChevronLeft className="h-4 w-4 mr-2 text-secondary" />
            <span className="text-primary">{getBreadcrumbString()}</span>
          </button>
        </div>
      )}

      {/* Options */}
      <div className="max-h-48 overflow-y-auto scrollbar-hide">
        {Object.entries(currentLevel).map(
          ([categoryId, node]: [string, any]) => {
            const hasChildren =
              node.children && Object.keys(node.children).length > 0;
            const isSelected = selectedValues.includes(categoryId);

            return (
              <div key={categoryId} className="relative">
                {hasChildren ? (
                  // Button-in-button layout for items with children
                  <div
                    className={cn(
                      "flex transition-colors",
                      hoveredRow === categoryId ? "bg-accent" : "",
                    )}
                    onMouseLeave={() => {
                      setHoveredRow(null);
                      setHoveredArea(null);
                    }}
                  >
                    {/* Selection area */}
                    <button
                      type="button"
                      onClick={() => handleCategorySelect(categoryId)}
                      onMouseEnter={() => {
                        setHoveredRow(categoryId);
                        setHoveredArea("selection");
                      }}
                      className={cn(
                        "w-fit px-3 py-2 type-p transition-colors flex items-center gap-2",
                        isSelected
                          ? "bg-accent-blue text-brand"
                          : hoveredRow === categoryId &&
                            hoveredArea === "selection"
                            ? "bg-accent-dark text-primary"
                            : "text-primary",
                      )}
                    >
                      <span>{node.label}</span>
                      {isSelected && (
                        <Icons.Check className="h-4 w-4 text-brand" />
                      )}
                    </button>

                    {/* Navigation area */}
                    <button
                      type="button"
                      onClick={() => handleCategoryNavigate(categoryId)}
                      onMouseEnter={() => {
                        setHoveredRow(categoryId);
                        setHoveredArea("navigation");
                      }}
                      className="flex-1 py-2 px-2 transition-colors flex items-center justify-end"
                    >
                      <Icons.ChevronRight className="h-4 w-4 text-tertiary" />
                    </button>
                  </div>
                ) : (
                  // Full-width button for leaf items
                  <button
                    type="button"
                    onClick={() => handleCategorySelect(categoryId)}
                    className={cn(
                      "w-full px-3 py-2 type-p text-left transition-colors flex items-center justify-between",
                      isSelected
                        ? "bg-accent-blue text-brand"
                        : "hover:bg-accent text-primary",
                    )}
                  >
                    <span>{node.label}</span>
                    {isSelected && (
                      <Icons.Check className="h-4 w-4 text-brand" />
                    )}
                  </button>
                )}
              </div>
            );
          },
        )}
      </div>
    </div>
  );
});

// Tags selection component with hex color swatches
const TagsSubmenu = React.memo(function TagsSubmenu({
  tags,
  selectedValues,
  onToggleValue,
}: {
  tags: Array<{ id: string; name: string; hex: string }>;
  selectedValues: string[];
  onToggleValue: (tagId: string) => void;
}) {
  const [searchTerm, setSearchTerm] = React.useState("");

  // Filter tags by search term
  const filteredTags = React.useMemo(() => {
    if (!searchTerm) return tags;
    const lower = searchTerm.toLowerCase();
    return tags.filter((t) => t.name.toLowerCase().includes(lower));
  }, [tags, searchTerm]);

  return (
    <Command shouldFilter={false}>
      <CommandInput
        placeholder="Search tags..."
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      <CommandList className="max-h-64">
        <CommandGroup>
          {filteredTags.map((tag) => {
            const isSelected = selectedValues.includes(tag.id);
            return (
              <CommandItem
                key={tag.id}
                value={tag.name}
                onSelect={() => onToggleValue(tag.id)}
                className="justify-between"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3.5 w-3.5 rounded-full border border-border flex-shrink-0"
                    style={{ backgroundColor: `#${tag.hex}` }}
                  />
                  <span className="type-p text-primary">{tag.name}</span>
                </div>
                {isSelected && <Icons.Check className="h-4 w-4" />}
              </CommandItem>
            );
          })}
        </CommandGroup>
        {filteredTags.length === 0 && (
          <CommandEmpty>No tags found</CommandEmpty>
        )}
      </CommandList>
    </Command>
  );
});

// Active filters display component with proper label lookup
const ActiveFiltersDisplay = React.memo(function ActiveFiltersDisplay({
  activeFilters,
  disabled,
  onRemoveFilter,
}: {
  activeFilters: Array<{
    fieldId: string;
    fieldLabel: string;
    value: string[];
  }>;
  disabled: boolean;
  onRemoveFilter: (fieldId: string) => void;
}) {
  // Get dynamic options for all fields
  const { options: categoryOptions } = useFieldOptions("categoryId");
  const { seasons, tags } = useBrandCatalog();

  const getOptionLabel = React.useCallback(
    (fieldId: string, value: string) => {
      const field = QUICK_FIELDS.find((f) => f.id === fieldId);
      // Check static options first
      const staticOption = field?.options?.find((o: any) => o.value === value);
      if (staticOption) return staticOption.label;

      // Check dynamic options based on field type
      if (fieldId === "categoryId") {
        const option = categoryOptions.find((o) => o.value === value);
        return option?.label ?? value;
      }
      if (fieldId === "season") {
        const season = seasons.find((s) => s.id === value);
        return season?.name ?? value;
      }
      if (fieldId === "tagId") {
        const tag = tags.find((t) => t.id === value);
        return tag?.name ?? value;
      }

      return value;
    },
    [categoryOptions, seasons, tags],
  );

  return (
    <>
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
              onClick={() => onRemoveFilter(filter.fieldId)}
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
});

const QuickFilterItem = React.memo(function QuickFilterItem({
  field,
  selectedValues,
  onToggleValue,
  openSubmenu,
  onOpenSubmenuChange,
}: {
  field: any;
  selectedValues: string[];
  onToggleValue: (optionValue: string) => void;
  openSubmenu: string | null;
  onOpenSubmenuChange: (fieldId: string | null) => void;
}) {
  // For season field, we need to use useBrandCatalog directly since it's not in useFieldOptions
  const isSeasonField = field.id === "season";
  const { options: dynamicOptions, isLoading: isDynamicLoading } =
    useFieldOptions(field.id);
  const {
    categoryHierarchy,
    categoryMap,
    seasons,
    tags,
  } = useBrandCatalog();

  // For season, convert seasons to options format
  const seasonOptions = React.useMemo(() => {
    if (!isSeasonField) return [];
    return seasons.map((season) => ({
      value: season.id,
      label: season.name,
    }));
  }, [isSeasonField, seasons]);

  const options = React.useMemo(() => {
    if (isSeasonField) return seasonOptions;
    return field.options ?? dynamicOptions;
  }, [field.options, dynamicOptions, isSeasonField, seasonOptions]);

  const isLoading = isSeasonField ? false : isDynamicLoading;
  const hideSearch = field.id === "status";

  const toggleValue = React.useCallback(
    (optionValue: string) => {
      onToggleValue(optionValue);
    },
    [onToggleValue],
  );

  // Special handling for category (hierarchical)
  if (field.id === "categoryId") {
    return (
      <DropdownMenuSub
        open={openSubmenu === field.id}
        onOpenChange={(open) => {
          onOpenSubmenuChange(open ? field.id : null);
        }}
      >
        <DropdownMenuSubTrigger>
          <span>{field.label}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>
            <CategoryHierarchySubmenu
              categoryHierarchy={categoryHierarchy}
              categoryMap={categoryMap}
              selectedValues={selectedValues}
              onToggleValue={toggleValue}
            />
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>
    );
  }

  // Special handling for tags (with hex color swatches)
  if (field.id === "tagId") {
    return (
      <DropdownMenuSub
        open={openSubmenu === field.id}
        onOpenChange={(open) => {
          onOpenSubmenuChange(open ? field.id : null);
        }}
      >
        <DropdownMenuSubTrigger>
          <span>{field.label}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuPortal>
          <DropdownMenuSubContent>
            <TagsSubmenu
              tags={tags}
              selectedValues={selectedValues}
              onToggleValue={toggleValue}
            />
          </DropdownMenuSubContent>
        </DropdownMenuPortal>
      </DropdownMenuSub>
    );
  }

  // Standard rendering for other fields
  return (
    <DropdownMenuSub
      open={openSubmenu === field.id}
      onOpenChange={(open) => {
        onOpenSubmenuChange(open ? field.id : null);
      }}
    >
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

                  // Get season info for season field
                  let seasonInfo:
                    | {
                      startDate?: Date | null;
                      endDate?: Date | null;
                      isOngoing?: boolean;
                    }
                    | undefined;
                  if (field.id === "season") {
                    const season = seasons.find((s) => s.id === option.value);
                    if (season) {
                      seasonInfo = {
                        startDate: season.startDate,
                        endDate: season.endDate,
                        isOngoing: season.isOngoing,
                      };
                    }
                  }

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
                        {seasonInfo && (
                          <span className="type-p text-tertiary ml-auto">
                            {formatSeasonDateRange(seasonInfo)}
                          </span>
                        )}
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
