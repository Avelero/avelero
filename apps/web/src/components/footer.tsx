import { AveleroLogo } from "@v1/ui/avelero-logo";
import { AveleroText } from "@v1/ui/avelero-text";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="px-6 sm:px-16 bg-card border-t border-border overflow-hidden">
      <div className="mb-8">
        <nav>
          <div className="flex flex-col md:flex-row justify-between gap-6 md:gap-4 py-6 md:py-8">
            <AveleroLogo
              height={24}
              color="var(--foreground)"
              className="hidden md:block"
            />
            <div className="gap-x-3 gap-y-2 grid grid-cols-2 md:grid-cols-4">
              <div>
                <h6 className="text-small text-foreground/50 pb-1">Product</h6>
                <ul>
                  <li>
                    <Link
                      aria-label="Go to footprint section"
                      className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1"
                      href="/#footprint"
                    >
                      Footprint
                    </Link>
                  </li>
                  <li>
                    <Link
                      aria-label="Go to designer section"
                      className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1"
                      href="/#designer"
                    >
                      Designer
                    </Link>
                  </li>
                  <li>
                    <Link
                      aria-label="Go to automation section"
                      className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1"
                      href="/#automation"
                    >
                      Automation
                    </Link>
                  </li>
                  <li>
                    <Link
                      aria-label="Go to compliance section"
                      className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1"
                      href="/#compliance"
                    >
                      Compliance
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h6 className="text-small text-foreground/50 pb-1">Legal</h6>
                <ul>
                  <li>
                    <Link
                      aria-label="Go to terms and conditions page"
                      className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1"
                      href="/terms-and-conditions"
                    >
                      Terms & conditions
                    </Link>
                  </li>
                  <li>
                    <Link
                      aria-label="Go to privacy policy page"
                      className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1"
                      href="/privacy-policy"
                    >
                      Privacy policy
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h6 className="text-small text-foreground/50 pb-1">
                  Resources
                </h6>
                <ul>
                  <li>
                    <Link
                      aria-label="Go to updates page"
                      className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1"
                      href="/updates/"
                    >
                      Updates
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h6 className="text-small text-foreground/50 pb-1">Connect</h6>
                <ul>
                  <li>
                    <a
                      aria-label="Send email to Avelero founder"
                      className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1"
                      href="mailto:raf@avelero.com"
                    >
                      raf@avelero.com
                    </a>
                  </li>
                  <li>
                    <a
                      aria-label="Open Avelero LinkedIn page in new tab"
                      className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1"
                      href="https://www.linkedin.com/company/avelero"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      LinkedIn
                    </a>
                  </li>
                  <li>
                    <a
                      aria-label="Open Avelero X page in new tab"
                      className="inline-block text-small text-foreground hover:text-foreground/70 transition-colors duration-100 py-1"
                      href="https://x.com/avelerodpp"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      X
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </nav>
      </div>
      <AveleroText
        className="w-full h-auto translate-y-[25%]"
        color="hsl(var(--border))"
      />
    </footer>
  );
}
