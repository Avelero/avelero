import { Icons } from "@v1/ui/icons";

interface Props {
  label: string;
  url: string;
  /**
   * Menu variant determines which CSS class is applied.
   * - "primary": uses .menu-primary-button class
   * - "secondary": uses .menu-secondary-button class
   */
  variant?: "primary" | "secondary";
}

export function MenuButton({ label, url, variant = "primary" }: Props) {
  // Check if URL is external
  const isExternal = url.startsWith("http://") || url.startsWith("https://");

  // Use variant-specific CSS classes for independent styling
  const buttonClass =
    variant === "secondary" ? "menu-secondary-button" : "menu-primary-button";
  const iconClass =
    variant === "secondary"
      ? "menu-secondary-button__icon"
      : "menu-primary-button__icon";

  return (
    <a
      href={url}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className={`px-sm py-md flex justify-between items-center border-b cursor-pointer ${buttonClass}`}
    >
      {label}
      <Icons.ChevronRight className={iconClass} />
    </a>
  );
}
