"use client";

import { allColors } from "@v1/selections";
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

function normalizeHex(hex?: string | null) {
  if (!hex) return allColors[0]?.hex ?? "000000";
  return hex.replace("#", "").toUpperCase();
}

export function ColorSelect({
  value,
  onValueChange,
  children,
  open,
  onOpenChange,
  align = "start",
  sideOffset = 4,
  disabled = false,
}: {
  value?: string | null;
  onValueChange: (hex: string) => void;
  children: React.ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
  sideOffset?: number;
  disabled?: boolean;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const controlled = open !== undefined;
  const isOpen = controlled ? open : internalOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!controlled) {
        setInternalOpen(next);
      }
      onOpenChange?.(next);
    },
    [controlled, onOpenChange],
  );

  React.useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
    }
  }, [isOpen]);

  const normalizedValue = normalizeHex(value);

  const filteredColors = React.useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allColors;
    return allColors.filter((color) => {
      return (
        color.name.toLowerCase().includes(term) ||
        color.hex.toLowerCase().includes(term.replace("#", ""))
      );
    });
  }, [searchTerm]);

  return (
    <Popover open={disabled ? false : isOpen} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={sideOffset}
        className="w-[260px] p-0 border border-border bg-background"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search colors..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList className="max-h-64">
            <CommandGroup>
              {filteredColors.map((color, index) => {
                const isSelected = normalizedValue === color.hex.toUpperCase();
                return (
                  <CommandItem
                    key={`${color.hex}-${color.name}-${index}`}
                    value={`${color.name}-${color.hex}-${index}`}
                    onSelect={() => {
                      onValueChange(color.hex.toUpperCase());
                      setOpen(false);
                    }}
                    className="justify-between"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex h-4 w-4 items-center justify-center">
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-border"
                          style={{ backgroundColor: `#${color.hex}` }}
                        />
                      </span>
                      <span className="type-p text-primary truncate">
                        {color.name}
                      </span>
                      <span className="type-small text-tertiary uppercase">
                        #{color.hex}
                      </span>
                    </div>
                    <Icons.Check
                      className={cn(
                        "h-4 w-4 text-brand",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </CommandItem>
                );
              })}
              {filteredColors.length === 0 ? (
                <CommandEmpty>No colors found.</CommandEmpty>
              ) : null}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { normalizeHex as normalizeColorHex };
