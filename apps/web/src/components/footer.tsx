import { AveleroLogo } from "@v1/ui/avelero-logo";
import { AveleroText } from "@v1/ui/avelero-text";

export function Footer() {
  return (
    <footer className="px-6 sm:px-16 bg-card border-t border-border overflow-hidden">
      <div className="mb-8">
        <nav>
          <div className="flex flex-col md:flex-row justify-between gap-6 md:gap-4 py-6 md:py-8">
            <AveleroLogo height={24} color="var(--foreground)" className="hidden md:block" />
            <div className="gap-x-3 gap-y-2 grid grid-cols-2 md:grid-cols-4">
              <div>
                <h6 className="text-small text-foreground/50 pb-1">Product</h6>
                <ul>
                  <li>
                    <a aria-label="Go to customization section" className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1" href="/customization">
                      Customization
                    </a>
                  </li>
                  <li>
                    <a aria-label="Go to calculations section" className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1" href="/calculations">
                      Calculations
                    </a>
                  </li>
                  <li>
                    <a aria-label="Go to pricing page" className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1" href="/pricing">
                      Pricing
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h6 className="text-small text-foreground/50 pb-1">Resources</h6>
                <ul>
                  <li>
                    <a aria-label="Go to compliance page" className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1" href="/compliance">
                      Compliance
                    </a>
                  </li>
                  <li>
                    <a aria-label="Go to about page" className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1" href="/about">
                      About
                    </a>
                  </li>
                  <li>
                    <a aria-label="Go to blog page" className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1" href="/blog">
                      Blog
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h6 className="text-small text-foreground/50 pb-1">Legal</h6>
                <ul>
                  <li>
                    <a aria-label="Go to terms and conditions page" className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1" href="/terms-and-conditions">
                      Terms & conditions
                    </a>
                  </li>
                  <li>
                    <a aria-label="Go to privacy policy page" className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1" href="/privacy-policy">
                      Privacy policy
                    </a>
                  </li>
                </ul>
              </div>
              <div>
                <h6 className="text-small text-foreground/50 pb-1">Connect</h6>
                <ul>
                  <li>
                    <a aria-label="Send email to Avelero founder" className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1" href="mailto:raf@avelero.com">
                      raf@avelero.com
                    </a>
                  </li>
                  <li>
                    <a aria-label="Open Avelero LinkedIn page in new tab" className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1" href="https://www.linkedin.com/company/avelero" target="_blank" rel="noopener noreferrer">
                      LinkedIn
                    </a>
                  </li>
                  <li>
                    <a aria-label="Open Avelero X page in new tab" className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1" href="https://x.com/avelerodpp" target="_blank" rel="noopener noreferrer">
                      X
                    </a>
                  </li>
                </ul>
              </div>
            </div>
      </div>
    </nav>
  </div>
  <AveleroText className="w-full h-auto translate-y-[25%]" color="hsl(var(--border))" />
</footer>
  );
}
