"use client";

import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../utils";

const booleanVariants = cva("relative flex-1", {
  variants: {
    size: {
      default: "h-9",
      sm: "h-8",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

export interface BooleanProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange">,
    VariantProps<typeof booleanVariants> {
  value?: boolean;
  onChange?: (value: boolean) => void;
  leftLabel?: string;
  rightLabel?: string;
  disabled?: boolean;
  selectedClassName?: string;
  thumbClassName?: string;
}

const BooleanToggle = React.forwardRef<HTMLDivElement, BooleanProps>(
  (
    {
      className,
      size,
      value = false,
      onChange,
      leftLabel = "False",
      rightLabel = "True",
      disabled = false,
      selectedClassName,
      thumbClassName,
      ...props
    },
    ref,
  ) => {
    const handleLeftClick = () => {
      if (!disabled && value !== false) {
        onChange?.(false);
      }
    };

    const handleRightClick = () => {
      if (!disabled && value !== true) {
        onChange?.(true);
      }
    };

    return (
      <div
        ref={ref}
        className={cn(booleanVariants({ size }), className)}
        {...props}
      >
        {/* Thumb - slides based on value */}
        <div
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 w-1/2 border border-border bg-background transition-transform duration-200 will-change-transform",
            value === true ? "translate-x-full" : "translate-x-0",
            thumbClassName,
          )}
        />

        {/* Button Grid */}
        <div className="relative z-10 grid h-full grid-cols-2">
          {/* Left Button (False) */}
          <button
            type="button"
            aria-pressed={value === false}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onClick={handleLeftClick}
            disabled={disabled}
            className={cn(
              "flex items-center justify-center px-3 text-[14px] transition-colors",
              value === false
                ? cn(
                    "text-primary cursor-default pointer-events-none",
                    selectedClassName,
                  )
                : "text-tertiary hover:text-primary cursor-pointer",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            {leftLabel}
          </button>

          {/* Right Button (True) */}
          <button
            type="button"
            aria-pressed={value === true}
            aria-disabled={disabled}
            tabIndex={disabled ? -1 : 0}
            onClick={handleRightClick}
            disabled={disabled}
            className={cn(
              "flex items-center justify-center px-3 text-[14px] transition-colors",
              value === true
                ? cn(
                    "text-primary cursor-default pointer-events-none",
                    selectedClassName,
                  )
                : "text-tertiary hover:text-primary cursor-pointer",
              disabled && "opacity-50 cursor-not-allowed",
            )}
          >
            {rightLabel}
          </button>
        </div>
      </div>
    );
  },
);

BooleanToggle.displayName = "BooleanToggle";

export { BooleanToggle, booleanVariants };
