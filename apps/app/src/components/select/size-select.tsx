"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
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
import * as React from "react";

export interface TierTwoSizeOption {
  id?: string; // Optional: ID from database (undefined if custom/unsaved)
  name: string; // Size name (e.g., "M", "32", "10.5")
  categoryKey: string; // Level 2 category key (e.g., "mens-tops", "womens-bottoms")
  categoryPath: string; // Level 2 category display (e.g., "Men's / Tops", "Women's / Bottoms")
  sortIndex: number; // Sort order (lower = earlier)
  source: "brand" | "custom"; // Where this size came from
}

interface SizeSelectProps {
  value: TierTwoSizeOption[];
  onValueChange: (value: TierTwoSizeOption[]) => void;
  onCreateNew?: (initialValue: string, categoryPath?: string) => void; // Callback to open size modal with prefilled category
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const SizeLabel = ({
  size,
  onRemove,
  disabled = false,
}: {
  size: TierTwoSizeOption;
  onRemove: () => void;
  disabled?: boolean;
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <div
      className="relative flex items-center justify-center px-2 h-6 border border-border rounded-full bg-background box-border"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <p className="type-small leading-none text-primary">{size.name}</p>
      {isHovered && !disabled && (
        <div className="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center">
          <div className="w-3 h-3 bg-gradient-to-r from-transparent to-background" />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="w-4 h-4 flex rounded-r-full rounded-l-md items-center justify-center bg-background text-tertiary hover:text-destructive transition-colors"
          >
            <Icons.X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
};

export function SizeSelect({
  value,
  onValueChange,
  onCreateNew,
  placeholder = "Add size",
  disabled = false,
  className,
}: SizeSelectProps) {
  const { sizeOptions, tierTwoCategoryHierarchy } = useBrandCatalog();
  const [open, setOpen] = React.useState(false);
  const [navigationPath, setNavigationPath] = React.useState<string[]>([]); // ["Men's"] or ["Men's", "Tops"]
  const [searchTerm, setSearchTerm] = React.useState("");

  // Group sizes by full category path for efficient lookup
  const sizesByCategory = React.useMemo(() => {
    const map = new Map<string, TierTwoSizeOption[]>();

    for (const option of sizeOptions) {
      const existing = map.get(option.categoryPath) || [];
      existing.push(option);
      map.set(option.categoryPath, existing);
    }

    // Sort sizes within each category by sortIndex
    for (const [key, sizes] of map.entries()) {
      sizes.sort((a, b) => a.sortIndex - b.sortIndex);
    }

    return map;
  }, [sizeOptions]);

  // Get tier-one categories (Men's, Women's)
  const tierOneCategories = React.useMemo(() => {
    return Object.keys(tierTwoCategoryHierarchy).sort();
  }, [tierTwoCategoryHierarchy]);

  // Get current view based on navigation path
  const currentView = React.useMemo(() => {
    if (navigationPath.length === 0) {
      return { type: "tier-one" as const, categories: tierOneCategories };
    }
    if (navigationPath.length === 1) {
      const tierOneKey = navigationPath[0];
      // Get tier-two display names for this tier-one category
      const tierTwoPaths = tierOneKey
        ? tierTwoCategoryHierarchy[tierOneKey] || []
        : [];
      // Extract just the tier-two names (e.g., "Tops" from "Men's / Tops")
      const tierTwoNames = tierTwoPaths.map(
        (path) => path.split(" / ")[1] || path,
      );
      return { type: "tier-two" as const, categories: tierTwoNames };
    }
    // navigationPath.length === 2
    const tierOneKey = navigationPath[0];
    const tierTwoKey = navigationPath[1];
    // Reconstruct the full category path
    const fullCategoryPath = `${tierOneKey} / ${tierTwoKey}`;
    const sizes = sizesByCategory.get(fullCategoryPath) || [];
    return { type: "sizes" as const, sizes };
  }, [
    navigationPath,
    tierOneCategories,
    tierTwoCategoryHierarchy,
    sizesByCategory,
  ]);

  // Filter sizes when searching on page 3
  const filteredSizes = React.useMemo(() => {
    if (currentView.type !== "sizes" || !searchTerm)
      return currentView.type === "sizes" ? currentView.sizes : [];
    return currentView.sizes.filter((s: TierTwoSizeOption) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [currentView, searchTerm]);

  const handleNavigateForward = (category: string) => {
    setNavigationPath([...navigationPath, category]);
    setSearchTerm("");
  };

  const handleNavigateBack = () => {
    if (navigationPath.length > 0) {
      setNavigationPath(navigationPath.slice(0, -1));
      setSearchTerm("");
    }
  };

  const handleToggleSize = (size: TierTwoSizeOption) => {
    const isSelected = value.some(
      (s) => s.categoryKey === size.categoryKey && s.name === size.name,
    );

    if (isSelected) {
      onValueChange(
        value.filter(
          (s) => !(s.categoryKey === size.categoryKey && s.name === size.name),
        ),
      );
    } else {
      // Limit to 12 sizes
      if (value.length >= 12) {
        return;
      }
      onValueChange([...value, size]);
      // Clear search term after selection
      setSearchTerm("");
    }
  };

  const handleRemoveSize = (size: TierTwoSizeOption) => {
    onValueChange(
      value.filter(
        (s) => !(s.categoryKey === size.categoryKey && s.name === size.name),
      ),
    );
  };

  const handleCreateClick = () => {
    if (searchTerm && onCreateNew) {
      // Reconstruct the category path from navigation (e.g., "Men's / Tops")
      const categoryPath =
        navigationPath.length === 2
          ? `${navigationPath[0]} / ${navigationPath[1]}`
          : undefined;

      onCreateNew(searchTerm, categoryPath);
      setOpen(false);
      setSearchTerm("");
    }
  };

  const showCreateOption =
    currentView.type === "sizes" &&
    searchTerm &&
    !filteredSizes.some(
      (s: TierTwoSizeOption) =>
        s.name.toLowerCase() === searchTerm.toLowerCase(),
    );

  const handleOpenChange = (newOpen: boolean) => {
    if (disabled) return;
    setOpen(newOpen);
  };

  // Reset navigation and search when popover closes (with cleanup)
  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setNavigationPath([]);
        setSearchTerm("");
      }, 200); // Match popover animation duration
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Check if sizes are from multiple systems
  const uniqueCategories = React.useMemo(() => {
    const categories = new Set(value.map((s) => s.categoryKey));
    return categories.size;
  }, [value]);

  // Get breadcrumb string for navigation bar
  const getBreadcrumbString = () => {
    return navigationPath.join(" / ");
  };

  return (
    <div className="space-y-1.5">
      <Popover open={disabled ? false : open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild disabled={disabled}>
          <div
            className={cn(
              "group flex flex-wrap items-center py-[5px] px-2 w-full min-h-9 border border-border bg-background gap-1.5 cursor-pointer",
              disabled && "opacity-50 cursor-not-allowed",
              className,
            )}
            onClick={(e) => {
              if (disabled) e.preventDefault();
            }}
          >
            {value.map((size, index) => (
              <SizeLabel
                key={`${size.categoryKey}-${size.name}-${index}`}
                size={size}
                onRemove={() => handleRemoveSize(size)}
                disabled={disabled}
              />
            ))}
            {!disabled && value.length < 12 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(!open);
                }}
                className="mx-1 border-b border-border type-p text-tertiary group-hover:text-secondary group-hover:border-secondary cursor-pointer transition-colors"
              >
                {placeholder}
              </button>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px] p-0"
          align="start"
        >
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
                currentView.type === "sizes"
                  ? ""
                  : "max-h-48 overflow-y-auto scrollbar-hide",
              )}
            >
              {currentView.type === "tier-one" && (
                // Page 1: Tier-one categories
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
                // Page 2: Tier-two categories
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
                // Page 3: Sizes with multi-select and keyboard navigation
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
                        filteredSizes.map((size: TierTwoSizeOption) => {
                          const isSelected = value.some(
                            (s) =>
                              s.categoryKey === size.categoryKey &&
                              s.name === size.name,
                          );
                          return (
                            <CommandItem
                              key={`${size.categoryKey}-${size.name}`}
                              value={size.name}
                              onSelect={() => handleToggleSize(size)}
                              className="justify-between"
                            >
                              <span className="type-p text-primary">
                                {size.name}
                              </span>
                              {isSelected && (
                                <Icons.Check className="h-4 w-4" />
                              )}
                            </CommandItem>
                          );
                        })
                      ) : searchTerm && showCreateOption && onCreateNew ? (
                        <CommandItem
                          value={searchTerm}
                          onSelect={handleCreateClick}
                        >
                          <div className="flex items-center gap-2">
                            <Icons.Plus className="h-3.5 w-3.5" />
                            <span className="type-p text-primary">
                              Create &quot;{searchTerm}&quot;
                            </span>
                          </div>
                        </CommandItem>
                      ) : !searchTerm && onCreateNew ? (
                        <CommandEmpty>Start typing to create...</CommandEmpty>
                      ) : searchTerm ? (
                        <CommandEmpty>No results found</CommandEmpty>
                      ) : null}
                    </CommandGroup>
                  </CommandList>
                </Command>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {uniqueCategories > 1 && (
        <p className="type-small text-destructive">
          Warning: You've selected sizes from {uniqueCategories} different size
          systems
        </p>
      )}
    </div>
  );
}
