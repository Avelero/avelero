"use client";

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { cn } from "@v1/ui/cn";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Select } from "@v1/ui/select";
import { useState } from "react";
import {
  type ShowcaseBrandData,
  ShowcaseBrandSheet,
} from "../../../sheets/showcase-brand-sheet";

interface IdentifiersSectionProps {
  productIdentifier: string;
  setProductIdentifier: (value: string) => void;
  showcaseBrandId: string | null;
  setShowcaseBrandId: (value: string | null) => void;
  productIdentifierError?: string;
  productIdentifierInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function IdentifiersSection({
  productIdentifier,
  setProductIdentifier,
  showcaseBrandId,
  setShowcaseBrandId,
  productIdentifierError,
  productIdentifierInputRef,
}: IdentifiersSectionProps) {
  const { showcaseBrands: apiBrandOptions } = useBrandCatalog();
  
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

        {/* Product Identifier */}
        <div className="space-y-1.5">
          <Label>Product identifier <span className="text-destructive">*</span></Label>
          <Input
            ref={productIdentifierInputRef}
            value={productIdentifier}
            onChange={(e) => setProductIdentifier(e.target.value)}
            placeholder="Enter product identifier"
            className={cn(
              "h-9",
              productIdentifierError &&
                "border-destructive focus-visible:border-destructive focus-visible:ring-2 focus-visible:ring-destructive"
            )}
            aria-invalid={Boolean(productIdentifierError)}
          />
          {productIdentifierError && (
            <p className="type-small text-destructive">
              {productIdentifierError}
            </p>
          )}
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
