"use client";

import type {
  DppData,
  ThemeConfig,
  ThemeStyles,
  TypographyScale,
} from "@v1/dpp-components";
import {
  isTokenReference,
  getTokenName,
  type ColorTokenKey,
} from "@v1/dpp-components";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
} from "react";
import { saveThemeAction } from "@/actions/design/save-theme-action";
import { toast } from "@v1/ui/sonner";
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";

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
 * Style value types - supports primitives, radius objects, and border objects
 */
type RadiusValue = {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
};

type BorderValue = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type StyleValue = string | number | RadiusValue | BorderValue;

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

/**
 * State for editing a menu item (navigates to a sub-editor view)
 */
export type MenuItemEditState = {
  menuType: "primary" | "secondary";
  configPath: string;
  itemIndex: number;
} | null;

type DesignEditorContextValue = {
  // Theme state
  themeStylesDraft: ThemeStyles;
  themeConfigDraft: ThemeConfig;
  initialThemeStyles: ThemeStyles;
  initialThemeConfig: ThemeConfig;
  brandId?: string;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  setThemeStylesDraft: (next: ThemeStyles) => void;
  setThemeConfigDraft: (next: ThemeConfig) => void;
  resetDrafts: () => void;
  saveDrafts: () => Promise<void>;
  previewData: DppData;

  // Helper setters for nested updates (ThemeStyles)
  updateTypographyScale: (
    scale: TypographyScaleKey,
    value: TypographyScale,
  ) => void;
  updateColor: (colorKey: string, value: string) => void;
  updateComponentStyle: (path: string, value: StyleValue) => void;
  /**
   * Gets the resolved value for display in input fields.
   * If the stored value is a token reference (e.g., "$foreground"),
   * returns the actual color value from the design tokens.
   */
  getComponentStyleValue: (path: string) => StyleValue | undefined;
  /**
   * Gets the raw stored value, including token references.
   * Use this to check if a field is using a design token.
   */
  getRawComponentStyleValue: (path: string) => StyleValue | undefined;
  /**
   * Checks if a component style is using a design token reference.
   * Returns the token name (without $) if true, null otherwise.
   */
  getComponentStyleTokenRef: (path: string) => string | null;

  // Helper setters for nested updates (ThemeConfig)
  /**
   * Update a config value using dot-notation path
   * e.g., updateConfigValue("cta.bannerHeadline", "Welcome!")
   */
  updateConfigValue: (path: string, value: unknown) => void;
  /**
   * Get a config value using dot-notation path
   * e.g., getConfigValue("cta.bannerHeadline")
   */
  getConfigValue: (path: string) => unknown;
  /**
   * Toggle a section visibility flag
   * e.g., toggleSectionVisibility("showCTABanner")
   */
  toggleSectionVisibility: (key: keyof ThemeConfig["sections"]) => void;

  // Navigation state
  navigation: NavigationState;
  navigateToSection: (section: NavigationSection) => void;
  navigateToComponent: (componentId: string) => void;
  navigateBack: () => void;
  navigateToRoot: () => void;

  // Menu item editing state
  menuItemEdit: MenuItemEditState;
  navigateToMenuItemEdit: (menuType: "primary" | "secondary", configPath: string, itemIndex: number) => void;
  clearMenuItemEdit: () => void;

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
  null,
);

type ProviderProps = {
  children: React.ReactNode;
  initialThemeConfig: ThemeConfig;
  initialThemeStyles: ThemeStyles;
  initialGoogleFontsUrl: string | null;
  previewData: DppData;
  brandId?: string;
};

