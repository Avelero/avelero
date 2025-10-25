"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@v1/ui/command";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";
import { getSizesForCategory } from "@v1/selections/sizes";

interface SizeSelectProps {
  value: string | null;
  onValueChange: (value: string) => void;
  selectedCategory?: string; // Full category path (e.g., "Men's / Tops / Jerseys")
  availableSizes?: string[]; // Optional: override default sizes
  onCreateNew?: (initialValue: string, categoryPath: string) => void; // Callback to open size modal
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Renders a size selector popover with searchable sizes and an optional "create new" action.
 *
 * @param value - Currently selected size string or `null` to show the placeholder.
 * @param onValueChange - Called with the chosen size when a user selects an existing size.
 * @param selectedCategory - Optional full category path used to determine default sizes when `availableSizes` is not provided.
 * @param availableSizes - Optional override list of sizes to display instead of deriving them from `selectedCategory`.
 * @param onCreateNew - Optional callback invoked with `(initialValue, categoryPath)` when the user chooses to create a new custom size.
 * @param placeholder - Text shown when no size is selected.
 * @param disabled - Disables the trigger button when `true`.
 * @param className - Additional CSS classes applied to the trigger button.
 * @returns The rendered SizeSelect React element.
 */
export function SizeSelect({
  value,
  onValueChange,
  selectedCategory,
  availableSizes,
  onCreateNew,
  placeholder = "Select size",
  disabled = false,
  className,
}: SizeSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  // Get default sizes based on category, or use provided availableSizes
  const sizesForCategory = React.useMemo(() => {
    if (availableSizes) {
      return availableSizes;
    }
    return getSizesForCategory(selectedCategory || "");
  }, [selectedCategory, availableSizes]);

  const filteredSizes = React.useMemo(() => {
    if (!searchTerm) return sizesForCategory;
    return sizesForCategory.filter((s) =>
      s.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sizesForCategory, searchTerm]);

  const showCreateOption = searchTerm && 
    !sizesForCategory.some(s => s.toLowerCase() === searchTerm.toLowerCase());

  const handleSelect = (size: string) => {
    onValueChange(size);
    setOpen(false);
    setSearchTerm("");
  };

  const handleCreateClick = () => {
    setOpen(false);
    const term = searchTerm;
    setSearchTerm("");
    if (term && onCreateNew) {
      onCreateNew(term, selectedCategory || "");
    }
  };

  // Reset search when popover closes
  React.useEffect(() => {
    if (!open) {
      setSearchTerm("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("w-full justify-between h-9", className)}
          icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
          disabled={disabled}
        >
          <span className={cn(value ? "text-primary" : "text-tertiary")}>
            {value || placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search sizes..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandGroup>
              {filteredSizes.length > 0 ? (
                filteredSizes.map((s) => (
                  <CommandItem
                    key={s}
                    value={s}
                    onSelect={() => handleSelect(s)}
                    className="justify-between"
                  >
                    <span>{s}</span>
                    {value === s && <Icons.Check className="h-4 w-4" />}
                  </CommandItem>
                ))
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
              ) : !searchTerm && selectedCategory ? (
                <div className="px-3 py-8 text-center">
                  <p className="type-p text-tertiary">
                    No sizes available for this category
                  </p>
                </div>
              ) : !searchTerm ? (
                <div className="px-3 py-8 text-center">
                  <p className="type-p text-tertiary">
                    Begin typing to create a custom size
                  </p>
                </div>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
