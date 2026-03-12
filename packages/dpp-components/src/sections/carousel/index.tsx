"use client";

/**
 * Similar products carousel canvas section.
 *
 * Renders the carousel inside the shared canvas wrapper so it aligns with the
 * other canvas blocks.
 */

import { Icons } from "@v1/ui/icons";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { resolveStyles } from "../../lib/resolve-styles";
import { formatPrice } from "../../utils/formatting";
import type { SectionProps } from "../registry";

/** Render the similar products carousel and keep scroll controls in sync. */
export function CarouselSection({
  section,
  tokens,
  zoneId,
  content,
  wrapperClassName,
}: SectionProps) {
  // Derive the rendered product slice once and expose only the section root to the editor.
  const s = resolveStyles(section.styles, tokens);
  const products = content?.similarProducts ?? [];

  const showTitle = section.content.showTitle !== false;
  const showPrice = section.content.showPrice !== false;
  const roundPrice = section.content.roundPrice !== false;
  const productCount = (section.content.productCount as number) ?? 6;

  const displayProducts = products.slice(0, productCount);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const endSpacerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number | undefined>(undefined);
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const rootSelection = select("carousel", "overlay");

  const updateEndSpacer = useCallback(() => {
    if (!contentRef.current || !endSpacerRef.current) return;
    const computedStyle = window.getComputedStyle(contentRef.current);
    const paddingInline =
      computedStyle.paddingInlineStart ||
      computedStyle.paddingInline ||
      computedStyle.paddingLeft;
    const paddingValue = Number.parseFloat(paddingInline);
    const gapValue = Number.parseFloat(computedStyle.gap) || 0;
    const spacerWidth = Math.max(paddingValue - gapValue, 1);
    endSpacerRef.current.style.width = `${spacerWidth}px`;
  }, []);

  const updateButtonVisibility = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth, scrollWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  }, []);

  const scroll = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current || !contentRef.current) return;
    const card = scrollRef.current.querySelector(
      ".product-item",
    ) as HTMLElement;
    if (!card) return;
    const computedStyle = window.getComputedStyle(contentRef.current);
    const gapValue = Number.parseFloat(computedStyle.gap) || 0;
    const scrollDistance = (card.getBoundingClientRect().width + gapValue) * 2;
    const current = scrollRef.current.scrollLeft;
    const maxScroll =
      scrollRef.current.scrollWidth - scrollRef.current.clientWidth;
    const target =
      direction === "left"
        ? Math.max(current - scrollDistance, 0)
        : Math.min(current + scrollDistance, maxScroll);
    scrollRef.current.scrollTo({ left: target, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    updateButtonVisibility();
    setIsScrolling(true);
    if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = window.setTimeout(
      () => setIsScrolling(false),
      200,
    );
  }, [updateButtonVisibility]);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;
    updateEndSpacer();
    updateButtonVisibility();
    scrollContainer.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", updateEndSpacer);
    window.addEventListener("resize", updateButtonVisibility);
    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateEndSpacer);
      window.removeEventListener("resize", updateButtonVisibility);
      if (scrollTimeoutRef.current)
        window.clearTimeout(scrollTimeoutRef.current);
    };
  }, [handleScroll, updateButtonVisibility, updateEndSpacer]);

  if (displayProducts.length === 0) return null;

  const showNavButtons = displayProducts.length > 3;

  return (
    <div {...rootSelection} className={wrapperClassName ?? "w-full"}>
      <h6 style={s.title}>Similar Items</h6>

      <div className="relative pt-sm">
        <div className="w-full overflow-hidden">
          <div
            ref={scrollRef}
            className="overflow-x-auto scrollbar-none"
            style={{ scrollBehavior: "smooth" }}
          >
            <div ref={contentRef} className="carousel__content flex gap-sm">
              {displayProducts.map((product, index) => (
                <div key={`${product.name}-${index}`} className="product-item">
                  <a
                    href={product.url}
                    className="flex flex-col gap-sm cursor-pointer w-full h-full"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <div
                      className="relative w-full overflow-hidden border"
                      style={{ aspectRatio: "3/4", ...s.productImage }}
                    >
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 280px"
                        quality={90}
                      />
                    </div>
                    {(showTitle || showPrice) && (
                      <div className="flex gap-xs" style={s.productDetails}>
                        {showTitle && (
                          <div
                            className="line-clamp-2 min-w-0"
                            style={s.productName}
                          >
                            {product.name}
                          </div>
                        )}
                        {showPrice && (
                          <div className="flex-shrink-0" style={s.productPrice}>
                            {formatPrice(
                              product.price,
                              product.currency,
                              roundPrice,
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </a>
                </div>
              ))}
              <div ref={endSpacerRef} className="flex-shrink-0" />
            </div>
          </div>
        </div>

        {showNavButtons && (
          <>
            <button
              type="button"
              onClick={() => scroll("left")}
              className={`nav-button-fade border hidden @3xl:flex absolute top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center cursor-pointer ${!canScrollLeft ? "@3xl:hidden" : ""} ${isScrolling ? "fading" : ""}`}
              style={{ ...s.navButton, left: "1rem" }}
              aria-label="Previous items"
            >
              <Icons.ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scroll("right")}
              className={`nav-button-fade border hidden @3xl:flex absolute top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center cursor-pointer ${!canScrollRight ? "@3xl:hidden" : ""} ${isScrolling ? "fading" : ""}`}
              style={{ ...s.navButton, right: "1rem" }}
              aria-label="Next items"
            >
              <Icons.ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
