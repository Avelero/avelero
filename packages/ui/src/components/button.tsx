import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 p-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground box-border hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground box-border hover:bg-destructive/90",
        outline: "border border-border bg-background hover:bg-accent",
        subtle:
          "bg-background text-secondary border border-border box-border hover:bg-accent",
        secondary:
          "bg-secondary text-secondary-foreground box-border hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        brand: "text-primary-foreground bg-brand hover:bg-brand/90",
      },
      size: {
        default: "h-9 px-2 py-[10px] text-[14px] leading-[16px]",
        sm: "h-[30px] p-2 text-[14px] leading-[14px]",
        lg: "px-8 py-2 text-[14px] leading-[16px]",
        icon: "h-9 p-2 text-[14px] leading-[16px]", // 16x16 icon (default icon-only)
        "icon-sm": "h-[30px] p-2 text-[14px] leading-[14px]", // 14x14 icon (smaller icon-only)
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
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
