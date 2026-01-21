"use client";

import { cn } from "@v1/ui/cn";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";
import * as React from "react";

interface EnvironmentSectionProps {
  carbonKgCo2e: string;
  setCarbonKgCo2e: (value: string) => void;
  waterLiters: string;
  setWaterLiters: (value: string) => void;
  weightGrams: string;
  setWeightGrams: (value: string) => void;
  carbonError?: string;
  waterError?: string;
  weightError?: string;
}

export function EnvironmentSection({
  carbonKgCo2e,
  setCarbonKgCo2e,
  waterLiters,
  setWaterLiters,
  weightGrams,
  setWeightGrams,
  carbonError,
  waterError,
  weightError,
}: EnvironmentSectionProps) {
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
      let cleanDecimal = decimalPart.replace(/[^\d]/g, "").substring(0, 4);

      // Remove trailing zeros from decimal part (85.3400 -> 85.34)
      cleanDecimal = cleanDecimal.replace(/0+$/, "");

      // Remove non-digits from integer part
      const cleanInteger = integerPart.replace(/[^\d]/g, "");

      // Remove leading zeros but keep "0" if that's the only digit
      const trimmedInteger = cleanInteger.replace(/^0+/, "") || "0";

      // Combine, only add decimal if there's a non-empty decimal part
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
              onChange={(e) =>
                handleNumericChange(e.target.value, setCarbonKgCo2e)
              }
              onBlur={(e) => handleNumericBlur(e.target.value, setCarbonKgCo2e)}
              placeholder="Enter carbon value"
              className={cn(
                "h-9 flex-1",
                carbonError &&
                  "focus-visible:ring-destructive focus-visible:border-destructive",
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
              onChange={(e) =>
                handleNumericChange(e.target.value, setWaterLiters)
              }
              onBlur={(e) => handleNumericBlur(e.target.value, setWaterLiters)}
              placeholder="Enter water value"
              className={cn(
                "h-9 flex-1",
                waterError &&
                  "focus-visible:ring-destructive focus-visible:border-destructive",
              )}
            />
          </div>
          {waterError && (
            <p className="type-small text-destructive">{waterError}</p>
          )}
        </div>

        {/* Weight Input */}
        <div className="flex flex-col gap-1">
          <Label>Weight</Label>
          <div className="flex items-center">
            <div className="flex items-center border-y border-l border-border bg-background h-9 px-3 w-[81px] type-p text-secondary whitespace-nowrap">
              grams
            </div>
            <Input
              type="text"
              value={weightGrams}
              onChange={(e) =>
                handleNumericChange(e.target.value, setWeightGrams)
              }
              onBlur={(e) => handleNumericBlur(e.target.value, setWeightGrams)}
              placeholder="Enter product weight"
              className={cn(
                "h-9 flex-1",
                weightError &&
                  "focus-visible:ring-destructive focus-visible:border-destructive",
              )}
            />
          </div>
          {weightError && (
            <p className="type-small text-destructive">{weightError}</p>
          )}
        </div>
      </div>
    </div>
  );
}
