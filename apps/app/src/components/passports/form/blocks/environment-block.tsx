"use client";

import * as React from "react";
import { Label } from "@v1/ui/label";
import { Input } from "@v1/ui/input";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { cn } from "@v1/ui/cn";

interface EcoClaim {
  id: string;
  value: string;
}

export function EnvironmentSection() {
  const [carbon, setCarbon] = React.useState("");
  const [water, setWater] = React.useState("");
  const [ecoClaims, setEcoClaims] = React.useState<EcoClaim[]>([]);

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
        prev.map((claim) => (claim.id === id ? { ...claim, value } : claim))
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
              type="number"
              value={carbon}
              onChange={(e) => setCarbon(e.target.value)}
              placeholder="Enter carbon value"
              className="h-9 flex-1"
            />
          </div>
        </div>

        {/* Water Input */}
        <div className="flex flex-col gap-1">
          <Label>Water</Label>
          <div className="flex items-center">
            <div className="flex items-center border-y border-l border-border bg-background h-9 px-3 w-[81px] type-p text-secondary whitespace-nowrap">
              Liter
            </div>
            <Input
              type="number"
              value={water}
              onChange={(e) => setWater(e.target.value)}
              placeholder="Enter water value"
              className="h-9 flex-1"
            />
          </div>
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
