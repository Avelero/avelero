"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as React from "react";

import { cn } from "../utils";

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

const PopoverAnchor = PopoverPrimitive.Anchor;

type PopoverContentProps = React.ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
> & {
  inline?: boolean;
  /**
   * When false (default), prevents focus stealing on open, which avoids scroll jumps
   * when nested inside other modals (e.g., Sheet/Dialog). When true, allows normal
   * auto-focus behavior on open.
   */
  modal?: boolean;
  /**
   * Container element for the portal. When specified, the popover will be portaled
   * into this container instead of document.body. Useful when the popover is inside
   * a Sheet/Dialog to ensure proper scroll behavior.
   */
  container?: HTMLElement | null;
};

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(
  (
    {
      className,
      align = "center",
      sideOffset = 4,
      inline = false,
      modal = false,
      container,
      onOpenAutoFocus,
      ...props
    },
    ref,
  ) => {
    // When not modal, prevent focus stealing which can cause scroll jumps
    const handleOpenAutoFocus = modal
      ? onOpenAutoFocus
      : (e: Event) => {
          e.preventDefault();
          onOpenAutoFocus?.(e);
        };

    const content = (
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        collisionPadding={16}
        onOpenAutoFocus={handleOpenAutoFocus}
        className={cn(
          "z-50 min-w-[8rem] overflow-hidden rounded-none",
          "border border-border bg-background p-0 shadow-lg",
          "text-foreground",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "data-[side=bottom]:slide-in-from-top-2",
          "data-[side=left]:slide-in-from-right-2",
          "data-[side=right]:slide-in-from-left-2",
          "data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    );

    if (inline) return content;
    return (
      <PopoverPrimitive.Portal container={container}>
        {content}
      </PopoverPrimitive.Portal>
    );
  },
);
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
