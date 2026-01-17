/**
 * useNavigationBlocker
 *
 * Custom hook to block navigation when there are unsaved changes.
 * Works with Next.js App Router by intercepting link clicks and
 * providing a pending navigation state.
 *
 * Usage:
 * 1. Call this hook with shouldBlock = true when form has unsaved changes
 * 2. Render UnsavedChangesModal with pendingUrl state
 * 3. Call confirmNavigation() when user confirms discard
 * 4. Call cancelNavigation() when user wants to keep editing
 */

import { useRouter } from "next/navigation";
import * as React from "react";

interface UseNavigationBlockerOptions {
  /** Whether navigation should be blocked */
  shouldBlock: boolean;
  /** Optional callback invoked when user confirms discard (before navigation) */
  onDiscard?: () => void | Promise<void>;
}

interface UseNavigationBlockerResult {
  /** URL user is trying to navigate to (null if no pending navigation) */
  pendingUrl: string | null;
  /** Confirm navigation and proceed to pending URL */
  confirmNavigation: () => void | Promise<void>;
  /** Cancel navigation and stay on current page */
  cancelNavigation: () => void;
  /** Programmatically request navigation (will be blocked if shouldBlock) */
  requestNavigation: (url: string) => void;
  /** Check if a URL would trigger the blocker (for custom link handling) */
  wouldBlock: (url: string) => boolean;
}

export function useNavigationBlocker({
  shouldBlock,
  onDiscard,
}: UseNavigationBlockerOptions): UseNavigationBlockerResult {
  const router = useRouter();
  const [pendingUrl, setPendingUrl] = React.useState<string | null>(null);

  // Handle browser back/forward and tab close
  React.useEffect(() => {
    if (!shouldBlock) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldBlock]);

  // Intercept link clicks globally
  React.useEffect(() => {
    if (!shouldBlock) return;

    const handleClick = (event: MouseEvent) => {
      // Skip if modifier keys are pressed (new tab/window navigation)
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;

      const target = event.target as HTMLElement;
      const link = target.closest("a");

      if (!link) return;

      const href = link.getAttribute("href");
      if (!href) return;

      // Skip external links
      if (href.startsWith("http://") || href.startsWith("https://")) return;

      // Skip same-page anchors
      if (href.startsWith("#")) return;

      // Skip download links
      if (link.hasAttribute("download")) return;

      // Skip links that open in new tab
      if (link.target === "_blank") return;

      // Block the navigation
      event.preventDefault();
      event.stopPropagation();
      setPendingUrl(href);
    };

    // Use capture phase to intercept before Next.js handles it
    document.addEventListener("click", handleClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
    };
  }, [shouldBlock]);

  const confirmNavigation = React.useCallback(async () => {
    if (pendingUrl) {
      const url = pendingUrl;
      setPendingUrl(null);
      // Call onDiscard callback if provided (e.g., to invalidate caches)
      if (onDiscard) {
        try {
          await onDiscard();
        } catch (err) {
          console.error("onDiscard callback failed:", err);
        }
      }
      // Use setTimeout to ensure state is cleared before navigation
      setTimeout(() => {
        router.push(url);
      }, 0);
    }
  }, [pendingUrl, router, onDiscard]);

  const cancelNavigation = React.useCallback(() => {
    setPendingUrl(null);
  }, []);

  const requestNavigation = React.useCallback(
    (url: string) => {
      if (shouldBlock) {
        setPendingUrl(url);
      } else {
        router.push(url);
      }
    },
    [shouldBlock, router],
  );

  const wouldBlock = React.useCallback(
    (url: string) => {
      if (!shouldBlock) return false;
      // Check if it's an internal navigation
      if (url.startsWith("http://") || url.startsWith("https://")) return false;
      if (url.startsWith("#")) return false;
      return true;
    },
    [shouldBlock],
  );

  return {
    pendingUrl,
    confirmNavigation,
    cancelNavigation,
    requestNavigation,
    wouldBlock,
  };
}
