/**
 * Common Component Props
 */

import type { ThemeConfig, ThemeStyles } from '@v1/dpp-components';

export interface BaseComponentProps {
  themeConfig: ThemeConfig;
  themeStyles?: ThemeStyles;
  className?: string;
}

export interface SectionProps extends BaseComponentProps {
  isLast?: boolean;
}
