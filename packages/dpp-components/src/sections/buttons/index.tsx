import { Icons } from "@v1/ui/icons";
import { resolveStyles } from "../../lib/resolve-styles";
import type { SectionProps } from "../registry";

interface MenuItem {
  id?: string;
  label: string;
  url: string;
}

export function ButtonsSection({ section, tokens }: SectionProps) {
  const s = resolveStyles(section.styles, tokens);
  const menuItems = (section.content.menuItems as MenuItem[] | undefined) ?? [];

  if (menuItems.length === 0) return null;

  return (
    <div className="w-full @3xl:mx-0">
      <div className="border-t">
        {menuItems.map((item, index) => (
          <a
            key={item.id || `menu-${index}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-sm border-b cursor-pointer"
            style={s.button}
          >
            <span>{item.label}</span>
            <Icons.ChevronRight
              className="flex-shrink-0"
              style={s["button.icon"]}
            />
          </a>
        ))}
      </div>
    </div>
  );
}
