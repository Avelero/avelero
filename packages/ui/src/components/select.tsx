"use client";

import * as React from "react";
import { cn } from "../utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

// ============================================================================
// Select Context - for clearing cmdk selection when hovering footer
// ============================================================================
interface SelectContextValue {
  /** Clears the cmdk selection highlight (used when hovering outside the list) */
  clearSelection: () => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext() {
  return React.useContext(SelectContext);
}

/** Root component for composable select - wraps Popover */
const Select = Popover;

/** Trigger component for composable select - wraps PopoverTrigger */
const SelectTrigger = PopoverTrigger;

/** Content wrapper for composable select - combines PopoverContent + Command */
const SelectContent = React.forwardRef<
  React.ElementRef<typeof PopoverContent>,
  React.ComponentPropsWithoutRef<typeof PopoverContent> & {
    /** If false, disables cmdk's built-in filtering (useful for external/async filtering). Default: true */
    shouldFilter?: boolean;
    /** Default highlighted value - highlights this item instead of the first one */
    defaultValue?: string;
  }
>(
  (
    { className, children, shouldFilter = true, defaultValue, ...props },
    ref,
  ) => {
    // Track the controlled value for cmdk selection
    const [value, setValue] = React.useState(defaultValue ?? "");

    // Reset to default value when defaultValue changes (e.g., when popover reopens)
    React.useEffect(() => {
      setValue(defaultValue ?? "");
    }, [defaultValue]);

    const contextValue = React.useMemo<SelectContextValue>(
      () => ({
        clearSelection: () => setValue("__clear__"),
      }),
      [],
    );

    return (
      <PopoverContent
        ref={ref}
        className={cn(
          "w-[--radix-popover-trigger-width] min-w-[200px] max-w-[320px] p-0",
          className,
        )}
        align="start"
        {...props}
      >
        <SelectContext.Provider value={contextValue}>
          <Command
            shouldFilter={shouldFilter}
            value={value}
            onValueChange={setValue}
          >
            {children}
          </Command>
        </SelectContext.Provider>
      </PopoverContent>
    );
  },
);
SelectContent.displayName = "SelectContent";

/** Search input for composable select - wraps CommandInput */
const SelectSearch = CommandInput;

/** Scrollable list container for composable select - wraps CommandList */
const SelectList = React.forwardRef<
  React.ElementRef<typeof CommandList>,
  React.ComponentPropsWithoutRef<typeof CommandList>
>(({ className, ...props }, ref) => (
  <CommandList ref={ref} className={cn("max-h-48", className)} {...props} />
));
SelectList.displayName = "SelectList";

/** Group container for select items - wraps CommandGroup */
const SelectGroup = CommandGroup;

/** Individual selectable item - wraps CommandItem */
const SelectItem = React.forwardRef<
  React.ElementRef<typeof CommandItem>,
  React.ComponentPropsWithoutRef<typeof CommandItem>
>(({ className, ...props }, ref) => (
  <CommandItem
    ref={ref}
    className={cn("justify-between", className)}
    {...props}
  />
));
SelectItem.displayName = "SelectItem";

/** Empty state display - wraps CommandEmpty */
const SelectEmpty = CommandEmpty;

/** Separator between groups - wraps CommandSeparator */
const SelectSeparator = CommandSeparator;

/** Header section for select content (above the list) */
const SelectHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "px-2 py-1.5 text-xs font-medium text-secondary border-b border-border",
      className,
    )}
    {...props}
  />
));
SelectHeader.displayName = "SelectHeader";

/** Footer section for select content (below the list, separated by border).
 *  Clears cmdk selection on mouse enter to prevent double-highlight. */
const SelectFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, onMouseEnter, ...props }, ref) => {
  const context = useSelectContext();

  const handleMouseEnter = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      context?.clearSelection();
      onMouseEnter?.(e);
    },
    [context, onMouseEnter],
  );

  return (
    <div
      ref={ref}
      className={cn("border-t border-border p-1", className)}
      onMouseEnter={handleMouseEnter}
      {...props}
    />
  );
});
SelectFooter.displayName = "SelectFooter";

/**
 * Reusable action component for select menus (footer context).
 * Uses a regular button instead of CommandItem to avoid cmdk selection state persistence.
 */
const SelectAction = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Callback when action is selected */
    onSelect?: () => void;
  }
>(({ className, children, onSelect, onClick, tabIndex = 0, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    tabIndex={tabIndex}
    onClick={(e) => {
      onClick?.(e);
      onSelect?.();
    }}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center gap-0.5 rounded-none px-2 h-[30px] !type-small outline-none",
      "hover:bg-accent hover:text-accent-foreground",
      "focus-visible:bg-accent focus-visible:text-accent-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </button>
));
SelectAction.displayName = "SelectAction";

export {
  Select,
  SelectTrigger,
  SelectContent,
  SelectSearch,
  SelectList,
  SelectGroup,
  SelectItem,
  SelectEmpty,
  SelectSeparator,
  SelectHeader,
  SelectFooter,
  SelectAction,
};
