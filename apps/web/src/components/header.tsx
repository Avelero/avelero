"use client";

import { AveleroLogo } from "@v1/ui/avelero-logo";
import { Button } from "./button";
import { useEffect, useState } from "react";

export function Header() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const scrollRange = 16;
      
      const progress = Math.min(scrollY / scrollRange, 1);
      setScrollProgress(progress);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Disable body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      <div className="h-4" />
      <header
        className={`sticky top-0 w-full flex items-center justify-between z-50 py-4 px-4 sm:px-16 backdrop-blur-md bg-background/80 transition-none ${
          isMobileMenuOpen ? 'border-b-0 md:border-b' : 'border-b'
        }`}
        style={{
          borderBottomColor: `hsl(var(--border) / ${scrollProgress})`,
        }}
      >
        <div className={isMobileMenuOpen ? 'invisible md:visible' : ''}>
          <AveleroLogo height={32} color="var(--foreground)" />
        </div>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:block">
          <div className="flex items-center gap-4">
            <a href="/product" className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150">
              Product
            </a>
            <a href="/compliance" className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150">
              Compliance
            </a>
            <a href="/pricing" className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150">
              Pricing
            </a>
            <a href="/resources" className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150">
              Resources
            </a>
            <Button>Login</Button>
          </div>
        </nav>

        {/* Mobile Navigation */}
        <div className="flex md:hidden items-center gap-3">
          <div className={isMobileMenuOpen ? 'invisible' : ''}>
            <Button>Login</Button>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex flex-col justify-center items-center w-10 h-10 gap-1.5 text-foreground hover:text-foreground/70 transition-colors duration-150"
            aria-label="Toggle menu"
          >
            <span className={`w-6 h-0.5 bg-current ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
            <span className={`w-6 h-0.5 bg-current ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`w-6 h-0.5 bg-current ${isMobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
          </button>
        </div>
      </header>
      
      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 top-0 z-40 bg-background md:hidden pt-[calc(64px+1rem)] ${
          isMobileMenuOpen ? 'block' : 'hidden'
        }`}
      >
        <nav className="h-full px-4 sm:px-16 py-8">
          <div className="flex flex-col items-start gap-6">
            <a 
              href="/product" 
              className="text-2xl font-medium text-foreground hover:text-foreground/70 transition-colors duration-150"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Product
            </a>
            <a 
              href="/compliance" 
              className="text-2xl font-medium text-foreground hover:text-foreground/70 transition-colors duration-150"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Compliance
            </a>
            <a 
              href="/pricing" 
              className="text-2xl font-medium text-foreground hover:text-foreground/70 transition-colors duration-150"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Pricing
            </a>
            <a 
              href="/resources" 
              className="text-2xl font-medium text-foreground hover:text-foreground/70 transition-colors duration-150"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Resources
            </a>
          </div>
        </nav>
      </div>
      <div className="h-4" />
    </>
  );
}