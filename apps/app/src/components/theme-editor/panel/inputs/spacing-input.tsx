"use client";

import { Input } from "@v1/ui/input";
import { cn } from "@v1/ui/cn";
import { Label } from "@v1/ui/label";

interface SpacingValues {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface SpacingInputProps {
  outerLabel?: string;
  innerLabel?: string;
  outerValues: SpacingValues;
  innerValues: SpacingValues;
  onOuterChange: (values: SpacingValues) => void;
  onInnerChange: (values: SpacingValues) => void;
  className?: string;
}

/**
 * Spacing input with outer (margin) and inner (padding) sections.
 * Each section has 4 directional inputs.
 */
export function SpacingInput({
  outerLabel = "Outer",
  innerLabel = "Inner",
  outerValues,
  innerValues,
  onOuterChange,
  onInnerChange,
  className,
}: SpacingInputProps) {
  const handleOuterChange = (side: keyof SpacingValues, value: number) => {
    onOuterChange({ ...outerValues, [side]: value });
  };

  const handleInnerChange = (side: keyof SpacingValues, value: number) => {
    onInnerChange({ ...innerValues, [side]: value });
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Outer (Margin) */}
      <div className="space-y-1.5">
        <Label variant="small">{outerLabel}</Label>
        <div className="grid grid-cols-2 gap-2">
          {/* Top */}
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 type-small text-tertiary pointer-events-none">
              ↑
            </span>
            <Input
              type="number"
              allowEmpty
              value={outerValues.top}
              onChange={(e) =>
                handleOuterChange("top", Number.parseFloat(e.target.value))
              }
              className="h-8 text-sm pl-7"
            />
          </div>
          {/* Right */}
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 type-small text-tertiary pointer-events-none">
              →
            </span>
            <Input
              type="number"
              allowEmpty
              value={outerValues.right}
              onChange={(e) =>
                handleOuterChange("right", Number.parseFloat(e.target.value))
              }
              className="h-8 text-sm pl-7"
            />
          </div>
          {/* Bottom */}
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 type-small text-tertiary pointer-events-none">
              ↓
            </span>
            <Input
              type="number"
              allowEmpty
              value={outerValues.bottom}
              onChange={(e) =>
                handleOuterChange("bottom", Number.parseFloat(e.target.value))
              }
              className="h-8 text-sm pl-7"
            />
          </div>
          {/* Left */}
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 type-small text-tertiary pointer-events-none">
              ←
            </span>
            <Input
              type="number"
              allowEmpty
              value={outerValues.left}
              onChange={(e) =>
                handleOuterChange("left", Number.parseFloat(e.target.value))
              }
              className="h-8 text-sm pl-7"
            />
          </div>
        </div>
      </div>

      {/* Inner (Padding) */}
      <div className="space-y-1.5">
        <Label variant="small">{innerLabel}</Label>
        <div className="grid grid-cols-2 gap-2">
          {/* Top */}
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 type-small text-tertiary pointer-events-none">
              ↑
            </span>
            <Input
              type="number"
              allowEmpty
              value={innerValues.top}
              onChange={(e) =>
                handleInnerChange("top", Number.parseFloat(e.target.value))
              }
              className="h-8 text-sm pl-7"
            />
          </div>
          {/* Right */}
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 type-small text-tertiary pointer-events-none">
              →
            </span>
            <Input
              type="number"
              allowEmpty
              value={innerValues.right}
              onChange={(e) =>
                handleInnerChange("right", Number.parseFloat(e.target.value))
              }
              className="h-8 text-sm pl-7"
            />
          </div>
          {/* Bottom */}
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 type-small text-tertiary pointer-events-none">
              ↓
            </span>
            <Input
              type="number"
              allowEmpty
              value={innerValues.bottom}
              onChange={(e) =>
                handleInnerChange("bottom", Number.parseFloat(e.target.value))
              }
              className="h-8 text-sm pl-7"
            />
          </div>
          {/* Left */}
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 type-small text-tertiary pointer-events-none">
              ←
            </span>
            <Input
              type="number"
              allowEmpty
              value={innerValues.left}
              onChange={(e) =>
                handleInnerChange("left", Number.parseFloat(e.target.value))
              }
              className="h-8 text-sm pl-7"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
