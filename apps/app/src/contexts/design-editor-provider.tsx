"use client";

import type {
  DppData,
  ThemeConfig,
  ThemeStyles,
  TypographyScale,
} from "@v1/dpp-components";
import { createContext, useContext, useMemo, useState, useCallback } from "react";
import { saveThemeAction } from "@/actions/design/save-theme-action";

type TypographyScaleKey = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "body" | "body-sm" | "body-xs";

type DesignEditorContextValue = {
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
  updateTypographyScale: (scale: TypographyScaleKey, value: TypographyScale) => void;
  updateColor: (colorKey: string, value: string) => void;
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

  const updateTypographyScale = useCallback((scale: TypographyScaleKey, value: TypographyScale) => {
    setThemeStylesDraft((prev) => ({
      ...prev,
      typography: {
        ...prev.typography,
        [scale]: value,
      },
    }));
  }, []);

  const updateColor = useCallback((colorKey: string, value: string) => {
    setThemeStylesDraft((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [colorKey]: value,
      },
    }));
  }, []);

  const value = useMemo(
    () => ({
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
