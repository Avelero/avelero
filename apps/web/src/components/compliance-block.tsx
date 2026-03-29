import type { ReactNode } from "react";
import { AwlLogo, EsprLogo, GdprLogo, IsoLogo } from "./logos";

interface ComplianceCardProps {
  title: string;
  description: string;
  icon: ReactNode;
}

function ComplianceCard({ title, description, icon }: ComplianceCardProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center aspect-square p-6">
      <div className="flex items-center justify-center w-full py-7">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <h6 className="text-body text-foreground">{title}</h6>
        <p className="text-micro text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function ComplianceBlock() {
  return (
    <div
      id="compliance"
      className="w-full py-[45px] sm:py-[62px] scroll-mt-20"
    >
      <div className="flex flex-col items-start sm:items-center text-center mb-4 sm:mb-[62px]">
        <h4 className="text-h6 md:text-h5 text-foreground">
          Stay compliant &amp; secure
        </h4>
        <p className="text-h6 md:text-h5 text-muted-foreground">with Avelero</p>
      </div>
      <div className="rounded-sm border border-border grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 [&>*+*]:border-t [&>*+*]:sm:border-t-0 [&>*+*]:sm:border-l [&>*:nth-child(3)]:sm:border-t [&>*:nth-child(3)]:sm:border-l-0 [&>*:nth-child(3)]:lg:border-t-0 [&>*:nth-child(3)]:lg:border-l border-border [&>*]:border-border">
          <ComplianceCard
            title="ISO 14040-44"
            description="Footprint model trained in accordance with ISO 14040-44 lifecycle assessment standards."
            icon={<IsoLogo height={48} color="var(--muted-foreground)" />}
          />
          <ComplianceCard
            title="GDPR"
            description="Product and consumer data processed in full compliance with EU privacy law."
            icon={<GdprLogo height={48} color="var(--muted-foreground)" />}
          />
          <ComplianceCard
            title="ESPR"
            description="Meets EU Eco-Design for Sustainable Product Regulations."
            icon={<EsprLogo height={48} color="var(--muted-foreground)" />}
          />
          <ComplianceCard
            title="AWL"
            description="Meets France's Anti-Waste and Circular Economy Law."
            icon={<AwlLogo height={48} color="var(--muted-foreground)" />}
          />
      </div>
    </div>
  );
}
