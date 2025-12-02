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
 * Style value types - supports primitives and radius objects
 */
type RadiusValue = {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
};

type StyleValue = string | number | RadiusValue;

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
  brandId?: string;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  setThemeConfigDraft: (next: ThemeConfig) => void;
  setThemeStylesDraft: (next: ThemeStyles) => void;
  resetDrafts: () => void;
  saveDrafts: () => Promise<void>;
  previewData: DppData;

  // Helper setters for nested updates (ThemeStyles)
  updateTypographyScale: (
    scale: TypographyScaleKey,
    value: TypographyScale
  ) => void;
  updateColor: (colorKey: string, value: string) => void;
  updateComponentStyle: (path: string, value: StyleValue) => void;
  getComponentStyleValue: (path: string) => StyleValue | undefined;

  // Helper setters for config updates (ThemeConfig)
  updateConfigValue: (path: string, value: unknown) => void;
  getConfigValue: (path: string) => unknown;

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

  /**
   * Update a component style property using dot-notation path
   * e.g., updateComponentStyle("journey-card.borderColor", "#FF0000")
   */
  const updateComponentStyle = useCallback(
    (path: string, value: StyleValue) => {
      const [componentKey, ...propertyPath] = path.split(".");
      const propertyKey = propertyPath.join(".");

      setThemeStylesDraft((prev) => {
        const currentComponent = (prev as Record<string, unknown>)[
          componentKey
        ] as Record<string, unknown> | undefined;
        return {
          ...prev,
          [componentKey]: {
            ...currentComponent,
            [propertyKey]: value,
          },
        };
      });
    },
    []
  );

  /**
   * Get a component style value using dot-notation path
   * e.g., getComponentStyleValue("journey-card.borderColor")
   */
  const getComponentStyleValue = useCallback(
    (path: string): StyleValue | undefined => {
      const [componentKey, ...propertyPath] = path.split(".");
      const propertyKey = propertyPath.join(".");

      const component = (themeStylesDraft as Record<string, unknown>)[
        componentKey
      ] as Record<string, unknown> | undefined;
      return component?.[propertyKey] as StyleValue | undefined;
    },
    [themeStylesDraft]
  );

  /**
   * Update a config value using dot-notation path
   * e.g., updateConfigValue("branding.headerLogoUrl", "https://...")
   * e.g., updateConfigValue("sections.showPrimaryMenu", true)
   * e.g., updateConfigValue("menus.primary", [...items])
   */
  const updateConfigValue = useCallback((path: string, value: unknown) => {
    const keys = path.split(".");
    
    setThemeConfigDraft((prev) => {
      // Deep clone the config to avoid mutation
      const next = JSON.parse(JSON.stringify(prev)) as ThemeConfig;
      
      // Navigate to the nested property and update it
      let current: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (current[key] === undefined) {
          current[key] = {};
        }
        current = current[key] as Record<string, unknown>;
      }
      current[keys[keys.length - 1]] = value;
      
      return next;
    });
  }, []);

  /**
   * Get a config value using dot-notation path
   * e.g., getConfigValue("branding.headerLogoUrl")
   * e.g., getConfigValue("sections.showPrimaryMenu")
   */
  const getConfigValue = useCallback(
    (path: string): unknown => {
      const keys = path.split(".");
      let current: unknown = themeConfigDraft;
      
      for (const key of keys) {
        if (current === null || current === undefined) {
          return undefined;
        }
        current = (current as Record<string, unknown>)[key];
      }
      
      return current;
    },
    [themeConfigDraft]
  );

  // ---------------------------------------------------------------------------
  // Navigation State
  // ---------------------------------------------------------------------------
  const [navigation, setNavigation] = useState<NavigationState>({
    level: "section",
    section: "layout",
  });

  const navigateToSection = useCallback((section: NavigationSection) => {
    setNavigation({ level: "section", section });
  }, []);

  const navigateToComponent = useCallback((componentId: string) => {
    setNavigation({ level: "component", section: "layout", componentId });
    setSelectedComponentId(componentId);
  }, []);

  const navigateBack = useCallback(() => {
    setNavigation((prev) => {
      if (prev.level === "component") {
        // Go back to layout section and clear selection
        setSelectedComponentId(null);
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
      brandId,
      hasUnsavedChanges,
      isSaving,
      setThemeConfigDraft,
      setThemeStylesDraft,
      resetDrafts,
      saveDrafts,
      previewData,
      updateTypographyScale,
      updateColor,
      updateComponentStyle,
      getComponentStyleValue,
      updateConfigValue,
      getConfigValue,
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
      brandId,
      hasUnsavedChanges,
      isSaving,
      previewData,
      resetDrafts,
      saveDrafts,
      updateTypographyScale,
      updateColor,
      updateComponentStyle,
      getComponentStyleValue,
      updateConfigValue,
      getConfigValue,
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
