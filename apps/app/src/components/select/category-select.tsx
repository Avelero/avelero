"use client";

import { categoryHierarchy } from "@v1/selections/categories";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Label } from "@v1/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import * as React from "react";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export function CategorySelect({
  value,
  onChange,
  label = "Category",
  className,
}: CategorySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [categoryPath, setCategoryPath] = React.useState<string[]>([]);
  const [selectedCategoryPath, setSelectedCategoryPath] = React.useState<
    string[]
  >([]);
  const [hoveredRow, setHoveredRow] = React.useState<string | null>(null);
  const [hoveredArea, setHoveredArea] = React.useState<
    "selection" | "navigation" | null
  >(null);

  // Helper function to find path from display string
  const findPathFromDisplayString = React.useCallback(
    (displayString: string): string[] => {
      if (displayString === "Select category" || !displayString) {
        return [];
      }

      const findPathRecursive = (
        current: any,
        currentPath: string[],
      ): string[] | null => {
        for (const [key, val] of Object.entries(current)) {
          const newPath = [...currentPath, key];
          const labels: string[] = [];
          let temp: any = categoryHierarchy;

          for (const pathKey of newPath) {
            if (temp[pathKey]) {
              labels.push(temp[pathKey].label);
              temp = temp[pathKey].children || {};
            }
          }

          const fullString = labels.join(" / ");
          const truncatedString =
            labels.length <= 3
              ? fullString
              : `${labels[0]} / ... / ${labels[labels.length - 1]}`;

          if (
            fullString === displayString ||
            truncatedString === displayString
          ) {
            return newPath;
          }

          if ((val as any).children) {
            const foundPath = findPathRecursive((val as any).children, newPath);
            if (foundPath) return foundPath;
          }
        }
        return null;
      };

      return findPathRecursive(categoryHierarchy, []) || [];
    },
    [],
  );

  // Sync selectedCategoryPath when value changes from outside
  React.useEffect(() => {
    const pathFromValue = findPathFromDisplayString(value);

    // Only update if the path is different from current selectedCategoryPath
    setSelectedCategoryPath((currentPath) => {
      const pathsMatch =
        pathFromValue.length === currentPath.length &&
        pathFromValue.every((segment, index) => segment === currentPath[index]);

      return pathsMatch ? currentPath : pathFromValue;
    });
  }, [value, findPathFromDisplayString]);

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

  const handleCategorySelect = (key: string) => {
    const newPath = [...categoryPath, key];

    // Check if this category is already selected
    const isCurrentlySelected =
      selectedCategoryPath.length === newPath.length &&
      selectedCategoryPath.every(
        (segment, index) => segment === newPath[index],
      );

    if (isCurrentlySelected) {
      // Deselect
      setSelectedCategoryPath([]);
      onChange("Select category");
    } else {
      // Select new category
      setSelectedCategoryPath(newPath);

      // Generate display string
      const labels: string[] = [];
      let current: any = categoryHierarchy;

      for (const pathKey of newPath) {
        if (current[pathKey]) {
          labels.push(current[pathKey].label);
          current = current[pathKey].children || {};
        }
      }

      const displayString =
        labels.length <= 3
          ? labels.join(" / ")
          : `${labels[0]} / ... / ${labels[labels.length - 1]}`;

      onChange(displayString);
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
    if (selectedCategoryPath.length > 0) {
      setCategoryPath(selectedCategoryPath.slice(0, -1));
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
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-9"
            icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
          >
            <span
              className={cn(
                "truncate",
                value === "Select category" ? "text-tertiary" : "text-primary",
              )}
            >
              {value}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width]"
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
            <div className="max-h-48 overflow-y-auto">
              {Object.entries(getCurrentLevelOptions()).map(
                ([key, value]: [string, any]) => {
                  const hasChildren =
                    value.children && Object.keys(value.children).length > 0;
                  const currentPath = [...categoryPath, key];
                  const isSelected =
                    selectedCategoryPath.length === currentPath.length &&
                    selectedCategoryPath.every(
                      (segment, index) => segment === currentPath[index],
                    );

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
                                  ? "bg-border text-primary"
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
