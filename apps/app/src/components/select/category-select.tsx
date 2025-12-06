"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Label } from "@v1/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import * as React from "react";

interface CategorySelectProps {
  value: string | null; // Category ID or null
  onChange: (value: string | null) => void; // Returns category ID or null
  label?: string;
  className?: string;
}

export function CategorySelect({
  value,
  onChange,
  label = "Category",
  className,
}: CategorySelectProps) {
  const { categoryHierarchy, categoryMap } = useBrandCatalog();
  const [open, setOpen] = React.useState(false);
  const [categoryPath, setCategoryPath] = React.useState<string[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<
    string | null
  >(value);
  const [hoveredRow, setHoveredRow] = React.useState<string | null>(null);
  const [hoveredArea, setHoveredArea] = React.useState<
    "selection" | "navigation" | null
  >(null);

  // Helper function to get path (array of IDs) for a category
  const getCategoryPath = React.useCallback(
    (categoryId: string | null): string[] => {
      if (!categoryId) return [];

      const path: string[] = [];
      let currentId: string | null = categoryId;

      while (currentId) {
        path.unshift(currentId);
        const category = categoryMap.get(currentId);
        currentId = category?.parentId || null;
      }

      return path;
    },
    [categoryMap],
  );

  // Helper function to get display string for a category
  const getCategoryDisplayString = React.useCallback(
    (categoryId: string | null): string => {
      if (!categoryId) return "Select category";

      const path = getCategoryPath(categoryId);
      const labels = path
        .map((id) => categoryMap.get(id)?.name || "")
        .filter(Boolean);

      if (labels.length === 0) return "Select category";
      if (labels.length <= 3) return labels.join(" / ");
      return `${labels[0]} / ... / ${labels[labels.length - 1]}`;
    },
    [categoryMap, getCategoryPath],
  );

  // Sync selected category when value prop changes
  React.useEffect(() => {
    setSelectedCategoryId(value);
  }, [value]);

  // Helper function to get current level options
  const getCurrentLevelOptions = () => {
    let current: any = categoryHierarchy;
    for (const key of categoryPath) {
      current = current[key]?.children || {};
    }
    return current;
  };

  // Helper function to get breadcrumb string for navigation
  const getBreadcrumbString = () => {
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
  };

  const handleCategorySelect = (categoryId: string) => {
    // Check if this category is already selected
    const isCurrentlySelected = selectedCategoryId === categoryId;

    if (isCurrentlySelected) {
      // Deselect
      setSelectedCategoryId(null);
      onChange(null);
    } else {
      // Select new category
      setSelectedCategoryId(categoryId);
      onChange(categoryId);
    }

    setOpen(false);
  };

  const handleCategoryNavigate = (key: string) => {
    setCategoryPath([...categoryPath, key]);
  };

  const handleCategoryBack = () => {
    if (categoryPath.length > 0) {
      setCategoryPath(categoryPath.slice(0, -1));
    }
  };

  const initializeCategoryNavigation = () => {
    if (selectedCategoryId) {
      const path = getCategoryPath(selectedCategoryId);
      // Set the path to everything except the last element (the selected category itself)
      setCategoryPath(path.slice(0, -1));
    } else {
      setCategoryPath([]);
    }
  };

  const resetCategoryNavigation = () => {
    setCategoryPath([]);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label>{label}</Label>}
      <Popover
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen) {
            initializeCategoryNavigation();
          } else {
            resetCategoryNavigation();
            setHoveredRow(null);
            setHoveredArea(null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-9"
          >
            <span
              className={cn(
                "truncate px-1",
                !value ? "text-tertiary" : "text-primary",
              )}
            >
              {getCategoryDisplayString(value)}
            </span>
            <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px]"
          align="start"
        >
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
              {Object.entries(getCurrentLevelOptions()).map(
                ([key, value]: [string, any]) => {
                  const hasChildren =
                    value.children && Object.keys(value.children).length > 0;
                  // key is the category ID
                  const isSelected = selectedCategoryId === key;

                  return (
                    <div key={key} className="relative">
                      {hasChildren ? (
                        // Button-in-button layout for items with children
                        <div
                          className={cn(
                            "flex transition-colors",
                            hoveredRow === key ? "bg-accent" : "",
                          )}
                          onMouseLeave={() => {
                            setHoveredRow(null);
                            setHoveredArea(null);
                          }}
                        >
                          {/* Selection area */}
                          <button
                            type="button"
                            onClick={() => handleCategorySelect(key)}
                            onMouseEnter={() => {
                              setHoveredRow(key);
                              setHoveredArea("selection");
                            }}
                            className={cn(
                              "w-fit px-3 py-2 type-p transition-colors flex items-center gap-2",
                              isSelected
                                ? "bg-accent-blue text-brand"
                                : hoveredRow === key &&
                                  hoveredArea === "selection"
                                  ? "bg-accent-dark text-primary"
                                  : "text-primary",
                            )}
                          >
                            <span>{value.label}</span>
                            {isSelected && (
                              <Icons.Check className="h-4 w-4 text-brand" />
                            )}
                          </button>

                          {/* Navigation area */}
                          <button
                            type="button"
                            onClick={() => handleCategoryNavigate(key)}
                            onMouseEnter={() => {
                              setHoveredRow(key);
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
                          onClick={() => handleCategorySelect(key)}
                          className={cn(
                            "w-full px-3 py-2 type-p text-left transition-colors flex items-center justify-between",
                            isSelected
                              ? "bg-accent-blue text-brand"
                              : "hover:bg-accent text-primary",
                          )}
                        >
                          <span>{value.label}</span>
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
        </PopoverContent>
      </Popover>
    </div>
  );
}
