"use client";

import { saveThemeAction } from "@/actions/design/save-theme-action";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  ComponentType,
  DppData,
  LayoutComponentInstance,
  ThemeConfig,
  ThemeStyles,
  TypographyScale,
  ZoneId,
} from "@v1/dpp-components";
import {
  type ColorTokenKey,
  generateGoogleFontsUrlFromTypography,
  getTokenName,
  isTokenReference,
} from "@v1/dpp-components";
import { COMPONENT_LIBRARY } from "@v1/dpp-components/lib/component-library";
import { generateDefaultLayout } from "@v1/dpp-components/lib/layout-migration";
import { toast } from "@v1/ui/sonner";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

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
  setPreviewData: (data: DppData) => void;

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
  navigateToMenuItemEdit: (
    menuType: "primary" | "secondary",
    configPath: string,
    itemIndex: number,
  ) => void;
  clearMenuItemEdit: () => void;

  // Layout instance operations
  addInstance: (
    zoneId: ZoneId,
    componentType: ComponentType,
    position: number,
  ) => string;
  deleteInstance: (zoneId: ZoneId, instanceId: string) => void;
  moveInstance: (
    zoneId: ZoneId,
    instanceId: string,
    newPosition: number,
  ) => void;
  updateInstanceContent: (
    zoneId: ZoneId,
    instanceId: string,
    path: string,
    value: unknown,
  ) => void;
  updateInstanceStyle: (
    zoneId: ZoneId,
    instanceId: string,
    cssVar: string,
    value: unknown,
  ) => void;
  getInstanceContent: (
    zoneId: ZoneId,
    instanceId: string,
    path: string,
  ) => unknown;
  getInstanceStyle: (
    zoneId: ZoneId,
    instanceId: string,
    cssVar: string,
  ) => unknown;

  // Instance navigation
  navigateToInstance: (zoneId: ZoneId, instanceId: string) => void;
  activeInstanceId: string | null;
  activeZoneId: ZoneId | null;

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

/**
 * Ensure the ThemeConfig has a layout field. If missing (legacy data),
 * run the one-time migration to generate it from section flags / menus / cta.
 */
function ensureLayout(config: ThemeConfig): ThemeConfig {
  if (config.layout) return config;
  const { layout: _, ...rest } = config as ThemeConfig & { layout?: unknown };
  return { ...config, layout: generateDefaultLayout(rest as Omit<ThemeConfig, "layout">) };
}

