"use client";

/**
 * Sidebar button-link section.
 *
 * Renders the configured menu items as a stacked list of shadowed action cards.
 */
import { Icons } from "@v1/ui/icons";
import { createSectionSelectionAttributes } from "../../lib/editor-selection";
import { useHapticTap } from "../../lib/haptics";
import {
  INTERACTIVE_HOVER_CLASS_NAME,
  createInteractiveHoverStyle,
} from "../../lib/interactive-hover";
import { resolveStyles } from "../../lib/resolve-styles";
import type { SectionProps } from "../registry";

interface MenuItem {
  id?: string;
  label: string;
  url: string;
}

export function ButtonsSection({
  section,
  tokens,
  zoneId,
  wrapperClassName,
}: SectionProps) {
  // Resolve button styles and normalize the new card treatment for every item.
  const s = resolveStyles(section.styles, tokens);
  const menuItems = (section.content.menuItems as MenuItem[] | undefined) ?? [];
  const select = createSectionSelectionAttributes(section.id, zoneId);
  const rootSelection = select("buttons");
  const labelSelection = select("buttons.label");
  const iconSelection = select("buttons.icon");
  const buttonStyle = createInteractiveHoverStyle(s.button, {
    background: true,
  });
  const hapticTap = useHapticTap();

  if (menuItems.length === 0) return null;

  return (
    <div
      className={["flex flex-col gap-md w-full", wrapperClassName]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-md">
        {menuItems.map((item, index) => (
          <a
            key={item.id || `menu-${index}`}
            {...rootSelection}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-between gap-md p-md cursor-pointer ${INTERACTIVE_HOVER_CLASS_NAME}`}
            style={buttonStyle}
            onClick={() => hapticTap()}
          >
            <span {...labelSelection}>{item.label}</span>
            <Icons.ChevronRight
              {...iconSelection}
              className="shrink-0"
              style={s["button.icon"]}
            />
          </a>
        ))}
      </div>
    </div>
  );
}
