"use client";

import { useEffect, useRef, useState } from "react";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

interface RollingDigitProps {
  digit: number;
  /** Whether to skip the entrance animation on first render. */
  skipInitial: boolean;
}

function RollingDigit({ digit, skipInitial }: RollingDigitProps) {
  const [animated, setAnimated] = useState(skipInitial);

  useEffect(() => {
    // Enable transitions after mount so the initial render doesn't animate.
    if (!animated) {
      requestAnimationFrame(() => setAnimated(true));
    }
  }, [animated]);

  return (
    <span className="inline-block h-[1lh] overflow-hidden leading-[inherit] align-bottom">
      <span
        className="inline-flex flex-col"
        style={{
          transform: `translateY(${-digit * 10}%)`,
          transition: animated ? "transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
        }}
      >
        {DIGITS.map((d) => (
          <span
            key={d}
            className="inline-block h-[1lh] leading-[inherit]"
            aria-hidden={d !== digit}
          >
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

interface RollingPriceProps {
  value: number;
  className?: string;
}

export function RollingPrice({ value, className }: RollingPriceProps) {
  const formatted = `€${value.toLocaleString("en-US")}`;
  const isFirstRender = useRef(true);

  useEffect(() => {
    isFirstRender.current = false;
  }, []);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {formatted.split("").map((char, i) => {
        const pos = `p${i}`;
        const digit = Number.parseInt(char, 10);
        if (Number.isNaN(digit)) {
          return <span key={pos}>{char}</span>;
        }
        return (
          <RollingDigit
            key={pos}
            digit={digit}
            skipInitial={isFirstRender.current}
          />
        );
      })}
    </span>
  );
}
