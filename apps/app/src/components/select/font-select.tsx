"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { fonts, type FontMetadata } from "@v1/selections/fonts";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Button } from "@v1/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";

// Pre-sort all fonts alphabetically
const ALL_FONTS_SORTED = [...fonts].sort((a, b) =>
  a.family.localeCompare(b.family),
);

// Track loaded fonts to avoid duplicate loads
const loadedFonts = new Set<string>();

// Load a font from Google Fonts
function loadFont(family: string) {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);

  const link = document.createElement("link");
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
  link.rel = "stylesheet";
  document.head.appendChild(link);
}

interface FontSelectProps {
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function FontSelect({
  value,
  onValueChange,
  placeholder = "Select font...",
  className,
}: FontSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Load the selected font for the trigger button
  React.useEffect(() => {
    if (value) {
      loadFont(value);
    }
  }, [value]);

  // Focus input when popover opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setSearchTerm("");
    }
  }, [open]);

  const handleSelect = (fontFamily: string) => {
    onValueChange(fontFamily);
    setOpen(false);
  };

  const displayValue = value || placeholder;
  const isPlaceholder = !value;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className={cn("w-full justify-between", className)}
          icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
        >
          <span
            className={cn("truncate", isPlaceholder && "text-tertiary")}
            style={value ? { fontFamily: `"${value}", sans-serif` } : undefined}
          >
            {displayValue}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px] p-0"
        align="start"
      >
        {/* Search Input */}
        <div className="flex items-center border-b px-3">
          <Icons.Search className="mr-2 h-4 w-4 shrink-0 text-tertiary" />
          <input
            ref={inputRef}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search fonts..."
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-tertiary disabled:cursor-not-allowed disabled:opacity-50"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="ml-2 text-tertiary hover:text-secondary"
            >
              <Icons.X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Virtualized Font List - only render when open */}
        {open && (
          <VirtualizedFontList
            fonts={ALL_FONTS_SORTED}
            searchTerm={searchTerm}
            selectedValue={value}
            onSelect={handleSelect}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

// Separate component for virtualized list to ensure proper ref attachment
interface VirtualizedFontListProps {
  fonts: FontMetadata[];
  searchTerm: string;
  selectedValue: string | null;
  onSelect: (fontFamily: string) => void;
}

function VirtualizedFontList({
  fonts,
  searchTerm,
  selectedValue,
  onSelect,
}: VirtualizedFontListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Filter fonts based on search
  const filteredFonts = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return fonts;
    }
    const query = searchTerm.toLowerCase().trim();
    return fonts.filter((font) => font.family.toLowerCase().includes(query));
  }, [fonts, searchTerm]);

  // Virtual list for fonts
  const virtualizer = useVirtualizer({
    count: filteredFonts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 10,
  });

  // Load fonts for visible items
  const virtualItems = virtualizer.getVirtualItems();
  React.useEffect(() => {
    for (const item of virtualItems) {
      const font = filteredFonts[item.index];
      if (font) {
        loadFont(font.family);
      }
    }
  }, [virtualItems, filteredFonts]);

  if (filteredFonts.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-secondary">
        No fonts found.
      </div>
    );
  }

  return (
    <div ref={scrollRef} style={{ height: 300, overflow: "auto" }}>
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((virtualRow) => {
          const font = filteredFonts[virtualRow.index];
          if (!font) return null;
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <FontItem
                font={font}
                isSelected={selectedValue === font.family}
                onSelect={onSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Individual font item component
interface FontItemProps {
  font: FontMetadata;
  isSelected: boolean;
  onSelect: (fontFamily: string) => void;
}

function FontItem({ font, isSelected, onSelect }: FontItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(font.family)}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none h-8",
        "hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent",
      )}
    >
      <span style={{ fontFamily: `"${font.family}", sans-serif` }}>
        {font.family}
      </span>
      {isSelected && <Icons.Check className="h-4 w-4" />}
    </button>
  );
}
