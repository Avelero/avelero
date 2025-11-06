"use client";

import { AveleroLogo } from "@v1/ui/avelero-logo";
import { Button } from "./button";

export function Header() {
  return (
    <header className="sticky top-0 w-full flex items-center justify-between py-8 z-10">
      <AveleroLogo height={32} color="var(--foreground)" />

      <nav>
        <div className="flex items-center gap-4">
          <a
            href="https://avelero.app/product"
            className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150"
          >
            Product
          </a>
          <a
            href="https://avelero.app/compliance"
            className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150"
          >
            Compliance
          </a>
          <a
            href="https://avelero.app/pricing"
            className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150"
          >
            Pricing
          </a>
          <a
            href="https://avelero.app/resources"
            className="text-button px-2 py-3 text-foreground hover:text-foreground/70 transition-colors duration-150"
          >
            Resources
          </a>
          <Button>Login</Button>
        </div>
      </nav>
    </header>
  );
}
