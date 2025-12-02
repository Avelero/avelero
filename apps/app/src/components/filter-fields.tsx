"use client";

import { RELATIVE_DATE_OPTIONS } from "@/config/filters";
import { useFieldOptions } from "@/hooks/use-filter-options";
import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { BooleanToggle } from "@v1/ui/boolean";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { DatePicker } from "@v1/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@v1/ui/dropdown-menu";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { MinMaxInput } from "@v1/ui/min-max";
import { Select } from "@v1/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@v1/ui/command";
import { format } from "date-fns";
import * as React from "react";
import type {
  FilterFieldConfig,
  FilterOperator,
  FilterValue,
} from "./passports/filter-types";

interface FilterFieldInputProps {
  fieldConfig: FilterFieldConfig;
  operator: FilterOperator | null | undefined;
  value: FilterValue;
  onOperatorChange: (operator: FilterOperator) => void;
  onValueChange: (value: FilterValue) => void;
}

/**
 * Integrated control that renders BOTH operator selector and value input
 * based on the field configuration. Some field types (e.g., boolean)
 * do not render an operator selector at all.
 */
export function FilterFieldInput({
  fieldConfig,
  operator,
  value,
  onOperatorChange,
  onValueChange,
}: FilterFieldInputProps) {
  // Hoist dynamic options loading to satisfy Rules of Hooks
  const { options: dynamicOptions, isLoading } = useFieldOptions(
    fieldConfig.id,
  );

  // Hoist useBrandCatalog to satisfy Rules of Hooks
  const { colors, tags, seasons } = useBrandCatalog();

  // Enhance multi-select options with visual indicators (must be at top level for Rules of Hooks)
  const enhancedMultiSelectOptions = React.useMemo(() => {
    // Only enhance if it's a multi-select field that needs enhancement
    if (fieldConfig.inputType !== "multi-select") {
      return null;
    }

    const options = fieldConfig.options ?? dynamicOptions;

    if (fieldConfig.id === "tagId") {
      // Add color circles for tags
      return options.map((option) => {
        const tag = tags.find((t) => t.id === option.value);
        return {
          ...option,
          icon: tag ? (
            <div
              className="h-3.5 w-3.5 rounded-full border border-border flex-shrink-0"
              style={{ backgroundColor: `#${tag.hex}` }}
            />
          ) : undefined,
        };
      });
    }

    if (fieldConfig.id === "colorId") {
      // Add color circles for colors
      return options.map((option) => {
        const color = colors.find((c) => c.id === option.value);
        return {
          ...option,
          icon: color ? (
            <div
              className="h-3.5 w-3.5 rounded-full border border-border flex-shrink-0"
              style={{ backgroundColor: `#${color.hex}` }}
            />
          ) : undefined,
        };
      });
    }

    // Season enhancement is now handled in SeasonPopoverSelect component
    // No need to enhance here since we use a custom component

    // For other multi-select fields, return options as-is
    return options;
  }, [fieldConfig.inputType, fieldConfig.id, fieldConfig.options, dynamicOptions, colors, tags, seasons]);

  // Boolean fields: show True/False only (no operator)
  if (fieldConfig.inputType === "boolean") {
    const boolValue = (value as boolean) ?? false;
    return (
      <div className="flex items-center gap-2 w-full">
        {/* Static operator container matching operator button size/style */}
        <div className="flex items-center justify-center type-p !leading-4 text-primary border border-border px-3 py-2.5 h-9 bg-background">
          <div className="flex items-center justify-center px-1">equals</div>
        </div>

        <BooleanToggle
          value={boolValue}
          onChange={onValueChange}
          leftLabel="False"
          rightLabel="True"
        />
      </div>
    );
  }

  // Build operator selector only when meaningful
  // Exclude number/percentage/date fields as they now have integrated controls
  const showOperator =
    fieldConfig.operators &&
    fieldConfig.operators.length > 0 &&
    fieldConfig.inputType !== "number" &&
    fieldConfig.inputType !== "percentage" &&
    fieldConfig.inputType !== "date";

  // Helper: some operators do not require a value
  const operatorNeedsNoValue =
    operator === "is empty" || operator === "is not empty";

  // Route rendering by input type
  const renderValueControl = () => {
    switch (fieldConfig.inputType) {
      case "text":
        return operatorNeedsNoValue ? null : (
          <Input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={fieldConfig.placeholder ?? "Enter value..."}
            className="h-9"
          />
        );

      case "number":
      case "percentage":
        return (
          <MinMaxInput
            value={value as { min?: number; max?: number }}
            onChange={(newValue) => {
              // Automatically set operator to "between" when range value is provided
              const hasMin = newValue.min != null;
              const hasMax = newValue.max != null;
              if ((hasMin || hasMax) && operator !== "between") {
                onOperatorChange("between" as FilterOperator);
              }
              onValueChange(newValue);
            }}
            unit={fieldConfig.unit}
          />
        );

      case "select": {
        const options = fieldConfig.options ?? dynamicOptions;
        return operatorNeedsNoValue ? null : (
          <Select
            options={options}
            value={value as string}
            onValueChange={onValueChange}
            placeholder="Select..."
            searchable
            loading={isLoading}
            inline
          />
        );
      }

      case "multi-select": {
        // Special handling for categoryId - use hierarchical paged navigation
        if (fieldConfig.id === "categoryId") {
          return operatorNeedsNoValue ? null : (
            <CategoryPopoverSelect
              value={(value as string[]) ?? []}
              onValueChange={onValueChange}
            />
          );
        }

        // Special handling for sizeId - use paged navigation
        if (fieldConfig.id === "sizeId") {
          return operatorNeedsNoValue ? null : (
            <SizePopoverSelect
              value={(value as string[]) ?? []}
              onValueChange={onValueChange}
            />
          );
        }

        // Special handling for season - use custom popover with date info
        if (fieldConfig.id === "season") {
          return operatorNeedsNoValue ? null : (
            <SeasonPopoverSelect
              value={(value as string[]) ?? []}
              onValueChange={onValueChange}
            />
          );
        }

        // Use enhanced options if available, otherwise fall back to regular options
        const options = enhancedMultiSelectOptions ?? (fieldConfig.options ?? dynamicOptions);
        
        return operatorNeedsNoValue ? null : (
          <Select
            multiple
            options={options}
            value={(value as string[]) ?? []}
            onValueChange={onValueChange}
            placeholder="Select..."
            searchable
            loading={isLoading}
            inline
          />
        );
      }

      case "hierarchical": {
        // Handle hierarchical input type (categoryId in advanced filters should be multi-select, but handle this case too)
        if (fieldConfig.id === "categoryId") {
          return operatorNeedsNoValue ? null : (
            <CategoryPopoverSelect
              value={(value as string[]) ?? []}
              onValueChange={onValueChange}
            />
          );
        }
        // Fall through to default for other hierarchical fields
        break;
      }

      case "date": {
        const rangeValue = value as any;
        const afterDate = rangeValue?.after ? new Date(rangeValue.after) : null;
        const beforeDate = rangeValue?.before
          ? new Date(rangeValue.before)
          : null;

        // Validation: check if after > before
        const afterInvalid = afterDate && beforeDate && afterDate > beforeDate;
        const beforeInvalid = afterDate && beforeDate && beforeDate < afterDate;

        const handleAfterChange = (date: Date | null) => {
          const newAfter = date;
          const newBefore = beforeDate;

          // Automatically determine the operator based on which fields are filled
          let newOperator: FilterOperator;
          if (newAfter && newBefore) {
            newOperator = "is between" as FilterOperator;
          } else if (newAfter && !newBefore) {
            newOperator = "is after" as FilterOperator;
          } else if (!newAfter && newBefore) {
            newOperator = "is before" as FilterOperator;
          } else {
            newOperator = "is between" as FilterOperator;
          }

          onOperatorChange(newOperator);
          onValueChange({
            after: newAfter?.toISOString() ?? "",
            before: newBefore?.toISOString() ?? "",
          });
        };

        const handleBeforeChange = (date: Date | null) => {
          const newAfter = afterDate;
          const newBefore = date;

          // Automatically determine the operator based on which fields are filled
          let newOperator: FilterOperator;
          if (newAfter && newBefore) {
            newOperator = "is between" as FilterOperator;
          } else if (newAfter && !newBefore) {
            newOperator = "is after" as FilterOperator;
          } else if (!newAfter && newBefore) {
            newOperator = "is before" as FilterOperator;
          } else {
            newOperator = "is between" as FilterOperator;
          }

          onOperatorChange(newOperator);
          onValueChange({
            after: newAfter?.toISOString() ?? "",
            before: newBefore?.toISOString() ?? "",
          });
        };

        return (
          <div className="flex items-center gap-2 w-full">
            <DatePicker
              value={afterDate}
              onChange={handleAfterChange}
              placeholder="After"
              className={cn(afterInvalid && "[&_input]:border-destructive")}
              inline
            />
            <DatePicker
              value={beforeDate}
              onChange={handleBeforeChange}
              placeholder="Before"
              className={cn(beforeInvalid && "[&_input]:border-destructive")}
              inline
            />
          </div>
        );
      }

      case "date-relative": {
        return (
          <Select
            options={RELATIVE_DATE_OPTIONS}
            value={(value as any)?.option ?? null}
            onValueChange={(option: string) => {
              onOperatorChange("relative" as FilterOperator);
              onValueChange({ type: "relative", option: option as any });
            }}
            placeholder="Select..."
            inline
          />
        );
      }

      case "country":
        return operatorNeedsNoValue ? null : (
          <Input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={fieldConfig.placeholder ?? "Country code"}
            className="h-9"
          />
        );

      default:
        return (
          <Input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder={fieldConfig.placeholder ?? "Enter value..."}
            className="h-9"
          />
        );
    }
  };

  return (
    <div className="flex items-center gap-2 w-full">
      {showOperator && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className={cn(
                "justify-between",
                operatorNeedsNoValue ? "w-full" : "w-fit",
              )}
              icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
            >
              <span className="truncate">
                {operator || "Select operator..."}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]" inline>
            {fieldConfig.operators.map((op) => (
              <DropdownMenuItem key={op} onSelect={() => onOperatorChange(op)}>
                <span>{op}</span>
                <Icons.Check
                  className={cn(
                    "h-4 w-4 ml-auto",
                    operator === op ? "opacity-100" : "opacity-0",
                  )}
                />
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {!operatorNeedsNoValue && (
        <div className="flex-1 min-w-0">{renderValueControl()}</div>
      )}
    </div>
  );
}

// Category Popover Select Component (hierarchical paged navigation)
function CategoryPopoverSelect({
  value,
  onValueChange,
}: {
  value: string[];
  onValueChange: (value: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const { categoryHierarchy, categoryMap } = useBrandCatalog();
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
      const newValue = value.includes(categoryId)
        ? value.filter((v) => v !== categoryId)
        : [...value, categoryId];
      onValueChange(newValue);
    },
    [value, onValueChange],
  );

  const currentLevel = getCurrentLevelOptions();

  // Display text for trigger button
  const displayText = React.useMemo(() => {
    if (value.length === 0) return "Select category...";
    if (value.length === 1) {
      // Find category name
      const firstValue = value[0];
      if (!firstValue) return "1 selected";
      const cat = categoryMap.get(firstValue);
      return cat?.name ?? "1 selected";
    }
    return `${value.length} selected`;
  }, [value, categoryMap]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className="w-full justify-between"
          icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
        >
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start" inline>
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
            {Object.entries(currentLevel).map(([categoryId, node]: [string, any]) => {
              const hasChildren =
                node.children && Object.keys(node.children).length > 0;
              const isSelected = value.includes(categoryId);

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
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Size Popover Select Component (paged navigation)
function SizePopoverSelect({
  value,
  onValueChange,
}: {
  value: string[];
  onValueChange: (value: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const {
    tierTwoCategoryHierarchy,
    sizeOptions,
  } = useBrandCatalog();
  const [navigationPath, setNavigationPath] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Compute tier one categories from tier two hierarchy
  const tierOneCategories = React.useMemo(() => {
    return Object.keys(tierTwoCategoryHierarchy).sort();
  }, [tierTwoCategoryHierarchy]);

  // Group sizes by category path
  const sizesByCategory = React.useMemo(() => {
    const map = new Map<string, typeof sizeOptions>();
    for (const size of sizeOptions) {
      const existing = map.get(size.categoryPath) || [];
      existing.push(size);
      map.set(size.categoryPath, existing);
    }
    // Sort sizes within each category
    for (const [key, sizes] of map.entries()) {
      sizes.sort((a, b) => a.sortIndex - b.sortIndex);
    }
    return map;
  }, [sizeOptions]);

  // Get current view based on navigation path
  const currentView = React.useMemo(() => {
    if (navigationPath.length === 0) {
      return { type: "tier-one" as const, categories: tierOneCategories };
    }
    if (navigationPath.length === 1) {
      const tierOneKey = navigationPath[0];
      const tierTwoPaths = tierOneKey ? (tierTwoCategoryHierarchy[tierOneKey] || []) : [];
      const tierTwoNames = tierTwoPaths.map((path) => path.split(" / ")[1] || path);
      return { type: "tier-two" as const, categories: tierTwoNames };
    }
    const tierOneKey = navigationPath[0];
    const tierTwoKey = navigationPath[1];
    const fullCategoryPath = `${tierOneKey} / ${tierTwoKey}`;
    const sizes = sizesByCategory.get(fullCategoryPath) || [];
    return { type: "sizes" as const, sizes };
  }, [navigationPath, tierOneCategories, tierTwoCategoryHierarchy, sizesByCategory]);

  // Filter sizes when searching on page 3
  const filteredSizes = React.useMemo(() => {
    if (currentView.type !== "sizes" || !searchTerm) {
      return currentView.type === "sizes" ? currentView.sizes : [];
    }
    return currentView.sizes.filter((s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [currentView, searchTerm]);

  const handleNavigateForward = React.useCallback((category: string) => {
    setNavigationPath((prev) => [...prev, category]);
    setSearchTerm("");
  }, []);

  const handleNavigateBack = React.useCallback(() => {
    setNavigationPath((prev) => prev.slice(0, -1));
    setSearchTerm("");
  }, []);

  const handleToggleSize = React.useCallback(
    (size: typeof sizeOptions[0]) => {
      const sizeId = size.id || `${size.categoryKey}-${size.name}`;
      const newValue = value.includes(sizeId)
        ? value.filter((v) => v !== sizeId)
        : [...value, sizeId];
      onValueChange(newValue);
    },
    [value, onValueChange, sizeOptions],
  );

  // Get breadcrumb string for navigation bar
  const getBreadcrumbString = React.useCallback(() => {
    return navigationPath.join(" / ");
  }, [navigationPath]);

  // Display text for trigger button
  const displayText = React.useMemo(() => {
    if (value.length === 0) return "Select size...";
    if (value.length === 1) {
      // Find size name
      const firstValue = value[0];
      if (!firstValue) return "1 selected";
      const size = sizeOptions.find(
        (s) => (s.id || `${s.categoryKey}-${s.name}`) === firstValue,
      );
      return size?.name ?? "1 selected";
    }
    return `${value.length} selected`;
  }, [value, sizeOptions]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className="w-full justify-between"
          icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
        >
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start" inline>
        <div className="flex flex-col">
          {/* Navigation Bar for tier-two (page 2) */}
          {currentView.type === "tier-two" && navigationPath.length > 0 && (
            <div className="border-b border-border bg-background">
              <button
                type="button"
                onClick={handleNavigateBack}
                className="w-full py-2 px-3 type-p text-primary focus:outline-none flex items-center hover:bg-accent transition-colors"
              >
                <Icons.ChevronLeft className="h-4 w-4 mr-2 text-secondary" />
                <span className="text-primary">{getBreadcrumbString()}</span>
              </button>
            </div>
          )}

          {/* Content Area */}
          <div
            className={cn(
              currentView.type === "sizes" ? "" : "max-h-48 overflow-y-auto scrollbar-hide",
            )}
          >
            {currentView.type === "tier-one" && (
              <>
                {tierOneCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleNavigateForward(category)}
                    className="w-full px-3 py-2 type-p text-left transition-colors flex items-center justify-between hover:bg-accent text-primary"
                  >
                    <span>{category}</span>
                    <Icons.ChevronRight className="h-4 w-4 text-tertiary" />
                  </button>
                ))}
              </>
            )}

            {currentView.type === "tier-two" && (
              <>
                {currentView.categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleNavigateForward(category)}
                    className="w-full px-3 py-2 type-p text-left transition-colors flex items-center justify-between hover:bg-accent text-primary"
                  >
                    <span>{category}</span>
                    <Icons.ChevronRight className="h-4 w-4 text-tertiary" />
                  </button>
                ))}
              </>
            )}

            {currentView.type === "sizes" && (
              <Command shouldFilter={false}>
                <div className="flex items-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleNavigateBack}
                    className="h-[37px] w-[37px] flex-shrink-0 rounded-none border-0 border-b border-r text-tertiary hover:text-secondary"
                  >
                    <Icons.ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex-1">
                    <CommandInput
                      placeholder="Search sizes..."
                      value={searchTerm}
                      onValueChange={setSearchTerm}
                    />
                  </div>
                </div>
                <CommandList className="max-h-48">
                  <CommandGroup>
                    {filteredSizes.length > 0 ? (
                      filteredSizes.map((size) => {
                        const sizeId = size.id || `${size.categoryKey}-${size.name}`;
                        const isSelected = value.includes(sizeId);
                        return (
                          <CommandItem
                            key={sizeId}
                            value={size.name}
                            onSelect={() => handleToggleSize(size)}
                            className="justify-between"
                          >
                            <span className="type-p text-primary">{size.name}</span>
                            {isSelected && <Icons.Check className="h-4 w-4" />}
                          </CommandItem>
                        );
                      })
                    ) : searchTerm ? (
                      <CommandEmpty>No results found</CommandEmpty>
                    ) : (
                      <CommandEmpty>No sizes available</CommandEmpty>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Season Popover Select Component (with date info display)
function SeasonPopoverSelect({
  value,
  onValueChange,
}: {
  value: string[];
  onValueChange: (value: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const { seasons } = useBrandCatalog();

  // Convert seasons to options format
  const seasonOptions = React.useMemo(() => {
    return seasons.map((season) => ({
      value: season.id,
      label: season.name,
    }));
  }, [seasons]);

  // Filter seasons based on search
  const filteredSeasons = React.useMemo(() => {
    if (!searchTerm) return seasonOptions;
    const normalized = searchTerm.toLowerCase();
    return seasonOptions.filter((option) =>
      option.label.toLowerCase().includes(normalized),
    );
  }, [seasonOptions, searchTerm]);

  const handleToggleSeason = React.useCallback(
    (seasonId: string) => {
      const newValue = value.includes(seasonId)
        ? value.filter((v) => v !== seasonId)
        : [...value, seasonId];
      onValueChange(newValue);
    },
    [value, onValueChange],
  );

  // Helper function to format season date range
  const formatSeasonDateRange = React.useCallback(
    (season: {
      startDate?: Date | null;
      endDate?: Date | null;
      isOngoing?: boolean;
    }): string => {
      if (season.isOngoing) {
        return "Ongoing";
      }

      if (!season.startDate || !season.endDate) {
        return "";
      }

      const startMonth = format(season.startDate, "MMMM yyyy");
      const endMonth = format(season.endDate, "MMMM yyyy");

      return `${startMonth} to ${endMonth}`;
    },
    [],
  );

  // Display text for trigger button
  const displayText = React.useMemo(() => {
    if (value.length === 0) return "Select season...";
    if (value.length === 1) {
      const firstValue = value[0];
      if (!firstValue) return "1 selected";
      const season = seasons.find((s) => s.id === firstValue);
      return season?.name ?? "1 selected";
    }
    return `${value.length} selected`;
  }, [value, seasons]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className="w-full justify-between"
          icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
        >
          <span className="truncate">{displayText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start" inline>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search seasons..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList className="max-h-48">
            <CommandGroup>
              {filteredSeasons.length > 0 ? (
                filteredSeasons.map((option) => {
                  const isSelected = value.includes(option.value);
                  const season = seasons.find((s) => s.id === option.value);
                  const seasonInfo = season
                    ? {
                        startDate: season.startDate,
                        endDate: season.endDate,
                        isOngoing: season.isOngoing,
                      }
                    : null;

                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleToggleSeason(option.value)}
                      className="justify-between"
                    >
                      <div className="flex items-center gap-2">
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
                })
              ) : searchTerm ? (
                <CommandEmpty>No results found</CommandEmpty>
              ) : (
                <CommandEmpty>No seasons available</CommandEmpty>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
