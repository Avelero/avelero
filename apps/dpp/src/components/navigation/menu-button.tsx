import type { ThemeConfig } from '@/types/theme-config';
import { Icons } from '@v1/ui/icons';

interface Props {
  label: string;
  url: string;
  theme: ThemeConfig;
}

export function MenuButton({ label, url, theme }: Props) {
  const { colors } = theme;
  
  // Check if URL is external
  const isExternal = url.startsWith('http://') || url.startsWith('https://');
  
  return (
    <a
      href={url}
      target={isExternal ? '_blank' : undefined}
      rel={isExternal ? 'noopener noreferrer' : undefined}
      className="px-sm py-md flex justify-between items-center border-b cursor-pointer menu-button"
    >
      {label}
      <Icons.ChevronRight className="w-5 h-5" />
    </a>
  );
}
