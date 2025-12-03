import { Button } from "./button";
import { Icons } from "@v1/ui/icons";
import { ContactDrawer } from "./contact-drawer";

export function Hero() {
  return (
    <div className="w-full pt-[58px] pb-[45px] sm:pt-[92px] sm:pb-[62px] flex flex-col gap-8 md:gap-16">
      <h1 className="text-[10vw] sm:text-[clamp(3.8rem,9.5vw,4.8rem)] md:text-[clamp(4.8rem,10vw,6.7rem)] lg:text-[clamp(6.7rem,10.5vw,8.625rem)] xl:text-[8.625rem] leading-none text-foreground">
        Product passpo<span className="tracking-wide">rt</span>s that{" "}
        <span className="text-primary">engage</span>
      </h1>
      <div className="flex flex-col md:flex-row justify-start gap-8 md:gap-0 md:justify-between items-start md:items-end">
        <div className="flex flex-row gap-4 order-last md:order-first">
          <ContactDrawer />
          <Button asChild>
            <a
              href="https://passport.avelero.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open live digital product passport in new tab"
            >
              <span>Live passport</span>
              <Icons.SquareArrowOutUpRight color="hsl(var(--foreground))" />
            </a>
          </Button>
        </div>
        <p className="w-full md:w-1/2 text-small text-foreground/50">
          <span className="text-foreground">
            Avelero is built for fashion brands
          </span>{" "}
          that want to launch EU-compliant product passports in days, not
          months. Connect your article data, estimate product footprints, and
          design on-brand experiences that customers actually want to explore.
        </p>
      </div>
    </div>
  );
}
