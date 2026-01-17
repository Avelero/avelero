import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@v1/ui/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1 whitespace-nowrap transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 [&>span]:px-1 [&>span]:text-button outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "button-3d-default text-card-foreground",
        brand: "button-3d-brand text-primary-foreground",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
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
