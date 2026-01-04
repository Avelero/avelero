"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import type { CustomFont } from "@v1/dpp-components";
import { type FontMetadata, fonts } from "@v1/selections/fonts";
import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Select,
  SelectAction,
  SelectContent,
  SelectFooter,
  SelectSearch,
  SelectTrigger,
} from "@v1/ui/select";
import * as React from "react";

// Pre-sort all fonts alphabetically
const ALL_FONTS_SORTED = [...fonts].sort((a, b) =>
  a.family.localeCompare(b.family),
);

// Track loaded fonts to avoid duplicate loads
const loadedFonts = new Set<string>();

// Load a font from Google Fonts
function loadGoogleFont(family: string) {
  if (loadedFonts.has(family)) return;
  loadedFonts.add(family);

  const link = document.createElement("link");
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
  link.rel = "stylesheet";
  document.head.appendChild(link);
}

// Load a custom font via @font-face
function loadCustomFont(font: CustomFont) {
  const fontKey = `custom:${font.fontFamily}`;
  if (loadedFonts.has(fontKey)) return;
  loadedFonts.add(fontKey);

  const style = document.createElement("style");
  style.textContent = `
    @font-face {
      font-family: "${font.fontFamily}";
      src: url("${font.src}") format("${font.format ?? "woff2"}");
      font-weight: ${font.fontWeight ?? 400};
      font-style: ${font.fontStyle ?? "normal"};
      font-display: ${font.fontDisplay ?? "swap"};
    }
  `;
  document.head.appendChild(style);
}

interface FontSelectProps {
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Custom fonts uploaded by the user */
  customFonts?: CustomFont[];
  /** Callback to open the custom fonts management modal */
  onManageCustomFonts?: () => void;
}

