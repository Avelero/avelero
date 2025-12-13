"use client";

import { useBrandCatalog, type SizeOption } from "@/hooks/use-brand-catalog";
import { sizeGroups } from "@v1/selections";
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

// Re-export SizeOption type for convenience
export type { SizeOption } from "@/hooks/use-brand-catalog";

interface SizeSelectProps {
  value: SizeOption[];
  onValueChange: (value: SizeOption[]) => void;
  onCreateNew?: (sizeName: string) => void; // Opens custom size modal
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const SizeLabel = ({
  size,
  onRemove,
  disabled = false,
}: {
  size: SizeOption;
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
  const { sizeOptions } = useBrandCatalog();
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Merge sizeOptions with selected custom sizes (those without IDs that aren't in sizeOptions)
  // Use sortIndex as unique key since same name can exist in different groups
  const allAvailableSizes = React.useMemo(() => {
    const sizeMap = new Map<number, SizeOption>();
    
    // Add all sizes from catalog
    for (const size of sizeOptions) {
      sizeMap.set(size.sortIndex, size);
    }
    
    // Add selected custom sizes that aren't in catalog yet
    for (const size of value) {
      if (!sizeMap.has(size.sortIndex)) {
        sizeMap.set(size.sortIndex, size);
      }
    }
    
    return Array.from(sizeMap.values());
  }, [sizeOptions, value]);

  // Filter sizes by search term
  const filteredSizes = React.useMemo(() => {
    if (!searchTerm) return allAvailableSizes;
    const lower = searchTerm.toLowerCase();
    return allAvailableSizes.filter((s) => s.name.toLowerCase().includes(lower));
  }, [allAvailableSizes, searchTerm]);

  // Group filtered sizes for display
  const groupedSizes = React.useMemo(() => {
    const groups: Record<string, SizeOption[]> = {};

    // First pass: assign sizes to their known groups
    for (const size of filteredSizes) {
      let groupName = "Custom"; // Default to Custom for sizes not in standard groups

      // Find which group this size belongs to using sortIndex (unique identifier)
      // This correctly handles sizes with same name in different groups (e.g., "8" in US Numeric vs US Shoe)
      for (const [name, sizes] of Object.entries(sizeGroups)) {
        if (sizes.some((s) => s.sortIndex === size.sortIndex)) {
          groupName = name;
          break;
        }
      }

      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName]!.push(size);
    }

    return groups;
  }, [filteredSizes]);

  const handleToggleSize = (size: SizeOption) => {
    // Use sortIndex for comparison since same name can exist in different groups
    const isSelected = value.some((s) => s.sortIndex === size.sortIndex);

    if (isSelected) {
      onValueChange(value.filter((s) => s.sortIndex !== size.sortIndex));
    } else if (value.length < 12) {
      onValueChange([...value, size]);
      setSearchTerm("");
    }
  };

  const handleRemoveSize = (size: SizeOption) => {
    onValueChange(value.filter((s) => s.sortIndex !== size.sortIndex));
  };

  // Show "create" option if search doesn't match any existing size
  const showCreateOption =
    searchTerm &&
    !sizeOptions.some((s) => s.name.toLowerCase() === searchTerm.toLowerCase());

  const handleCreateClick = () => {
    if (onCreateNew && searchTerm.trim()) {
      onCreateNew(searchTerm.trim());
      setOpen(false);
      setSearchTerm("");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (disabled) return;
    setOpen(newOpen);
  };

  // Reset search when popover closes
  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setSearchTerm("");
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Define group order for consistent display (Custom first)
  const groupOrder = [
    "Custom",
    "Letter",
    "US Numeric",
    "Waist",
    "US Shoe",
    "EU Shoe",
    "UK Shoe",
    "One Size",
  ];

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
                key={`${size.name}-${index}`}
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
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search sizes..."
              value={searchTerm}
              onValueChange={setSearchTerm}
            />
            <CommandList className="max-h-64">
              {groupOrder.map((groupName) => {
                const sizes = groupedSizes[groupName];
                if (!sizes || sizes.length === 0) return null;

                return (
                  <CommandGroup key={groupName} heading={groupName}>
                    {sizes.map((size) => {
                      // Use sortIndex for comparison since same name can exist in different groups
                      const isSelected = value.some(
                        (s) => s.sortIndex === size.sortIndex,
                      );
                      return (
                        <CommandItem
                          key={size.name}
                          value={size.name}
                          onSelect={() => handleToggleSize(size)}
                          className="justify-between"
                        >
                          <span className="type-p text-primary">
                            {size.name}
                          </span>
                          {isSelected && <Icons.Check className="h-4 w-4" />}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                );
              })}
              {showCreateOption && onCreateNew && (
                <CommandGroup>
                  <CommandItem onSelect={handleCreateClick}>
                    <div className="flex items-center">
                      <Icons.Plus className="h-4 w-4" />
                      <span className="px-1">Create &quot;{searchTerm}&quot;</span>
                    </div>
                  </CommandItem>
                </CommandGroup>
              )}
              {filteredSizes.length === 0 && !showCreateOption && (
                <CommandEmpty>No sizes found</CommandEmpty>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
