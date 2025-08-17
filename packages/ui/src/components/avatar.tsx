"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import Image from "next/image";
import * as React from "react";
import { cn } from "../utils";

type SizeValue = number | string;
function cssSize(v?: SizeValue): string | undefined {
  if (v == null) return undefined;
  return typeof v === "number" ? `${v}px` : v;
}

interface AvatarProps
  extends Omit<React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>, 'color'> {
  name?: string;
  src?: string | null;
  color?: string | null; // full color string, e.g. "hsl(177 100% 33%)"
  hue?: number | null;   // stored hue integer 160..259
  width?: SizeValue;     // explicit width
  height?: SizeValue;    // explicit height
}

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, style, children, name, src, color, hue, width, height, ...props }, ref) => {
  const w = cssSize(width);
  const h = cssSize(height);
  const box = w ?? h ?? "40px";

  const styleWithVar: React.CSSProperties & { ["--avatar-size"]?: string } = {
    ...style,
    width: w ?? h,
    height: h ?? w,
    ["--avatar-size"]: box,
  };

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full",
        "h-10 w-10", // default 40px if width/height not provided
        className,
      )}
      style={styleWithVar}
      {...props}
    >
      {children || (
        <>
          <AvatarImageNext 
            src={src || ""} 
            alt={name ?? ""} 
            width={typeof width === 'number' ? width : (typeof width === 'string' ? parseInt(width) : 40)} 
            height={typeof height === 'number' ? height : (typeof height === 'string' ? parseInt(height) : 40)}
          />
          <AvatarFallback name={name} color={color ?? undefined} hue={hue ?? undefined} />
        </>
      )}
    </AvatarPrimitive.Root>
  );
});
Avatar.displayName = AvatarPrimitive.Root.displayName;

export const AvatarImageNext = React.forwardRef<
  React.ElementRef<typeof Image>,
  React.ComponentPropsWithoutRef<typeof Image>
>(({ className, onError, ...props }, ref) => {
  const [hasError, setHasError] = React.useState(false);

  if (hasError || !props.src || (typeof props.src === 'string' && props.src.trim() === "")) {
    return null;
  }

  return (
    <Image
      ref={ref}
      className={cn("aspect-square h-full w-full absolute z-10", className)}
      onError={(e) => {
        setHasError(true);
        onError?.(e);
      }}
      {...props}
    />
  );
});

AvatarImageNext.displayName = "AvatarImageNext";

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

interface FallbackProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> {
  name?: string;
  color?: string;
  hue?: number;
}

function firstLetter(name?: string): string {
  if (!name) return "?";
  const ch = name.trim()[0];
  return ch ? ch.toUpperCase() : "?";
}

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  FallbackProps
>(({ className, name, color, hue, style, children, ...props }, ref) => {
  // Build color string if hue is provided. If neither color nor hue, use bg-accent via class only.
  const bgStyle: React.CSSProperties | undefined =
    color ? { backgroundColor: color }
    : hue != null ? { backgroundColor: `hsl(${hue} 100% 33%)` }
    : undefined;

  const label = (children as React.ReactNode) ?? firstLetter(name);

  return (
    <AvatarPrimitive.Fallback
      ref={ref}
      className={cn(
        "flex h-full w-full select-none items-center justify-center rounded-full",
        hue == null && !color ? "bg-brand" : "", // strict rule: default token if DB has nothing
        "uppercase font-normal tracking-normal text-primary-foreground",
        className,
      )}
      style={{
        fontSize: "calc(var(--avatar-size) * 0.5)",
        lineHeight: "var(--avatar-size)",
        ...bgStyle,
        ...style,
      }}
      {...props}
    >
      {label}
    </AvatarPrimitive.Fallback>
  );
});
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export { Avatar, AvatarImage, AvatarFallback };