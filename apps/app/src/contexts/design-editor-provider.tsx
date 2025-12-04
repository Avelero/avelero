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

type DesignEditorContextValue = {
  // Theme state (styles are editable, config is read-only for preview)
  themeStylesDraft: ThemeStyles;
  themeConfig: ThemeConfig; // Read-only, used for preview rendering
  initialThemeStyles: ThemeStyles;
  brandId?: string;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  setThemeStylesDraft: (next: ThemeStyles) => void;
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
  null,
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
  const [themeStylesDraft, setThemeStylesDraft] =
    useState<ThemeStyles>(initialThemeStyles);
  const [isSaving, setIsSaving] = useState(false);

  // Track the last saved state to properly detect unsaved changes
  const [savedThemeStyles, setSavedThemeStyles] =
    useState<ThemeStyles>(initialThemeStyles);

  // Reset draft and saved states when initialThemeStyles changes (e.g., brand switch)
  useEffect(() => {
    setThemeStylesDraft(initialThemeStyles);
    setSavedThemeStyles(initialThemeStyles);
  }, [initialThemeStyles]);

  // ThemeConfig is read-only in the theme editor (edited in /design/content)
  const themeConfig = initialThemeConfig;

  const hasUnsavedChanges =
    JSON.stringify(themeStylesDraft) !== JSON.stringify(savedThemeStyles);

  const resetDrafts = useCallback(() => {
    setThemeStylesDraft(savedThemeStyles);
  }, [savedThemeStyles]);

  const saveDrafts = useCallback(async () => {
    if (!brandId) return;
    setIsSaving(true);
    try {
      const result = await saveThemeAction({
        brandId,
        themeStyles: themeStylesDraft,
      });
      
      if (result?.serverError) {
        toast.error(result.serverError || "Failed to save theme");
        return;
      }
      
      // Update saved state to match current drafts after successful save
      setSavedThemeStyles(themeStylesDraft);
      toast.success("Changes saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save theme");
    } finally {
      setIsSaving(false);
    }
  }, [brandId, themeStylesDraft]);

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
      themeConfig,
      initialThemeStyles,
      brandId,
      hasUnsavedChanges,
      isSaving,
      setThemeStylesDraft,
      resetDrafts,
      saveDrafts,
      previewData,
      updateTypographyScale,
      updateColor,
      updateComponentStyle,
      getComponentStyleValue,
      getRawComponentStyleValue,
      getComponentStyleTokenRef,
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
      themeStylesDraft,
      themeConfig,
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
      getRawComponentStyleValue,
      getComponentStyleTokenRef,
      navigation,
      navigateToSection,
      navigateToComponent,
      navigateBack,
      navigateToRoot,
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
