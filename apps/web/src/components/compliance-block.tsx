import { EsprLogo, AwlLogo } from "./logos";

export function ComplianceBlock() {
    return (
        <div className="flex flex-row w-full py-[62px]">
            <div className="w-1/2 flex flex-col items-start justify-between flex-1">
                <h4 className="text-h5 text-foreground">EU- and US-Compliant</h4>
                <div className="flex flex-col justify-start gap-2">
                    <div className="flex flex-row items-center gap-[18px]">
                        <div className="h-1.5 w-1.5 bg-foreground"/>
                        <p className="text-small text-foreground/50">AWL Compliant</p>
                    </div>
                    <div className="flex flex-row items-center gap-[18px]">
                        <div className="h-1.5 w-1.5 bg-foreground"/>
                        <p className="text-small text-foreground/50">AWL Compliant</p>
                    </div>
                    <div className="flex flex-row items-center gap-[18px]">
                        <div className="h-1.5 w-1.5 bg-foreground"/>
                        <p className="text-small text-foreground/50">AWL Compliant</p>
                    </div>
                </div>
            </div>
            <div className="flex flex-row w-1/2 border border-border">
                <div className="flex flex-col items-center gap-4 justify-center p-8 border-r border-border aspect-square w-1/2 flex-shrink-0">
                    <AwlLogo height={48} color="hsl(var(--foreground) / 70%)" />
                    <div className="flex flex-col items-center justify-center gap-1">
                        <h6 className="text-body text-center text-foreground">AWL Compliant</h6>
                        <p className="text-micro text-center text-foreground/50">French Anti-Waste Law</p>
                    </div>
                </div>
                <div className="flex flex-col items-center gap-4 justify-center p-8 aspect-square w-1/2 flex-shrink-0">
                    <EsprLogo height={48} color="hsl(var(--foreground) / 70%)" />
                    <div className="flex flex-col items-center justify-center gap-1">
                        <h6 className="text-body text-center text-foreground">ESPR Compliant</h6>
                        <p className="text-micro text-center text-foreground/50">Eco-Design for Sustainable Product Regulations</p>
                    </div>
                </div>
            </div>
        </div>
    );
}