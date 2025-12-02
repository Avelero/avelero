"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import { PanelHeader } from "./panel-header";
import { TypographyEditor } from "./sections/typography-editor";
import { ColorsEditor } from "./sections/colors-editor";
import { ComponentSection } from "./sections/component-section";
import { LayoutTree } from "./sections/layout-tree";
import { findComponentById } from "../registry/component-registry";
import type { NavigationSection } from "@/contexts/design-editor-provider";

// Get display title for navigation state
function getNavigationTitle(
  level: "root" | "section" | "component",
  section?: NavigationSection,
  componentId?: string
): string {
  if (level === "section") {
    switch (section) {
      case "layout":
        return "Layout";
      case "typography":
        return "Typography";
      case "colors":
        return "Colors";
      default:
        return "Layout";
    }
  }
  if (level === "component" && componentId) {
    const component = findComponentById(componentId);
    return component?.displayName || componentId;
  }
  return "Layout";
}

export function DesignPanel() {
  const { navigation, navigateBack } = useDesignEditor();

  // Default to layout section if at root (shouldn't happen with new default)
  const effectiveSection = navigation.section ?? "layout";

  const title = getNavigationTitle(
    navigation.level,
    effectiveSection,
    navigation.componentId
  );

  // Only show back button when viewing a component (to go back to layout tree)
  const showBackButton = navigation.level === "component";

  // Render the appropriate content based on navigation state
  const renderContent = () => {
    // Component editor view
    if (navigation.level === "component" && navigation.componentId) {
      return <ComponentSection componentId={navigation.componentId} />;
    }

    // Section view - controlled by sidebar
    switch (effectiveSection) {
      case "layout":
        return <LayoutTree />;
      case "typography":
        return <TypographyEditor />;
      case "colors":
        return <ColorsEditor />;
      default:
        return <LayoutTree />;
    }
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
