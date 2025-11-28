"use client";

import { useEffect, useMemo } from "react";
import { buildThemeStylesheet, type ThemeStyles } from "@v1/dpp-components";

type Props = {
  themeStyles?: ThemeStyles;
  className?: string;
};

export function PreviewThemeInjector({ themeStyles }: Props) {
  const css = useMemo(
    () =>
      buildThemeStylesheet({
        themeStyles,
        includeFontFaces: true,
      }),
    [themeStyles],
  );

  useEffect(() => {
    if (!css) return;
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-preview-theme", "dpp");
    styleEl.innerHTML = css;
    document.head.appendChild(styleEl);
    return () => {
      styleEl.remove();
    };
  }, [css]);

  return null;
}
