"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import Image from "next/image";
import * as React from "react";
import { cn } from "../utils";
import { Icons } from "./icons";

type SizeValue = number | string;
function cssSize(v?: SizeValue): string | undefined {
  if (v == null) return undefined;
  return typeof v === "number" ? `${v}px` : v;
}

export interface SmartAvatarProps
  extends Omit<React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>, "color"> {
  name?: string | null;
  src?: string | null;
  hue?: number | null;
  size?: number;              // single source of truth for size
  loading?: boolean;
  className?: string;
}

/**
 * SmartAvatar implements the 4 states:
 * 1) src present → render image
 * 2) no src and hue present → initials with HSL(hue 100% 33%)
 * 3) no src and no hue → default empty state (bg-accent + user icon)
 * 4) loading → default empty state
 */
export const SmartAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  SmartAvatarProps
>(({ name, src, hue, size = 40, loading = false, className, style, ...props }, ref) => {
  const w = cssSize(size);
  const h = cssSize(size);
  const box = w ?? h ?? "40px";

  const styleWithVar: React.CSSProperties & { ["--avatar-size"]?: string } = {
    ...style,
    width: w,
    height: h,
    ["--avatar-size"]: box,
  };

  // Internal decision once, so AvatarPrimitive subtree stays minimal.
  const showDefault = loading || (!src && (hue == null));
  const showImage = !loading && !!src;
  const showFallback = !loading && !src && hue != null;

  return (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full border border-border",
        "h-10 w-10",
        className,
      )}
      style={styleWithVar}
      {...props}
    >
      {showImage ? (
        <AvatarImageNext
          src={src || ""}
          alt={name ?? ""}
          width={typeof size === "number" ? size : 40}
          height={typeof size === "number" ? size : 40}
        />
      ) : null}

      {showFallback ? (
        <InitialsFallback name={name ?? undefined} hue={hue!} />
      ) : null}

      {showDefault ? <DefaultFallback size={typeof size === "number" ? size : 40} /> : null}
    </AvatarPrimitive.Root>
  );
});
SmartAvatar.displayName = "SmartAvatar";

/** Next.js Image wrapper that disappears on error or empty src */
const AvatarImageNext = React.forwardRef<
  React.ElementRef<typeof Image>,
  React.ComponentPropsWithoutRef<typeof Image>
>(({ className, onError, src, ...rest }, ref) => {
  const [hasError, setHasError] = React.useState(false);
  const srcStr = src as unknown as string | undefined;
  const isAbsoluteHttp = typeof srcStr === "string" && /^https?:\/\//i.test(srcStr);
  if (hasError || !isAbsoluteHttp) return null;

  return (
    <Image
      ref={ref}
      className={cn("absolute inset-0 z-10 h-full w-full object-cover object-center", className)}
      onError={(e) => {
        setHasError(true);
        onError?.(e);
      }}
      unoptimized
      src={srcStr!}
      {...rest}
    />
  );
});
AvatarImageNext.displayName = "AvatarImageNext";

/** Initials over HSL hue background */
function InitialsFallback({ name, hue }: { name?: string; hue: number }) {
  const label = firstLetter(name);
  return (
    <div
      className={cn(
        "flex h-full w-full select-none items-center justify-center rounded-full",
        "uppercase font-normal tracking-normal text-primary-foreground",
      )}
      style={{
        backgroundColor: `hsl(${hue} 100% 33%)`,
        fontSize: "calc(var(--avatar-size) * 0.5)",
        lineHeight: "var(--avatar-size)",
      }}
    >
      {label}
    </div>
  );
}

/** Default empty state: bg-accent + user icon sized at 50% */
function DefaultFallback({ size }: { size: number }) {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-accent">
      <Icons.UserRound className="text-tertiary" size={size * 0.5} />
    </div>
  );
}

function firstLetter(name?: string): string {
  if (!name) return "?";
  const ch = name.trim()[0];
  return ch ? ch.toUpperCase() : "?";
}

// Backwards-compat named exports in case other code imports these symbols
export { SmartAvatar as Avatar };