"use client";

import * as React from "react";
import { Icons } from "@v1/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@v1/ui/popover";
import { Button } from "@v1/ui/button";
import { Label } from "@v1/ui/label";
import { cn } from "@v1/ui/cn";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const categoryHierarchy = {
  mens: {
    label: "Men's",
    children: {
      bottoms: {
        label: "Bottoms",
        children: {
          casual_pants: { label: "Casual Pants" },
          cropped_pants: { label: "Cropped Pants" },
          denim: { label: "Denim" },
          jumpsuits: { label: "Jumpsuits" },
          leggings: { label: "Leggings" },
          shorts: { label: "Shorts" },
          sweatpants_joggers: { label: "Sweatpants & Joggers" },
          swimwear: { label: "Swimwear" },
        },
      },
      outerwear: {
        label: "Outerwear",
        children: {
          bombers: { label: "Bombers" },
          cloaks_capes: { label: "Cloaks & Capes" },
          denim_jackets: { label: "Denim Jackets" },
          heavy_coats: { label: "Heavy Coats" },
          leather_jackets: { label: "Leather Jackets" },
          light_jackets: { label: "Light Jackets" },
          parkas: { label: "Parkas" },
          raincoats: { label: "Raincoats" },
          vests: { label: "Vests" },
        },
      },
      tops: {
        label: "Tops",
        children: {
          jerseys: { label: "Jerseys" },
          long_sleeve_shirts: { label: "Long Sleeve Shirts" },
          polos: { label: "Polos" },
          button_ups: { label: "Button-Ups" },
          short_sleeve_shirts: { label: "Short Sleeve Shirts" },
          sweaters_knitwear: { label: "Sweaters & Knitwear" },
          sweatshirts_hoodies: { label: "Sweatshirts & Hoodies" },
          sleeveless: { label: "Sleeveless" },
        },
      },
      footwear: {
        label: "Footwear",
        children: {
          sneakers: { label: "Sneakers" },
          dress_shoes: { label: "Dress Shoes" },
          boots: { label: "Boots" },
          loafers: { label: "Loafers" },
          sandals: { label: "Sandals" },
          athletic_shoes: { label: "Athletic Shoes" },
          casual_shoes: { label: "Casual Shoes" },
        },
      },
    },
  },
  womens: {
    label: "Women's",
    children: {
      bottoms: {
        label: "Bottoms",
        children: {
          jeans: { label: "Jeans" },
          joggers: { label: "Joggers" },
          jumpsuits: { label: "Jumpsuits" },
          leggings: { label: "Leggings" },
          maxi_skirts: { label: "Maxi Skirts" },
          midi_skirts: { label: "Midi Skirts" },
          mini_skirts: { label: "Mini Skirts" },
          pants: { label: "Pants" },
          shorts: { label: "Shorts" },
          sweatpants: { label: "Sweatpants" },
        },
      },
      dresses: {
        label: "Dresses",
        children: {
          gowns: { label: "Gowns" },
          maxi: { label: "Maxi" },
          midi: { label: "Midi" },
          mini: { label: "Mini" },
        },
      },
      outerwear: {
        label: "Outerwear",
        children: {
          blazers: { label: "Blazers" },
          bombers: { label: "Bombers" },
          coats: { label: "Coats" },
          denim_jackets: { label: "Denim Jackets" },
          down_jackets: { label: "Down Jackets" },
          fur_faux_fur: { label: "Fur & Faux Fur" },
          jackets: { label: "Jackets" },
          leather_jackets: { label: "Leather Jackets" },
          rain_jackets: { label: "Rain Jackets" },
          vests: { label: "Vests" },
        },
      },
      tops: {
        label: "Tops",
        children: {
          blouses: { label: "Blouses" },
          bodysuits: { label: "Bodysuits" },
          button_ups: { label: "Button-Ups" },
          crop_tops: { label: "Crop Tops" },
          hoodies: { label: "Hoodies" },
          long_sleeve_shirts: { label: "Long Sleeve Shirts" },
          polos: { label: "Polos" },
          short_sleeve_shirts: { label: "Short Sleeve Shirts" },
          sweaters: { label: "Sweaters" },
          sweatshirts: { label: "Sweatshirts" },
          tank_tops: { label: "Tank Tops" },
        },
      },
      footwear: {
        label: "Footwear",
        children: {
          sneakers: { label: "Sneakers" },
          heels: { label: "Heels" },
          boots: { label: "Boots" },
          flats: { label: "Flats" },
          sandals: { label: "Sandals" },
          athletic_shoes: { label: "Athletic Shoes" },
          casual_shoes: { label: "Casual Shoes" },
        },
      },
    },
  },
} as const;

