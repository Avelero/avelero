"use client";

import * as React from "react";
import { CategorySelect } from "@/components/select/category-select";
import { SeasonSelect, type Season } from "@/components/select/season-select";
import { ColorSelect, type ColorOption } from "@/components/select/color-select";
import { SizeSelect } from "@/components/select/size-select";
import { TagSelect, type TagOption } from "@/components/select/tag-select";
import { SeasonModal } from "@/components/modals/season-modal";
import { SizeModal } from "@/components/modals/size-modal";
import { Label } from "@v1/ui/label";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";

// TODO: Load from API
const SEASON_OPTIONS: Season[] = [
  { name: "SS24", startDate: new Date(2024, 5, 1), endDate: new Date(2024, 9, 31) },
  { name: "AW24", startDate: new Date(2024, 10, 1), endDate: new Date(2025, 2, 31) },
  { name: "SS25", startDate: new Date(2025, 5, 1), endDate: new Date(2025, 9, 31) },
  { name: "AW25", startDate: new Date(2025, 10, 1), endDate: new Date(2026, 2, 31) },
  { name: "SS26", startDate: new Date(2026, 5, 12), endDate: new Date(2026, 9, 19) },
  { name: "AW26", startDate: new Date(2026, 10, 1), endDate: new Date(2027, 2, 31) },
];

const COLOR_OPTIONS: ColorOption[] = [
  { name: "Black", hex: "000000" },
  { name: "White", hex: "FFFFFF" },
  { name: "Navy", hex: "000080" },
  { name: "Grey", hex: "808080" },
  { name: "Red", hex: "FF0000" },
  { name: "Blue", hex: "0000FF" },
  { name: "Green", hex: "008000" },
  { name: "Yellow", hex: "FFFF00" },
  { name: "Pink", hex: "FFC0CB" },
  { name: "Purple", hex: "800080" },
];

