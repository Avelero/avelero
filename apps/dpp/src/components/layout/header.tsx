import type { ThemeConfig } from '@/types/theme-config';
import { AveleroLogoText } from '../icons/avelero-logo-text';

interface Props {
  theme: ThemeConfig;
  brandName: string;
}

export function Header({ theme, brandName }: Props) {
  const { branding, colors } = theme;
  const logoHeight = 18;
  
  return (
    <div className="fixed top-0 left-0 right-0 w-full z-50">
      {/* Brand section */}
      <div
        className="flex items-center justify-center w-full py-sm border-b"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.border,
        }}
      >
        {branding.headerLogoUrl ? (
          <img
            src={branding.headerLogoUrl}
            alt={brandName}
            className="object-contain"
            style={{ height: `${logoHeight}px`, width: 'auto' }}
          />
        ) : (
          <span
            className="type-body"
            style={{ color: colors.primaryText, fontSize: logoHeight }}
          >
            {brandName}
          </span>
        )}
      </div>
      
      {/* Powered by Avelero section */}
      <div
        className="flex items-center justify-center w-full gap-micro py-xs border-b"
        style={{
          backgroundColor: colors.background,
          borderColor: colors.border,
        }}
      >
        <span
          className="text-geist text-[12px] leading-[100%]"  
          style={{ color: colors.primaryText }}
        >
          Powered by
        </span>
        <AveleroLogoText height={12} color={colors.primaryText} />
      </div>
    </div>
  );
}
