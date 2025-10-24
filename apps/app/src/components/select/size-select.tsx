"use client";

import * as React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from "@v1/ui/command";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";

interface SizeSelectProps {
  value: string | null;
  onValueChange: (value: string) => void;
  availableSizes: string[];
  onCreateNew: (initialValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SizeSelect({
  value,
  onValueChange,
  availableSizes,
  onCreateNew,
  placeholder = "Select size",
  disabled = false,
  className,
}: SizeSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredSizes = React.useMemo(() => {
    if (!searchTerm) return availableSizes;
    return availableSizes.filter((s) =>
      s.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableSizes, searchTerm]);

  const showCreateOption = searchTerm && 
    !availableSizes.some(s => s.toLowerCase() === searchTerm.toLowerCase());

  const handleSelect = (size: string) => {
    onValueChange(size);
    setOpen(false);
    setSearchTerm("");
  };

  const handleCreateClick = () => {
    setOpen(false);
    const term = searchTerm;
    setSearchTerm("");
    if (term) onCreateNew(term);
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
              ) : searchTerm && showCreateOption ? (
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

