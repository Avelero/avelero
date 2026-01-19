"use client";

import {
  type NavigationSection,
  useDesignEditor,
} from "@/contexts/design-editor-provider";
import { Icons } from "@v1/ui/icons";
import type { LucideIcon } from "lucide-react";
import { SidebarButton } from "./sidebar-button";

const items: Array<{ id: NavigationSection; name: string; icon: LucideIcon }> =
  [
    { id: "layout", name: "Layout", icon: Icons.GalleryVertical },
    { id: "typography", name: "Typography", icon: Icons.Type },
    { id: "colors", name: "Colors", icon: Icons.Palette },
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
            icon={item.icon}
            isActive={navigation.section === item.id}
            isExpanded={isExpanded}
            onClick={() => navigateToSection(item.id)}
          />
        ))}
      </div>
    </nav>
  );
}
