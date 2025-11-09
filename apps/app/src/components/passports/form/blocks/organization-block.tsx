"use client";

import { usePassportFormContext } from "@/components/passports/form/context/passport-form-context";
import type { SeasonOption } from "@/hooks/use-passport-form-data";
import { SeasonModal } from "@/components/modals/season-modal";
import { SizeModal } from "@/components/modals/size-modal";
import { CategorySelect } from "@/components/select/category-select";
import {
  type ColorOption,
  ColorSelect,
} from "@/components/select/color-select";
import { type Season, SeasonSelect } from "@/components/select/season-select";
import { SizeSelect } from "@/components/select/size-select";
import { type TagOption, TagSelect } from "@/components/select/tag-select";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Label } from "@v1/ui/label";
import * as React from "react";

export function OrganizationSection() {
  const { formState, referenceData, updateField } = usePassportFormContext();

  // Track which optional fields are visible
  const [showSeason, setShowSeason] = React.useState(false);
  const [showColor, setShowColor] = React.useState(false);
  const [showSize, setShowSize] = React.useState(false);
  const [showTags, setShowTags] = React.useState(false);

  // Track category display value separately for CategorySelect
  const [categoryDisplayValue, setCategoryDisplayValue] =
    React.useState<string>("Select category");

  // Modal states
  const [seasonModalOpen, setSeasonModalOpen] = React.useState(false);
  const [sizeModalOpen, setSizeModalOpen] = React.useState(false);
  const [pendingSeasonName, setPendingSeasonName] = React.useState<string>("");
  const [prefillSize, setPrefillSize] = React.useState<string | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Sync display value when categoryId changes from context
  React.useEffect(() => {
    if (formState.categoryId) {
      const selectedCat = referenceData.categories.find(
        (cat) => cat.value === formState.categoryId,
      );
      if (selectedCat) {
        setCategoryDisplayValue(selectedCat.label);
      }
    } else {
      setCategoryDisplayValue("Select category");
    }
  }, [formState.categoryId, referenceData.categories]);

  // If category is not selected, hide and reset Size
  React.useEffect(() => {
    if (!formState.categoryId) {
      setShowSize(false);
      updateField("sizeId", null);
    }
  }, [formState.categoryId, updateField]);

  // Check if any footer buttons should be visible
  const hasFooterButtons =
    !showSeason ||
    !showColor ||
    (!showSize && formState.categoryId) ||
    !showTags;

  return (
    <>
      <div className="border border-border bg-background">
        <div className="p-4 flex flex-col gap-3">
          <p className="type-p !font-medium text-primary">Organization</p>

          {/* Category */}
          <CategorySelect
            value={categoryDisplayValue}
            onChange={(displayValue) => {
              setCategoryDisplayValue(displayValue);
              // Find the matching category by display value (works for all tiers)
              const selectedCat = referenceData.categories.find(
                (cat) => cat.label === displayValue,
              );
              if (selectedCat) {
                updateField("categoryId", selectedCat.value);
              } else if (displayValue === "Select category") {
                updateField("categoryId", null);
              }
            }}
            className="w-full"
          />

          {/* Season Field */}
          {showSeason && (
            <div className="space-y-1.5 group/field">
              <Label>Season</Label>
              <div className="relative">
                <div className="transition-[margin-right] duration-200 ease-in-out group-hover/field:mr-11">
                  <SeasonSelect
                    value={formState.season}
                    onValueChange={(season) => updateField("season", season)}
                    seasons={referenceData.seasons}
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
                      updateField("season", null);
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
                    value={formState.colors}
                    onValueChange={(colors) => updateField("colors", colors)}
                    defaultColors={referenceData.allColors}
                    placeholder="Add color"
                  />
                </div>
                <div className="absolute right-0 top-0 w-0 group-hover/field:w-9 overflow-hidden transition-[width] duration-200 ease-in-out">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowColor(false);
                      updateField("colors", []);
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
          {showSize && formState.categoryId && (
            <div className="space-y-1.5 group/field">
              <Label>Size</Label>
              <div className="relative">
                <div className="transition-[margin-right] duration-200 ease-in-out group-hover/field:mr-11">
                  <SizeSelect
                    value={formState.sizeId}
                    onValueChange={(sizeId) => updateField("sizeId", sizeId)}
                    selectedCategory={categoryDisplayValue}
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
                      updateField("sizeId", null);
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
                    value={formState.tags}
                    onValueChange={(tags) => updateField("tags", tags)}
                    placeholder="Add tags"
                  />
                </div>
                <div className="absolute right-0 top-0 w-0 group-hover/field:w-9 overflow-hidden transition-[width] duration-200 ease-in-out">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowTags(false);
                      updateField("tags", []);
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
          <div className="border-t border-border bg-accent-light flex flex-wrap gap-2 px-4 py-3">
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
            {!showSize && formState.categoryId && (
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
          const season: SeasonOption = {
            name: newSeason.name,
            startDate: newSeason.startDate || undefined,
            endDate: newSeason.endDate || undefined,
            isOngoing: newSeason.ongoing,
          };
          updateField("season", season);
          setPendingSeasonName("");
        }}
      />
      <SizeModal
        open={sizeModalOpen}
        onOpenChange={setSizeModalOpen}
        selectedCategory={categoryDisplayValue}
        prefillSize={prefillSize}
        onSave={(sizes) => {
          if (sizes.length > 0) {
            // The size modal should return the size ID, we'll use the first one
            updateField("sizeId", sizes[0] || null);
          }
          setPrefillSize(null);
        }}
      />
    </>
  );
}
