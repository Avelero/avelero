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
  articleNumber: string;
  setArticleNumber: (value: string) => void;
  ean: string;
  setEan: (value: string) => void;
  showcaseBrandId: string | null;
  setShowcaseBrandId: (value: string | null) => void;
  articleNumberError?: string;
  eanError?: string;
  articleNumberInputRef?: React.RefObject<HTMLInputElement | null>;
  eanInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function IdentifiersSection({
  articleNumber,
  setArticleNumber,
  ean,
  setEan,
  showcaseBrandId,
  setShowcaseBrandId,
  articleNumberError,
  eanError,
  articleNumberInputRef,
  eanInputRef,
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

        {/* SKU Input */}
        <div className="space-y-1.5">
          <Label>Article number <span className="text-destructive">*</span></Label>
          <Input
            ref={articleNumberInputRef}
            value={articleNumber}
            onChange={(e) => setArticleNumber(e.target.value)}
            placeholder="Enter article number"
            className={cn(
              "h-9",
              articleNumberError &&
                "border-destructive focus-visible:border-destructive focus-visible:ring-2 focus-visible:ring-destructive"
            )}
            aria-invalid={Boolean(articleNumberError)}
          />
          {articleNumberError && (
            <p className="type-small text-destructive">{articleNumberError}</p>
          )}
        </div>

        {/* EAN Input */}
        <div className="space-y-1.5">
          <Label>EAN</Label>
          <Input
            ref={eanInputRef}
            value={ean}
            onChange={(e) => setEan(e.target.value)}
            placeholder="Enter EAN"
            className={cn(
              "h-9",
              eanError && "focus-visible:ring-destructive focus-visible:border-destructive"
            )}
          />
          {eanError && (
            <p className="type-small text-destructive">{eanError}</p>
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
