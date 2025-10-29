'use client';

import { useState, useEffect, useRef } from 'react';
import type { ThemeConfig } from '@/types/theme-config';
import { Icons } from '@v1/ui/icons';

interface Props {
  brand: string;
  title: string;
  description: string;
  themeConfig: ThemeConfig;
  isLast?: boolean;
}

export function ProductDescription({ brand, title, description, themeConfig, isLast = false }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showButton, setShowButton] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  
  // Generate stable ID for accessibility
  const descriptionId = `product-description-${brand.replace(/\s+/g, '-').toLowerCase()}-${title.replace(/\s+/g, '-').toLowerCase()}`;
  
  useEffect(() => {
    const checkHeight = () => {
      if (textRef.current) {
        const textHeight = textRef.current.scrollHeight;
        
        // Calculate container height from computed font size
        let containerHeight = 48; // fallback
        try {
          const computedStyle = window.getComputedStyle(textRef.current);
          const fontSize = Number.parseFloat(computedStyle.fontSize);
          if (Number.isFinite(fontSize) && fontSize > 0) {
            containerHeight = fontSize * 3; // 3em
          }
        } catch (error) {
          console.warn('Failed to compute font size for overflow check:', error);
        }
        
        setShowButton(textHeight > containerHeight);
      }
    };
    
    checkHeight();
    setTimeout(checkHeight, 100);
    
    window.addEventListener('resize', checkHeight);
    return () => window.removeEventListener('resize', checkHeight);
  }, [description]);
  
  return (
    <div
      className={`pt-xl pb-md px-sm md:px-0 md:pt-0 flex flex-col gap-sm w-full${isLast ? ' pb-0' : ''}`}
    >
      <div className="product__brand">
        {brand}
      </div>
      
      <h1 className="product__title">
        {title}
      </h1>
      
      <div className="description-wrapper">
        <div 
          id={descriptionId}
          className={`relative overflow-hidden ${isExpanded ? 'max-h-[1000px]' : 'max-h-[3em]'}`}
        >
          <p
            ref={textRef}
            className="product__description"
          >
            {description}
          </p>
          
          {!isExpanded && (
            <div
              className="absolute bottom-0 left-0 right-0 h-[1.5em] pointer-events-none"
              style={{
                background: 'linear-gradient(to bottom, transparent, var(--background))',
              }}
            />
          )}
        </div>
        
        {showButton && (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="product__show-more text-[12px] leading-[100%] flex items-center gap-micro cursor-pointer pt-sm"
            aria-expanded={isExpanded}
            aria-controls={descriptionId}
          >
            <span>{isExpanded ? 'SHOW LESS' : 'SHOW MORE'}</span>
            <Icons.ChevronDown className={`w-[14px] h-[14px] ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
    </div>
  );
}
