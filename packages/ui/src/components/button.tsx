import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center text-p transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "!text-p bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "!text-p bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "!text-p border bg-transparent hover:bg-accent hover:text-accent-foreground",
        secondary:
          "!text-p bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "!text-p hover:bg-accent hover:text-accent-foreground",
        link: "!text-p text-primary underline-offset-4 hover:underline",
        brand: "!text-p text-primary-foreground bg-brand hover:bg-brand/90",
      },
      size: {
        default: "px-4 py-2",
        popover: "px-3 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
