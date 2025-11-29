"use client";

import { Icons } from "@v1/ui/icons";
import { useDesignEditor } from "@/contexts/design-editor-provider";
import { PanelHeader } from "./navigation/panel-header";
import { TypographyEditor, ColorsEditor, ComponentEditor } from "./editors";
import { LayoutTree } from "./layout/layout-tree";
import { findComponentById } from "./layout/component-registry";
import type { NavigationSection } from "@/contexts/design-editor-provider";

// Main menu items configuration
const MAIN_MENU_ITEMS: Array<{
  id: NavigationSection;
  label: string;
  icon: React.ReactNode;
}> = [
  {
    id: "layout",
    label: "Layout",
    icon: <Icons.LayoutGrid className="h-4 w-4" />,
  },
  {
    id: "typography",
    label: "Typography",
    icon: <Icons.Type className="h-4 w-4" />,
  },
  {
    id: "colors",
    label: "Colors",
    icon: <Icons.Palette className="h-4 w-4" />,
  },
];

// Get display title for navigation state
function getNavigationTitle(
  level: "root" | "section" | "component",
  section?: NavigationSection,
  componentId?: string
): string {
  if (level === "root") {
    return "Passport";
  }
  if (level === "section") {
    switch (section) {
      case "layout":
        return "Layout";
      case "typography":
        return "Typography";
      case "colors":
        return "Colors";
      default:
        return "Passport";
    }
  }
  if (level === "component" && componentId) {
    const component = findComponentById(componentId);
    return component?.displayName || componentId;
  }
  return "Passport";
}

// Root menu with Layout, Typography, Colors buttons
function RootMenu() {
  const { navigateToSection } = useDesignEditor();

  return (
    <div className="flex flex-col p-2">
      {MAIN_MENU_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => navigateToSection(item.id)}
          className="group flex items-center justify-between px-2 py-2.5 text-left type-p text-primary hover:bg-accent transition-colors duration-100 ease-out"
        >
          <div className="flex items-center gap-2">
            {item.icon}
            <span className="type-p truncate">{item.label}</span>
          </div>
          <Icons.ChevronRight className="h-4 w-4 text-primary" />
        </button>
      ))}
    </div>
  );
}

export function DesignLeftPanel() {
  const { navigation, navigateBack } = useDesignEditor();

  const title = getNavigationTitle(
    navigation.level,
    navigation.section,
    navigation.componentId
  );
  const showBackButton = navigation.level !== "root";

  // Render the appropriate content based on navigation state
  const renderContent = () => {
    if (navigation.level === "root") {
      return <RootMenu />;
    }

    if (navigation.level === "section") {
      switch (navigation.section) {
        case "layout":
          return <LayoutTree />;
        case "typography":
          return <TypographyEditor />;
        case "colors":
          return <ColorsEditor />;
        default:
          return <RootMenu />;
      }
    }

    if (navigation.level === "component" && navigation.componentId) {
      return <ComponentEditor componentId={navigation.componentId} />;
    }

    return <RootMenu />;
  };

  return (
    <div className="flex h-full w-[300px] flex-col border-r bg-background">
      <PanelHeader
        title={title}
        showBackButton={showBackButton}
        onBack={navigateBack}
      />
      <div className="flex-1 flex flex-col min-h-0">{renderContent()}</div>
    </div>
  );
}
