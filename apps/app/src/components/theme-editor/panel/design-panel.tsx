"use client";

import { useDesignEditor } from "@/contexts/design-editor-provider";
import type { NavigationSection } from "@/contexts/design-editor-provider";
import { useState } from "react";
import {
  hasConfigContent,
  hasEditableContent,
  resolveComponentForEditor,
} from "../registry";
import { PanelHeader } from "./panel-header";
import { ColorsEditor } from "./views/colors-editor";
import { ContentSection } from "./views/content-section";
import { LayoutTree } from "./views/layout-tree";
import { MenuItemEditor } from "./views/menu-item-editor";
import { StyleContentTabs, type TabType } from "./views/style-content-tabs";
import { StylesSection } from "./views/styles-section";
import { TypographyEditor } from "./views/typography-editor";

function getNavigationTitle(
  componentId: string | undefined,
  section?: NavigationSection,
  level?: "root" | "section" | "component",
  resolvedName?: string,
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
    return resolvedName || componentId;
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
    passportDraft,
  } = useDesignEditor();

  const [activeTab, setActiveTab] = useState<TabType>("styles");

  const effectiveSection = navigation.section ?? "layout";

  // Menu item editing sub-view
  if (menuItemEdit) {
    const items =
      (getConfigValue(menuItemEdit.contentPath) as
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
            configPath={menuItemEdit.contentPath}
            itemIndex={menuItemEdit.itemIndex}
            onBack={clearMenuItemEdit}
          />
        </div>
      </div>
    );
  }

  // Resolve component for title and content rendering
  const resolved = navigation.componentId
    ? resolveComponentForEditor(navigation.componentId, passportDraft)
    : null;

  const title = getNavigationTitle(
    navigation.componentId,
    effectiveSection,
    navigation.level,
    resolved?.displayName,
  );

  const showBackButton = navigation.level === "component";

  const renderContent = () => {
    // Component editor view
    if (navigation.level === "component" && navigation.componentId) {
      if (!resolved) {
        return (
          <div className="p-4 text-center">
            <p className="type-small text-secondary">Component not found</p>
          </div>
        );
      }

      const hasStyles = hasEditableContent(resolved);
      const hasConfig = hasConfigContent(resolved);

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

      if (hasStyles) {
        return <StylesSection componentId={navigation.componentId} />;
      }

      if (hasConfig) {
        return <ContentSection componentId={navigation.componentId} />;
      }

      return (
        <div className="p-4 text-center">
          <p className="type-small text-secondary">
            No editable properties for this component
          </p>
        </div>
      );
    }

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
