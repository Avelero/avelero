"use client";

import { type Passport, buildPassportStylesheet } from "@v1/dpp-components";
import { useEffect, useMemo } from "react";

type Props = {
  tokens?: Passport["tokens"];
};

export function PreviewThemeInjector({ tokens }: Props) {
  const css = useMemo(
    () => (tokens ? buildPassportStylesheet(tokens) : ""),
    [tokens],
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
