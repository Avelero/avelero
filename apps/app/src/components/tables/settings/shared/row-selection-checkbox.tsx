"use client";

import * as React from "react";

export function RowSelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
  hitArea = "row",
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean, meta?: { shiftKey: boolean }) => void;
  ariaLabel: string;
  hitArea?: "header" | "row";
}) {
  const ref = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate && !checked;
    }
  }, [checked, indeterminate]);

  return (
    <label
      className={
        "relative inline-flex h-14 w-11 -mx-[14px] items-center justify-center cursor-pointer"
      }
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => {
        if (event.shiftKey) {
          event.preventDefault();
        }
      }}
    >
      <input
        ref={ref}
        type="checkbox"
        aria-label={ariaLabel}
        aria-checked={indeterminate ? "mixed" : checked ? "true" : "false"}
        className="block h-4 w-4 shrink-0 appearance-none border-[1.5px] border-border bg-background checked:bg-background checked:border-brand aria-[checked=mixed]:border-brand cursor-pointer outline-none focus:outline-none"
        checked={checked}
        onChange={(event) => {
          const shiftKey = (event.nativeEvent as MouseEvent).shiftKey;
          (event.target as HTMLInputElement).blur();
          if (shiftKey) {
            window.getSelection?.()?.removeAllRanges();
          }
          onChange(event.target.checked, { shiftKey });
        }}
      />
      {(checked || indeterminate) && (
        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-[10px] h-[10px] bg-brand" />
        </span>
      )}
    </label>
  );
}
