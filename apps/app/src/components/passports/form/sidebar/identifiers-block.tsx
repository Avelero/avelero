"use client";

import { Label } from "@v1/ui/label";
import { Input } from "@v1/ui/input";
import { Select } from "@v1/ui/select";
import { useState } from "react";
import { ShowcaseBrandSheet, type ShowcaseBrandData } from "../../../sheets/showcase-brand-sheet";

/**
 * Render an Identifiers panel with SKU, EAN, and Brand fields and an integrated brand-creation workflow.
 *
 * The component manages local state for SKU, EAN, and the selected brand, provides a searchable brand
 * select with a create option, opens a brand creation sheet prefilled with the search term when creating
 * a new brand, and appends and auto-selects newly created brands.
 *
 * @returns The rendered Identifiers section as JSX.
 */
export function IdentifiersSection() {
  const [sku, setSku] = useState("");
  const [ean, setEan] = useState("");
  const [brand, setBrand] = useState<string>("");
  
  // TODO: Load from API - for now using local state
  const [brandOptions, setBrandOptions] = useState([
    { value: "brand-1", label: "Avelero Apparel" },
    { value: "brand-2", label: "Example Brand Co." },
  ]);

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingBrandName, setPendingBrandName] = useState("");

  const handleCreateNewBrand = (searchTerm: string) => {
    setPendingBrandName(searchTerm);
    setSheetOpen(true);
  };

  const handleBrandCreated = (brandData: ShowcaseBrandData) => {
    // Add the new brand to options
    const newOption = {
      value: brandData.id,
      label: brandData.name,
    };
    setBrandOptions((prev) => [...prev, newOption]);
    
    // Auto-select the newly created brand
    setBrand(brandData.id);
  };

  return (
    <>
      <div className="border border-border bg-background p-4 flex flex-col gap-3">
        <p className="type-p !font-medium text-primary">Identifiers</p>
        
        {/* SKU Input */}
        <div className="space-y-1.5">
          <Label>SKU</Label>
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Enter SKU"
            className="h-9"
          />
        </div>

        {/* EAN Input */}
        <div className="space-y-1.5">
          <Label>EAN</Label>
          <Input
            value={ean}
            onChange={(e) => setEan(e.target.value)}
            placeholder="Enter EAN"
            className="h-9"
          />
        </div>

        {/* Brand Select */}
        <div className="space-y-1.5">
          <Label>Brand</Label>
          <Select
            options={brandOptions}
            value={brand}
            onValueChange={setBrand}
            placeholder="Select brand"
            searchable
            searchPlaceholder="Search brand"
            hasCreateOption
            onCreateNew={handleCreateNewBrand}
            createLabel="Create"
            inline
          />
        </div>
      </div>

      {/* Showcase Brand Sheet */}
      <ShowcaseBrandSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialName={pendingBrandName}
        onBrandCreated={handleBrandCreated}
      />
    </>
  );
}