"use client";

import { usePassportFormContext } from "@/components/passports/form/context/passport-form-context";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Select } from "@v1/ui/select";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ShowcaseBrandData,
  ShowcaseBrandSheet,
} from "../../../sheets/showcase-brand-sheet";

export function IdentifiersSection() {
  const { formState, referenceData, updateField } = usePassportFormContext();

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingBrandName, setPendingBrandName] = useState("");
  
  // Local state for debounced SKU input
  const [localSku, setLocalSku] = useState(formState.sku);
  const skuTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Sync local state when form state changes externally
  useEffect(() => {
    setLocalSku(formState.sku);
  }, [formState.sku]);

  // Debounced update handler
  const handleSkuChange = useCallback((value: string) => {
    setLocalSku(value);
    if (skuTimerRef.current) clearTimeout(skuTimerRef.current);
    skuTimerRef.current = setTimeout(() => {
      updateField("sku", value);
    }, 200);
  }, [updateField]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (skuTimerRef.current) clearTimeout(skuTimerRef.current);
    };
  }, []);

  const handleCreateNewBrand = (searchTerm: string) => {
    setPendingBrandName(searchTerm);
    setSheetOpen(true);
  };

  const handleBrandCreated = (brandData: ShowcaseBrandData) => {
    // Auto-select the newly created brand
    // Note: The brand will be available in referenceData after the mutation refetches
    updateField("showcaseBrandId", brandData.id);
  };

  return (
    <>
      <div className="border border-border bg-background p-4 flex flex-col gap-3">
        <p className="type-p !font-medium text-primary">Identifiers</p>

        {/* SKU Input */}
        <div className="space-y-1.5">
          <Label>
            SKU <span className="text-destructive">*</span>
          </Label>
          <Input
            value={localSku}
            onChange={(e) => handleSkuChange(e.target.value)}
            placeholder="Enter SKU"
            className="h-9"
          />
          {formState.errors.sku && (
            <p className="type-small text-destructive">{formState.errors.sku}</p>
          )}
        </div>

        {/* Brand Select */}
        <div className="space-y-1.5">
          <Label>Manufacturer</Label>
          <Select
            options={referenceData.showcaseBrands}
            value={formState.showcaseBrandId || ""}
            onValueChange={(value) => updateField("showcaseBrandId", value)}
            placeholder="Select manufacturer"
            searchable
            searchPlaceholder="Search manufacturer"
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
