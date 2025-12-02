"use client";

import { SidebarButton } from "./sidebar-button";
import { useDesignEditor, type NavigationSection } from "@/contexts/design-editor-provider";

// Using existing animations - can be updated later with more specific ones
import layoutAnimation from "@/animations/system-regular-727-spinner-dashes-hover-rotation.json";
import typographyAnimation from "@/animations/system-regular-63-settings-cog-hover-cog-1.json";
import colorsAnimation from "@/animations/system-regular-10-analytics-hover-analytics.json";

const items: Array<{ id: NavigationSection; name: string; animation: object }> = [
  { id: "layout", name: "Layout", animation: layoutAnimation },
  { id: "typography", name: "Typography", animation: typographyAnimation },
  { id: "colors", name: "Colors", animation: colorsAnimation },
];

interface EditorMenuProps {
  isExpanded: boolean;
}

export function EditorMenu({ isExpanded }: EditorMenuProps) {
  const { navigation, navigateToSection } = useDesignEditor();

  return (
    <nav>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <SidebarButton
            key={item.id}
            item={{ name: item.name }}
            animationData={item.animation}
            isActive={navigation.section === item.id}
            isExpanded={isExpanded}
            onClick={() => navigateToSection(item.id)}
          />
        ))}
      </div>
    </nav>
  );
}

