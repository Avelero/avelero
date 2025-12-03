import type { ReactNode } from "react";

interface BrandCardProps {
  logo: React.ReactNode;
}

export function BrandCard({ logo }: BrandCardProps) {
  return (
    <div className="py-7 border border-border bg-card">
      <div className="h-10 flex items-center justify-center">{logo}</div>
    </div>
  );
}

interface BrandsProps {
  children: ReactNode;
}

export function Brands({ children }: BrandsProps) {
  return (
    <div className="w-full pt-[90px] sm:pt-[124px] pb-[45px] sm:pb-[62px]">
      <div className="flex flex-col items-center w-full pb-8 gap-6">
        <h6 className="text-body text-foreground">Integrates with</h6>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 w-full">
          {children}
        </div>
      </div>
    </div>
  );
}
