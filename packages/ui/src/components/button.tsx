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
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
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
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    // Auto-detect icon-only button
    const isIconOnly = icon && !children;

    // Determine icon size based on the size prop
    // size="sm" or size="icon-sm" uses 14x14 icons
    // everything else (including size="icon") uses 16x16 icons
    const useSmallIcon = size === "sm" || size === "icon-sm";
    const iconSizeClass = useSmallIcon ? "h-[14px] w-[14px]" : "h-4 w-4";

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {icon && iconPosition === "left" && (
              <span className={cn("inline-flex items-center", iconSizeClass)}>
                {icon}
              </span>
            )}
            {children && (
              <span className="inline-flex items-center px-1">
                {children}
              </span>
            )}
            {icon && iconPosition === "right" && (
              <span className={cn("inline-flex items-center", iconSizeClass)}>
                {icon}
              </span>
            )}
          </>
        )}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
