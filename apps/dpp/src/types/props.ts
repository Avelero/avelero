/**
 * Common Component Props
 */

import type { ThemeConfig } from "./theme-config";
import type { ThemeStyles } from "./theme-styles";

export interface BaseComponentProps {
  themeConfig: ThemeConfig;
  themeStyles?: ThemeStyles;
  className?: string;
}

export interface SectionProps extends BaseComponentProps {
  isLast?: boolean;
}
