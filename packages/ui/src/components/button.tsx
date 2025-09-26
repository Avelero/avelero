import { Slot } from "@radix-ui/react-slot";
import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center text-p transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 p-2",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border bg-transparent hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        brand: "text-primary-foreground bg-brand hover:bg-brand/90",
        "default-secondary":
          "bg-background text-secondary border border-border hover:bg-accent",
        "default-primary":
          "bg-primary text-primary-foreground border border-primary hover:bg-primary/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        popover: "px-3 py-2",
        sm: "p-2",
        lg: "h-9 px-8",
        icon: "p-2",
        iconSm: "p-2",
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
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  iconOnly?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      icon,
      iconPosition = "right",
      iconOnly = false,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const isSmall = size === "sm" || size === "iconSm";
    const iconSizeClass = isSmall ? "h-[14px] w-[14px]" : "h-4 w-4";
    const textSizeClass = isSmall
      ? "text-[14px] leading-[14px]"
      : "text-[14px] leading-[16px]";

    const content = (
      <>
        {icon && iconPosition === "left" ? (
          <span className={cn("inline-flex items-center", iconSizeClass)}>
            {icon}
          </span>
        ) : null}
        <span
          className={cn(
            "inline-flex items-center px-1",
            isSmall ? "leading-[14px]" : "leading-[16px]",
          )}
        >
          <span className={textSizeClass}>{children}</span>
        </span>
        {icon && iconPosition === "right" ? (
          <span className={cn("inline-flex items-center", iconSizeClass)}>
            {icon}
          </span>
        ) : null}
      </>
    );

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {asChild ? (
          children
        ) : iconOnly && icon ? (
          <span className={cn("inline-flex items-center", iconSizeClass)}>
            {icon}
          </span>
        ) : (
          content
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
