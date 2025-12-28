"use client";

/**
 * IdentifiersSidebar
 *
 * Sidebar component for product forms showing:
 * - Product handle input
 * - Manufacturer select
 */

import { useBrandCatalog } from "@/hooks/use-brand-catalog";
import { cn } from "@v1/ui/cn";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import { Select } from "@v1/ui/select";
import { useState } from "react";
import {
  type ManufacturerData,
  ManufacturerSheet,
} from "../../../sheets/manufacturer-sheet";

interface IdentifiersSidebarProps {
  productHandle: string;
  setProductHandle: (value: string) => void;
  manufacturerId: string | null;
  setManufacturerId: (value: string | null) => void;
  productHandleError?: string;
  productHandleInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function IdentifiersSidebar({
  productHandle,
  setProductHandle,
  manufacturerId,
  setManufacturerId,
  productHandleError,
  productHandleInputRef,
}: IdentifiersSidebarProps) {
  const { manufacturers: apiBrandOptions } = useBrandCatalog();

  // Convert brandOptions from API format to Select format
  const selectBrandOptions = apiBrandOptions.map(
    (brand: { id: string; name: string }) => ({
      value: brand.id,
      label: brand.name,
    }),
  );

  // Sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pendingManufacturerName, setPendingManufacturerName] = useState("");

  const handleCreateNewManufacturer = (searchTerm: string) => {
    setPendingManufacturerName(searchTerm);
    setSheetOpen(true);
  };

  const handleManufacturerCreated = (manufacturerData: ManufacturerData) => {
    // Auto-select the newly created manufacturer
    // The manufacturer will be available in the dropdown after the immediate mutation updates the query
    setManufacturerId(manufacturerData.id);
  };

  return (
    <>
      <div className="border border-border bg-background p-4 flex flex-col gap-3">
        <p className="type-p !font-medium text-primary">Identifiers</p>

        {/* Product Identifier */}
        <div className="space-y-1.5">
          <Label>
            Product handle <span className="text-destructive">*</span>
          </Label>
          <Input
            ref={productHandleInputRef}
            value={productHandle}
            onChange={(e) => setProductHandle(e.target.value)}
            placeholder="Enter product handle"
            className={cn(
              "h-9",
              productHandleError &&
                "border-destructive focus-visible:border-destructive focus-visible:ring-2 focus-visible:ring-destructive",
            )}
            aria-invalid={Boolean(productHandleError)}
          />
          {productHandleError && (
            <p className="type-small text-destructive">{productHandleError}</p>
          )}
        </div>

        {/* Manufacturer Select */}
        <div className="space-y-1.5">
          <Label>Manufacturer</Label>
          <Select
            options={selectBrandOptions}
            value={manufacturerId || ""}
            onValueChange={setManufacturerId}
            placeholder="Select manufacturer"
            searchable
            searchPlaceholder="Search manufacturer..."
            hasCreateOption
            onCreateNew={handleCreateNewManufacturer}
            createLabel="Create"
            inline
          />
        </div>
      </div>

      {/* Manufacturer Sheet */}
      <ManufacturerSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        initialName={pendingManufacturerName}
        onManufacturerCreated={handleManufacturerCreated}
      />
    </>
  );
}
