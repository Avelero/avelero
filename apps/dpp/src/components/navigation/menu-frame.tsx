import type { ThemeConfig } from '@/types/theme-config';
import { MenuButton } from './menu-button';

interface MenuItem {
  label: string;
  url: string;
}

interface Props {
  menuItems: MenuItem[];
  theme: ThemeConfig;
  isLastMenu?: boolean;
}

export function MenuFrame({ menuItems, theme, isLastMenu = false }: Props) {
  const { colors } = theme;
  const menuClasses = isLastMenu ? 'w-full pt-lg pb-lg md:pb-0 md:px-0' : 'w-full pt-lg pb-lg md:px-0';
  
  if (menuItems.length === 0) return null;
  
  return (
    <div className={menuClasses}>
      <div className="border-t" style={{ borderColor: colors.border }}>
        {menuItems.map((item, index) => (
          <MenuButton key={`${item.url}-${index}`} label={item.label} url={item.url} theme={theme} />
        ))}
      </div>
    </div>
  );
}
  