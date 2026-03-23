/**
 * Billing interval toggle shared by the plan selector surfaces.
 */
"use client";

import { cn } from "@v1/ui/cn";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface BillingIntervalToggleProps {
  interval: "quarterly" | "yearly";
  onChange: (interval: "quarterly" | "yearly") => void;
}

export function BillingIntervalToggle({
  interval,
  onChange,
}: BillingIntervalToggleProps) {
  // Track the active pill geometry so the sliding thumb stays aligned.
  const quarterlyRef = useRef<HTMLButtonElement>(null);
  const yearlyRef = useRef<HTMLButtonElement>(null);
  const [thumb, setThumb] = useState({ left: 0, width: 0 });

  // Measure the active option so the animated thumb stays aligned.
  const measure = useCallback(() => {
    const active =
      interval === "quarterly" ? quarterlyRef.current : yearlyRef.current;
    if (active) {
      setThumb({ left: active.offsetLeft, width: active.offsetWidth });
    }
  }, [interval]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // Re-measure on resize
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div className="relative flex h-9 flex-none">
      {/* Animated thumb */}
      <div
        className="pointer-events-none absolute inset-y-0 border border-border bg-background transition-all duration-200 will-change-[left,width]"
        style={{ left: thumb.left, width: thumb.width }}
      />

      <button
        ref={quarterlyRef}
        type="button"
        onClick={() => onChange("quarterly")}
        className={cn(
          "relative z-10 px-3 text-[14px] transition-colors",
          interval === "quarterly"
            ? "text-primary cursor-default"
            : "text-tertiary hover:text-primary cursor-pointer",
        )}
      >
        Quarterly
      </button>

      <button
        ref={yearlyRef}
        type="button"
        onClick={() => onChange("yearly")}
        className={cn(
          "relative z-10 px-3 text-[14px] transition-colors",
          interval === "yearly"
            ? "text-primary cursor-default"
            : "text-tertiary hover:text-primary cursor-pointer",
        )}
      >
        Yearly (save 15%)
      </button>
    </div>
  );
}
