/**
 * Common Component Props
 */

import type { ThemeConfig } from './theme-config';

export interface BaseComponentProps {
  theme: ThemeConfig;
  className?: string;
}

export interface SectionProps extends BaseComponentProps {
  isLast?: boolean;
}


