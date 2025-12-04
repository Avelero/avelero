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
  variant = "primary",
}: Props) {
  if (menuItems.length === 0) return null;

  // Use variant-specific wrapper class for the menu container
  const containerClass =
    variant === "secondary" ? "menu-secondary" : "menu-primary";

  return (
    <div className="w-full mt-2x @3xl:mx-0">
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
