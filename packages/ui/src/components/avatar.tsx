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
  extends Omit<
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    "color"
  > {
  name?: string | null;
  src?: string | null;
  /** Hex color for fallback background (e.g., "#E53935") */
  color?: string | null;
  size?: number; // single source of truth for size
  loading?: boolean;
  className?: string;
}

/**
 * SmartAvatar implements 3 visual states with 4 scenarios:
 * 1) loading → default empty state (bg-accent + user icon)
 * 2) src present → render image
 * 3) no src and color present → initials with colored background
 * 4) no src and no color → default empty state (bg-accent + user icon)
 *
 * Note: Scenarios 1 and 4 share the same visual appearance (default fallback).
 */
export const SmartAvatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  SmartAvatarProps
>(
  (
    {
      name,
      src,
      color,
      size = 40,
      loading = false,
      className,
      style,
      ...props
    },
    ref,
  ) => {
    const w = cssSize(size);
    const h = cssSize(size);
    const box = w ?? h ?? "40px";

    const styleWithVar: React.CSSProperties & { "--avatar-size"?: string } = {
      ...style,
      width: w,
      height: h,
      "--avatar-size": box,
    };

    const [isLoaded, setIsLoaded] = React.useState(false);
    const [hadError, setHadError] = React.useState(false);
    React.useEffect(() => {
      setIsLoaded(false);
      setHadError(false);
    }, [src]);

    const hasSrc = !!src;
    const isImagePending = hasSrc && !isLoaded && !hadError;

    // Internal decision once, so AvatarPrimitive subtree stays minimal.
    const showDefault = loading || (!hasSrc && color == null) || isImagePending;
    const showImage = hasSrc && !hadError;
    const showFallback = !loading && !hasSrc && color != null;

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
            onLoad={() => setIsLoaded(true)}
            onError={() => setHadError(true)}
            style={{ opacity: isLoaded ? 1 : 0 }}
          />
        ) : null}

        {showFallback ? (
          <InitialsFallback name={name ?? undefined} color={color!} />
        ) : null}

        {showDefault ? (
          <DefaultFallback size={typeof size === "number" ? size : 40} />
        ) : null}
      </AvatarPrimitive.Root>
    );
  },
);
SmartAvatar.displayName = "SmartAvatar";

/** Next.js Image wrapper that disappears on error or empty src */
const AvatarImageNext = React.forwardRef<
  React.ElementRef<typeof Image>,
  React.ComponentPropsWithoutRef<typeof Image>
>(({ className, onError, onLoad, src, ...rest }, ref) => {
  const [hasError, setHasError] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  // Check if image is already loaded (from cache)
  React.useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      // Image is already loaded from cache, fire onLoad immediately
      onLoad?.(new Event("load") as any);
    }
  }, [src, onLoad]);

  const srcStr = src as unknown as string | undefined;
  const isAbsoluteHttp =
    typeof srcStr === "string" && /^https?:\/\//i.test(srcStr);
  const isSameOriginRelative =
    typeof srcStr === "string" && srcStr.startsWith("/");
  if (hasError || !(isAbsoluteHttp || isSameOriginRelative)) return null;

  return (
    <Image
      ref={(node) => {
        // @ts-ignore
        imgRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cn(
        "absolute inset-0 z-10 h-full w-full object-cover object-center",
        className,
      )}
      onError={(e) => {
        setHasError(true);
        onError?.(e);
      }}
      unoptimized={isAbsoluteHttp}
      onLoad={(e) => {
        onLoad?.(e);
      }}
      src={srcStr!}
      {...rest}
    />
  );
});
AvatarImageNext.displayName = "AvatarImageNext";

/** Initials over colored background - font size is 50% of avatar size (2:1 ratio) */
function InitialsFallback({ name, color }: { name?: string; color: string }) {
  const label = firstLetter(name);
  return (
    <div
      className={cn(
        "flex h-full w-full select-none items-center justify-center rounded-full",
        "uppercase font-medium tracking-normal text-primary-foreground",
      )}
      style={{
        backgroundColor: color,
        // 2:1 ratio: avatar size / 2 = font size (e.g., 24px circle → 12px font)
        fontSize: "calc(var(--avatar-size) / 2)",
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
