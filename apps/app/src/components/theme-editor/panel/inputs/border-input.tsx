"use client";

import { Input } from "@v1/ui/input";
import { cn } from "@v1/ui/cn";
import { Label } from "@v1/ui/label";

interface BorderInputProps {
  label?: string;
  values: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  onChange: (values: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }) => void;
  className?: string;
}

/**
 * 4-side border width input.
 * Displays a 2x2 grid with single border indicators showing which side is controlled.
 */
export function BorderInput({
  label,
  values,
  onChange,
  className,
}: BorderInputProps) {
  const handleChange = (side: keyof typeof values, value: number) => {
    onChange({ ...values, [side]: value });
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label variant="small">{label}</Label>}
      <div className="grid grid-cols-2 gap-2">
        {/* Top */}
        <div className="relative">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 pointer-events-none border-t border-tertiary" />
          <Input
            type="number"
            allowEmpty
            value={values.top}
            onChange={(e) =>
              handleChange("top", Number.parseFloat(e.target.value))
            }
            min={0}
            className="h-8 text-sm pl-7"
          />
        </div>
        {/* Right */}
        <div className="relative">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 pointer-events-none border-r border-tertiary" />
          <Input
            type="number"
            allowEmpty
            value={values.right}
            onChange={(e) =>
              handleChange("right", Number.parseFloat(e.target.value))
            }
            min={0}
            className="h-8 text-sm pl-7"
          />
        </div>
        {/* Bottom */}
        <div className="relative">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 pointer-events-none border-b border-tertiary" />
          <Input
            type="number"
            allowEmpty
            value={values.bottom}
            onChange={(e) =>
              handleChange("bottom", Number.parseFloat(e.target.value))
            }
            min={0}
            className="h-8 text-sm pl-7"
          />
        </div>
        {/* Left */}
        <div className="relative">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 pointer-events-none border-l border-tertiary" />
          <Input
            type="number"
            allowEmpty
            value={values.left}
            onChange={(e) =>
              handleChange("left", Number.parseFloat(e.target.value))
            }
            min={0}
            className="h-8 text-sm pl-7"
          />
        </div>
      </div>
    </div>
  );
}










