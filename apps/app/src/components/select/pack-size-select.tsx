/**
 * Select component for choosing a passport pack size.
 * Shows per-passport price in the dropdown items.
 */
"use client";

import { Button } from "@v1/ui/button";
import { cn } from "@v1/ui/cn";
import { Icons } from "@v1/ui/icons";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectList,
  SelectTrigger,
} from "@v1/ui/select";
import { useState } from "react";
import {
  CREDIT_PACKS,
  formatCredits,
} from "../billing/plan-features";

interface PackSizeSelectProps {
  value: string | null;
  onValueChange: (size: string) => void;
  className?: string;
}

function formatPerPassport(price: number, credits: number): string {
  const per = price / credits;
  return `€${per.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}/passport`;
}

export function PackSizeSelect({
  value,
  onValueChange,
  className,
}: PackSizeSelectProps) {
  const [open, setOpen] = useState(false);

  const selectedPack = value
    ? CREDIT_PACKS.find((p) => String(p.credits) === value)
    : null;

  const displayValue = selectedPack
    ? `${formatCredits(selectedPack.credits)} passports`
    : null;

  function handleSelect(size: string) {
    onValueChange(size);
    setOpen(false);
  }

  return (
    <Select open={open} onOpenChange={setOpen}>
      <SelectTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className={cn(
            "w-full justify-between data-[state=open]:bg-accent",
            className,
          )}
        >
          <span
            className={cn("truncate px-1", !displayValue && "text-tertiary")}
          >
            {displayValue ?? "Select passports..."}
          </span>
          <Icons.ChevronDown className="h-4 w-4 text-tertiary" />
        </Button>
      </SelectTrigger>
      <SelectContent>
        <SelectList>
          <SelectGroup>
            {CREDIT_PACKS.map((pack) => {
              const packKey = String(pack.credits);

              return (
                <SelectItem
                  key={packKey}
                  value={packKey}
                  onSelect={() => handleSelect(packKey)}
                >
                  <span className="px-1">
                    {formatCredits(pack.credits)} passports —{" "}
                    {formatPerPassport(pack.price, pack.credits)}
                  </span>
                  {value === packKey && (
                    <Icons.Check className="h-4 w-4" />
                  )}
                </SelectItem>
              );
            })}
          </SelectGroup>
        </SelectList>
      </SelectContent>
    </Select>
  );
}
