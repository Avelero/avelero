"use client";

import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import * as React from "react";

interface EcoClaim {
  id: string;
  value: string;
}

interface EnvironmentSectionProps {
  carbonKgCo2e: string;
  setCarbonKgCo2e: (value: string) => void;
  waterLiters: string;
  setWaterLiters: (value: string) => void;
  carbonError?: string;
  waterError?: string;
}

export function EnvironmentSection({
  carbonKgCo2e,
  setCarbonKgCo2e,
  waterLiters,
  setWaterLiters,
  carbonError,
  waterError,
}: EnvironmentSectionProps) {
  // Eco-claims are local state (not yet implemented in API submission)
  const [ecoClaims, setEcoClaims] = React.useState<EcoClaim[]>([]);

  // Normalize numeric input: handle commas, spaces, multiple decimals, and precision
  const normalizeNumericInput = (value: string): string => {
    if (!value || value.trim() === "") return "";

    // Remove spaces
    let normalized = value.replace(/\s+/g, "");

    // Find the first decimal separator (. or ,)
    const firstDecimalIndex = normalized.search(/[.,]/);

    if (firstDecimalIndex !== -1) {
      // Split by the first decimal separator
      const integerPart = normalized.substring(0, firstDecimalIndex);
      const decimalPart = normalized.substring(firstDecimalIndex + 1);

      // Remove all non-digits from decimal part and limit to 4 digits
      const cleanDecimal = decimalPart.replace(/[^\d]/g, "").substring(0, 4);

      // Remove non-digits from integer part
      const cleanInteger = integerPart.replace(/[^\d]/g, "");

      // Remove leading zeros but keep "0" if that's the only digit
      const trimmedInteger = cleanInteger.replace(/^0+/, "") || "0";

      // Combine, only add decimal if there's a decimal part
      normalized = cleanDecimal
        ? `${trimmedInteger}.${cleanDecimal}`
        : trimmedInteger;
    } else {
      // No decimal separator, just clean digits and remove leading zeros
      normalized = normalized.replace(/[^\d]/g, "");
      normalized = normalized.replace(/^0+/, "") || "0";
    }

    return normalized;
  };

  // Handle input change - allow any numeric characters while typing
  const handleNumericChange = (
    value: string,
    setter: (value: string) => void,
  ) => {
    // Allow only digits, spaces, commas, and periods while typing
    const filtered = value.replace(/[^\d\s.,]/g, "");
    setter(filtered);
  };

  // Handle blur - normalize the value
  const handleNumericBlur = (
    value: string,
    setter: (value: string) => void,
  ) => {
    const normalized = normalizeNumericInput(value);
    setter(normalized);
  };

  const addEcoClaim = () => {
    if (ecoClaims.length < 5) {
      const newClaim: EcoClaim = {
        id: Date.now().toString(),
        value: "",
      };
      setEcoClaims((prev) => [...prev, newClaim]);
    }
  };

  const updateEcoClaim = (id: string, value: string) => {
    // Limit to 50 characters
    if (value.length <= 50) {
      setEcoClaims((prev) =>
        prev.map((claim) => (claim.id === id ? { ...claim, value } : claim)),
      );
    }
  };

  const removeEcoClaim = (id: string) => {
    setEcoClaims((prev) => prev.filter((claim) => claim.id !== id));
  };

  const canAddEcoClaim = ecoClaims.length < 5;

  return (
    <div className="border border-border bg-background">
      <div className="p-4 flex flex-col gap-3">
        <p className="type-p !font-medium text-primary">Environment</p>

        {/* Carbon Input */}
        <div className="flex flex-col gap-1">
          <Label>Carbon</Label>
          <div className="flex items-center">
            <div className="flex items-center border-y border-l border-border bg-background h-9 px-3 w-[81px] type-p text-secondary whitespace-nowrap">
              kgCO2e
            </div>
            <Input
              type="text"
              value={carbonKgCo2e}
              onChange={(e) => handleNumericChange(e.target.value, setCarbonKgCo2e)}
              onBlur={(e) => handleNumericBlur(e.target.value, setCarbonKgCo2e)}
              placeholder="Enter carbon value"
              className={cn(
                "h-9 flex-1",
                carbonError && "focus-visible:ring-destructive focus-visible:border-destructive"
              )}
            />
          </div>
          {carbonError && (
            <p className="type-small text-destructive">{carbonError}</p>
          )}
        </div>

        {/* Water Input */}
        <div className="flex flex-col gap-1">
          <Label>Water</Label>
          <div className="flex items-center">
            <div className="flex items-center border-y border-l border-border bg-background h-9 px-3 w-[81px] type-p text-secondary whitespace-nowrap">
              Liter
            </div>
            <Input
              type="text"
              value={waterLiters}
              onChange={(e) => handleNumericChange(e.target.value, setWaterLiters)}
              onBlur={(e) => handleNumericBlur(e.target.value, setWaterLiters)}
              placeholder="Enter water value"
              className={cn(
                "h-9 flex-1",
                waterError && "focus-visible:ring-destructive focus-visible:border-destructive"
              )}
            />
          </div>
          {waterError && (
            <p className="type-small text-destructive">{waterError}</p>
          )}
        </div>

        {/* Separator if eco-claims exist */}
        {ecoClaims.length > 0 && <div className="border-t border-border" />}

        {/* Eco-claims */}
        {ecoClaims.map((claim) => (
          <div key={claim.id} className="group/claim relative">
            <div className="transition-[margin-right] duration-200 ease-in-out group-hover/claim:mr-11">
              <div className="relative">
                <Icons.Check className="h-4 w-4 text-brand absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input
                  value={claim.value}
                  onChange={(e) => updateEcoClaim(claim.id, e.target.value)}
                  placeholder="Enter eco-claim..."
                  className="h-9 w-full pl-8"
                  maxLength={50}
                />
              </div>
            </div>
            <div className="absolute right-0 top-0 w-0 group-hover/claim:w-9 overflow-hidden transition-[width] duration-200 ease-in-out">
              <Button
                type="button"
                variant="outline"
                onClick={() => removeEcoClaim(claim.id)}
                className="h-9 w-9 text-tertiary hover:text-destructive flex-shrink-0"
              >
                <Icons.X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer with Add Button */}
      {canAddEcoClaim && (
        <div className="border-t border-border px-4 py-3 bg-accent-light">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEcoClaim}
            icon={<Icons.Plus className="h-4 w-4" />}
            iconPosition="left"
          >
            Add eco-claim
          </Button>
        </div>
      )}
    </div>
  );
}
