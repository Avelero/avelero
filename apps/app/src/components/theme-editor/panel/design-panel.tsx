"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import type { NavigationSection } from "@/contexts/design-editor-provider";
import { useState } from "react";
import {
  findComponentById,
  hasConfigContent,
  hasEditableContent,
} from "../registry";
import { PanelHeader } from "./panel-header";
import { ColorsEditor } from "./views/colors-editor";
import { ContentSection } from "./views/content-section";
import { LayoutTree } from "./views/layout-tree";
import { MenuItemEditor } from "./views/menu-item-editor";
import { StyleContentTabs, type TabType } from "./views/style-content-tabs";
import { StylesSection } from "./views/styles-section";
import { TypographyEditor } from "./views/typography-editor";

// Get display title for navigation state
function getNavigationTitle(
  level: "root" | "section" | "component",
  section?: NavigationSection,
  componentId?: string,
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
  const {
    navigation,
    navigateBack,
    menuItemEdit,
    clearMenuItemEdit,
    getConfigValue,
  } = useDesignEditor();

  // Tab state for component view (Styles vs Content)
  const [activeTab, setActiveTab] = useState<TabType>("styles");

  // Default to layout section if at root (shouldn't happen with new default)
  const effectiveSection = navigation.section ?? "layout";

  // Check if we're editing a menu item
  if (menuItemEdit) {
    // Get the menu item label for the header
    const items =
      (getConfigValue(menuItemEdit.configPath) as
        | Array<{ label: string; url: string }>
        | undefined) ?? [];
    const item = items[menuItemEdit.itemIndex];
    const headerTitle = item?.label || "Edit Button";

    return (
      <div className="flex h-full w-[300px] flex-col border-r bg-background">
        <PanelHeader
          title={headerTitle}
          showBackButton={true}
          onBack={clearMenuItemEdit}
        />
        <div className="flex-1 flex flex-col min-h-0">
          <MenuItemEditor
            menuType={menuItemEdit.menuType}
            configPath={menuItemEdit.configPath}
            itemIndex={menuItemEdit.itemIndex}
            onBack={clearMenuItemEdit}
          />
        </div>
      </div>
    );
  }

  const title = getNavigationTitle(
    navigation.level,
    effectiveSection,
    navigation.componentId,
  );

  // Only show back button when viewing a component (to go back to layout tree)
  const showBackButton = navigation.level === "component";

  // Render the appropriate content based on navigation state
  const renderContent = () => {
    // Component editor view
    if (navigation.level === "component" && navigation.componentId) {
      const component = findComponentById(navigation.componentId);
      if (!component) {
        return (
          <div className="p-4 text-center">
            <p className="type-small text-secondary">Component not found</p>
          </div>
        );
      }

      const hasStyles = hasEditableContent(component);
      const hasConfig = hasConfigContent(component);

      // Both styles and content available - show tabs
      if (hasStyles && hasConfig) {
        return (
          <>
            <StyleContentTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              showContentTab={true}
            />
            {activeTab === "styles" ? (
              <StylesSection componentId={navigation.componentId} />
            ) : (
              <ContentSection componentId={navigation.componentId} />
            )}
          </>
        );
      }

      // Only styles available - no tabs needed
      if (hasStyles) {
        return <StylesSection componentId={navigation.componentId} />;
      }

      // Only content available - no tabs needed
      if (hasConfig) {
        return <ContentSection componentId={navigation.componentId} />;
      }

      // Neither - shouldn't happen but handle gracefully
      return (
        <div className="p-4 text-center">
          <p className="type-small text-secondary">
            No editable properties for this component
          </p>
        </div>
      );
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
