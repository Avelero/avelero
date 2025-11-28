"use client";

import * as React from "react";
import { fonts } from "@v1/selections/fonts";
import { cn } from "@v1/ui/cn";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Command, CommandInput } from "@v1/ui/command";
import { useVirtualizer } from "@tanstack/react-virtual";

interface FontFamilySelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

// Popular fonts to show at the top of the list
const POPULAR_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Poppins",
  "Playfair Display",
  "Source Sans 3",
  "Raleway",
  "Nunito",
  "Work Sans",
  "DM Sans",
  "Space Grotesk",
  "Outfit",
  "Sora",
];

// Pre-compute sorted font list once (popular first, then rest)
const SORTED_FONTS = (() => {
  const popularFonts = fonts
    .filter((f) => POPULAR_FONTS.includes(f.family))
    .sort((a, b) => POPULAR_FONTS.indexOf(a.family) - POPULAR_FONTS.indexOf(b.family));

  const otherFonts = fonts.filter((f) => !POPULAR_FONTS.includes(f.family));

  return [...popularFonts, ...otherFonts];
})();

const ITEM_HEIGHT = 32;
const LIST_HEIGHT = 192;

// Virtualized list component that initializes after mount
function VirtualizedFontList({
  fonts: fontList,
  value,
  onSelect,
}: {
  fonts: typeof SORTED_FONTS;
  value: string;
  onSelect: (fontFamily: string) => void;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = React.useState(false);

  // Wait for mount before rendering virtualizer
  React.useLayoutEffect(() => {
    setIsMounted(true);
  }, []);

  const virtualizer = useVirtualizer({
    count: fontList.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 20,
    enabled: isMounted,
  });

  if (fontList.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        No fonts found.
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={scrollRef}
      className="overflow-auto"
      style={{ height: LIST_HEIGHT }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {items.map((virtualItem) => {
          const font = fontList[virtualItem.index];
          if (!font) return null;
          const isSelected = font.family === value;

          return (
            <div
              key={font.family}
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelect(font.family)}
              className={cn(
                "absolute left-0 top-0 w-full",
                "flex items-center justify-between px-2 text-sm cursor-pointer",
                "hover:bg-accent hover:text-accent-foreground",
                "outline-none select-none",
                isSelected && "bg-accent"
              )}
              style={{
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <span className="truncate">{font.family}</span>
              <Icons.Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  isSelected ? "opacity-100" : "opacity-0"
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function FontFamilySelect({
  label,
  value,
  onChange,
  placeholder = "Select font",
  className,
}: FontFamilySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Filter fonts based on search
  const filteredFonts = React.useMemo(() => {
    if (!search.trim()) return SORTED_FONTS;
    const lowerSearch = search.toLowerCase().trim();
    return SORTED_FONTS.filter((f) =>
      f.family.toLowerCase().includes(lowerSearch)
    );
  }, [search]);

  // Reset search when closing
  React.useEffect(() => {
    if (!open) {
      setSearch("");
    }
  }, [open]);

  const handleSelect = (fontFamily: string) => {
    onChange(fontFamily);
    setOpen(false);
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <span className="type-small text-secondary">{label}</span>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="default"
            className="w-full justify-between h-8 text-sm"
            icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
          >
            <span className="truncate">{value || placeholder}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px] p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search fonts..."
              value={search}
              onValueChange={setSearch}
            />
            {/* Only render when open to ensure fresh virtualizer */}
            {open && (
              <VirtualizedFontList
                fonts={filteredFonts}
                value={value}
                onSelect={handleSelect}
              />
            )}
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
