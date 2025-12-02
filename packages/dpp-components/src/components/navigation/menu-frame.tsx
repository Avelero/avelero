import type { ThemeConfig } from "@v1/dpp-components";
import { MenuButton } from "./menu-button";

interface MenuItem {
  id?: string; // Stable unique identifier
  label: string;
  url: string;
}

interface Props {
  menuItems: MenuItem[];
  themeConfig: ThemeConfig;
  isLastMenu?: boolean;
  /**
   * Menu variant determines which CSS class is applied to buttons.
   * - "primary": uses .menu-primary-button class (default)
   * - "secondary": uses .menu-secondary-button class
   */
  variant?: "primary" | "secondary";
}

export function MenuFrame({
  menuItems,
  themeConfig,
  isLastMenu = false,
  variant = "primary",
}: Props) {
  const menuClasses = isLastMenu
    ? "w-full mt-lg mb-lg @3xl:mb-0 @3xl:mx-0"
    : "w-full mt-lg mb-lg @3xl:mx-0";

  if (menuItems.length === 0) return null;

  // Use variant-specific wrapper class for the menu container
  const containerClass = variant === "secondary" ? "menu-secondary" : "menu-primary";

  return (
    <div className={menuClasses}>
      <div className={`${containerClass} border-t`}>
        {menuItems.map((item) => (
          <MenuButton
            key={item.id || `${item.url}-${item.label}`}
            label={item.label}
            url={item.url}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}
