"use client";

import type {
  DppData,
  ThemeConfig,
  ThemeStyles,
  TypographyScale,
} from "@v1/dpp-components";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
} from "react";
import { saveThemeAction } from "@/actions/design/save-theme-action";

// =============================================================================
// TYPES
// =============================================================================

type TypographyScaleKey =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "body"
  | "body-sm"
  | "body-xs";

/**
 * Navigation section types for the left panel
 */
export type NavigationSection = "layout" | "typography" | "colors";

/**
 * Navigation state for the left panel
 * - root: Shows the three main buttons (Layout, Typography, Colors)
 * - section: Shows content of a section (e.g., typography accordions)
 * - component: Shows fields for a specific component in Layout
 */
export type NavigationState = {
  level: "root" | "section" | "component";
  section?: NavigationSection;
  componentId?: string;
};

type DesignEditorContextValue = {
  // Theme state
  themeConfigDraft: ThemeConfig;
  themeStylesDraft: ThemeStyles;
  initialThemeConfig: ThemeConfig;
  initialThemeStyles: ThemeStyles;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  setThemeConfigDraft: (next: ThemeConfig) => void;
  setThemeStylesDraft: (next: ThemeStyles) => void;
  resetDrafts: () => void;
  saveDrafts: () => Promise<void>;
  previewData: DppData;

  // Helper setters for nested updates
  updateTypographyScale: (
    scale: TypographyScaleKey,
    value: TypographyScale
  ) => void;
  updateColor: (colorKey: string, value: string) => void;

  // Navigation state
  navigation: NavigationState;
  navigateToSection: (section: NavigationSection) => void;
  navigateToComponent: (componentId: string) => void;
  navigateBack: () => void;
  navigateToRoot: () => void;

  // Layout tree expand/collapse state
  expandedItems: Set<string>;
  toggleExpanded: (componentId: string) => void;

  // Selection state (for preview hover/click)
  selectedComponentId: string | null;
  hoveredComponentId: string | null;
  setSelectedComponentId: (id: string | null) => void;
  setHoveredComponentId: (id: string | null) => void;
};

const DesignEditorContext = createContext<DesignEditorContextValue | null>(
  null
);

type ProviderProps = {
  children: React.ReactNode;
  initialThemeConfig: ThemeConfig;
  initialThemeStyles: ThemeStyles;
  previewData: DppData;
  brandId?: string;
};

export function DesignEditorProvider({
  children,
  initialThemeConfig,
  initialThemeStyles,
  previewData,
  brandId,
}: ProviderProps) {
  // ---------------------------------------------------------------------------
  // Theme State
  // ---------------------------------------------------------------------------
  const [themeConfigDraft, setThemeConfigDraft] =
    useState<ThemeConfig>(initialThemeConfig);
  const [themeStylesDraft, setThemeStylesDraft] =
    useState<ThemeStyles>(initialThemeStyles);
  const [isSaving, setIsSaving] = useState(false);

  const hasUnsavedChanges =
    JSON.stringify(themeConfigDraft) !== JSON.stringify(initialThemeConfig) ||
    JSON.stringify(themeStylesDraft) !== JSON.stringify(initialThemeStyles);

  const resetDrafts = useCallback(() => {
    setThemeConfigDraft(initialThemeConfig);
    setThemeStylesDraft(initialThemeStyles);
  }, [initialThemeConfig, initialThemeStyles]);

  const saveDrafts = useCallback(async () => {
    if (!brandId) return;
    setIsSaving(true);
    try {
      await saveThemeAction({
        brandId,
        themeConfig: themeConfigDraft,
        themeStyles: themeStylesDraft,
      });
    } finally {
      setIsSaving(false);
    }
  }, [brandId, themeConfigDraft, themeStylesDraft]);

  const updateTypographyScale = useCallback(
    (scale: TypographyScaleKey, value: TypographyScale) => {
      setThemeStylesDraft((prev) => ({
        ...prev,
        typography: {
          ...prev.typography,
          [scale]: value,
        },
      }));
    },
    []
  );

  const updateColor = useCallback((colorKey: string, value: string) => {
    setThemeStylesDraft((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [colorKey]: value,
      },
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Navigation State
  // ---------------------------------------------------------------------------
  const [navigation, setNavigation] = useState<NavigationState>({
    level: "root",
  });

  const navigateToSection = useCallback((section: NavigationSection) => {
    setNavigation({ level: "section", section });
  }, []);

  const navigateToComponent = useCallback((componentId: string) => {
    setNavigation({ level: "component", section: "layout", componentId });
  }, []);

  const navigateBack = useCallback(() => {
    setNavigation((prev) => {
      if (prev.level === "component") {
        // Go back to layout section
        return { level: "section", section: "layout" };
      }
      if (prev.level === "section") {
        // Go back to root
        return { level: "root" };
      }
      return prev;
    });
  }, []);

  const navigateToRoot = useCallback(() => {
    setNavigation({ level: "root" });
  }, []);

  // ---------------------------------------------------------------------------
  // Layout Tree Expand/Collapse State
  // ---------------------------------------------------------------------------
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((componentId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(componentId)) {
        next.delete(componentId);
      } else {
        next.add(componentId);
      }
      return next;
    });
  }, []);

  // ---------------------------------------------------------------------------
  // Selection State (for preview interaction)
  // ---------------------------------------------------------------------------
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(
    null
  );
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(
    null
  );

  // ---------------------------------------------------------------------------
  // Context Value
  // ---------------------------------------------------------------------------
  const value = useMemo(
    () => ({
      // Theme state
      themeConfigDraft,
      themeStylesDraft,
      initialThemeConfig,
      initialThemeStyles,
      hasUnsavedChanges,
      isSaving,
      setThemeConfigDraft,
      setThemeStylesDraft,
      resetDrafts,
      saveDrafts,
      previewData,
      updateTypographyScale,
      updateColor,
      // Navigation state
      navigation,
      navigateToSection,
      navigateToComponent,
      navigateBack,
      navigateToRoot,
      // Expand/collapse
      expandedItems,
      toggleExpanded,
      // Selection
      selectedComponentId,
      hoveredComponentId,
      setSelectedComponentId,
      setHoveredComponentId,
    }),
    [
      themeConfigDraft,
      themeStylesDraft,
      initialThemeConfig,
      initialThemeStyles,
      hasUnsavedChanges,
      isSaving,
      previewData,
      resetDrafts,
      saveDrafts,
      updateTypographyScale,
      updateColor,
      navigation,
      navigateToSection,
      navigateToComponent,
      navigateBack,
      navigateToRoot,
      expandedItems,
      toggleExpanded,
      selectedComponentId,
      hoveredComponentId,
    ]
  );

  return (
    <DesignEditorContext.Provider value={value}>
      {children}
    </DesignEditorContext.Provider>
  );
}

export function useDesignEditor() {
  const ctx = useContext(DesignEditorContext);
  if (!ctx) {
    throw new Error("useDesignEditor must be used within DesignEditorProvider");
  }
  return ctx;
}
