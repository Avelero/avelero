"use client";

import type { SimilarProduct, ThemeConfig } from "@v1/dpp-components";
import { Icons } from "@v1/ui/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { ProductCard } from "./product-card";

interface Props {
  products: SimilarProduct[];
  themeConfig: ThemeConfig;
  imageZoom?: number;
  imagePosition?: "top" | "center" | "bottom";
}

export function ProductCarousel({
  products,
  themeConfig,
  imageZoom = 100,
  imagePosition = "top",
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const endSpacerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<number | undefined>(undefined);

  // Update end spacer width based on content padding
  const updateEndSpacer = useCallback(() => {
    if (!contentRef.current || !endSpacerRef.current) return;

    // Get the computed padding-inline and gap values from the content element
    const computedStyle = window.getComputedStyle(contentRef.current);
    const paddingInline =
      computedStyle.paddingInlineStart ||
      computedStyle.paddingInline ||
      computedStyle.paddingLeft;
    const paddingValue = Number.parseFloat(paddingInline);
    const gapValue = Number.parseFloat(computedStyle.gap) || 0;

    // Set end spacer width to padding minus gap
    const spacerWidth = Math.max(paddingValue - gapValue, 1);
    endSpacerRef.current.style.width = `${spacerWidth}px`;
  }, []);

  // Update button visibility based on scroll position
  const updateButtonVisibility = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollLeft, clientWidth, scrollWidth } = scrollRef.current;

    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  }, []);

  // Scroll handler - travels 2 cards + 2 gaps
  const scroll = useCallback((direction: "left" | "right") => {
    if (!scrollRef.current || !contentRef.current) return;

    const card = scrollRef.current.querySelector(
      ".product-item",
    ) as HTMLElement;
    if (!card) return;

    // Get the computed gap value from the content element
    const computedStyle = window.getComputedStyle(contentRef.current);
    const gapValue = Number.parseFloat(computedStyle.gap) || 0;

    // Calculate distance: 2 cards + 2 gaps
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

  // Handle scroll events with debounced fade effect
  const handleScroll = useCallback(() => {
    updateButtonVisibility();
    setIsScrolling(true);

    if (scrollTimeoutRef.current) window.clearTimeout(scrollTimeoutRef.current);

    scrollTimeoutRef.current = window.setTimeout(() => {
      setIsScrolling(false);
    }, 200);
  }, [updateButtonVisibility]);

  // Setup event listeners
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

  if (!products || products.length === 0) return null;

  const showNavButtons = products.length > 3;

  return (
    <div className="carousel py-lg @3xl:pt-2x @3xl:pb-lg w-full">
      {/* Header container - keeps the title aligned with the page content */}
      <div className="max-w-container mx-auto px-sm @3xl:px-lg">
        <h6 className="carousel__title">Similar Items</h6>
      </div>

      {/* Carousel container */}
      <div className="relative pt-sm">
        <div className="w-full overflow-hidden">
          <div
            ref={scrollRef}
            className="overflow-x-auto scrollbar-none"
            style={{
              scrollBehavior: "smooth",
            }}
          >
            <div ref={contentRef} className="carousel__content flex gap-sm">
              {products.map((product, index) => (
                <div key={`${product.name}-${index}`} className="product-item">
                  <ProductCard
                    product={product}
                    imageZoom={imageZoom}
                    imagePosition={imagePosition}
                  />
                </div>
              ))}
              {/* End spacer to ensure the last card can be fully scrolled */}
              <div
                ref={endSpacerRef}
                className="carousel__end-spacer flex-shrink-0"
              />
            </div>
          </div>
        </div>

        {/* Navigation buttons */}
        {showNavButtons && (
          <>
            <button
              type="button"
              onClick={() => scroll("left")}
              className={`nav-button-fade border carousel__nav-button carousel__nav-button--prev hidden @3xl:flex absolute top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center cursor-pointer ${!canScrollLeft ? "@3xl:hidden" : ""} ${isScrolling ? "fading" : ""}`}
              aria-label="Previous items"
            >
              <Icons.ChevronLeft className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => scroll("right")}
              className={`nav-button-fade border carousel__nav-button carousel__nav-button--next hidden @3xl:flex absolute top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center cursor-pointer ${!canScrollRight ? "@3xl:hidden" : ""} ${isScrolling ? "fading" : ""}`}
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
