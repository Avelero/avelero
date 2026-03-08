"use client";

import { Icons } from "@v1/ui/icons";
import { useEffect, useRef, useState } from "react";
import { resolveStyles } from "../../lib/resolve-styles";
import type { SectionProps } from "../registry";

export function HeroSection({ section, tokens, data }: SectionProps) {
  const s = resolveStyles(section.styles, tokens);
  const { productAttributes, productIdentifiers } = data;

  const brand = productAttributes.brand;
  const title = productIdentifiers.productName;
  const description = productAttributes.description ?? "";

  const [isExpanded, setIsExpanded] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  const descriptionId = `hero-desc-${section.id}`;

  useEffect(() => {
    const checkHeight = () => {
      if (!textRef.current) return;
      const textHeight = textRef.current.scrollHeight;
      let containerHeight = 48;
      try {
        const computedStyle = window.getComputedStyle(textRef.current);
        const fontSize = Number.parseFloat(computedStyle.fontSize);
        if (Number.isFinite(fontSize) && fontSize > 0) {
          containerHeight = fontSize * 3;
        }
      } catch {
        // fallback to 48px
      }
      setShowButton(textHeight > containerHeight);
    };

    checkHeight();

    const handleFontsLoaded = () => checkHeight();
    if (document.fonts) {
      document.fonts.addEventListener("loadingdone", handleFontsLoaded);
    }
    const timeoutId = setTimeout(checkHeight, 100);
    window.addEventListener("resize", checkHeight);

    return () => {
      if (document.fonts) {
        document.fonts.removeEventListener("loadingdone", handleFontsLoaded);
      }
      clearTimeout(timeoutId);
      window.removeEventListener("resize", checkHeight);
    };
  }, [description]);

  return (
    <div className="pt-xl px-sm @3xl:px-0 @3xl:pt-0 flex flex-col gap-sm w-full">
      <div style={s.brand}>{brand}</div>
      <h1 style={s.title}>{title}</h1>

      {description && (
        <div>
          <div
            id={descriptionId}
            className={`relative overflow-hidden ${showButton && !isExpanded ? "max-h-[3em]" : ""}`}
          >
            <p ref={textRef} style={s.description}>
              {description}
            </p>
            {showButton && !isExpanded && (
              <div
                className="absolute bottom-0 left-0 right-0 h-[1.5em] pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to bottom, transparent, var(--background))",
                }}
              />
            )}
          </div>

          {showButton && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-micro cursor-pointer pt-sm"
              style={s.showMore}
              aria-expanded={isExpanded}
              aria-controls={descriptionId}
            >
              <span>{isExpanded ? "SHOW LESS" : "SHOW MORE"}</span>
              <Icons.ChevronDown
                className={`w-[14px] h-[14px] ${isExpanded ? "rotate-180" : ""}`}
              />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