export function OrganizationSection() {
  const [category, setCategory] = React.useState("Select category");
  
  // Track which optional fields are visible
  const [showSeason, setShowSeason] = React.useState(false);
  const [showColor, setShowColor] = React.useState(false);
  const [showSize, setShowSize] = React.useState(false);
  const [showTags, setShowTags] = React.useState(false);

  // Field values
  const [season, setSeason] = React.useState<Season | null>(null);
  const [seasons, setSeasons] = React.useState<Season[]>(SEASON_OPTIONS);
  const [colors, setColors] = React.useState<ColorOption[]>([]);
  const [availableColors, setAvailableColors] = React.useState<ColorOption[]>(COLOR_OPTIONS);
  const [size, setSize] = React.useState<string | null>(null);
  const [tags, setTags] = React.useState<TagOption[]>([]);
  // If category is not selected, hide and reset Size
  React.useEffect(() => {
    if (category === "Select category") {
      setShowSize(false);
      setSize(null);
    }
  }, [category]);

  // Modal states
  const [seasonModalOpen, setSeasonModalOpen] = React.useState(false);
  const [sizeModalOpen, setSizeModalOpen] = React.useState(false);
  const [pendingSeasonName, setPendingSeasonName] = React.useState<string>("");
  const [prefillSize, setPrefillSize] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);


  const hasFooterButtons = !showSeason || !showColor || !showSize || !showTags;

  return (
    <>
      <div className="border border-border bg-background">
        <div className="p-4 flex flex-col gap-3">
          <p className="type-p !font-medium text-primary">Organization</p>

          {/* Category */}
          <CategorySelect value={category} onChange={setCategory} className="w-full" />

        {/* Season Field */}
        {showSeason && (
          <div className="space-y-1.5 group/field">
            <Label>Season</Label>
            <div className="relative">
              <div className="transition-[margin-right] duration-200 ease-in-out group-hover/field:mr-11">
                <SeasonSelect
                  value={season}
                  onValueChange={setSeason}
                  seasons={seasons}
                  onCreateNew={(term) => {
                    // Open modal with the typed term prefilled
                    setSeasonModalOpen(true);
                    // Store term in state for passing to modal
                    setPendingSeasonName(term);
                  }}
                  placeholder="Select season"
                />
              </div>
              <div className="absolute right-0 top-0 w-0 group-hover/field:w-9 overflow-hidden transition-[width] duration-200 ease-in-out">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowSeason(false);
                    setSeason(null);
                  }}
                  className="h-9 w-9 text-tertiary hover:text-destructive flex-shrink-0"
                >
                  <Icons.X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Color Field */}
        {showColor && (
          <div className="space-y-1.5 group/field">
            <Label>Color</Label>
            <div className="relative">
              <div className="transition-[margin-right] duration-200 ease-in-out group-hover/field:mr-11">
                <ColorSelect
                  value={colors}
                  onValueChange={setColors}
                  defaultColors={availableColors}
                  placeholder="Add color"
                />
              </div>
              <div className="absolute right-0 top-0 w-0 group-hover/field:w-9 overflow-hidden transition-[width] duration-200 ease-in-out">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowColor(false);
                    setColors([]);
                  }}
                  className="h-9 w-9 text-tertiary hover:text-destructive flex-shrink-0"
                >
                  <Icons.X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Size Field */}
        {showSize && category !== "Select category" && (
          <div className="space-y-1.5 group/field">
            <Label>Size</Label>
            <div className="relative">
              <div className="transition-[margin-right] duration-200 ease-in-out group-hover/field:mr-11">
                <SizeSelect
                  value={size}
                  onValueChange={setSize}
                  availableSizes={["XS", "S", "M", "L", "XL", "XXL"]}
                  onCreateNew={(initial) => {
                    // Open modal and request a new row prefilled with the created term
                    setPrefillSize(initial);
                    setSizeModalOpen(true);
                  }}
                  placeholder="Select size"
                />
              </div>
              <div className="absolute right-0 top-0 w-0 group-hover/field:w-9 overflow-hidden transition-[width] duration-200 ease-in-out">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowSize(false);
                    setSize(null);
                  }}
                  className="h-9 w-9 text-tertiary hover:text-destructive flex-shrink-0"
                >
                  <Icons.X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tags Field */}
        {showTags && (
          <div className="space-y-1.5 group/field">
            <Label>Tags</Label>
            <div className="relative">
              <div className="transition-[margin-right] duration-200 ease-in-out group-hover/field:mr-11">
                <TagSelect
                  value={tags}
                  onValueChange={setTags}
                  placeholder="Add tags"
                />
              </div>
              <div className="absolute right-0 top-0 w-0 group-hover/field:w-9 overflow-hidden transition-[width] duration-200 ease-in-out">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowTags(false);
                    setTags([]);
                  }}
                  className="h-9 w-9 text-tertiary hover:text-destructive flex-shrink-0"
                >
                  <Icons.X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        </div>

        {/* Footer with Add Buttons (render after mount to avoid SSR/client mismatches) */}
        {mounted && hasFooterButtons && (
          <div className="border-t border-border px-4 py-3 bg-accent-light flex flex-wrap gap-2">
            {!showSeason && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSeason(true)}
                icon={<Icons.Plus className="h-4 w-4" />}
                iconPosition="left"
              >
                Season
              </Button>
            )}
            {!showColor && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowColor(true)}
                icon={<Icons.Plus className="h-4 w-4" />}
                iconPosition="left"
              >
                Color
              </Button>
            )}
          {!showSize && category !== "Select category" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSize(true)}
                icon={<Icons.Plus className="h-4 w-4" />}
                iconPosition="left"
              >
                Size
              </Button>
            )}
            {!showTags && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowTags(true)}
                icon={<Icons.Plus className="h-4 w-4" />}
                iconPosition="left"
              >
                Tags
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <SeasonModal
        open={seasonModalOpen}
        onOpenChange={setSeasonModalOpen}
        initialName={pendingSeasonName}
        onSave={(newSeason) => {
          const season: Season = {
            name: newSeason.name,
            startDate: newSeason.startDate || undefined,
            endDate: newSeason.endDate || undefined,
            isOngoing: newSeason.ongoing,
          };
          setSeasons((prev) => [...prev, season]);
          setSeason(season);
          setPendingSeasonName("");
        }}
      />
      <SizeModal
        open={sizeModalOpen}
        onOpenChange={setSizeModalOpen}
        selectedCategory={category}
        prefillSize={prefillSize}
        onSave={(sizes) => {
          if (sizes.length > 0) {
            setSize(sizes[0] || null);
          }
          setPrefillSize(null);
        }}
      />
    </>
  );
}
