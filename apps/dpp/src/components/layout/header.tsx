import type { ThemeConfig } from "@/types/theme-config";
import { AveleroLogo } from "@v1/ui/avelero-logo";

interface Props {
  themeConfig: ThemeConfig;
  brandName: string;
}

export function Header({ themeConfig, brandName }: Props) {
  const { branding } = themeConfig;
  const logoHeight = 18;

  return (
    <div className="fixed top-0 left-0 right-0 w-full z-50">
      {/* Brand section */}
      <div className="header flex items-center justify-center w-full py-sm border-b">
        {branding.headerLogoUrl ? (
          <img
            src={branding.headerLogoUrl}
            alt={brandName}
            className="object-contain"
            style={{ height: `${logoHeight}px`, width: "auto" }}
          />
        ) : (
          <span
            className="header__text-logo leading-[100%]"
            style={{ fontSize: logoHeight }}
          >
            {brandName}
          </span>
        )}
      </div>

      {/* Powered by Avelero section */}
      <div className="header flex items-center justify-center w-full gap-micro py-xs border-b">
        <span className="text-geist text-[12px] text-foreground leading-[100%]">
          Powered by
        </span>
        <AveleroLogo height={12} color="var(--foreground)" />
      </div>
    </div>
  );
}
