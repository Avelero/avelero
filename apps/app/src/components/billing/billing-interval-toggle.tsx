"use client";

import { cn } from "@v1/ui/cn";
import { useCallback, useEffect, useRef, useState } from "react";

interface BillingIntervalToggleProps {
  interval: "monthly" | "yearly";
  onChange: (interval: "monthly" | "yearly") => void;
}

export function BillingIntervalToggle({
  interval,
  onChange,
}: BillingIntervalToggleProps) {
  const monthlyRef = useRef<HTMLButtonElement>(null);
  const yearlyRef = useRef<HTMLButtonElement>(null);
  const [thumb, setThumb] = useState({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const active =
      interval === "monthly" ? monthlyRef.current : yearlyRef.current;
    if (active) {
      setThumb({ left: active.offsetLeft, width: active.offsetWidth });
    }
  }, [interval]);

  useEffect(() => {
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
        ref={monthlyRef}
        type="button"
        onClick={() => onChange("monthly")}
        className={cn(
          "relative z-10 px-3 text-[14px] transition-colors",
          interval === "monthly"
            ? "text-primary cursor-default"
            : "text-tertiary hover:text-primary cursor-pointer",
        )}
      >
        Monthly
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
        Yearly (save 10%)
      </button>
    </div>
  );
}
