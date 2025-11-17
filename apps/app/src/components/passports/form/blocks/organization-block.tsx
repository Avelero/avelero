"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { SeasonModal } from "@/components/modals/season-modal";
import { CategorySelect } from "@/components/select/category-select";
import { type Season, SeasonSelect } from "@/components/select/season-select";
import { TagSelect } from "@/components/select/tag-select";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Label } from "@v1/ui/label";
import * as React from "react";

interface OrganizationSectionProps {
  categoryId: string | null;
  setCategoryId: (value: string | null) => void;
  season: string | null;
  setSeason: (value: string | null) => void;
  tagIds: string[];
  setTagIds: (value: string[]) => void;
}

export function OrganizationSection({
  categoryId,
  setCategoryId,
  season,
  setSeason,
  tagIds,
  setTagIds,
}: OrganizationSectionProps) {
  // Fetch seasons from API
  const { seasons } = useBrandCatalog();

  // Track which optional fields are visible
  const [showSeason, setShowSeason] = React.useState(() => Boolean(season));
  const [showTags, setShowTags] = React.useState(() => tagIds.length > 0);

  // Field values (local state for complex objects, IDs are in parent)
  const [seasonObject, setSeasonObject] = React.useState<Season | null>(null);
  
  // Sync season object with parent's season string
  React.useEffect(() => {
    if (season) {
      // Check if current seasonObject matches the season prop
      if (seasonObject?.name !== season) {
        // Try to find matching season object
        const found = seasons.find((s: Season) => s.name === season);
        if (found) {
          setSeasonObject(found);
        } else {
          // Clear seasonObject if season doesn't match any available season
          setSeasonObject(null);
        }
      }
    } else {
      // Clear seasonObject when season is null
      setSeasonObject(null);
    }
  }, [season, seasons]);

  React.useEffect(() => {
    if (season && !showSeason) {
      setShowSeason(true);
    }
  }, [season, showSeason]);

  React.useEffect(() => {
    if (tagIds.length > 0 && !showTags) {
      setShowTags(true);
    }
  }, [tagIds, showTags]);

  // Modal states
  const [seasonModalOpen, setSeasonModalOpen] = React.useState(false);
  const [pendingSeasonName, setPendingSeasonName] = React.useState<string>("");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const hasFooterButtons = !showSeason || !showTags;

  return (
    <>
      <div className="border border-border bg-background">
        <div className="p-4 flex flex-col gap-3">
          <p className="type-p !font-medium text-primary">Organization</p>

          {/* Category */}
          <CategorySelect
            value={categoryId}
            onChange={setCategoryId}
            className="w-full"
          />

          {/* Season Field */}
          {showSeason && (
            <div className="space-y-1.5 group/field">
              <Label>Season</Label>
              <div className="relative">
                <div className="transition-[margin-right] duration-200 ease-in-out group-hover/field:mr-11">
                  <SeasonSelect
                    value={seasonObject}
                    onValueChange={(newSeason) => {
                      setSeasonObject(newSeason);
                      setSeason(newSeason?.name ?? null);
                    }}
                    seasons={seasons}
                    onCreateNew={(name: string) => {
                      setPendingSeasonName(name);
                      setSeasonModalOpen(true);
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
                      setSeasonObject(null);
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

          {/* Tags Field */}
          {showTags && (
            <div className="space-y-1.5 group/field">
              <Label>Tags</Label>
              <div className="relative">
                <div className="transition-[margin-right] duration-200 ease-in-out group-hover/field:mr-11">
                  <TagSelect
                    value={tagIds}
                    onValueChange={setTagIds}
                    placeholder="Add tags"
                  />
                </div>
                <div className="absolute right-0 top-0 w-0 group-hover/field:w-9 overflow-hidden transition-[width] duration-200 ease-in-out">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowTags(false);
                      setTagIds([]);
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

      {/* Season Modal */}
      <SeasonModal
        open={seasonModalOpen}
        onOpenChange={setSeasonModalOpen}
        initialName={pendingSeasonName}
        onSave={(newSeason) => {
          // React Query will automatically refetch and update the seasons list
          // Convert the season modal output to Season type
          const seasonObj: Season = {
            name: newSeason.name,
            startDate: newSeason.startDate || undefined,
            endDate: newSeason.endDate || undefined,
            isOngoing: newSeason.isOngoing,
          };
          setSeasonObject(seasonObj);
          setSeason(newSeason.name);
          setShowSeason(true);
        }}
      />
    </>
  );
}
