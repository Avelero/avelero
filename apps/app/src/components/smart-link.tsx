"use client";

/**
 * SmartLink Component
 *
 * Extends Next.js Link with optional keep-warm prefetching while the link
 * stays in the viewport.
 */

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import {
  type AnchorHTMLAttributes,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

const DEFAULT_WARM_ROOT_MARGIN = "200px";
const DEFAULT_MIN_WARM_GAP_MS = 45_000;

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

type AnchorProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps>;

export interface SmartLinkProps extends LinkProps, AnchorProps {
  children?: ReactNode;
  keepWarm?: boolean;
  minWarmGapMs?: number;
  warmRootMargin?: string;
}

const globalLastWarmAtByHref = new Map<string, number>();

/**
 * Checks whether the current browser connection should avoid keep-warm prefetch.
 */
function shouldSkipForConnection(): boolean {
  const connection = (navigator as NavigatorWithConnection).connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  return connection.effectiveType === "slow-2g" || connection.effectiveType === "2g";
}

/**
 * Resolves a Link href to a keep-warm eligible internal path.
 */
function resolveKeepWarmHref(href: LinkProps["href"]): string | null {
  if (typeof href !== "string") return null;
  if (!href.startsWith("/")) return null;
  return href;
}

/**
 * Renders a Next.js Link with optional viewport-aware keep-warm prefetching.
 */
export function SmartLink({
  keepWarm = true,
  minWarmGapMs = DEFAULT_MIN_WARM_GAP_MS,
  warmRootMargin = DEFAULT_WARM_ROOT_MARGIN,
  ...props
}: SmartLinkProps) {
  // Reads the App Router instance used for navigation and prefetch APIs.
  const router = useRouter();
  const anchorRef = useRef<HTMLAnchorElement>(null);
  const isInViewportRef = useRef(false);
  const isMountedRef = useRef(false);
  const pendingTimerIdRef = useRef<number | null>(null);

  const keepWarmHref = useMemo(
    () => resolveKeepWarmHref(props.href),
    [props.href],
  );

  /**
   * Clears any scheduled delayed warm attempt.
   */
  const clearPendingWarm = useCallback(() => {
    if (pendingTimerIdRef.current === null) return;
    window.clearTimeout(pendingTimerIdRef.current);
    pendingTimerIdRef.current = null;
  }, []);

  /**
   * Validates whether keep-warm prefetch should currently run.
   */
  const canWarmNow = useCallback(() => {
    if (!keepWarm || !keepWarmHref) return false;
    if (!isInViewportRef.current) return false;
    if (document.visibilityState !== "visible") return false;
    if (!navigator.onLine) return false;
    if (shouldSkipForConnection()) return false;
    return true;
  }, [keepWarm, keepWarmHref]);

  /**
   * Schedules or runs a warm prefetch with global cooldown and invalidation loop.
   */
  const warmPrefetch = useCallback(
    (delayMs = 0) => {
      if (!keepWarmHref) return;

      clearPendingWarm();
      pendingTimerIdRef.current = window.setTimeout(() => {
        pendingTimerIdRef.current = null;
        if (!isMountedRef.current || !canWarmNow()) return;

        const now = Date.now();
        const lastWarmAt = globalLastWarmAtByHref.get(keepWarmHref) ?? 0;
        const elapsedMs = now - lastWarmAt;

        if (elapsedMs < minWarmGapMs) {
          warmPrefetch(minWarmGapMs - elapsedMs);
          return;
        }

        globalLastWarmAtByHref.set(keepWarmHref, now);
        const prefetchOptions = {
          kind: "auto",
          // Re-warm when Next marks this prefetch entry stale.
          onInvalidate: () => {
            warmPrefetch(0);
          },
        };
        router.prefetch(
          keepWarmHref,
          prefetchOptions as Parameters<typeof router.prefetch>[1],
        );
      }, Math.max(0, delayMs));
    },
    [canWarmNow, clearPendingWarm, keepWarmHref, minWarmGapMs, router],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearPendingWarm();
    };
  }, [clearPendingWarm]);

  useEffect(() => {
    if (!keepWarm || !keepWarmHref) return;
    const node = anchorRef.current;
    if (!node) return;

    // Start warming only while the link is in or near the viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isInViewportRef.current = Boolean(entry?.isIntersecting);
        if (isInViewportRef.current) {
          warmPrefetch(0);
        } else {
          clearPendingWarm();
        }
      },
      { root: null, rootMargin: warmRootMargin, threshold: 0.01 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [clearPendingWarm, keepWarm, keepWarmHref, warmPrefetch, warmRootMargin]);

  useEffect(() => {
    if (!keepWarm || !keepWarmHref) return;

    // Re-check warmth when the tab regains focus/visibility/connectivity.
    const handleSignal = () => {
      if (isInViewportRef.current) {
        warmPrefetch(0);
      }
    };

    document.addEventListener("visibilitychange", handleSignal);
    window.addEventListener("focus", handleSignal);
    window.addEventListener("online", handleSignal);

    return () => {
      document.removeEventListener("visibilitychange", handleSignal);
      window.removeEventListener("focus", handleSignal);
      window.removeEventListener("online", handleSignal);
    };
  }, [keepWarm, keepWarmHref, warmPrefetch]);

  return <Link ref={anchorRef} {...props} />;
}