export function FontSelect({
  value,
  onValueChange,
  placeholder = "Select font...",
  className,
  customFonts = [],
  onManageCustomFonts,
}: FontSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Get unique custom font families (deduplicated)
  const customFontFamilies = React.useMemo(() => {
    const families = new Map<string, CustomFont>();
    for (const font of customFonts) {
      // Keep first occurrence of each family
      if (!families.has(font.fontFamily)) {
        families.set(font.fontFamily, font);
      }
    }
    return Array.from(families.values()).sort((a, b) =>
      a.fontFamily.localeCompare(b.fontFamily),
    );
  }, [customFonts]);

  // Check if selected value is a custom font
  const isCustomFontSelected = React.useMemo(() => {
    return customFonts.some(
      (f) => f.fontFamily.toLowerCase() === value?.toLowerCase(),
    );
  }, [customFonts, value]);

  // Load the selected font for the trigger button
  React.useEffect(() => {
    if (value) {
      if (isCustomFontSelected) {
        const customFont = customFonts.find(
          (f) => f.fontFamily.toLowerCase() === value.toLowerCase(),
        );
        if (customFont) {
          loadCustomFont(customFont);
        }
      } else {
        loadGoogleFont(value);
      }
    }
  }, [value, isCustomFontSelected, customFonts]);

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

  const handleManageCustomFonts = () => {
    setOpen(false);
    onManageCustomFonts?.();
  };

  const displayValue = value || placeholder;
  const isPlaceholder = !value;

  return (
    <Select open={open} onOpenChange={setOpen}>
      <SelectTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className={cn("w-full justify-between", className)}
        >
          <span
            className={cn("truncate px-1", isPlaceholder && "text-tertiary")}
            style={value ? { fontFamily: `"${value}", sans-serif` } : undefined}
          >
            {displayValue}
          </span>
          <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
        </Button>
      </SelectTrigger>
      <SelectContent shouldFilter={false}>
        <SelectSearch
          ref={inputRef}
          placeholder="Search..."
          value={searchTerm}
          onValueChange={setSearchTerm}
        />

        {/* Font List */}
        <FontList
          googleFonts={ALL_FONTS_SORTED}
          customFonts={customFontFamilies}
          allCustomFonts={customFonts}
          searchTerm={searchTerm}
          selectedValue={value}
          onSelect={handleSelect}
          isOpen={open}
        />

        {/* Custom Fonts Button - always visible at bottom */}
        <SelectFooter>
          <SelectAction onSelect={handleManageCustomFonts}>
            <div className="flex items-center gap-2">
              <Icons.Plus className="h-3.5 w-3.5" />
              <span>Custom fonts</span>
            </div>
          </SelectAction>
        </SelectFooter>
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// Font List Component
// ============================================================================

interface FontListProps {
  googleFonts: FontMetadata[];
  customFonts: CustomFont[];
  allCustomFonts: CustomFont[];
  searchTerm: string;
  selectedValue: string | null;
  onSelect: (fontFamily: string) => void;
  isOpen: boolean;
}

function FontList({
  googleFonts,
  customFonts,
  allCustomFonts,
  searchTerm,
  selectedValue,
  onSelect,
  isOpen,
}: FontListProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Filter custom fonts based on search
  const filteredCustomFonts = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return customFonts;
    }
    const query = searchTerm.toLowerCase().trim();
    return customFonts.filter((font) =>
      font.fontFamily.toLowerCase().includes(query),
    );
  }, [customFonts, searchTerm]);

  // Filter Google fonts based on search
  const filteredGoogleFonts = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return googleFonts;
    }
    const query = searchTerm.toLowerCase().trim();
    return googleFonts.filter((font) =>
      font.family.toLowerCase().includes(query),
    );
  }, [googleFonts, searchTerm]);

  const hasCustomFonts = filteredCustomFonts.length > 0;
  const hasGoogleFonts = filteredGoogleFonts.length > 0;
  const showSectionHeaders = customFonts.length > 0; // Show headers if there are any custom fonts (even if filtered out)

  // Find selected item index for scroll-to-selected
  const selectedGoogleFontIndex = React.useMemo(() => {
    if (!selectedValue) return -1;
    return filteredGoogleFonts.findIndex((f) => f.family === selectedValue);
  }, [filteredGoogleFonts, selectedValue]);

  const selectedCustomFontIndex = React.useMemo(() => {
    if (!selectedValue) return -1;
    return filteredCustomFonts.findIndex(
      (f) => f.fontFamily.toLowerCase() === selectedValue.toLowerCase(),
    );
  }, [filteredCustomFonts, selectedValue]);

  // Calculate initial offset for virtualizer to prevent flicker
  const initialOffset = React.useMemo(() => {
    if (searchTerm.trim()) return 0;
    // Only calculate offset for Google fonts (virtualized section)
    if (selectedGoogleFontIndex < 0 || selectedCustomFontIndex >= 0) return 0;

    const itemHeight = 32;
    const viewportHeight = 300;
    // Center the selected item in the viewport
    const targetOffset = selectedGoogleFontIndex * itemHeight - viewportHeight / 2 + itemHeight / 2;
    return Math.max(0, targetOffset);
  }, [selectedGoogleFontIndex, selectedCustomFontIndex, searchTerm]);

  // Virtual list for Google fonts
  const virtualizer = useVirtualizer({
    count: filteredGoogleFonts.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 32,
    overscan: 10,
    initialOffset,
  });

  // Scroll to selected custom font when opening (non-virtualized)
  React.useEffect(() => {
    if (!isOpen || searchTerm.trim()) return;
    if (selectedCustomFontIndex < 0) return;

    // Immediate scroll for custom fonts section
    const itemHeight = 32;
    const headerHeight = showSectionHeaders ? 28 : 0;
    const scrollTop = headerHeight + selectedCustomFontIndex * itemHeight;
    scrollRef.current?.scrollTo({ top: Math.max(0, scrollTop - 48) });
  }, [isOpen, searchTerm, selectedCustomFontIndex, showSectionHeaders]);

  // Load fonts for visible Google font items
  const virtualItems = virtualizer.getVirtualItems();
  React.useEffect(() => {
    for (const item of virtualItems) {
      const font = filteredGoogleFonts[item.index];
      if (font) {
        loadGoogleFont(font.family);
      }
    }
  }, [virtualItems, filteredGoogleFonts]);

  // Load all visible custom fonts
  React.useEffect(() => {
    for (const font of filteredCustomFonts) {
      // Find all variants for this font family and load them
      const variants = allCustomFonts.filter(
        (f) => f.fontFamily === font.fontFamily,
      );
      for (const variant of variants) {
        loadCustomFont(variant);
      }
    }
  }, [filteredCustomFonts, allCustomFonts]);

  if (!hasCustomFonts && !hasGoogleFonts) {
    return (
      <div className="py-6 text-center text-sm text-secondary">
        No fonts found.
      </div>
    );
  }

  // Calculate heights for proper scroll container sizing
  const customFontsHeight = hasCustomFonts
    ? filteredCustomFonts.length * 32 + (showSectionHeaders ? 28 : 0) // items + header
    : 0;
  const googleFontsHeaderHeight = showSectionHeaders && hasGoogleFonts ? 28 : 0;

  return (
    <div ref={scrollRef} className="overflow-auto p-1" style={{ maxHeight: 300 }}>
      {/* Custom Fonts Section */}
      {hasCustomFonts && (
        <div>
          {showSectionHeaders && (
            <div className="px-2 py-1.5 text-xs font-medium text-tertiary uppercase tracking-wide sticky top-0 bg-popover z-10">
              Custom fonts
            </div>
          )}
          {filteredCustomFonts.map((font) => (
            <CustomFontItem
              key={font.fontFamily}
              font={font}
              isSelected={
                selectedValue?.toLowerCase() === font.fontFamily.toLowerCase()
              }
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {/* Google Fonts Section */}
      {hasGoogleFonts && (
        <div>
          {showSectionHeaders && (
            <div className="px-2 py-1.5 text-xs font-medium text-tertiary uppercase tracking-wide sticky top-0 bg-popover z-10">
              Default fonts
            </div>
          )}
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: "100%",
              position: "relative",
            }}
          >
            {virtualItems.map((virtualRow) => {
              const font = filteredGoogleFonts[virtualRow.index];
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
                  <GoogleFontItem
                    font={font}
                    isSelected={selectedValue === font.family}
                    onSelect={onSelect}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Font Item Components
// ============================================================================

interface CustomFontItemProps {
  font: CustomFont;
  isSelected: boolean;
  onSelect: (fontFamily: string) => void;
}

function CustomFontItem({ font, isSelected, onSelect }: CustomFontItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(font.fontFamily)}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center justify-between px-2 py-1.5 text-sm outline-none h-8",
        "hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent",
      )}
    >
      <span style={{ fontFamily: `"${font.fontFamily}", sans-serif` }}>
        {font.fontFamily}
      </span>
      {isSelected && <Icons.Check className="h-4 w-4" />}
    </button>
  );
}

interface GoogleFontItemProps {
  font: FontMetadata;
  isSelected: boolean;
  onSelect: (fontFamily: string) => void;
}

function GoogleFontItem({ font, isSelected, onSelect }: GoogleFontItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(font.family)}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center justify-between px-2 py-1.5 text-sm outline-none h-8",
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