export function CategorySelect({ value, onChange, label = "Category", className }: CategorySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [categoryPath, setCategoryPath] = React.useState<string[]>([]);
  const [selectedCategoryPath, setSelectedCategoryPath] = React.useState<string[]>([]);
  const [hoveredRow, setHoveredRow] = React.useState<string | null>(null);
  const [hoveredArea, setHoveredArea] = React.useState<"selection" | "navigation" | null>(null);

  // Helper function to get current level options
  const getCurrentLevelOptions = () => {
    let current: any = categoryHierarchy;
    for (const key of categoryPath) {
      current = current[key]?.children || {};
    }
    return current;
  };

  // Helper function to get breadcrumb string for navigation
  const getBreadcrumbString = () => {
    if (categoryPath.length === 0) return "";

    const labels: string[] = [];
    let current: any = categoryHierarchy;

    for (const key of categoryPath) {
      if (current[key]) {
        labels.push(current[key].label);
        current = current[key].children || {};
      }
    }

    return labels.join(" / ");
  };

  const handleCategorySelect = (key: string) => {
    const newPath = [...categoryPath, key];

    // Check if this category is already selected
    const isCurrentlySelected =
      selectedCategoryPath.length === newPath.length &&
      selectedCategoryPath.every((segment, index) => segment === newPath[index]);

    if (isCurrentlySelected) {
      // Deselect
      setSelectedCategoryPath([]);
      onChange("Select category");
    } else {
      // Select new category
      setSelectedCategoryPath(newPath);

      // Generate display string
      const labels: string[] = [];
      let current: any = categoryHierarchy;

      for (const pathKey of newPath) {
        if (current[pathKey]) {
          labels.push(current[pathKey].label);
          current = current[pathKey].children || {};
        }
      }

      const displayString =
        labels.length <= 3
          ? labels.join(" / ")
          : `${labels[0]} / ... / ${labels[labels.length - 1]}`;

      onChange(displayString);
    }

    setOpen(false);
  };

  const handleCategoryNavigate = (key: string) => {
    setCategoryPath([...categoryPath, key]);
  };

  const handleCategoryBack = () => {
    if (categoryPath.length > 0) {
      setCategoryPath(categoryPath.slice(0, -1));
    }
  };

  const initializeCategoryNavigation = () => {
    if (selectedCategoryPath.length > 0) {
      setCategoryPath(selectedCategoryPath.slice(0, -1));
    } else {
      setCategoryPath([]);
    }
  };

  const resetCategoryNavigation = () => {
    setCategoryPath([]);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label>{label}</Label>}
      <Popover
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen) {
            initializeCategoryNavigation();
          } else {
            resetCategoryNavigation();
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between h-9"
            icon={<Icons.ChevronDown className="h-4 w-4 text-tertiary" />}
          >
            <span className={cn("truncate", value === "Select category" ? "text-tertiary" : "text-primary")}>
              {value}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <div className="flex flex-col">
            {/* Navigation Bar */}
            {categoryPath.length > 0 && (
              <div className="border-b border-border bg-background">
                <button
                  type="button"
                  onClick={handleCategoryBack}
                  className="w-full py-2 px-3 type-p text-primary focus:outline-none flex items-center hover:bg-accent transition-colors"
                >
                  <Icons.ChevronLeft className="h-4 w-4 mr-2 text-secondary" />
                  <span className="text-primary">{getBreadcrumbString()}</span>
                </button>
              </div>
            )}

            {/* Options */}
            <div className="max-h-48 overflow-y-auto">
              {Object.entries(getCurrentLevelOptions()).map(([key, value]: [string, any]) => {
                const hasChildren = value.children && Object.keys(value.children).length > 0;
                const currentPath = [...categoryPath, key];
                const isSelected =
                  selectedCategoryPath.length === currentPath.length &&
                  selectedCategoryPath.every((segment, index) => segment === currentPath[index]);

                return (
                  <div key={key} className="relative">
                    {hasChildren ? (
                      // Button-in-button layout for items with children
                      <div
                        className={cn(
                          "flex transition-colors",
                          hoveredRow === key ? "bg-accent" : "",
                        )}
                        onMouseLeave={() => {
                          setHoveredRow(null);
                          setHoveredArea(null);
                        }}
                      >
                        {/* Selection area */}
                        <button
                          type="button"
                          onClick={() => handleCategorySelect(key)}
                          onMouseEnter={() => {
                            setHoveredRow(key);
                            setHoveredArea("selection");
                          }}
                          className={cn(
                            "w-fit px-3 py-2 type-p transition-colors flex items-center gap-2",
                            isSelected
                              ? "bg-accent-blue text-brand"
                              : hoveredRow === key && hoveredArea === "selection"
                                ? "bg-border text-primary"
                                : "text-primary",
                          )}
                        >
                          <span>{value.label}</span>
                          {isSelected && <Icons.Check className="h-4 w-4 text-brand" />}
                        </button>

                        {/* Navigation area */}
                        <button
                          type="button"
                          onClick={() => handleCategoryNavigate(key)}
                          onMouseEnter={() => {
                            setHoveredRow(key);
                            setHoveredArea("navigation");
                          }}
                          className="flex-1 py-2 px-2 transition-colors flex items-center justify-end"
                        >
                          <Icons.ChevronRight className="h-4 w-4 text-tertiary" />
                        </button>
                      </div>
                    ) : (
                      // Full-width button for leaf items
                      <button
                        type="button"
                        onClick={() => handleCategorySelect(key)}
                        className={cn(
                          "w-full px-3 py-2 type-p text-left transition-colors flex items-center justify-between",
                          isSelected ? "bg-accent-blue text-brand" : "hover:bg-accent text-primary",
                        )}
                      >
                        <span>{value.label}</span>
                        {isSelected && <Icons.Check className="h-4 w-4 text-brand" />}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

