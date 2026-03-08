"use client";

import { saveThemeAction } from "@/actions/design/save-theme-action";
import { useTRPC } from "@/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import type {
  CustomFont,
  DppData,
  Passport,
  Section,
  SectionType,
  Styles,
  TypeScale,
  TypographyScale,
  ZoneId,
} from "@v1/dpp-components";
import {
  SECTION_REGISTRY,
  type ColorTokenKey,
  generateGoogleFontsUrlFromTypography,
  getTokenName,
  isTokenReference,
} from "@v1/dpp-components";
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

type StyleValue = string | number | Record<string, number>;

export type NavigationSection = "layout" | "typography" | "colors";

export type NavigationState = {
  level: "root" | "section" | "component";
  section?: NavigationSection;
  componentId?: string;
};

export type MenuItemEditState = {
  menuType: "primary" | "secondary";
  contentPath: string;
  itemIndex: number;
} | null;

/**
 * Tracks which part of the passport the style/content editors are targeting.
 */
type ActiveTarget =
  | { type: "header" }
  | { type: "footer" }
  | { type: "section"; zoneId: ZoneId; sectionId: string }
  | null;

type DesignEditorContextValue = {
  // Passport state
  passportDraft: Passport;
  brandId?: string;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  resetDrafts: () => void;
  saveDrafts: () => Promise<void>;
  previewData: DppData;
  setPreviewData: (data: DppData) => void;

  // Token updates
  updateTypographyScale: (scale: TypeScale, value: TypographyScale) => void;
  updateColor: (colorKey: string, value: string) => void;
  updateCustomFonts: (fonts: CustomFont[]) => void;

  // Style helpers (operate on active target: header/footer/section)
  updateComponentStyle: (path: string, value: StyleValue) => void;
  getComponentStyleValue: (path: string) => StyleValue | undefined;
  getRawComponentStyleValue: (path: string) => StyleValue | undefined;
  getComponentStyleTokenRef: (path: string) => string | null;

  // Content helpers (operate on active target)
  updateConfigValue: (path: string, value: unknown) => void;
  getConfigValue: (path: string) => unknown;

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
    contentPath: string,
    itemIndex: number,
  ) => void;
  clearMenuItemEdit: () => void;

  // Section operations
  addSection: (
    zoneId: ZoneId,
    sectionType: SectionType,
    position: number,
  ) => string;
  deleteSection: (zoneId: ZoneId, sectionId: string) => void;
  moveSection: (
    zoneId: ZoneId,
    sectionId: string,
    newPosition: number,
  ) => void;

  // Section instance navigation
  navigateToSectionInstance: (zoneId: ZoneId, sectionId: string) => void;
  activeSectionId: string | null;
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
  initialPassport: Passport;
  initialGoogleFontsUrl: string | null;
  previewData: DppData;
  brandId?: string;
};

// =============================================================================
// HELPERS
// =============================================================================

function deepGet(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const key of parts) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }
  return current;
}

function deepSet(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const lastKey = parts[parts.length - 1];
  if (lastKey) current[lastKey] = value;
}

function generateSectionId(): string {
  return `sec_${crypto.randomUUID().slice(0, 8)}`;
}

// =============================================================================
// PROVIDER
// =============================================================================

