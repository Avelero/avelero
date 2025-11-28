import type { ThemeConfig } from "@v1/dpp-components";
import { AveleroLogo } from "@v1/ui/avelero-logo";

interface Props {
  themeConfig: ThemeConfig;
  brandName: string;
  position?: "fixed" | "sticky";
}

export function Header({ themeConfig, brandName, position = "fixed" }: Props) {
  const { branding } = themeConfig;
  const logoHeight = 18;

  // Determine positioning classes and styles
  const getPositionProps = () => {
    switch (position) {
      case "fixed":
        return {
          className: "fixed top-0 left-0 right-0 w-full z-50",
          style: undefined,
        };
      case "sticky":
        return {
          className: "sticky top-0 w-full z-50",
          style: { backgroundColor: "var(--background)" },
        };
    }
  };

  const positionProps = getPositionProps();

  return (
    <div className={positionProps.className} style={positionProps.style}>
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
        <span
          className="text-geist text-[12px] leading-[100%]"
          style={{ color: "var(--foreground)" }}
        >
          Powered by
        </span>
        <AveleroLogo height={12} color="var(--foreground)" />
      </div>
    </div>
  );
}
