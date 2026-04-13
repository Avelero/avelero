import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "@v1/ui/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-sm transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 [&>span]:px-1 [&>span]:text-button outline-none focus-visible:border-ring focus-visible:ring-ring focus-visible:ring-[3px] aria-invalid:ring-destructive aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "button-3d-default text-foreground",
        brand: "button-3d-brand text-primary-foreground",
        destructive:
          "bg-destructive text-white hover:brightness-90 focus-visible:ring-destructive",
        outline:
          "border border-border bg-background text-foreground hover:bg-[#02021208]",
        ghost:
          "hover:bg-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "px-4 py-3 [&_svg]:size-[14px]",
        sm: "px-3 py-2 [&_svg]:size-[14px]",
        lg: "px-4 py-3 [&_svg]:size-[16px]",
        icon: "size-[38px] [&_svg]:size-[14px]",
        "icon-sm": "size-8 [&_svg]:size-[14px]",
        "icon-lg": "size-10 [&_svg]:size-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  const processedChildren = asChild
    ? children
    : React.Children.map(children, (child) =>
        typeof child === "string" || typeof child === "number" ? (
          <span>{child}</span>
        ) : (
          child
        ),
      );

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {processedChildren}
    </Comp>
  );
}

export { Button, buttonVariants };
