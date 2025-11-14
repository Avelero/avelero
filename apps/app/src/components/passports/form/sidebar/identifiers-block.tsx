"use client";

import { usePassportFormData } from "@/hooks/use-passport-form-data";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Select } from "@v1/ui/select";
import { useState } from "react";
import {
  type ShowcaseBrandData,
  ShowcaseBrandSheet,
} from "../../../sheets/showcase-brand-sheet";

interface IdentifiersSectionProps {
  articleNumber: string;
  setArticleNumber: (value: string) => void;
  ean: string;
  setEan: (value: string) => void;
  showcaseBrandId: string | null;
  setShowcaseBrandId: (value: string | null) => void;
}

export function IdentifiersSection({
  articleNumber,
  setArticleNumber,
  ean,
  setEan,
  showcaseBrandId,
  setShowcaseBrandId,
}: IdentifiersSectionProps) {
  const { showcaseBrands: apiBrandOptions } = usePassportFormData();
  
  // Convert brandOptions from API format to Select format
  const selectBrandOptions = apiBrandOptions.map((brand: { id: string; name: string }) => ({
    value: brand.id,
    label: brand.name,
  }));

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingBrandName, setPendingBrandName] = useState("");

  const handleCreateNewBrand = (searchTerm: string) => {
    setPendingBrandName(searchTerm);
    setSheetOpen(true);
  };

  const handleBrandCreated = (brandData: ShowcaseBrandData) => {
    // Auto-select the newly created brand
    // The brand will be available in the dropdown after the immediate mutation updates the query
    setShowcaseBrandId(brandData.id);
  };

  return (
    <>
      <div className="border border-border bg-background p-4 flex flex-col gap-3">
        <p className="type-p !font-medium text-primary">Identifiers</p>

        {/* SKU Input */}
        <div className="space-y-1.5">
          <Label>Article number <span className="text-destructive">*</span></Label>
          <Input
            value={articleNumber}
            onChange={(e) => setArticleNumber(e.target.value)}
            placeholder="Enter article number"
            className="h-9"
            required
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
            options={selectBrandOptions}
            value={showcaseBrandId || ""}
            onValueChange={setShowcaseBrandId}
            placeholder="Select brand"
            searchable
            searchPlaceholder="Search brand..."
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
