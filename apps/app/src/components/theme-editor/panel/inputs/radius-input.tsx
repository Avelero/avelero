"use client";

import { cn } from "@v1/ui/cn";
import { Input } from "@v1/ui/input";
import { Label } from "@v1/ui/label";

interface RadiusInputProps {
  label?: string;
  values: {
    topLeft: number;
    topRight: number;
    bottomLeft: number;
    bottomRight: number;
  };
  onChange: (values: {
    topLeft: number;
    topRight: number;
    bottomLeft: number;
    bottomRight: number;
  }) => void;
  className?: string;
}

/**
 * 4-corner radius input for border-radius values.
 * Displays a 2x2 grid with corner indicators.
 */
export function RadiusInput({
  label,
  values,
  onChange,
  className,
}: RadiusInputProps) {
  const handleChange = (corner: keyof typeof values, value: number) => {
    onChange({ ...values, [corner]: value });
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label variant="small">{label}</Label>}
      <div className="grid grid-cols-2 gap-2">
        {/* Top-Left */}
        <div className="relative">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 pointer-events-none border-l border-t border-tertiary" />
          <Input
            type="number"
            allowEmpty
            value={values.topLeft}
            onChange={(e) =>
              handleChange("topLeft", Number.parseFloat(e.target.value))
            }
            min={0}
            className="h-8 text-sm pl-7"
          />
        </div>
        {/* Top-Right */}
        <div className="relative">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 pointer-events-none border-r border-t border-tertiary" />
          <Input
            type="number"
            allowEmpty
            value={values.topRight}
            onChange={(e) =>
              handleChange("topRight", Number.parseFloat(e.target.value))
            }
            min={0}
            className="h-8 text-sm pl-7"
          />
        </div>
        {/* Bottom-Left */}
        <div className="relative">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 pointer-events-none border-l border-b border-tertiary" />
          <Input
            type="number"
            allowEmpty
            value={values.bottomLeft}
            onChange={(e) =>
              handleChange("bottomLeft", Number.parseFloat(e.target.value))
            }
            min={0}
            className="h-8 text-sm pl-7"
          />
        </div>
        {/* Bottom-Right */}
        <div className="relative">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 pointer-events-none border-r border-b border-tertiary" />
          <Input
            type="number"
            allowEmpty
            value={values.bottomRight}
            onChange={(e) =>
              handleChange("bottomRight", Number.parseFloat(e.target.value))
            }
            min={0}
            className="h-8 text-sm pl-7"
          />
        </div>
      </div>
    </div>
  );
}
