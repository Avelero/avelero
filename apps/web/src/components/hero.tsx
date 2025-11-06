import { Button } from "./button";
import { Icons } from "@v1/ui/icons";

export function Hero() {
  return (
    <div className="w-full pt-[92px] pb-[124px] flex flex-col gap-16">
        <h1 className="text-h1 text-foreground">Product passports that <span className="text-primary">engage</span></h1>
         <div className="flex flex-row justify-between items-end">
             <div className="flex flex-row gap-4">
                 <Button variant="brand">Talk to founders</Button>
                 <Button>
                    Try it out
                    <Icons.SquareArrowOutUpRight className="!size-[14px]" />
                </Button>
             </div>
            <p className="w-1/2 text-small text-foreground/50">
                <span className="text-foreground">Avelero is built for fashion brands</span> that want to launch compliant product passports in days, not months. Integrate your systems, estimate product footprints, and design on-brand experiences that customers want to explore.
            </p>
        </div>
    </div>
  );
}