export function DesignEditorProvider({
  children,
  initialThemeConfig,
  initialThemeStyles,
  initialGoogleFontsUrl,
  previewData,
  brandId,
}: ProviderProps) {
  // ---------------------------------------------------------------------------
  // Theme Styles State
  // ---------------------------------------------------------------------------
  const [themeStylesDraft, setThemeStylesDraft] =
    useState<ThemeStyles>(initialThemeStyles);
  const [savedThemeStyles, setSavedThemeStyles] =
    useState<ThemeStyles>(initialThemeStyles);

  // ---------------------------------------------------------------------------
  // Theme Config State
  // ---------------------------------------------------------------------------
  const [themeConfigDraft, setThemeConfigDraft] =
    useState<ThemeConfig>(initialThemeConfig);
  const [savedThemeConfig, setSavedThemeConfig] =
    useState<ThemeConfig>(initialThemeConfig);

  // ---------------------------------------------------------------------------
  // Saving State
  // ---------------------------------------------------------------------------
  const [isSaving, setIsSaving] = useState(false);

  // tRPC client for config updates
  const trpc = useTRPC();
  const updateConfigMutation = useMutation(
    trpc.workflow.theme.updateConfig.mutationOptions(),
  );

  // Reset draft and saved states when initial values change (e.g., brand switch)
  useEffect(() => {
    setThemeStylesDraft(initialThemeStyles);
    setSavedThemeStyles(initialThemeStyles);
  }, [initialThemeStyles]);

  useEffect(() => {
    setThemeConfigDraft(initialThemeConfig);
    setSavedThemeConfig(initialThemeConfig);
  }, [initialThemeConfig]);

  // Load saved Google Fonts on mount to display typography correctly
  useEffect(() => {
    if (!initialGoogleFontsUrl) return;

    // Check if this font link already exists
    const existingLink = document.querySelector(
      `link[href="${initialGoogleFontsUrl}"]`,
    );
    if (existingLink) return;

    // Add preconnect for faster font loading
    const preconnect1 = document.createElement("link");
    preconnect1.rel = "preconnect";
    preconnect1.href = "https://fonts.googleapis.com";
    document.head.appendChild(preconnect1);

    const preconnect2 = document.createElement("link");
    preconnect2.rel = "preconnect";
    preconnect2.href = "https://fonts.gstatic.com";
    preconnect2.crossOrigin = "anonymous";
    document.head.appendChild(preconnect2);

    // Add the font stylesheet
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = initialGoogleFontsUrl;
    document.head.appendChild(link);

    return () => {
      // Cleanup on unmount or URL change
      link.remove();
      // Only remove preconnects if no other font links exist
      if (!document.querySelector('link[href*="fonts.googleapis.com/css"]')) {
        preconnect1.remove();
        preconnect2.remove();
      }
    };
  }, [initialGoogleFontsUrl]);

  // ---------------------------------------------------------------------------
  // Unsaved Changes Detection
  // ---------------------------------------------------------------------------
  const hasUnsavedStyleChanges =
    JSON.stringify(themeStylesDraft) !== JSON.stringify(savedThemeStyles);
  const hasUnsavedConfigChanges =
    JSON.stringify(themeConfigDraft) !== JSON.stringify(savedThemeConfig);
  const hasUnsavedChanges = hasUnsavedStyleChanges || hasUnsavedConfigChanges;

  // ---------------------------------------------------------------------------
  // Reset & Save
  // ---------------------------------------------------------------------------
  const resetDrafts = useCallback(() => {
    setThemeStylesDraft(savedThemeStyles);
    setThemeConfigDraft(savedThemeConfig);
  }, [savedThemeStyles, savedThemeConfig]);

  const saveDrafts = useCallback(async () => {
    if (!brandId) return;
    setIsSaving(true);

    try {
      const promises: Promise<unknown>[] = [];

      // Save styles if changed
      if (hasUnsavedStyleChanges) {
        promises.push(
          saveThemeAction({
            brandId,
            themeStyles: themeStylesDraft,
          }).then((result) => {
            if (result?.serverError) {
              throw new Error(result.serverError || "Failed to save theme styles");
            }
            setSavedThemeStyles(themeStylesDraft);
          }),
        );
      }

      // Save config if changed
      if (hasUnsavedConfigChanges) {
        promises.push(
          updateConfigMutation.mutateAsync({
            config: themeConfigDraft as unknown as Record<string, unknown>,
          }).then(() => {
            setSavedThemeConfig(themeConfigDraft);
          }),
        );
      }

      await Promise.all(promises);
      toast.success("Changes saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save theme");
    } finally {
      setIsSaving(false);
    }
  }, [
    brandId,
    themeStylesDraft,
    themeConfigDraft,
    hasUnsavedStyleChanges,
    hasUnsavedConfigChanges,
    updateConfigMutation,
  ]);

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
    [],
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
      const parts = path.split(".");
      const componentKey = parts[0];
      const propertyKey = parts.slice(1).join(".");

      if (!componentKey || !propertyKey) return;

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
    [],
  );

  /**
   * Get the raw stored value for a component style (including token references)
   */
  const getRawComponentStyleValue = useCallback(
    (path: string): StyleValue | undefined => {
      const parts = path.split(".");
      const componentKey = parts[0];
      const propertyKey = parts.slice(1).join(".");

      if (!componentKey || !propertyKey) return undefined;

      const component = (themeStylesDraft as Record<string, unknown>)[
        componentKey
      ] as Record<string, unknown> | undefined;
      return component?.[propertyKey] as StyleValue | undefined;
    },
    [themeStylesDraft],
  );

  /**
   * Get a component style value using dot-notation path
   * e.g., getComponentStyleValue("journey-card.borderColor")
   *
   * If the stored value is a token reference (e.g., "$foreground"),
   * it resolves to the actual color value from themeStylesDraft.colors
   * for display in input fields.
   */
  const getComponentStyleValue = useCallback(
    (path: string): StyleValue | undefined => {
      const storedValue = getRawComponentStyleValue(path);

      // If it's a token reference, resolve to the actual color value
      if (isTokenReference(storedValue)) {
        const tokenName = getTokenName(storedValue) as ColorTokenKey;
        const colors = themeStylesDraft.colors as
          | Record<string, string>
          | undefined;
        return colors?.[tokenName];
      }

      return storedValue;
    },
    [getRawComponentStyleValue, themeStylesDraft.colors],
  );

  /**
   * Check if a component style is using a design token reference
   * Returns the token name (without $) if true, null otherwise
   */
  const getComponentStyleTokenRef = useCallback(
    (path: string): string | null => {
      const storedValue = getRawComponentStyleValue(path);
      if (isTokenReference(storedValue)) {
        return getTokenName(storedValue);
      }
      return null;
    },
    [getRawComponentStyleValue],
  );

  // ---------------------------------------------------------------------------
  // Theme Config Helpers
  // ---------------------------------------------------------------------------

  /**
   * Update a config value using dot-notation path
   * e.g., updateConfigValue("cta.bannerHeadline", "Welcome!")
   */
  const updateConfigValue = useCallback((path: string, value: unknown) => {
    const parts = path.split(".");

    setThemeConfigDraft((prev) => {
      // Deep clone to avoid mutations
      const next = JSON.parse(JSON.stringify(prev)) as ThemeConfig;

      // Navigate to the parent and set the value
      let current: Record<string, unknown> = next as unknown as Record<string, unknown>;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        if (key && current[key] !== undefined) {
          current = current[key] as Record<string, unknown>;
        } else {
          // Path doesn't exist, create it
          if (key) {
            current[key] = {};
            current = current[key] as Record<string, unknown>;
          }
        }
      }

      const lastKey = parts[parts.length - 1];
      if (lastKey) {
        current[lastKey] = value;
      }

      return next;
    });
  }, []);

  /**
   * Get a config value using dot-notation path
   * e.g., getConfigValue("cta.bannerHeadline")
   */
  const getConfigValue = useCallback(
    (path: string): unknown => {
      const parts = path.split(".");
      let current: unknown = themeConfigDraft;

      for (const key of parts) {
        if (current && typeof current === "object" && key in current) {
          current = (current as Record<string, unknown>)[key];
        } else {
          return undefined;
        }
      }

      return current;
    },
    [themeConfigDraft],
  );

  /**
   * Toggle a section visibility flag
   * e.g., toggleSectionVisibility("showCTABanner")
   */
  const toggleSectionVisibility = useCallback(
    (key: keyof ThemeConfig["sections"]) => {
      setThemeConfigDraft((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          [key]: !prev.sections[key],
        },
      }));
    },
    [],
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
    // Clear component selection when switching sections
    setSelectedComponentId(null);
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
  // Menu Item Edit State
  // ---------------------------------------------------------------------------
  const [menuItemEdit, setMenuItemEdit] = useState<MenuItemEditState>(null);

  const navigateToMenuItemEdit = useCallback(
    (menuType: "primary" | "secondary", configPath: string, itemIndex: number) => {
      setMenuItemEdit({ menuType, configPath, itemIndex });
    },
    [],
  );

  const clearMenuItemEdit = useCallback(() => {
    setMenuItemEdit(null);
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
    null,
  );
  const [hoveredComponentId, setHoveredComponentId] = useState<string | null>(
    null,
  );

  // ---------------------------------------------------------------------------
  // Context Value
  // ---------------------------------------------------------------------------
  const value = useMemo(
    () => ({
      // Theme state
      themeStylesDraft,
      themeConfigDraft,
      initialThemeStyles,
      initialThemeConfig,
      brandId,
      hasUnsavedChanges,
      isSaving,
      setThemeStylesDraft,
      setThemeConfigDraft,
      resetDrafts,
      saveDrafts,
      previewData,
      // Style helpers
      updateTypographyScale,
      updateColor,
      updateComponentStyle,
      getComponentStyleValue,
      getRawComponentStyleValue,
      getComponentStyleTokenRef,
      // Config helpers
      updateConfigValue,
      getConfigValue,
      toggleSectionVisibility,
      // Navigation state
      navigation,
      navigateToSection,
      navigateToComponent,
      navigateBack,
      navigateToRoot,
      // Menu item editing
      menuItemEdit,
      navigateToMenuItemEdit,
      clearMenuItemEdit,
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
      themeStylesDraft,
      themeConfigDraft,
      initialThemeStyles,
      initialThemeConfig,
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
      getRawComponentStyleValue,
      getComponentStyleTokenRef,
      updateConfigValue,
      getConfigValue,
      toggleSectionVisibility,
      navigation,
      navigateToSection,
      navigateToComponent,
      navigateBack,
      navigateToRoot,
      menuItemEdit,
      navigateToMenuItemEdit,
      clearMenuItemEdit,
      expandedItems,
      toggleExpanded,
      selectedComponentId,
      hoveredComponentId,
    ],
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
