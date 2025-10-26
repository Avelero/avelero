'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type { ThemeConfig } from '@/types/theme-config';
import type { SimilarProduct } from '@/types/dpp-data';
import { ProductCard } from './product-card';
import { Icons } from '@v1/ui/icons';

interface Props {
  products: SimilarProduct[];
  brandName: string;
  theme: ThemeConfig;
  imageZoom?: number;
  imagePosition?: 'top' | 'center' | 'bottom';
}

export function ProductCarousel({
  products,
  brandName,
  theme,
  imageZoom = 100,
  imagePosition = 'center',
}: Props) {
  const { colors } = theme;
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const carouselContentRef = useRef<HTMLDivElement>(null);
  const endSpacerRef = useRef<HTMLDivElement>(null);
  const prevButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);
  
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [padding, setPadding] = useState(0);
  const scrollTimeoutRef = useRef<number | undefined>(undefined);
  
  // Get component padding based on screen size
  const getComponentPadding = useCallback(() => {
    return window.innerWidth < 768 ? 12 : 24; // 12px on mobile (--spacing-sm), 24px on desktop (--spacing-lg)
  }, []);
  
  // Update carousel layout and padding
  const updateCarouselLayout = useCallback(() => {
    if (!headerRef.current || !carouselContentRef.current) return;
    
    // Get the actual left position of the header container
    const containerRect = headerRef.current.getBoundingClientRect();
    const containerLeftOffset = containerRect.left;
    
    // Get the responsive padding value based on screen size
    const componentPadding = getComponentPadding();
    
    // Add the component padding to match other components' padding
    const totalPadding = containerLeftOffset + componentPadding;
    
    // Apply the same padding to both left and right of the carousel content
    carouselContentRef.current.style.paddingLeft = `${totalPadding}px`;
    carouselContentRef.current.style.paddingRight = `${totalPadding}px`;
    
    // Set the end spacer width based on mobile/desktop
    if (endSpacerRef.current) {
      const isMobile = window.innerWidth < 768;
      
      if (isMobile) {
        endSpacerRef.current.style.display = 'block';
        endSpacerRef.current.style.width = '1px';
        endSpacerRef.current.style.minHeight = '200px';
      } else {
        // Desktop: Use the totalPadding calculation but subtract the gap (12px)
        endSpacerRef.current.style.display = 'block';
        endSpacerRef.current.style.width = `${Math.max(totalPadding - 12, 0)}px`;
        endSpacerRef.current.style.minHeight = '200px';
      }
    }
    
    // Update padding state for button positioning
    setPadding(totalPadding);
  }, [getComponentPadding]);
  
  // Update button visibility based on scroll position
  const updateButtonVisibility = useCallback(() => {
    if (!scrollRef.current || !prevButtonRef.current || !nextButtonRef.current) return;
    
    const scrollLeft = scrollRef.current.scrollLeft;
    const visibleWidth = scrollRef.current.clientWidth;
    const totalWidth = scrollRef.current.scrollWidth;
    
    // Show/hide prev button based on scroll position
    const shouldShowPrev = scrollLeft > 1;
    setCanScrollLeft(shouldShowPrev);
    
    // Show/hide next button based on whether we've reached the end
    const shouldShowNext = scrollLeft + visibleWidth < totalWidth - 5;
    setCanScrollRight(shouldShowNext);
  }, []);
  
  // Hide buttons during scrolling with fade effect
  const hideButtonsDuringScroll = useCallback(() => {
    if (!prevButtonRef.current || !nextButtonRef.current) return;
    
    // Add fading class to buttons
    prevButtonRef.current.classList.add('fading');
    nextButtonRef.current.classList.add('fading');
    
    // Clear existing timeout
    if (scrollTimeoutRef.current !== undefined) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Set a new timeout to show buttons after scroll stops
    scrollTimeoutRef.current = window.setTimeout(() => {
      if (prevButtonRef.current && nextButtonRef.current) {
        prevButtonRef.current.classList.remove('fading');
        nextButtonRef.current.classList.remove('fading');
      }
    }, 200);
  }, []);
  
  // Calculate scroll distance based on item width and gap
  const calculateScrollDistance = useCallback(() => {
    if (!scrollRef.current) return 0;
    
    const items = scrollRef.current.querySelectorAll('.product-item');
    if (items.length === 0) return 0;
    
    // Get the exact width of the first item
    const firstItem = items[0] as HTMLElement;
    const itemWidth = firstItem.offsetWidth;
    
    // Use the standard spacing-sm value (12px)
    const gap = 12;
    
    // Check if we're on mobile or desktop
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
      // On mobile, scroll by exactly one card width + gap
      return itemWidth + gap;
    }
    // On desktop, scroll by exactly TWO cards width + TWO gaps
    return (itemWidth * 2) + (gap * 2);
  }, []);
  
  // Scroll handler
  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    
    const scrollDistance = calculateScrollDistance();
    const scrollAmount = direction === 'left' ? -scrollDistance : scrollDistance;
    
    scrollRef.current.scrollBy({
      left: scrollAmount,
      behavior: 'smooth'
    });
  }, [calculateScrollDistance]);
  
  // Handle scroll events
  const handleScroll = useCallback(() => {
    updateButtonVisibility();
    hideButtonsDuringScroll();
  }, [updateButtonVisibility, hideButtonsDuringScroll]);
  
  // Setup effects
  useEffect(() => {
    // Initialize layout
    updateCarouselLayout();
    updateButtonVisibility();
    
    // Add event listeners
    const scrollContainer = scrollRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
    }
    
    window.addEventListener('resize', updateCarouselLayout);
    window.addEventListener('resize', updateButtonVisibility);
    
    // Cleanup
    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('resize', updateCarouselLayout);
      window.removeEventListener('resize', updateButtonVisibility);
      
      if (scrollTimeoutRef.current !== undefined) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [updateCarouselLayout, updateButtonVisibility, handleScroll]);
  
  if (!products || products.length === 0) return null;
  
  const showNavButtons = products.length > 3;
  
  return (
    <div className="py-lg md:pt-2x md:pb-lg w-full">
      {/* Header container - used to measure padding alignment */}
      <div ref={headerRef} className="max-w-container mx-auto px-sm md:px-lg">
        <h6 className="type-h6" style={{ color: colors.primaryText }}>
          SIMILAR ITEMS
        </h6>
      </div>
      
      {/* Carousel container */}
      <div className="relative pt-sm">
        <div className="w-full overflow-hidden">
          <div
            ref={scrollRef}
            className="overflow-x-auto scrollbar-none"
            style={{
              scrollBehavior: 'smooth',
            }}
          >
            <div
              ref={carouselContentRef}
              className="flex gap-sm"
            >
              {products.map((product, index) => (
                <div
                  key={`${product.name}-${index}`}
                  className="product-item"
                >
                  <ProductCard
                    product={product}
                    theme={theme}
                    imageZoom={imageZoom}
                    imagePosition={imagePosition}
                  />
                </div>
              ))}
              {/* End spacer to ensure the last card can be fully scrolled */}
              <div
                ref={endSpacerRef}
                className="flex-shrink-0"
                style={{ width: '1px', minHeight: '200px' }}
              />
            </div>
          </div>
        </div>
        
        {/* Navigation buttons */}
        {showNavButtons && (
          <>
            <button
              ref={prevButtonRef}
              type="button"
              onClick={() => scroll('left')}
              className={`nav-button-fade hidden md:flex absolute top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center cursor-pointer ${!canScrollLeft ? 'md:hidden' : ''}`}
              style={{
                left: `${padding}px`,
                border: `1px solid ${colors.highlight}`,
                color: colors.highlight,
              }}
              aria-label="Previous items"
            >
              <Icons.ChevronLeft className="w-4 h-4" />
            </button>
            
            <button
              ref={nextButtonRef}
              type="button"
              onClick={() => scroll('right')}
              className={`nav-button-fade hidden md:flex absolute top-1/2 -translate-y-1/2 w-9 h-9 items-center justify-center cursor-pointer ${!canScrollRight ? 'md:hidden' : ''}`}
              style={{
                right: `${padding}px`,
                border: `1px solid ${colors.highlight}`,
                color: colors.highlight,
              }}
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