export function DesignEditorProvider({
  children,
  initialThemeConfig,
  initialThemeStyles,
  initialGoogleFontsUrl,
  previewData: initialPreviewData,
  brandId,
}: ProviderProps) {
  // ---------------------------------------------------------------------------
  // Preview Data State
  // ---------------------------------------------------------------------------
  const [previewData, setPreviewData] = useState<DppData>(initialPreviewData);

  // Sync preview data when initial prop changes (e.g., brand switch)
  useEffect(() => {
    setPreviewData(initialPreviewData);
  }, [initialPreviewData]);

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
    useState<ThemeConfig>(() => ensureLayout(initialThemeConfig));
  const [savedThemeConfig, setSavedThemeConfig] =
    useState<ThemeConfig>(() => ensureLayout(initialThemeConfig));

  // ---------------------------------------------------------------------------
  // Saving State
  // ---------------------------------------------------------------------------
  const [isSaving, setIsSaving] = useState(false);

  // tRPC client for config updates
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const updateConfigMutation = useMutation(
    trpc.brand.theme.update.mutationOptions(),
  );

  // Reset draft and saved states when initial values change (e.g., brand switch)
  useEffect(() => {
    setThemeStylesDraft(initialThemeStyles);
    setSavedThemeStyles(initialThemeStyles);
  }, [initialThemeStyles]);

  useEffect(() => {
    const migrated = ensureLayout(initialThemeConfig);
    setThemeConfigDraft(migrated);
    setSavedThemeConfig(migrated);
  }, [initialThemeConfig]);

  const previewGoogleFontsUrl = useMemo(() => {
    // Always prefer a canonical weighted URL generated from current typography.
    const generatedUrl = generateGoogleFontsUrlFromTypography(
      themeStylesDraft?.typography as Record<string, unknown> | undefined,
    );
    return generatedUrl || initialGoogleFontsUrl || "";
  }, [themeStylesDraft?.typography, initialGoogleFontsUrl]);

  // Load Google Fonts in preview to match current typography settings
  useEffect(() => {
    if (!previewGoogleFontsUrl) return;

    // Check if this font link already exists
    const existingLink = document.querySelector(
      `link[href="${previewGoogleFontsUrl}"]`,
    );
    if (existingLink) return;

    // Ensure preconnects exist (reuse if already present)
    let preconnect1: HTMLLinkElement | null = document.querySelector(
      'link[rel="preconnect"][href="https://fonts.googleapis.com"]',
    );
    let preconnect2: HTMLLinkElement | null = document.querySelector(
      'link[rel="preconnect"][href="https://fonts.gstatic.com"]',
    );
    const createdPreconnect1 = !preconnect1;
    const createdPreconnect2 = !preconnect2;

    // Add preconnect for faster font loading
    if (!preconnect1) {
      preconnect1 = document.createElement("link");
      preconnect1.rel = "preconnect";
      preconnect1.href = "https://fonts.googleapis.com";
      document.head.appendChild(preconnect1);
    }

    if (!preconnect2) {
      preconnect2 = document.createElement("link");
      preconnect2.rel = "preconnect";
      preconnect2.href = "https://fonts.gstatic.com";
      preconnect2.crossOrigin = "anonymous";
      document.head.appendChild(preconnect2);
    }

    // Add the font stylesheet
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = previewGoogleFontsUrl;
    document.head.appendChild(link);

    return () => {
      // Cleanup on unmount or URL change
      link.remove();

      // Remove preconnects only if they were created by this effect and unused
      if (
        !document.querySelector('link[href*="fonts.googleapis.com/css"]') &&
        createdPreconnect1
      ) {
        preconnect1?.remove();
      }
      if (
        !document.querySelector('link[href*="fonts.googleapis.com/css"]') &&
        createdPreconnect2
      ) {
        preconnect2?.remove();
      }
    };
  }, [previewGoogleFontsUrl]);

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
              throw new Error(
                result.serverError || "Failed to save theme styles",
              );
            }
            setSavedThemeStyles(themeStylesDraft);
          }),
        );
      }

      // Save config if changed
      if (hasUnsavedConfigChanges) {
        promises.push(
          updateConfigMutation
            .mutateAsync({
              config: themeConfigDraft as unknown as Record<string, unknown>,
            })
            .then(() => {
              setSavedThemeConfig(themeConfigDraft);
            }),
        );
      }

      await Promise.all(promises);
      // Invalidate theme cache so re-entering the editor fetches fresh data
      await queryClient.invalidateQueries({
        queryKey: trpc.brand.theme.get.queryKey(),
      });
      toast.success("Changes saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save theme",
      );
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
    queryClient,
    trpc,
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
      let current: Record<string, unknown> = next as unknown as Record<
        string,
        unknown
      >;
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
        setActiveInstanceId(null);
        setActiveZoneId(null);
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
    (
      menuType: "primary" | "secondary",
      configPath: string,
      itemIndex: number,
    ) => {
      setMenuItemEdit({ menuType, configPath, itemIndex });
    },
    [],
  );

  const clearMenuItemEdit = useCallback(() => {
    setMenuItemEdit(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Layout Instance Operations
  // ---------------------------------------------------------------------------
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<ZoneId | null>(null);

  const addInstance = useCallback(
    (zoneId: ZoneId, componentType: ComponentType, position: number) => {
      const id = `inst_${crypto.randomUUID().slice(0, 8)}`;
      const entry = COMPONENT_LIBRARY[componentType];
      const defaultContent = entry?.defaultContent;

      const newInstance: LayoutComponentInstance = {
        id,
        componentType,
        ...(defaultContent && Object.keys(defaultContent).length > 0
          ? { content: structuredClone(defaultContent) }
          : {}),
      };

      setThemeConfigDraft((prev) => {
        const next = JSON.parse(JSON.stringify(prev)) as ThemeConfig;
        const zone = next.layout.zones[zoneId];
        zone.splice(position, 0, newInstance);

        // For banner, apply default content to themeConfig.cta if fields are empty
        if (componentType === "banner" && defaultContent) {
          if (!next.cta.bannerHeadline && defaultContent.headline) {
            next.cta.bannerHeadline = defaultContent.headline as string;
          }
          if (!next.cta.bannerBackgroundImage && defaultContent.backgroundImage) {
            next.cta.bannerBackgroundImage = defaultContent.backgroundImage as string;
          }
          if (!next.cta.bannerCTAText && defaultContent.ctaText) {
            next.cta.bannerCTAText = defaultContent.ctaText as string;
          }
          if (!next.cta.bannerCTAUrl && defaultContent.ctaUrl) {
            next.cta.bannerCTAUrl = defaultContent.ctaUrl as string;
          }
          if (next.cta.showHeadline === undefined) {
            next.cta.showHeadline = (defaultContent.showHeadline as boolean) ?? true;
          }
          if (next.cta.showSubline === undefined) {
            next.cta.showSubline = (defaultContent.showSubline as boolean) ?? true;
          }
          if (next.cta.showButton === undefined) {
            next.cta.showButton = (defaultContent.showButton as boolean) ?? true;
          }
        }

        return next;
      });

      return id;
    },
    [],
  );

  const deleteInstance = useCallback(
    (zoneId: ZoneId, instanceId: string) => {
      setThemeConfigDraft((prev) => {
        const next = JSON.parse(JSON.stringify(prev)) as ThemeConfig;
        next.layout.zones[zoneId] = next.layout.zones[zoneId].filter(
          (inst) => inst.id !== instanceId,
        );
        return next;
      });

      // Clear active instance if it was deleted
      if (activeInstanceId === instanceId) {
        setActiveInstanceId(null);
        setActiveZoneId(null);
      }
    },
    [activeInstanceId],
  );

  const moveInstance = useCallback(
    (zoneId: ZoneId, instanceId: string, newPosition: number) => {
      setThemeConfigDraft((prev) => {
        const next = JSON.parse(JSON.stringify(prev)) as ThemeConfig;
        const zone = next.layout.zones[zoneId];
        const currentIndex = zone.findIndex((inst) => inst.id === instanceId);
        if (currentIndex === -1) return prev;

        const [item] = zone.splice(currentIndex, 1);
        if (item) {
          zone.splice(newPosition, 0, item);
        }
        return next;
      });
    },
    [],
  );

  const updateInstanceContent = useCallback(
    (zoneId: ZoneId, instanceId: string, path: string, value: unknown) => {
      setThemeConfigDraft((prev) => {
        const next = JSON.parse(JSON.stringify(prev)) as ThemeConfig;
        const instance = next.layout.zones[zoneId].find(
          (inst) => inst.id === instanceId,
        );
        if (!instance) return prev;

        if (!instance.content) instance.content = {};
        const parts = path.split(".");
        let current: Record<string, unknown> = instance.content;
        for (let i = 0; i < parts.length - 1; i++) {
          const key = parts[i];
          if (key) {
            if (!current[key] || typeof current[key] !== "object") {
              current[key] = {};
            }
            current = current[key] as Record<string, unknown>;
          }
        }
        const lastKey = parts[parts.length - 1];
        if (lastKey) current[lastKey] = value;

        return next;
      });
    },
    [],
  );

  const updateInstanceStyle = useCallback(
    (zoneId: ZoneId, instanceId: string, cssVar: string, value: unknown) => {
      setThemeConfigDraft((prev) => {
        const next = JSON.parse(JSON.stringify(prev)) as ThemeConfig;
        const instance = next.layout.zones[zoneId].find(
          (inst) => inst.id === instanceId,
        );
        if (!instance) return prev;

        if (!instance.styles) instance.styles = {};
        instance.styles[cssVar] = value;

        return next;
      });
    },
    [],
  );

  const getInstanceContent = useCallback(
    (zoneId: ZoneId, instanceId: string, path: string): unknown => {
      const instance = themeConfigDraft.layout.zones[zoneId].find(
        (inst) => inst.id === instanceId,
      );
      if (!instance?.content) return undefined;

      const parts = path.split(".");
      let current: unknown = instance.content;
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

  const getInstanceStyle = useCallback(
    (zoneId: ZoneId, instanceId: string, cssVar: string): unknown => {
      const instance = themeConfigDraft.layout.zones[zoneId].find(
        (inst) => inst.id === instanceId,
      );
      return instance?.styles?.[cssVar];
    },
    [themeConfigDraft],
  );

  const navigateToInstance = useCallback(
    (zoneId: ZoneId, instanceId: string) => {
      setActiveInstanceId(instanceId);
      setActiveZoneId(zoneId);
      // Find the instance to get its component type for navigation
      const instance = themeConfigDraft.layout.zones[zoneId].find(
        (inst) => inst.id === instanceId,
      );
      if (instance) {
        // Navigate to component level using the instance ID
        setNavigation({
          level: "component",
          section: "layout",
          componentId: instanceId,
        });
      }
    },
    [themeConfigDraft],
  );

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
      setPreviewData,
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
      // Layout instance operations
      addInstance,
      deleteInstance,
      moveInstance,
      updateInstanceContent,
      updateInstanceStyle,
      getInstanceContent,
      getInstanceStyle,
      navigateToInstance,
      activeInstanceId,
      activeZoneId,
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
      addInstance,
      deleteInstance,
      moveInstance,
      updateInstanceContent,
      updateInstanceStyle,
      getInstanceContent,
      getInstanceStyle,
      navigateToInstance,
      activeInstanceId,
      activeZoneId,
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
