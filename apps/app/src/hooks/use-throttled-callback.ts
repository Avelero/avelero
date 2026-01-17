import { useCallback, useRef, useEffect } from "react";

interface ThrottleOptions {
  leading?: boolean; // Fire on first call
  trailing?: boolean; // Fire after window closes
}

/**
 * Returns a throttled version of the callback.
 * - Leading edge: fires immediately on first call
 * - Trailing edge: fires once after delay if called during throttle window
 */
export function useThrottledCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delayMs: number,
  options: ThrottleOptions = { leading: true, trailing: true },
): T {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<boolean>(false);
  const callbackRef = useRef(callback);
  const lastArgsRef = useRef<Parameters<T> | null>(null);

  // Keep callback ref updated
  callbackRef.current = callback;

  // Cleanup timeout on unmount to prevent memory leaks and state updates on unmounted components
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      // If outside throttle window
      if (timeSinceLastCall >= delayMs) {
        // Always update timestamp to start new throttle window
        lastCallRef.current = now;

        if (options.leading) {
          // Fire immediately on leading edge
          callbackRef.current(...args);
        } else if (options.trailing) {
          // Leading is disabled but trailing is enabled - schedule trailing call
          lastArgsRef.current = args;
          pendingRef.current = true;
          timeoutRef.current = setTimeout(() => {
            if (pendingRef.current && lastArgsRef.current) {
              lastCallRef.current = Date.now();
              callbackRef.current(...lastArgsRef.current);
              pendingRef.current = false;
              lastArgsRef.current = null;
            }
            timeoutRef.current = null;
          }, delayMs);
        }
        return;
      }

      // Inside throttle window - schedule trailing call if enabled
      lastArgsRef.current = args;
      pendingRef.current = true;

      if (!timeoutRef.current && options.trailing) {
        const remaining = delayMs - timeSinceLastCall;
        timeoutRef.current = setTimeout(() => {
          if (pendingRef.current && lastArgsRef.current) {
            lastCallRef.current = Date.now();
            callbackRef.current(...lastArgsRef.current);
            pendingRef.current = false;
            lastArgsRef.current = null;
          }
          timeoutRef.current = null;
        }, remaining);
      }
    },
    [delayMs, options.leading, options.trailing],
  ) as T;
}
