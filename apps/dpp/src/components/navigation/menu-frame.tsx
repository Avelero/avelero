import type { ThemeConfig } from '@/types/theme-config';
import { MenuButton } from './menu-button';

interface MenuItem {
  label: string;
  url: string;
}

interface Props {
  menuItems: MenuItem[];
  themeConfig: ThemeConfig;
  isLastMenu?: boolean;
}

export function MenuFrame({ menuItems, themeConfig, isLastMenu = false }: Props) {
  const menuClasses = isLastMenu ? 'w-full mt-lg mb-lg md:mb-0 md:mx-0' : 'w-full mt-lg mb-lg md:mx-0';
  
  if (menuItems.length === 0) return null;
  
  return (
    <div className={menuClasses}>
      <div className="menu-button border-t">
        {menuItems.map((item, index) => (
          <MenuButton key={`${item.url}-${index}`} label={item.label} url={item.url} themeConfig={themeConfig} />
        ))}
      </div>
    </div>
  );
}
  