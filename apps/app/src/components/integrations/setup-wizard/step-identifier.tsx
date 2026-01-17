"use client";

import { cn } from "@v1/ui/cn";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { useState } from "react";

type MatchIdentifier = "sku" | "barcode";

interface StepIdentifierProps {
  onNext: (identifier: MatchIdentifier) => void;
  onBack: () => void;
}

/**
 * Step 2: Choose match identifier (SKU or Barcode).
 * Shown for ALL integrations (primary + secondary).
 */
export function StepIdentifier({ onNext, onBack }: StepIdentifierProps) {
  const [selected, setSelected] = useState<MatchIdentifier>("barcode");

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="space-y-2">
        <h5 className="type-h5 text-foreground">Choose identifier</h5>
        <p className="type-p text-secondary">
          Select how products will be matched with Avelero.
        </p>
      </div>

      {/* Identifier selection cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Barcode option */}
        <button
          type="button"
          onClick={() => setSelected("barcode")}
          className={cn(
            "relative flex flex-col gap-3 p-5 border text-left transition-all duration-100 cursor-pointer",
            selected === "barcode"
              ? "border-foreground bg-accent-light"
              : "border-border hover:bg-accent-light",
          )}
        >
          <Icons.Barcode className="h-6 w-6 text-foreground" />
          <div className="flex flex-col gap-2">
            <div className="flex items-center">
              <span className="type-p !font-medium text-foreground">
                Barcode
              </span>
              <span className="ml-1 inline-flex items-center rounded-full border border-border bg-background px-2 text-[10px] leading-[21px]">
                Recommended
              </span>
            </div>
            <p className="type-small text-secondary">
              Match products using barcodes. More likely to be unique and
              consistent between integrations.
            </p>
          </div>
        </button>

        {/* SKU option */}
        <button
          type="button"
          onClick={() => setSelected("sku")}
          className={cn(
            "relative flex flex-col gap-3 p-5 border text-left transition-all duration-100 cursor-pointer",
            selected === "sku"
              ? "border-foreground bg-accent-light"
              : "border-border hover:bg-accent-light",
          )}
        >
          <Icons.Package className="h-6 w-6 text-foreground" />
          <div className="flex flex-col gap-2">
            <span className="type-p !font-medium text-foreground">SKU</span>
            <p className="type-small text-secondary">
              Match products using SKU codes. Please verify consistency between
              integrations.
            </p>
          </div>
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button variant="default" onClick={() => onNext(selected)}>
          Next
        </Button>
      </div>
    </div>
  );
}
