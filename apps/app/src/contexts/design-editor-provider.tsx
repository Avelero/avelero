"use client";

import {
  type DppData,
  type ThemeConfig,
  type ThemeStyles,
} from "@v1/dpp-components";
import { createContext, useContext, useMemo, useState } from "react";
import { saveThemeAction } from "@/actions/design/save-theme-action";

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

  const resetDrafts = () => {
    setThemeConfigDraft(initialThemeConfig);
    setThemeStylesDraft(initialThemeStyles);
  };

  const saveDrafts = async () => {
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
  };

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
    }),
    [
      themeConfigDraft,
      themeStylesDraft,
      initialThemeConfig,
      initialThemeStyles,
      hasUnsavedChanges,
      isSaving,
      previewData,
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
