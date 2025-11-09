"use client";

import Link from "next/link";
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
        className={`sticky top-0 w-full flex items-center justify-between z-30 py-4 px-6 sm:px-16 backdrop-blur-md bg-background/80 transition-none ${
          isMobileMenuOpen ? 'border-b-0 md:border-b' : 'border-b'
        }`}
        style={{
          borderBottomColor: `hsl(var(--border) / ${scrollProgress})`,
        }}
      >
        <div className={isMobileMenuOpen ? 'invisible md:visible' : ''}>
          <Link href="/" aria-label="Go to home page">
            <AveleroLogo className="hidden md:block" height={32} color="var(--foreground)" />
          </Link>
          <Link href="/" aria-label="Go to home page">
            <AveleroLogo className="block md:hidden" height={24} color="var(--foreground)" />
          </Link>
        </div>
        
        {/* Desktop Navigation */}
        <nav className="hidden md:block">
          <div className="flex items-center gap-4">
            <Link href="/#footprint" aria-label="Go to footprint section" className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150">
              Footprint
            </Link>
            <Link href="/#designer" aria-label="Go to designer section" className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150">
              Designer
            </Link>
            <Link href="/#automation" aria-label="Go to automation section" className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150">
              Automation
            </Link>
            <Link href="/#compliance" aria-label="Go to compliance section" className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150">
              Compliance
            </Link>
            <Button asChild aria-label="Go to login page">
              <a href="https://app.avelero.com/login" rel="noopener noreferrer">
                <span>Login</span>
              </a>
            </Button>
          </div>
        </nav>

        {/* Mobile Navigation */}
        <div className="flex md:hidden items-center gap-3">
          <div className={isMobileMenuOpen ? 'invisible' : ''}>
            <Button asChild aria-label="Go to login page" size="sm">
              <a href="https://app.avelero.com/login" rel="noopener noreferrer">
                <span>Login</span>
              </a>
            </Button>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex flex-col justify-center items-center w-[30px] h-[30px] gap-1.5 text-foreground"
            aria-label="Open navbar mobile menu"
          >
            <span className={`w-6 h-[1.5px] bg-current ${isMobileMenuOpen ? 'rotate-45 translate-y-[7.5px]' : ''}`} />
            <span className={`w-6 h-[1.5px] bg-current ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
            <span className={`w-6 h-[1.5px] bg-current ${isMobileMenuOpen ? '-rotate-45 -translate-y-[7.5px]' : ''}`} />
          </button>
        </div>
      </header>
      
      {/* Mobile Menu Overlay */}
      <div
        className={`fixed inset-0 top-0 z-20 bg-background md:hidden pt-[calc(64px+1rem)] ${
          isMobileMenuOpen ? 'block' : 'hidden'
        }`}
      >
        <nav className="h-full px-4 sm:px-16 py-8">
          <div className="flex flex-col items-start gap-6">
            <Link 
              href="/#footprint" 
              aria-label="Go to footprint section"
              className="text-2xl font-medium text-foreground hover:text-foreground/70 transition-colors duration-150"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Footprint
            </Link>
            <Link 
              href="/#designer" 
              aria-label="Go to designer section"
              className="text-2xl font-medium text-foreground hover:text-foreground/70 transition-colors duration-150"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Designer
            </Link>
            <Link 
              href="/#automation" 
              aria-label="Go to automation section"
              className="text-2xl font-medium text-foreground hover:text-foreground/70 transition-colors duration-150"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Automation
            </Link>
            <Link 
              href="/#compliance" 
              aria-label="Go to compliance section"
              className="text-2xl font-medium text-foreground hover:text-foreground/70 transition-colors duration-150"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Compliance
            </Link>
          </div>
        </nav>
      </div>
      <div className="h-4" />
    </>
  );
}