export function DesignEditorProvider({
  children,
  initialPassport,
  initialGoogleFontsUrl,
  previewData: initialPreviewData,
  brandId,
}: ProviderProps) {
  // ---------------------------------------------------------------------------
  // Preview Data State
  // ---------------------------------------------------------------------------
  const [previewData, setPreviewData] = useState<DppData>(initialPreviewData);

  useEffect(() => {
    setPreviewData(initialPreviewData);
  }, [initialPreviewData]);

  // ---------------------------------------------------------------------------
  // Passport State
  // ---------------------------------------------------------------------------
  const [passportDraft, setPassportDraft] =
    useState<Passport>(initialPassport);
  const [savedPassport, setSavedPassport] =
    useState<Passport>(initialPassport);

  // ---------------------------------------------------------------------------
  // Saving State
  // ---------------------------------------------------------------------------
  const [isSaving, setIsSaving] = useState(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Reset when initial values change (e.g., brand switch)
  useEffect(() => {
    setPassportDraft(initialPassport);
    setSavedPassport(initialPassport);
  }, [initialPassport]);

  // Google Fonts for preview
  const previewGoogleFontsUrl = useMemo(() => {
    const generatedUrl = generateGoogleFontsUrlFromTypography(
      passportDraft?.tokens?.typography as Record<string, unknown> | undefined,
    );
    return generatedUrl || initialGoogleFontsUrl || "";
  }, [passportDraft?.tokens?.typography, initialGoogleFontsUrl]);

  useEffect(() => {
    if (!previewGoogleFontsUrl) return;

    const existingLink = document.querySelector(
      `link[href="${previewGoogleFontsUrl}"]`,
    );
    if (existingLink) return;

    let preconnect1: HTMLLinkElement | null = document.querySelector(
      'link[rel="preconnect"][href="https://fonts.googleapis.com"]',
    );
    let preconnect2: HTMLLinkElement | null = document.querySelector(
      'link[rel="preconnect"][href="https://fonts.gstatic.com"]',
    );
    const createdPreconnect1 = !preconnect1;
    const createdPreconnect2 = !preconnect2;

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

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = previewGoogleFontsUrl;
    document.head.appendChild(link);

    return () => {
      link.remove();
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
  const hasUnsavedChanges =
    JSON.stringify(passportDraft) !== JSON.stringify(savedPassport);

  // ---------------------------------------------------------------------------
  // Reset & Save
  // ---------------------------------------------------------------------------
  const resetDrafts = useCallback(() => {
    setPassportDraft(savedPassport);
  }, [savedPassport]);

  const saveDrafts = useCallback(async () => {
    if (!brandId) return;
    setIsSaving(true);

    try {
      const result = await saveThemeAction({
        brandId,
        passport: passportDraft,
      });

      if (result?.serverError) {
        throw new Error(result.serverError || "Failed to save");
      }

      setSavedPassport(passportDraft);
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
  }, [brandId, passportDraft, queryClient, trpc]);

  // ---------------------------------------------------------------------------
  // Token Updates
  // ---------------------------------------------------------------------------
  const updateTypographyScale = useCallback(
    (scale: TypeScale, value: TypographyScale) => {
      setPassportDraft((prev) => ({
        ...prev,
        tokens: {
          ...prev.tokens,
          typography: {
            ...prev.tokens.typography,
            [scale]: value,
          },
        },
      }));
    },
    [],
  );

  const updateColor = useCallback((colorKey: string, value: string) => {
    setPassportDraft((prev) => ({
      ...prev,
      tokens: {
        ...prev.tokens,
        colors: {
          ...prev.tokens.colors,
          [colorKey]: value,
        },
      },
    }));
  }, []);

  const updateCustomFonts = useCallback((fonts: CustomFont[]) => {
    setPassportDraft((prev) => ({
      ...prev,
      tokens: {
        ...prev.tokens,
        fonts,
      },
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Active Target Tracking
  // ---------------------------------------------------------------------------
  const [activeTarget, setActiveTarget] = useState<ActiveTarget>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<ZoneId | null>(null);

  /**
   * Get the styles object for the current active target.
   */
  const getActiveStyles = useCallback((): Styles | undefined => {
    if (!activeTarget) return undefined;
    if (activeTarget.type === "header") return passportDraft.header.styles;
    if (activeTarget.type === "footer") return passportDraft.footer.styles;

    const zone = passportDraft[activeTarget.zoneId];
    const section = zone?.find(
      (s: Section) => s.id === activeTarget.sectionId,
    );
    return section?.styles;
  }, [activeTarget, passportDraft]);

  // ---------------------------------------------------------------------------
  // Style Helpers
  // ---------------------------------------------------------------------------

  const updateComponentStyle = useCallback(
    (path: string, value: StyleValue) => {
      if (!activeTarget) return;
      const [element, ...rest] = path.split(".");
      const property = rest.join(".");
      if (!element || !property) return;

      setPassportDraft((prev) => {
        const next = structuredClone(prev);

        let styles: Styles;
        if (activeTarget.type === "header") {
          styles = next.header.styles;
        } else if (activeTarget.type === "footer") {
          styles = next.footer.styles;
        } else {
          const zone = next[activeTarget.zoneId];
          const section = zone?.find(
            (s: Section) => s.id === activeTarget.sectionId,
          );
          if (!section) return prev;
          styles = section.styles;
        }

        if (!styles[element]) {
          styles[element] = {};
        }
        (styles[element] as Record<string, unknown>)[property] = value;

        return next;
      });
    },
    [activeTarget],
  );

  const getRawComponentStyleValue = useCallback(
    (path: string): StyleValue | undefined => {
      const styles = getActiveStyles();
      if (!styles) return undefined;
      const [element, ...rest] = path.split(".");
      const property = rest.join(".");
      if (!element || !property) return undefined;
      return (styles[element] as Record<string, unknown> | undefined)?.[
        property
      ] as StyleValue | undefined;
    },
    [getActiveStyles],
  );

  const getComponentStyleValue = useCallback(
    (path: string): StyleValue | undefined => {
      const storedValue = getRawComponentStyleValue(path);
      if (isTokenReference(storedValue)) {
        const tokenName = getTokenName(storedValue) as ColorTokenKey;
        return passportDraft.tokens.colors[tokenName];
      }
      return storedValue;
    },
    [getRawComponentStyleValue, passportDraft.tokens.colors],
  );

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
  // Content Helpers
  // ---------------------------------------------------------------------------

  const updateConfigValue = useCallback(
    (path: string, value: unknown) => {
      if (!activeTarget) return;

      setPassportDraft((prev) => {
        const next = structuredClone(prev);

        if (activeTarget.type === "header") {
          deepSet(
            next.header as unknown as Record<string, unknown>,
            path,
            value,
          );
        } else if (activeTarget.type === "footer") {
          deepSet(
            next.footer as unknown as Record<string, unknown>,
            path,
            value,
          );
        } else {
          const zone = next[activeTarget.zoneId];
          const section = zone?.find(
            (s: Section) => s.id === activeTarget.sectionId,
          );
          if (!section) return prev;
          deepSet(section.content as Record<string, unknown>, path, value);
        }

        return next;
      });
    },
    [activeTarget],
  );

  const getConfigValue = useCallback(
    (path: string): unknown => {
      if (!activeTarget) return undefined;

      if (activeTarget.type === "header") {
        return deepGet(passportDraft.header, path);
      }
      if (activeTarget.type === "footer") {
        return deepGet(passportDraft.footer, path);
      }

      const zone = passportDraft[activeTarget.zoneId];
      const section = zone?.find(
        (s: Section) => s.id === activeTarget.sectionId,
      );
      return section ? deepGet(section.content, path) : undefined;
    },
    [activeTarget, passportDraft],
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
    setSelectedComponentId(null);
  }, []);

  const navigateToComponent = useCallback((componentId: string) => {
    setNavigation({ level: "component", section: "layout", componentId });
    setSelectedComponentId(componentId);

    // Set active target for header/footer child components
    if (componentId === "header" || componentId.startsWith("header.")) {
      setActiveTarget({ type: "header" });
    } else if (
      componentId === "footer" ||
      componentId.startsWith("footer.")
    ) {
      setActiveTarget({ type: "footer" });
    }
  }, []);

  const navigateBack = useCallback(() => {
    setNavigation((prev) => {
      if (prev.level === "component") {
        setSelectedComponentId(null);
        setActiveSectionId(null);
        setActiveZoneId(null);
        setActiveTarget(null);
        return { level: "section", section: "layout" };
      }
      if (prev.level === "section") {
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
      contentPath: string,
      itemIndex: number,
    ) => {
      setMenuItemEdit({ menuType, contentPath, itemIndex });
    },
    [],
  );

  const clearMenuItemEdit = useCallback(() => {
    setMenuItemEdit(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Section Operations
  // ---------------------------------------------------------------------------

  const addSection = useCallback(
    (zoneId: ZoneId, sectionType: SectionType, position: number) => {
      const id = generateSectionId();
      const entry = SECTION_REGISTRY[sectionType];
      const schema = entry?.schema;

      const newSection: Section = {
        id,
        type: sectionType,
        content: schema?.defaultContent
          ? structuredClone(schema.defaultContent)
          : {},
        styles: schema?.defaultStyles
          ? structuredClone(schema.defaultStyles)
          : {},
      };

      setPassportDraft((prev) => {
        const next = structuredClone(prev);
        const zone = next[zoneId];
        zone.splice(position, 0, newSection);
        return next;
      });

      return id;
    },
    [],
  );

  const deleteSection = useCallback(
    (zoneId: ZoneId, sectionId: string) => {
      setPassportDraft((prev) => {
        const next = structuredClone(prev);
        next[zoneId] = next[zoneId].filter(
          (s: Section) => s.id !== sectionId,
        );
        return next;
      });

      if (activeSectionId === sectionId) {
        setActiveSectionId(null);
        setActiveZoneId(null);
        setActiveTarget(null);
        setNavigation({ level: "section", section: "layout" });
        setSelectedComponentId(null);
      }
    },
    [activeSectionId],
  );

  const moveSection = useCallback(
    (zoneId: ZoneId, sectionId: string, newPosition: number) => {
      setPassportDraft((prev) => {
        const next = structuredClone(prev);
        const zone = next[zoneId];
        const currentIndex = zone.findIndex(
          (s: Section) => s.id === sectionId,
        );
        if (currentIndex === -1) return prev;

        const [item] = zone.splice(currentIndex, 1);
        if (item) zone.splice(newPosition, 0, item);
        return next;
      });
    },
    [],
  );

  const navigateToSectionInstance = useCallback(
    (zoneId: ZoneId, sectionId: string) => {
      setActiveSectionId(sectionId);
      setActiveZoneId(zoneId);
      setActiveTarget({ type: "section", zoneId, sectionId });
      setNavigation({
        level: "component",
        section: "layout",
        componentId: sectionId,
      });
    },
    [],
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
  // Selection State
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
      passportDraft,
      brandId,
      hasUnsavedChanges,
      isSaving,
      resetDrafts,
      saveDrafts,
      previewData,
      setPreviewData,
      updateTypographyScale,
      updateColor,
      updateCustomFonts,
      updateComponentStyle,
      getComponentStyleValue,
      getRawComponentStyleValue,
      getComponentStyleTokenRef,
      updateConfigValue,
      getConfigValue,
      navigation,
      navigateToSection,
      navigateToComponent,
      navigateBack,
      navigateToRoot,
      menuItemEdit,
      navigateToMenuItemEdit,
      clearMenuItemEdit,
      addSection,
      deleteSection,
      moveSection,
      navigateToSectionInstance,
      activeSectionId,
      activeZoneId,
      expandedItems,
      toggleExpanded,
      selectedComponentId,
      hoveredComponentId,
      setSelectedComponentId,
      setHoveredComponentId,
    }),
    [
      passportDraft,
      brandId,
      hasUnsavedChanges,
      isSaving,
      resetDrafts,
      saveDrafts,
      previewData,
      updateTypographyScale,
      updateColor,
      updateCustomFonts,
      updateComponentStyle,
      getComponentStyleValue,
      getRawComponentStyleValue,
      getComponentStyleTokenRef,
      updateConfigValue,
      getConfigValue,
      navigation,
      navigateToSection,
      navigateToComponent,
      navigateBack,
      navigateToRoot,
      menuItemEdit,
      navigateToMenuItemEdit,
      clearMenuItemEdit,
      addSection,
      deleteSection,
      moveSection,
      navigateToSectionInstance,
      activeSectionId,
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
