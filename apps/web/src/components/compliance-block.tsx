import { AwlLogo, EsprLogo } from "./logos";

export function ComplianceBlock() {
  return (
    <div
      id="compliance"
      className="flex md:flex-row flex-col w-full py-[45px] sm:py-[62px] gap-4 md:gap-0 scroll-mt-20"
    >
      <div className="w-full md:w-1/2 flex flex-col items-start justify-between flex-1">
        <h4 className="text-h6 md:text-h5 text-foreground">
          Access European markets
          <br />
          <span className="text-foreground/50">with Avelero</span>
        </h4>
        <div className="md:flex flex-col justify-start gap-2 hidden">
          <div className="flex flex-row items-center gap-[18px]">
            <div className="h-1.5 w-1.5 bg-foreground" />
            <p className="text-small text-foreground/50">
              Up-to-date on regulatory developments
            </p>
          </div>
          <div className="flex flex-row items-center gap-[18px]">
            <div className="h-1.5 w-1.5 bg-foreground" />
            <p className="text-small text-foreground/50">
              Aligned with ESPR and AWL requirements
            </p>
          </div>
          <div className="flex flex-row items-center gap-[18px]">
            <div className="h-1.5 w-1.5 bg-foreground" />
            <p className="text-small text-foreground/50">
              We make sure you stay compliant
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-row w-full md:w-1/2 border border-border">
        <div className="flex flex-col items-center gap-4 justify-center p-4 md:p-8 border-r border-border aspect-square w-1/2 flex-shrink-0">
          <AwlLogo height={48} color="hsl(var(--foreground) / 70%)" />
          <div className="flex flex-col h-16 items-center justify-start gap-1">
            <h6 className="text-body text-center text-foreground">
              AWL Compliant
            </h6>
            <p className="text-micro text-center text-foreground/50">
              French Anti-Waste Law
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 justify-center p-4 md:p-8 aspect-square w-1/2 flex-shrink-0">
          <EsprLogo height={48} color="hsl(var(--foreground) / 70%)" />
          <div className="flex flex-col items-center justify-center gap-1">
            <h6 className="text-body text-center text-foreground">
              ESPR Compliant
            </h6>
            <p className="text-micro text-center text-foreground/50">
              Eco-Design for Sustainable Products Regulation
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-start gap-2 md:hidden">
        <div className="flex flex-row items-center gap-[10px]">
          <div className="h-1.5 w-1.5 bg-foreground" />
          <p className="text-small text-foreground/50">
            Up-to-date on regulatory requirements
          </p>
        </div>
        <div className="flex flex-row items-center gap-[10px]">
          <div className="h-1.5 w-1.5 bg-foreground" />
          <p className="text-small text-foreground/50">
            Aligned with ESPR and AWL requirements
          </p>
        </div>
        <div className="flex flex-row items-center gap-[10px]">
          <div className="h-1.5 w-1.5 bg-foreground" />
          <p className="text-small text-foreground/50">
            We make sure you stay compliant
          </p>
        </div>
      </div>
    </div>
  );
}
