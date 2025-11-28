import type { ThemeConfig } from '@v1/dpp-components';
import { MenuButton } from './menu-button';

interface MenuItem {
  id?: string; // Stable unique identifier
  label: string;
  url: string;
}

interface Props {
  menuItems: MenuItem[];
  themeConfig: ThemeConfig;
  isLastMenu?: boolean;
}

export function MenuFrame({ menuItems, themeConfig, isLastMenu = false }: Props) {
  const menuClasses = isLastMenu ? 'w-full mt-lg mb-lg @3xl:mb-0 @3xl:mx-0' : 'w-full mt-lg mb-lg @3xl:mx-0';
  
  if (menuItems.length === 0) return null;
  
  return (
    <div className={menuClasses}>
      <div className="menu-button border-t">
        {menuItems.map((item, index) => (
          <MenuButton 
            key={item.id || `${item.url}-${item.label}`} 
            label={item.label} 
            url={item.url} 
          />
        ))}
      </div>
    </div>
  );
}
  
