import { useCallback, useRef } from "react";

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

    // Keep callback ref updated
    callbackRef.current = callback;

    return useCallback(
        (...args: Parameters<T>) => {
            const now = Date.now();
            const timeSinceLastCall = now - lastCallRef.current;

            // If outside throttle window, fire immediately (leading edge)
            if (timeSinceLastCall >= delayMs) {
                if (options.leading) {
                    lastCallRef.current = now;
                    callbackRef.current(...args);
                }
                return;
            }

            // Inside throttle window - schedule trailing call if enabled
            pendingRef.current = true;

            if (!timeoutRef.current && options.trailing) {
                const remaining = delayMs - timeSinceLastCall;
                timeoutRef.current = setTimeout(() => {
                    if (pendingRef.current) {
                        lastCallRef.current = Date.now();
                        callbackRef.current(...args);
                        pendingRef.current = false;
                    }
                    timeoutRef.current = null;
                }, remaining);
            }
        },
        [delayMs, options.leading, options.trailing],
    ) as T;
}
