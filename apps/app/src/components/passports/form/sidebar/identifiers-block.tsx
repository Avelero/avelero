"use client";

import { Label } from "@v1/ui/label";
import { Input } from "@v1/ui/input";
import { Select } from "@v1/ui/select";
import { useState } from "react";

// TODO: Load from API
const BRAND_OPTIONS = [
  { value: "brand-1", label: "Avelero Apparel" },
  { value: "brand-2", label: "Example Brand Co." },
];

export function IdentifiersSection() {
  const [sku, setSku] = useState("");
  const [ean, setEan] = useState("");
  const [brand, setBrand] = useState<string>("brand-1");

  return (
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
          options={BRAND_OPTIONS}
          value={brand}
          onValueChange={setBrand}
          placeholder="Select brand"
          searchable
          searchPlaceholder="Search brand"
        />
      </div>
    </div>
  );
}
