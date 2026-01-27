import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../utils";

const inputVariants = cva(
  "flex w-full rounded-none border border-border bg-background px-3 ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-tertiary focus-visible:outline-none focus-visible:ring-[1.5px] focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-50 transition-colors [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
  {
    variants: {
      variant: {
        default: "h-9 !type-p",
        small: "h-[30px] !type-small",
      },
      error: {
        true: "focus-visible:!ring-destructive",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  /**
   * When true and type="number", allows empty input while typing.
   * Defaults to the provided defaultValue (or 0) on blur if left empty.
   */
  allowEmpty?: boolean;
  /**
   * Default value to use on blur when allowEmpty is true and field is empty.
   * Defaults to 0 for number inputs.
   */
  emptyDefault?: number;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type,
      allowEmpty,
      emptyDefault = 0,
      variant,
      error,
      value,
      onChange,
      onBlur,
      onFocus,
      min,
      max,
      ...props
    },
    ref,
  ) => {
    // For numeric inputs with allowEmpty, track local string state
    const [localValue, setLocalValue] = React.useState<string>(
      value !== undefined ? String(value) : "",
    );
    const [isFocused, setIsFocused] = React.useState(false);

    const isNumericWithEmpty = type === "number" && allowEmpty;

    // Sync local value when external value changes (and not focused)
    React.useEffect(() => {
      if (isNumericWithEmpty && !isFocused && value !== undefined) {
        setLocalValue(String(value));
      }
    }, [value, isFocused, isNumericWithEmpty]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isNumericWithEmpty) {
        const raw = e.target.value;
        setLocalValue(raw);

        // Only notify parent if it's a valid number
        if (raw !== "" && raw !== "-" && onChange) {
          let num = Number.parseFloat(raw);
          if (!Number.isNaN(num)) {
            const minVal = typeof min === "number" ? min : undefined;
            const maxVal = typeof max === "number" ? max : undefined;
            if (minVal !== undefined) num = Math.max(minVal, num);
            if (maxVal !== undefined) num = Math.min(maxVal, num);
            // Create synthetic event with the parsed number
            const syntheticEvent = {
              ...e,
              target: { ...e.target, value: String(num) },
            } as React.ChangeEvent<HTMLInputElement>;
            onChange(syntheticEvent);
          }
        }
      } else {
        onChange?.(e);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (isNumericWithEmpty) {
        setIsFocused(false);
        // Default to emptyDefault if empty on blur
        if (localValue === "" || localValue === "-") {
          const minVal = typeof min === "number" ? min : undefined;
          const defaultVal =
            minVal !== undefined
              ? Math.max(minVal, emptyDefault)
              : emptyDefault;
          setLocalValue(String(defaultVal));
          if (onChange) {
            const syntheticEvent = {
              ...e,
              target: { ...e.target, value: String(defaultVal) },
            } as React.ChangeEvent<HTMLInputElement>;
            onChange(syntheticEvent);
          }
        }
      }
      onBlur?.(e);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (isNumericWithEmpty) {
        setIsFocused(true);
      }
      onFocus?.(e);
    };

    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, error, className }))}
        ref={ref}
        value={isNumericWithEmpty ? localValue : value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        min={min}
        max={max}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, inputVariants };
